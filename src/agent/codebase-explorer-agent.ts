import type { StructuredTool } from 'langchain';
import type { BaseToolContext } from '../utils/tool-context.js';
import type { StreamTextChunk } from './conflict-resolution-agent.js';
import type { LanguageModelLike } from '@langchain/core/language_models/base';
import { createExplorerAgentPrompt } from './codebase-explorer-agent-prompt.js';
import {
  createAgent,
  AIMessageChunk,
  BaseMessage,
  ToolMessage,
  type ContentBlock,
  type ToolCall,
} from 'langchain';
import type {
  BinaryOperatorAggregate,
  Messages,
  UpdateType,
} from '@langchain/langgraph';
import { makeReadTool } from '../tools/read.js';
import { makeLsTool } from '../tools/ls.js';
import { makeRipgrepTool } from '../tools/ripgrep.js';
import { makeGlobTool } from '../tools/glob.js';
import { dedent } from '../utils/dedent.js';
import { z } from 'zod';

export interface CodebaseExplorerAgentCallbacks {
  onMessageChunk: (chunk: StreamTextChunk) => void;
  onReasoningChunk: (chunk: StreamTextChunk) => void;
  onToolStart: (info: {
    toolName: string;
    input: unknown;
    callId?: string | undefined;
  }) => void;
  onToolEnd: (info: {
    toolName: string;
    output: unknown;
    callId?: string;
    isError?: boolean;
  }) => void;
}

interface ExplorationRequest {
  goal: string;
  startPaths?: string[];
}

interface ExplorationResult {
  findings: string;
  filesRead: string[];
}

export class CodebaseExplorerAgent {
  private emittedToolCallIds = new Set<string>();
  private messageTextById = new Map<string, string>();
  private lastMessageId: string | null = null;

  constructor(
    private repoPath: string,
    private llm: LanguageModelLike,
    private callbacks: CodebaseExplorerAgentCallbacks
  ) {}

  async explore(request: ExplorationRequest): Promise<ExplorationResult> {
    const context: BaseToolContext = {
      readFiles: new Map(),
    };
    this.emittedToolCallIds.clear();
    this.messageTextById.clear();
    this.lastMessageId = null;

    const tools: StructuredTool[] = [
      makeReadTool(this.repoPath, context),
      makeLsTool(this.repoPath),
      makeRipgrepTool(this.repoPath),
      makeGlobTool(this.repoPath),
    ];

    const agent = createAgent({
      model: this.llm,
      tools,
    });

    const systemPrompt = createExplorerAgentPrompt(this.repoPath);
    const userPrompt = dedent`
            Explore the codebase to achieve the following goal:
            ${request.goal}
            Start Your Exploration From the following paths:
            ${request.startPaths && request.startPaths.length > 0 ? request.startPaths.join('\n') : this.repoPath}
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
      { streamMode: ['messages', 'updates'], recursionLimit: 1000 }
    );
    for await (const [mode, chunk] of stream) {
      if (mode === 'updates') {
        this.handleStreamUpdate(chunk);
      } else {
        this.handleStreamMessage(chunk);
      }
    }

    return this.generateExplorationResult(context);
  }

  private async generateExplorationResult(
    context: BaseToolContext
  ): Promise<ExplorationResult> {
    const findings = this.lastMessageId
      ? (this.messageTextById.get(this.lastMessageId) ?? '')
      : '';

    return {
      findings,
      filesRead: Array.from(context.readFiles.keys()),
    };
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
    const callId = message.tool_call_id ?? undefined;
    const content = this.extractContentString(message.content);
    const output =
      typeof content === 'string' ? this.tryParseJson(content) : content;

    const isError = message.status !== 'success';

    const info: {
      toolName: string;
      output: unknown;
      callId?: string;
      isError?: boolean;
    } = {
      toolName,
      output,
    };

    if (callId) {
      info.callId = callId;
    }

    if (isError) {
      info.isError = true;
    }

    this.callbacks.onToolEnd(info);

    if (callId) {
      this.emittedToolCallIds.delete(callId);
    }
  }

  private handleToolCalls(toolCalls: ToolCall[]): void {
    for (const call of toolCalls) {
      if (call.id && this.emittedToolCallIds.has(call.id)) {
        continue;
      }

      if (call.id) {
        this.emittedToolCallIds.add(call.id);
      }

      const info = {
        toolName: call.name,
        input: call.args,
        callId: call.id,
      };

      this.callbacks.onToolStart(info);
    }
  }

  private emitReasoningChunk(messageId: string, text: string): void {
    if (!text) {
      return;
    }

    this.callbacks.onReasoningChunk({ id: messageId, text });
  }

  private emitMessageChunk(messageId: string, text: string): void {
    if (!text) {
      return;
    }
    // Tracing for Findings Generation
    const previous = this.messageTextById.get(messageId) ?? '';
    this.messageTextById.set(messageId, `${previous}${text}`);
    this.lastMessageId = messageId;

    this.callbacks.onMessageChunk({ id: messageId, text });
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
