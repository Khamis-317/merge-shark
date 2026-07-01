import { PromptTemplate } from '@langchain/core/prompts';
import { dedent } from '../../utils/dedent.js';
import type { EvalCase, RagResult, ToolCallLog } from '../types.js';
import {
  createJudgeModel,
  extractTextContent,
  parseJsonObject,
} from './utils.js';

export function extractAccessedFiles(toolCalls: ToolCallLog[]): Set<string> {
  const accessed = new Set<string>();

  for (const call of toolCalls) {
    if (call.toolName === 'read_file' || call.toolName === 'view_file') {
      const absolutePath = call.args['AbsolutePath'];
      const relativePath = call.args['path'];
      if (typeof absolutePath === 'string') accessed.add(absolutePath);
      if (typeof relativePath === 'string') accessed.add(relativePath);
    }
  }

  return accessed;
}

export function expectedFilesFromMetadata(evalCase: EvalCase): string[] {
  const metadata = evalCase.metadata;
  const files = new Set<string>();

  addString(files, metadata['file']);
  addString(files, metadata['filePath']);
  addString(files, metadata['sourceFile']);
  addStringArray(files, metadata['conflictingFiles']);
  addStringArray(files, metadata['expectedFiles']);
  addStringArray(files, metadata['relevantFiles']);

  return [...files].map(normalizeFilePath).filter(Boolean);
}

export async function resolveExpectedFiles(
  evalCase: EvalCase,
  options: { judgeModel?: string } = {}
): Promise<string[]> {
  const metadataFiles = expectedFilesFromMetadata(evalCase);
  if (metadataFiles.length > 0) {
    return metadataFiles;
  }

  if (!options.judgeModel) {
    return [];
  }

  return inferExpectedFilesWithJudge(evalCase, options.judgeModel);
}

export function evaluateRag(
  toolCalls: ToolCallLog[],
  expectedFiles: string[]
): RagResult {
  if (expectedFiles.length === 0) return { recall: 0, precision: 0, f1: 0 };

  const accessed = new Set(
    [...extractAccessedFiles(toolCalls)].map(normalizeFilePath)
  );
  const expected = new Set(expectedFiles.map(normalizeFilePath));

  let intersection = 0;
  for (const file of accessed) {
    if (expected.has(file)) intersection++;
  }

  const recall = expected.size > 0 ? intersection / expected.size : 0;
  const precision = accessed.size > 0 ? intersection / accessed.size : 0;
  const f1 =
    precision + recall > 0
      ? (2 * (precision * recall)) / (precision + recall)
      : 0;

  return { recall, precision, f1 };
}

function addString(files: Set<string>, value: unknown): void {
  if (typeof value === 'string' && value.trim()) {
    files.add(value);
  }
}

function addStringArray(files: Set<string>, value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    addString(files, item);
  }
}

function normalizeFilePath(filePath: string): string {
  return filePath.replaceAll('\\', '/').replace(/^\.\//, '').trim();
}

async function inferExpectedFilesWithJudge(
  evalCase: EvalCase,
  judgeModelName: string
): Promise<string[]> {
  const model = createJudgeModel(judgeModelName);
  const prompt = PromptTemplate.fromTemplate(dedent`
    Identify the repository files that are expected to be read or inspected to resolve this merge conflict.

    Return ONLY valid JSON with this shape:
    {{
      "expectedFiles": ["relative/path.ext"]
    }}

    Include only concrete file paths visible from the case metadata or conflict text. If no reliable file path can be inferred, return an empty array.

    Language: {language}

    Conflict type:
    {conflictType}

    Metadata:
    {metadata}

    Conflict context:
    {conflictContext}

    Conflict text:
    {conflictText}
    `);

  const response = await model.invoke(
    await prompt.format({
      language: evalCase.language,
      conflictType: evalCase.conflictType ?? 'unknown',
      metadata: JSON.stringify(evalCase.metadata, null, 2),
      conflictContext:
        evalCase.conflictContext ?? 'No additional context provided.',
      conflictText: evalCase.conflictText,
    })
  );

  const text = extractTextContent(response.content);
  const parsed = parseJsonObject(text);
  const expectedFiles = parsed?.['expectedFiles'];
  return Array.isArray(expectedFiles)
    ? expectedFiles
        .filter((file): file is string => typeof file === 'string')
        .map(normalizeFilePath)
        .filter(Boolean)
    : [];
}
