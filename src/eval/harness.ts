import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ConflictResolutionAgent } from '../agent/conflict-resolution-agent.js';
import { models } from '../models/index.js';
import { dedent } from '../utils/dedent.js';
import type {
  EvalCase,
  HarnessResult,
  TokenUsage,
  ToolCallLog,
} from './types.js';
import { classifyToolCall } from './metrics/tool-taxonomy.js';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

export interface FullRepoRunOptions {
  agent: string;
  modelName: string;
  command?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(
  record: Record<string, unknown> | undefined,
  key: string
): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' ? value : undefined;
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (isRecord(part) && typeof part['text'] === 'string') {
          return part['text'];
        }
        return '';
      })
      .join('');
  }

  return String(content ?? '');
}

function extractResolution(content: string): string {
  const match = content.match(/```[\w#+.-]*\s*\n([\s\S]*?)```/);
  return match?.[1] ? match[1].trim() : content.trim();
}

function extractTokenUsage(response: unknown): TokenUsage {
  const responseRecord = isRecord(response) ? response : undefined;
  const metadata = isRecord(responseRecord?.['response_metadata'])
    ? responseRecord['response_metadata']
    : undefined;
  const tokenUsage = isRecord(metadata?.['tokenUsage'])
    ? metadata['tokenUsage']
    : undefined;
  const usageMetadata = isRecord(responseRecord?.['usage_metadata'])
    ? responseRecord['usage_metadata']
    : undefined;

  const promptTokens =
    readNumber(tokenUsage, 'promptTokens') ??
    readNumber(usageMetadata, 'input_tokens') ??
    0;
  const completionTokens =
    readNumber(tokenUsage, 'completionTokens') ??
    readNumber(usageMetadata, 'output_tokens') ??
    0;
  const totalTokens =
    readNumber(tokenUsage, 'totalTokens') ??
    readNumber(usageMetadata, 'total_tokens') ??
    promptTokens + completionTokens;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

export async function runSnippetMode(
  evalCase: EvalCase,
  modelName: string
): Promise<HarnessResult> {
  const model = createEvalModel(modelName);

  const prompt = PromptTemplate.fromTemplate(dedent`
    You are an expert in code merge conflicts. Please resolve the following conflict.
    Output ONLY the resolved code block, starting with \`\`\`{language} and ending with \`\`\`.

    Conflict Context:
    {conflictContext}

    Conflict:
    {conflictText}
    `);

  const formattedPrompt = await prompt.format({
    language: evalCase.language,
    conflictContext:
      evalCase.conflictContext || 'No additional context provided.',
    conflictText: evalCase.conflictText,
  });

  const startTime = Date.now();
  const response = await model.invoke(formattedPrompt);
  const durationMs = Date.now() - startTime;

  const content = extractTextContent(
    isRecord(response) && 'content' in response ? response['content'] : response
  );
  const resolution = extractResolution(content);
  const tokenUsage = extractTokenUsage(response);

  return {
    resolution,
    toolCalls: [],
    tokenUsage,
    durationMs,
    editsFirstTry: true,
  };
}

export async function runFullRepoMode(
  evalCase: EvalCase,
  options: FullRepoRunOptions
): Promise<HarnessResult> {
  if (!evalCase.repoPath) {
    throw new Error(`Full repo case ${evalCase.id} is missing repoPath.`);
  }

  const sourceRepoPath = evalCase.repoPath;
  const runName =
    options.agent === 'merge-shark' ? options.modelName : options.agent;
  const workingRepoPath = await copyRepoForRun(
    sourceRepoPath,
    evalCase.id,
    runName
  );
  evalCase.repoPath = workingRepoPath;
  evalCase.metadata = {
    ...evalCase.metadata,
    sourceRepoPath,
    workingRepoPath,
  };

  if (options.agent !== 'merge-shark') {
    return runCommandAgent(evalCase, workingRepoPath, options);
  }

  const model = createEvalModel(options.modelName);
  const toolCalls: HarnessResult['toolCalls'] = [];
  const toolCategoriesByCallId = new Map<
    string,
    HarnessResult['toolCalls'][number]['category']
  >();
  const messages: string[] = [];
  const reasoningChunks: string[] = [];
  const startTime = Date.now();

  const agent = new ConflictResolutionAgent(workingRepoPath, model, {
    onMessageChunk: (chunk) => {
      messages.push(chunk.text);
    },
    onReasoningChunk: (chunk) => {
      reasoningChunks.push(chunk.text);
    },
    onToolStart: (info) => {
      const toolCall = withToolCategory({
        toolName: info.toolName,
        args: isRecord(info.input) ? info.input : { input: info.input },
        ...(info.callId ? { result: `started:${info.callId}` } : {}),
      });
      if (info.callId) {
        toolCategoriesByCallId.set(info.callId, toolCall.category);
      }
      toolCalls.push(toolCall);
    },
    onToolEnd: (info) => {
      const category = info.callId
        ? toolCategoriesByCallId.get(info.callId)
        : undefined;
      const toolCall = withToolCategory({
        toolName: info.toolName,
        ...(category ? { category } : {}),
        args: {},
        result:
          typeof info.output === 'string'
            ? info.output
            : JSON.stringify(info.output),
        ...(info.isError ? { error: 'tool error' } : {}),
      });
      toolCalls.push(toolCall);
    },
    onEditRequested: async () => ({ approved: true }),
    onBashRequested: async () => ({ approved: true }),
    onTodoUpdate: () => {},
  });

  const edits = await agent.run();
  const durationMs = Date.now() - startTime;
  const resolution = await repoSummary(workingRepoPath);
  const reasoning = [reasoningChunks.join(''), messages.join('')]
    .filter(Boolean)
    .join('\n\n');

  return {
    resolution,
    reasoning,
    toolCalls,
    tokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    durationMs,
    editsFirstTry: edits.length > 0,
  };
}

async function runCommandAgent(
  evalCase: EvalCase,
  workingRepoPath: string,
  options: FullRepoRunOptions
): Promise<HarnessResult> {
  if (!options.command) {
    throw new Error(
      `No command configured for external agent ${options.agent}. Pass --agent-command ${options.agent}=<command>.`
    );
  }

  const command = options.command
    .replaceAll('{repo}', shellQuote(workingRepoPath))
    .replaceAll('{caseId}', shellQuote(evalCase.id));

  const startTime = Date.now();
  const commandResult = await runExternalCommand(command, workingRepoPath);
  const { output, error } = commandResult;

  const durationMs = Date.now() - startTime;
  const resolution = await repoSummary(workingRepoPath);

  return {
    resolution,
    reasoning: output,
    toolCalls: [
      withToolCategory({
        toolName: options.agent,
        category: 'command',
        args: { command },
        result: output,
        ...(error ? { error } : {}),
      }),
    ],
    tokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    durationMs,
    editsFirstTry: !error,
  };
}

async function runExternalCommand(
  command: string,
  workingRepoPath: string
): Promise<{ output: string; error?: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workingRepoPath,
      env: { ...process.env, GIT_EDITOR: 'true' },
      maxBuffer: 1024 * 1024 * 20,
    });
    return { output: [stdout, stderr].filter(Boolean).join('\n') };
  } catch (err: unknown) {
    const execError = err as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    return {
      output: [execError.stdout, execError.stderr].filter(Boolean).join('\n'),
      error: execError.message ?? 'Command agent failed.',
    };
  }
}

