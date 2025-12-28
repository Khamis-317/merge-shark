import { useState, useEffect } from 'react';
import { ConflictResolutionAgent } from '../../agent/index.js';
import type { FileEditOptions } from '../../utils/edit-file.js';
import type {
  ApprovalResult,
  BashCommandRequest,
} from '../../utils/tool-context.js';
import type { TodoItem } from '../../tools/manage-todo.js';
import type { LanguageModelLike } from '@langchain/core/language_models/base';

export type ToolState =
  | { status: 'running' | 'complete' | 'failed' }
  | { status: 'awaiting-edit-approval'; edit: FileEditOptions }
  | { status: 'awaiting-bash-approval'; request: BashCommandRequest };

// Event types for the unified stream
export type StreamEvent =
  | {
      type: 'message';
      id: string;
      content: string;
    }
  | {
      type: 'thinking';
      id: string;
      content: string;
      startTime: number;
      isComplete: boolean;
    }
  | {
      type: 'tool';
      callId: string;
      name: string;
      input: unknown;
      output: unknown | null;
      state: ToolState;
    }
  | {
      type: 'todo';
      todos: TodoItem[];
    };

export type AgentStatus =
  | 'resolving'
  | 'complete'
  | 'reviewing'
  | 'awaiting-approval';

export interface UseAgentResolutionOptions {
  repoPath: string;
  llm: LanguageModelLike;
  yolo?: boolean;
}

export function useAgentResolution({
  repoPath,
  llm,
  yolo = false,
}: UseAgentResolutionOptions) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [status, setStatus] = useState<AgentStatus>('resolving');
  const [edits, setEdits] = useState<FileEditOptions[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [approvalResolver, setApprovalResolver] = useState<
    ((result: ApprovalResult) => void) | null
  >(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);

  useEffect(() => {
    const agent = new ConflictResolutionAgent(repoPath, llm, {
      onMessageChunk: (chunk) => {
        setEvents((prev) => {
          const existingIndex = prev.findIndex(
            (e) => e.type === 'message' && e.id === chunk.id
          );

          if (existingIndex >= 0) {
            // Update existing message
            const existing = prev[existingIndex] as Extract<
              StreamEvent,
              { type: 'message' }
            >;
            return prev.map((e, i) =>
              i === existingIndex
                ? { ...existing, content: existing.content + chunk.text }
                : e
            );
          }

          // Add new message
          return [
            ...prev,
            {
              type: 'message' as const,
              id: chunk.id,
              content: chunk.text,
            },
          ];
        });
      },

      onReasoningChunk: (chunk) => {
        setEvents((prev) => {
          const existingIndex = prev.findIndex(
            (e) => e.type === 'thinking' && e.id === chunk.id
          );

          if (existingIndex >= 0) {
            // Update existing thinking block
            const existing = prev[existingIndex] as Extract<
              StreamEvent,
              { type: 'thinking' }
            >;
            return prev.map((e, i) =>
              i === existingIndex
                ? { ...existing, content: existing.content + chunk.text }
                : e
            );
          }

          // Add new thinking block
          return [
            ...prev,
            {
              type: 'thinking' as const,
              id: chunk.id,
              content: chunk.text,
              startTime: Date.now(),
              isComplete: false,
            },
          ];
        });
      },

      onToolStart: (info) => {
        const callId = info.callId || `${info.toolName}-${Date.now()}`;

        setEvents((prev) => {
          // Mark any active thinking as complete
          const updatedEvents = prev.map((event) =>
            event.type === 'thinking' && !event.isComplete
              ? { ...event, isComplete: true }
              : event
          );

          // Add new tool call
          return [
            ...updatedEvents,
            {
              type: 'tool' as const,
              callId,
              name: info.toolName,
              input: info.input,
              output: null,
              state: { status: 'running' },
            },
          ];
        });
      },

      onToolEnd: (info) => {
        const callId = info.callId || `${info.toolName}-${Date.now()}`;
        const status = info.isError
          ? ('failed' as const)
          : ('complete' as const);
        setEvents((prev) =>
          prev.map((event) =>
            event.type === 'tool' && event.callId === callId
              ? { ...event, output: info.output, state: { status } }
              : event
          )
        );
      },

      onEditRequested: async (edit) => {
        // Auto-approve in yolo mode
        if (yolo) {
          return { approved: true };
        }

        setEvents((prev) => {
          const lastIndex = prev.length - 1;
          const lastEvent = prev[lastIndex];

          if (!lastEvent || lastEvent.type !== 'tool') return prev;

          return [
            ...prev.slice(0, lastIndex),
            {
              ...lastEvent,
              state: { status: 'awaiting-edit-approval', edit },
            },
          ];
        });

        // Return a promise that will be resolved when the user approves/rejects
        return new Promise<ApprovalResult>((resolve) => {
          setStatus('awaiting-approval');
          setApprovalResolver(() => resolve);
        });
      },

      onBashRequested: async (request) => {
        // Auto-approve in yolo mode
        if (yolo) {
          return { approved: true };
        }

        setEvents((prev) => {
          const lastIndex = prev.length - 1;
          const lastEvent = prev[lastIndex];

          if (!lastEvent || lastEvent.type !== 'tool') return prev;

          return [
            ...prev.slice(0, lastIndex),
            {
              ...lastEvent,
              state: { status: 'awaiting-bash-approval', request },
            },
          ];
        });

        // Return a promise that will be resolved when the user approves/rejects
        return new Promise<ApprovalResult>((resolve) => {
          setStatus('awaiting-approval');
          setApprovalResolver(() => resolve);
        });
      },

      onTodoUpdate: (updatedTodos: TodoItem[]) => {
        setTodos(updatedTodos);
        setEvents((prev) => {
          // Remove previous todo event if exists and add new one
          const filteredEvents = prev.filter((e) => e.type !== 'todo');
          return [
            ...filteredEvents,
            {
              type: 'todo' as const,
              todos: updatedTodos,
            },
          ];
        });
      },
    });

    // Run the agent
    const runAgent = async () => {
      try {
        const resolvedEdits = await agent.run();
        setEdits(resolvedEdits);
        setStatus('complete');

        // Mark any remaining thinking as complete
        setEvents((prev) =>
          prev.map((e) =>
            e.type === 'thinking' && !e.isComplete
              ? { ...e, isComplete: true }
              : e
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('complete');
      }
    };

    runAgent();
  }, [repoPath, llm]);

  const handleApprove = () => {
    if (approvalResolver) {
      approvalResolver({ approved: true });
      setApprovalResolver(null);
      setStatus('resolving');
    }
  };

  const handleReject = (feedback?: string) => {
    if (approvalResolver) {
      approvalResolver({ approved: false, feedback: feedback });
      setApprovalResolver(null);
      setStatus('resolving');
    }
  };

  return {
    events,
    status,
    edits,
    error,
    todos,
    onApprove: handleApprove,
    onReject: handleReject,
  };
}
