import { createSystemPrompt } from './conflict-resolution-agent-prompt.js';
import { getConflictingFiles } from '../context/conflicting-files.js';
import {
  findRepoLevelAgentsMd,
  globAllAgentsMdPaths,
  collectDirectoryContexts,
  type AgentsMdContext,
} from '../context/agents-md.js';
import { makeReadTool } from '../tools/read.js';
import { createAgent } from 'langchain';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { TavilySearch } from '@langchain/tavily';
import { makeEditTool } from '../tools/edit.js';
import { makeLsTool } from '../tools/ls.js';
import { makeRipgrepTool } from '../tools/ripgrep.js';
import { makeGlobTool } from '../tools/glob.js';
import { makeBashTool } from '../tools/bash.js';
import { makeCodebaseExplorerTool } from '../tools/codebase-explorer.js';
import {
  makeManageTodoTool,
  MANAGE_TODO_TOOL_NAME,
  type TodoItem,
} from '../tools/manage-todo.js';
import {
  gitMergeTarget,
  gitMergeBase,
  formatMergeInfo,
} from '../utils/git-utils.js';
import { dedent } from '../utils/dedent.js';
import { BaseAgent, type BaseAgentCallbacks } from './base-agent.js';
import {
  ConflictRepository,
  createEmbedding,
  extractAllConflicts,
  type Conflict,
} from '../memory/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { ToolContext } from '../utils/tool-context.js';
import type { FileEditOptions } from '../utils/edit-file.js';
import type { LanguageModelLike } from '@langchain/core/language_models/base';
import type {
  ApprovalResult,
  BashCommandRequest,
} from '../utils/tool-context.js';

export type StreamTextChunk = {
  id: string;
  text: string;
};

export interface ConflictAgentCallbacks extends BaseAgentCallbacks {
  onMessageChunk: (chunk: StreamTextChunk, subAgentId?: string) => void;
  onReasoningChunk: (chunk: StreamTextChunk, subAgentId?: string) => void;
  onToolStart: (
    info: {
      toolName: string;
      input: unknown;
      callId?: string | undefined;
    },
    subAgentId?: string
  ) => void;
  onToolEnd: (
    info: {
      toolName: string;
      output: unknown;
      callId?: string;
      isError?: boolean;
    },
    subAgentId?: string
  ) => void;
  onEditRequested: (edit: FileEditOptions) => Promise<ApprovalResult>;
  onBashRequested: (request: BashCommandRequest) => Promise<ApprovalResult>;
  onTodoUpdate: (todos: TodoItem[]) => void;
}

export class ConflictResolutionAgent extends BaseAgent {
  private edits: FileEditOptions[] = [];

  constructor(
    repoPath: string,
    llm: LanguageModelLike,
    protected override callbacks: ConflictAgentCallbacks,
    public memory?: ConflictRepository
  ) {
    super(repoPath, llm, callbacks);
  }

  getEdits(): FileEditOptions[] {
    return this.edits;
  }

  private async queryPreviousResolutions(
    conflictingFiles: string[]
  ): Promise<string | null> {
    const blocks: string[] = [];
    const seenIds = new Set<string>();

    for (const file of conflictingFiles) {
      const absolutePath = path.resolve(this.repoPath, file);
      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf-8');
      } catch {
        continue;
      }

      const conflicts = extractAllConflicts(content);
      const fileType = path.extname(file).slice(1);
      if (!fileType || conflicts.length === 0) continue;

      for (const conflict of conflicts) {
        const conflictText = `${conflict.baseChange}\n${conflict.incomingChange}`;
        let vector: number[];
        try {
          vector = await createEmbedding(conflictText);
        } catch {
          continue;
        }

        try {
          const similar = await this.memory!.findSimilar(vector, fileType, 3);
          for (const record of similar) {
            if (seenIds.has(record.id)) continue;
            seenIds.add(record.id);
            blocks.push(this.formatPastResolution(record));
          }
        } catch {
          continue;
        }
      }
    }

