import { createSystemPrompt } from './system-prompt.js';
import { getConflictingFiles } from '../context/conflicting-files.js';
import { makeReadTool } from '../tools/read.js';
import {
  createAgent,
  AIMessageChunk,
  BaseMessage,
  ToolMessage,
  DynamicStructuredTool,
  type ContentBlock,
  type ToolCall,
} from 'langchain';
import { makeEditTool } from '../tools/edit.js';
import { makeLsTool } from '../tools/ls.js';
import { makeRipgrepTool } from '../tools/ripgrep.js';
import { makeGlobTool } from '../tools/glob.js';
import { makeGitBlameTool } from '../tools/git-blame.js';
import { makeGitDiffTool } from '../tools/git-diff.js';
import { makeGitLogTool } from '../tools/git-log.js';
import { makeGetChangedFilesTool } from '../tools/get-changed-files.js';
import { makeGetLastMergeCommitsTool } from '../tools/get-last-merge-commits.js';
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
import { z } from 'zod';

import type { ToolContext } from '../utils/tool-context.js';
import type { FileEditOptions } from '../utils/edit-file.js';
import type {
  BinaryOperatorAggregate,
  Messages,
  UpdateType,
} from '@langchain/langgraph';
import type { LanguageModelLike } from '@langchain/core/language_models/base';
import type { EditApprovalResult } from '../utils/tool-context.js';

export type StreamTextChunk = {
  id: string;
  text: string;
};

export interface ConflictAgentCallbacks {
  onMessageChunk?: (chunk: StreamTextChunk) => void;
  onReasoningChunk?: (chunk: StreamTextChunk) => void;
  onToolStart?: (info: {
    toolName: string;
    input: unknown;
    callId?: string | undefined;
  }) => void;
  onToolEnd?: (info: {
    toolName: string;
    output: unknown;
    callId?: string;
    isError?: boolean;
  }) => void;
  onEditRequested?: (edit: FileEditOptions) => Promise<EditApprovalResult>;
  onTodoUpdate?: (todos: TodoItem[]) => void;
}

export class ConflictResolutionAgent {
  private callbacks: ConflictAgentCallbacks;
  private edits: FileEditOptions[] = [];
  private emittedToolCallIds = new Set<string>();

  constructor(
    private repoPath: string,
    private llm: LanguageModelLike,
    callbacks: ConflictAgentCallbacks = {}
  ) {
    this.callbacks = callbacks;
  }

  setCallbacks(cb: ConflictAgentCallbacks) {
    this.callbacks = { ...this.callbacks, ...cb };
  }

  getCallbacks(): ConflictAgentCallbacks {
    return this.callbacks;
  }

  getEdits(): FileEditOptions[] {
    return this.edits;
  }