function withToolCategory(toolCall: ToolCallLog): ToolCallLog {
  return {
    ...toolCall,
    category: toolCall.category ?? classifyToolCall(toolCall),
  };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function createEvalModel(modelName: string) {
  const configuredModel = models[modelName];
  if (configuredModel) {
    return configuredModel.factory();
  }

  if (modelName.startsWith('gemini')) {
    return new ChatGoogleGenerativeAI({ model: modelName, temperature: 0.1 });
  }

  return new ChatOpenAI({ model: modelName, temperature: 0.1 });
}

async function copyRepoForRun(
  repoPath: string,
  caseId: string,
  modelName: string
): Promise<string> {
  const runsDir = path.resolve(process.cwd(), 'eval-worktrees');
  await fs.mkdir(runsDir, { recursive: true });

  const runId = `${sanitizePathSegment(modelName)}-${sanitizePathSegment(caseId)}-${Date.now()}`;
  const destination = path.join(runsDir, runId);
  await fs.cp(repoPath, destination, { recursive: true, errorOnExist: true });
  return destination;
}

function sanitizePathSegment(value: string): string {
  return (
    value.replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '') || 'case'
  );
}

async function repoSummary(repoPath: string): Promise<string> {
  try {
    const [{ stdout: status }, { stdout: diff }] = await Promise.all([
      execFileAsync('git', ['status', '--short'], { cwd: repoPath }),
      execFileAsync('git', ['diff', '--stat'], { cwd: repoPath }),
    ]);

    return [
      `Working repository: ${repoPath}`,
      'Git status:',
      status.trim() || '(clean)',
      'Diff stat:',
      diff.trim() || '(no diff)',
    ].join('\n');
  } catch {
    return `Working repository: ${repoPath}`;
  }
}