    if (blocks.length === 0) return null;
    return blocks.join('\n');
  }

  private formatPastResolution(record: Conflict): string {
    return dedent`
      <resolution file_type="${record.fileType}" resolved_at="${record.resolvedAt}">
      <conflict>
        Base change:
        ${record.baseChange}

        Incoming change:
        ${record.incomingChange}
      </conflict>
      <outcome>
        ${record.resolution}
      </outcome>
      </resolution>
      `;
  }

  // prevent the internal todo tool from streaming callbacks
  protected override shouldSkipTool(toolName: string): boolean {
    return toolName === MANAGE_TODO_TOOL_NAME;
  }

  async run(): Promise<FileEditOptions[]> {
    const conflictingFiles = await getConflictingFiles(this.repoPath);

    const [repoLevel, agentsMdPaths] = await Promise.all([
      findRepoLevelAgentsMd(this.repoPath),
      globAllAgentsMdPaths(this.repoPath),
    ]);

    const agentsMdContext: AgentsMdContext = {
      repoPath: this.repoPath,
      agentsMdPaths,
      loadedPaths: new Set<string>(repoLevel ? [repoLevel.absolutePath] : []),
      processedDirs: new Set<string>(),
    };

    const context: ToolContext = {
      readFiles: new Map(),
      onEditRequested: this.callbacks.onEditRequested,
      onBashRequested: this.callbacks.onBashRequested,
      injectContext: (absolutePath: string) =>
        collectDirectoryContexts(absolutePath, agentsMdContext),
    };
    this.emittedToolCallIds.clear();

    // Try to get merge information (may fail in case of rebase)
    let mergeInfo: string | null = null;
    try {
      const mergeTarget = await gitMergeTarget(this.repoPath);
      const mergeBase = await gitMergeBase(this.repoPath, 'HEAD', mergeTarget);
      mergeInfo = formatMergeInfo(mergeTarget, mergeBase);
    } catch {
      // Merge info not available (likely a rebase operation)
      console.log(
        'Merge info not available - this might be a rebase operation'
      );
    }

    // Query past resolutions from memory
    let pastResolutions: string | null = null;
    if (this.memory) {
      try {
        pastResolutions = await this.queryPreviousResolutions(conflictingFiles);
      } catch (e) {
        console.log('Failed to query past resolutions:', e);
      }
    }

    const tools: StructuredToolInterface[] = [
      makeReadTool(this.repoPath, context),
      makeEditTool(this.repoPath, this.edits, context),
      makeLsTool(this.repoPath),
      makeRipgrepTool(this.repoPath),
      makeGlobTool(this.repoPath),
      makeBashTool(this.repoPath, context),
      makeManageTodoTool({
        onTodoUpdate: this.callbacks.onTodoUpdate,
      }),
      makeCodebaseExplorerTool(this.repoPath, this.llm, this.callbacks),
      // TavilySearch (@langchain/tavily) still ships a zod v3 input schema,
      // whose types are incompatible with this project's
      // `exactOptionalPropertyTypes`. It is a valid StructuredTool at runtime,
      // so cast it to the shared interface.
      new TavilySearch({
        tavilyApiKey: process.env[`TAVILY_API_KEY`]!,
      }) as StructuredToolInterface,
    ];

    const agent = createAgent({
      model: this.llm,
      tools,
    });

    const systemPrompt = createSystemPrompt({
      systemInfo: {
        operatingSystem: process.platform,
        date: new Date(),
        workingDirectory: this.repoPath,
      },
      mergeInfo,
      ...(repoLevel ? { agentsMdContent: repoLevel.content } : {}),
      ...(pastResolutions ? { pastResolutions } : {}),
    });

    const userPrompt = dedent`
      Resolve the conflicts in the following files:
      
      ${conflictingFiles.map((file) => `- ${file}`).join('\n')}
      `;

    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];

    const stream = await agent.stream(
      { messages },
      { streamMode: ['messages', 'updates'], recursionLimit: 500 }
    );

    for await (const [mode, chunk] of stream) {
      if (mode === 'updates') {
        this.handleStreamUpdate(chunk);
      } else {
        this.handleStreamMessage(chunk);
      }
    }

    return this.edits;
  }
}
