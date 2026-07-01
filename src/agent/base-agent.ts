import {
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
import type { LanguageModelLike } from '@langchain/core/language_models/base';
import { z } from 'zod';

export interface MessageChunkInfo {
  id: string;
  text: string;
}

export interface ToolStartInfo {
  toolName: string;
  input: unknown;
  callId?: string | undefined;
}

export interface ToolEndInfo {
  toolName: string;
  output: unknown;
  callId?: string;
  isError?: boolean;
}

export interface BaseAgentCallbacks {
  onMessageChunk: (chunk: MessageChunkInfo) => void;
  onReasoningChunk: (chunk: MessageChunkInfo) => void;
  onToolStart: (info: ToolStartInfo) => void;
  onToolEnd: (info: ToolEndInfo) => void;
}

/**
 * Abstract base class that owns all LangGraph stream-handling logic.
 * Subclasses opt in to agent-specific behaviour via two protected hooks:
 *   - `shouldSkipTool(name)` which return true to suppress a tool from callbacks
 *   - `onMessageEmitted(id, text)` which is called after each text chunk is emitted
 */
export abstract class BaseAgent {
  protected emittedToolCallIds = new Set<string>();

  constructor(
    protected repoPath: string,
    protected llm: LanguageModelLike,
    protected callbacks: BaseAgentCallbacks,
    protected jdtlsPath?: string,
    protected jdltlsDataPath?: string
  ) {}

  /**
   * Return true to prevent a tool from being forwarded to onToolStart /
   * onToolEnd callbacks
   */
  protected shouldSkipTool(_toolName: string): boolean {
    void _toolName;
    return false;
  }

  /**
   * Called after every text chunk is emitted via onMessageChunk.
   * Subclasses may use this to track accumulated message text.
   */
  protected onMessageEmitted(_messageId: string, _text: string): void {
    void _messageId;
    void _text;
  }

  protected handleStreamUpdate(
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
                args: z.record(z.string(), z.any()),
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
        this.handleToolCalls(message.kwargs.tool_calls);
      }
    } catch (e) {
      console.error('Failed to parse agent update messages:', e);
    }
  }

  protected handleStreamMessage(event: unknown): void {
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

  protected handleAIMessageChunk(chunk: AIMessageChunk): void {
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

  protected handleToolMessage(message: ToolMessage): void {
    const toolName = message.name ?? 'tool';

    if (this.shouldSkipTool(toolName)) return;

    const callId = message.tool_call_id ?? undefined;
    const content = this.extractContentString(message.content);
    const output =
      typeof content === 'string' ? this.tryParseJson(content) : content;

    const isError = message.status !== 'success';

    const info: ToolEndInfo = { toolName, output };

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

  protected handleToolCalls(toolCalls: ToolCall[]): void {
    for (const call of toolCalls) {
      if (this.shouldSkipTool(call.name)) continue;

      if (call.id && this.emittedToolCallIds.has(call.id)) {
        continue;
      }

      if (call.id) {
        this.emittedToolCallIds.add(call.id);
      }

      this.callbacks.onToolStart({
        toolName: call.name,
        input: call.args,
        callId: call.id,
      });
    }
  }

  protected emitReasoningChunk(messageId: string, text: string): void {
    if (!text) return;
    this.callbacks.onReasoningChunk({ id: messageId, text });
  }

  protected emitMessageChunk(messageId: string, text: string): void {
    if (!text) return;
    this.onMessageEmitted(messageId, text);
    this.callbacks.onMessageChunk({ id: messageId, text });
  }

  protected asNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    return value;
  }

  protected extractContentString(content: unknown): string | null {
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

  protected tryParseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