  async run(): Promise<FileEditOptions[]> {
    const conflictingFiles = await getConflictingFiles(this.repoPath);
    const context: ToolContext = {
      readFiles: new Map(),
      ...(this.callbacks.onEditRequested && {
        onEditRequested: this.callbacks.onEditRequested,
      }),
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

    const tools: DynamicStructuredTool[] = [
      makeReadTool(this.repoPath, context),
      makeEditTool(this.repoPath, this.edits, context),
      makeLsTool(this.repoPath),
      makeRipgrepTool(this.repoPath),
      makeGlobTool(this.repoPath),
      makeGitBlameTool(this.repoPath),
      makeGitDiffTool(this.repoPath),
      makeGitLogTool(this.repoPath),
      makeGetChangedFilesTool(this.repoPath),
      makeGetLastMergeCommitsTool(this.repoPath),
      makeManageTodoTool({
        ...(this.callbacks.onTodoUpdate && {
          onTodoUpdate: this.callbacks.onTodoUpdate,
        }),
      }),
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

  private handleStreamUpdate(
    chunk: Record<
      string | number | symbol,
      UpdateType<{ messages: BinaryOperatorAggregate<BaseMessage[], Messages> }>
    >
  ): void {
    if (!('model_request' in chunk)) {
      return;
    }
    const agentUpdate = chunk['model_request'];

    const schema = z.array(
      z.object({
        kwargs: z.object({
          tool_calls: z
            .array(
              z.object({
                name: z.string(),
                args: z.record(z.any()),
                id: z.string(),
              })
            )
            .optional()
            .default([]),
        }),
      })
    );

    try {
      const recordified = JSON.parse(JSON.stringify(agentUpdate.messages));
      const messages = schema.parse(recordified);
      for (const message of messages) {
        const toolCalls = message.kwargs.tool_calls;

        this.handleToolCalls(toolCalls);
      }
    } catch (e) {
      console.error('Failed to parse agent update messages:', e);
    }
  }

  private handleStreamMessage(event: unknown): void {
    if (Array.isArray(event)) {
      for (const item of event) {
        this.handleStreamMessage(item);
      }
      return;
    }

    if (event instanceof AIMessageChunk) {
      this.handleAIMessageChunk(event);
      return;
    }

    if (event instanceof ToolMessage) {
      this.handleToolMessage(event);
    }
  }

  private handleAIMessageChunk(chunk: AIMessageChunk): void {
    const messageId = chunk.id ?? 'ai-message';
    const content = chunk.content;

    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === 'reasoning') {
          this.emitReasoningChunk(
            messageId,
            (part as ContentBlock.Reasoning).reasoning
          );
        }

        if (part.type === 'text') {
          this.emitMessageChunk(messageId, (part as ContentBlock.Text).text);
        }
      }
    } else {
      const text = this.asNonEmptyString(content);
      if (text) {
        this.emitMessageChunk(messageId, text);
      }
    }
  }

  private handleToolMessage(message: ToolMessage): void {
    const toolName = message.name ?? 'tool';

    // Tool updates are handled through onTodoUpdate
    if (toolName === MANAGE_TODO_TOOL_NAME) return;

    const callId = message.tool_call_id ?? undefined;
    const content = this.extractContentString(message.content);
    const output =
      typeof content === 'string' ? this.tryParseJson(content) : content;

    const isError = message.status !== 'success';

    if (this.callbacks.onToolEnd) {
      const info: {
        toolName: string;
        output: unknown;
        callId?: string;
        isError?: boolean;
      } = {
        toolName,
        output,
      };

      if (callId !== undefined) {
        info.callId = callId;
      }

      if (isError) {
        info.isError = true;
      }

      this.callbacks.onToolEnd(info);
    }

    if (callId) {
      this.emittedToolCallIds.delete(callId);
    }
  }

  private handleToolCalls(toolCalls: ToolCall[]): void {
    for (const call of toolCalls) {
      // Tool updates are handled through onTodoUpdate
      if (call.name === MANAGE_TODO_TOOL_NAME) return;

      if (call.id && this.emittedToolCallIds.has(call.id)) {
        continue;
      }

      if (call.id) {
        this.emittedToolCallIds.add(call.id);
      }

      if (this.callbacks.onToolStart) {
        const info = {
          toolName: call.name,
          input: call.args,
          callId: call.id,
        };

        this.callbacks.onToolStart(info);
      }
    }
  }

  private emitReasoningChunk(messageId: string, text: string): void {
    if (!text) {
      return;
    }

    const chunk = { id: messageId, text };

    if (this.callbacks.onReasoningChunk) {
      this.callbacks.onReasoningChunk(chunk);
    }
  }

  private emitMessageChunk(messageId: string, text: string): void {
    if (!text) {
      return;
    }

    if (this.callbacks.onMessageChunk) {
      this.callbacks.onMessageChunk({ id: messageId, text });
    }
  }

  private asNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    return value;
  }

  private extractContentString(content: unknown): string | null {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const parts = content
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }

          if (part && typeof part === 'object') {
            if (
              'text' in part &&
              typeof (part as { text?: unknown }).text === 'string'
            ) {
              return (part as { text: string }).text;
            }
          }

          return null;
        })
        .filter((part): part is string => {
          return typeof part === 'string' && part.length > 0;
        });

      if (parts.length > 0) {
        return parts.join('\n');
      }
    }

    return null;
  }

  private tryParseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
