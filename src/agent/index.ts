import { ChatGoogle } from '@langchain/google-gauth';
import path from 'node:path';
import { createSystemPrompt } from './system-prompt.js';
import { getConflictingFiles } from '../context/conflicting-files.js';
import { readFile } from '../utils/read-file.js';
import { makeReadTool } from '../tools/read.js';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { makeEditTool } from '../tools/edit.js';
import { makeMultiEditTool } from '../tools/multi-edit.js';
import { makeLsTool } from '../tools/ls.js';
import { makeRipgrepTool } from '../tools/ripgrep.js';
import { makeGlobTool } from '../tools/glob.js';
import { makeGitBlameTool } from '../tools/git-blame.js';
import { makeGitDiffTool } from '../tools/git-diff.js';
import { makeGitLogTool } from '../tools/git-log.js';
import { makeGetChangedFilesTool } from '../tools/get-changed-files.js';
import { makeGetLastMergeCommitsTool } from '../tools/get-last-merge-commits.js';
import {
  gitMergeTarget,
  gitMergeBase,
  formatMergeInfo,
} from '../utils/git-utils.js';
import { dedent } from '../utils/dedent.js';
import { AIMessageChunk, ToolMessage } from '@langchain/core/messages';

import type { StructuredToolInterface } from '@langchain/core/tools';
import type { ToolContext } from '../utils/tool-context.js';
import type { FileEditOptions } from '../utils/edit-file.js';

export type StreamTextChunk = {
  id: string;
  text: string;
};

export type ConflictAgentCallbacks = {
  onMessageChunk?: (chunk: StreamTextChunk) => void;
  onReasoningChunk?: (chunk: StreamTextChunk) => void;
  /** @deprecated Use onReasoningChunk instead. */
  onThinking?: (chunk: string) => void;
  onToolStart?: (info: {
    toolName: string;
    input: unknown;
    callId?: string;
  }) => void;
  onToolEnd?: (info: {
    toolName: string;
    output: unknown;
    callId?: string;
  }) => void;
};

export class ConflictResolutionAgent {
  private callbacks: ConflictAgentCallbacks;
  private edits: FileEditOptions[] = [];
  private emittedToolCallIds = new Set<string>();

  constructor(
    private repoPath: string,
    callbacks: ConflictAgentCallbacks = {}
  ) {
    this.callbacks = callbacks;
  }

  setCallbacks(cb: ConflictAgentCallbacks) {
    this.callbacks = { ...this.callbacks, ...cb };
  }

  getEdits(): FileEditOptions[] {
    return this.edits;
  }

  async run(): Promise<FileEditOptions[]> {
    const conflictingFiles = await getConflictingFiles(this.repoPath);
    const conflictingFilesContent = await Promise.all(
      conflictingFiles.map(async (file) => {
        return {
          name: file,
          content: await readFile(path.join(this.repoPath, file)),
        };
      })
    );
    const context: ToolContext = { lastReadPath: null };
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

    const llm = new ChatGoogle({
      model: 'gemini-2.5-pro',
      // verbose: true,
      thinkingBudget: 24576, // Maximum thinking budget for Gemini 2.5 Flash
    });

    const tools: StructuredToolInterface[] = [
      makeReadTool(this.repoPath, context),
      makeEditTool(this.repoPath, this.edits, context),
      makeMultiEditTool(this.repoPath, this.edits, context),
      makeLsTool(this.repoPath),
      makeRipgrepTool(this.repoPath),
      makeGlobTool(this.repoPath),
      makeGitBlameTool(this.repoPath),
      makeGitDiffTool(this.repoPath),
      makeGitLogTool(this.repoPath),
      makeGetChangedFilesTool(this.repoPath),
      makeGetLastMergeCommitsTool(this.repoPath),
    ];

    const agent = createReactAgent({
      llm,
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
      ${conflictingFilesContent.map((file) => `<file name="${file.name}">\n${file.content}\n</file name="${file.name}">`).join('\n\n')}
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

    const stream = await agent.stream({ messages }, { streamMode: 'messages' });

    for await (const chunk of stream) {
      this.handleStreamEvent(chunk);
    }

    return this.edits;
  }

  private handleStreamEvent(event: unknown): void {
    if (Array.isArray(event)) {
      for (const item of event) {
        this.handleStreamEvent(item);
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
        if (!part || typeof part !== 'object') {
          continue;
        }

        const partType = (part as { type?: unknown }).type;

        if (
          partType === 'reasoning' &&
          typeof (part as { reasoning?: unknown }).reasoning === 'string'
        ) {
          this.emitReasoningChunk(
            messageId,
            (part as { reasoning: string }).reasoning
          );
        }

        if (
          partType === 'text' &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          this.emitMessageChunk(messageId, (part as { text: string }).text);
        }
      }
    } else {
      const text = this.asNonEmptyString(content);
      if (text) {
        this.emitMessageChunk(messageId, text);
      }
    }

    this.handleToolCalls(chunk.tool_calls);
  }

  private handleToolMessage(message: ToolMessage): void {
    const toolName = message.name ?? 'tool';
    const callId = message.tool_call_id ?? undefined;
    const content = this.extractContentString(message.content);
    const output =
      typeof content === 'string' ? this.tryParseJson(content) : content;

    if (this.callbacks.onToolEnd) {
      const info: {
        toolName: string;
        output: unknown;
        callId?: string;
      } = {
        toolName,
        output,
      };

      if (callId !== undefined) {
        info.callId = callId;
      }

      this.callbacks.onToolEnd(info);
    }

    if (callId) {
      this.emittedToolCallIds.delete(callId);
    }
  }

  private handleToolCalls(toolCalls: unknown): void {
    if (!Array.isArray(toolCalls)) {
      return;
    }

    for (const call of toolCalls) {
      if (!call || typeof call !== 'object') {
        continue;
      }

      const { id, name, args } = call as {
        id?: unknown;
        name?: unknown;
        args?: unknown;
      };

      if (typeof name !== 'string') {
        continue;
      }

      const callId = typeof id === 'string' ? id : undefined;
      if (callId && this.emittedToolCallIds.has(callId)) {
        continue;
      }

      if (callId) {
        this.emittedToolCallIds.add(callId);
      }

      if (this.callbacks.onToolStart) {
        const info: {
          toolName: string;
          input: unknown;
          callId?: string;
        } = {
          toolName: name,
          input: args,
        };

        if (callId !== undefined) {
          info.callId = callId;
        }

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

    if (this.callbacks.onThinking) {
      this.callbacks.onThinking(text);
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

    return value.trim().length > 0 ? value : null;
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
