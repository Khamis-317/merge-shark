import { useState, useEffect } from 'react';
import { ConflictResolutionAgent } from '../../agent/conflict-resolution-agent.js';
import {
  ConflictRepository,
  createEmbedding,
  parseConflictBlock,
  type Conflict,
} from '../../memory/index.js';
import { gitCurrentBranch } from '../../utils/git-utils.js';
import type { FileEditOptions } from '../../utils/edit-file.js';
import type {
  ApprovalResult,
  BashCommandRequest,
} from '../../utils/tool-context.js';
import type { TodoItem } from '../../tools/manage-todo.js';
import type { LanguageModelLike } from '@langchain/core/language_models/base';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

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
      subAgentId?: string | undefined;
    }
  | {
      type: 'thinking';
      id: string;
      content: string;
      startTime: number;
      isComplete: boolean;
      subAgentId?: string | undefined;
    }
  | {
      type: 'tool';
      callId: string;
      name: string;
      input: unknown;
      output: unknown | null;
      state: ToolState;
      subAgentId?: string | undefined;
    }
  | {
      type: 'todo';
      todos: TodoItem[];
    };

export type SubAgentPane = {
  paneNumber: number;
  callId: string;
  goal: string;
  status: 'running' | 'complete' | 'failed';
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
  jdtlsPath?: string;
  jdltlsDataPath?: string;
}

export function useAgentResolution({
  repoPath,
  llm,
  yolo = false,
  jdtlsPath,
  jdltlsDataPath,
}: UseAgentResolutionOptions) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [subAgentPanes, setSubAgentPanes] = useState<SubAgentPane[]>([]);
  //null main pane, string is subagent callId
  const [activePane, setActivePane] = useState<string | null>(null);
  const [status, setStatus] = useState<AgentStatus>('resolving');
  const [edits, setEdits] = useState<FileEditOptions[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [approvalResolver, setApprovalResolver] = useState<
    ((result: ApprovalResult) => void) | null
  >(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);

  useEffect(() => {
    const agent = new ConflictResolutionAgent(
      repoPath,
      llm,
      {
        onMessageChunk: (chunk, subAgentId) => {
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
                subAgentId,
              },
            ];
          });
        },

        onReasoningChunk: (chunk, subAgentId) => {
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
                subAgentId,
              },
            ];
          });
        },

        onToolStart: (info, subAgentId) => {
          const callId = info.callId || `${info.toolName}-${Date.now()}`;

          if (!subAgentId && info.toolName === 'codebase_explorer') {
            setSubAgentPanes((prev) => [
              ...prev,
              {
                paneNumber: prev.length + 1,
                callId,
                goal: (info.input as { goal?: string })?.goal ?? 'Exploring...',
                status: 'running',
              },
            ]);
          }

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
                subAgentId,
              },
            ];
          });
        },

        onToolEnd: (info, subAgentId) => {
          const callId = info.callId || `${info.toolName}-${Date.now()}`;
          if (!subAgentId && info.toolName === 'codebase_explorer') {
            setSubAgentPanes((prev) =>
              prev.map((pane) =>
                pane.callId === callId
                  ? { ...pane, status: info.isError ? 'failed' : 'complete' }
                  : pane
              )
            );
          }
          const status = info.isError
            ? ('failed' as const)
            : ('complete' as const);
          setEvents((prev) =>
            prev.map((event) =>
              event.type === 'tool' && event.callId === callId
                ? {
                    ...event,
                    output: info.output,
                    state: { status },
                    subAgentId,
                  }
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
      },
      jdtlsPath,
      jdltlsDataPath
    );

    // Run the agent
    const runAgent = async () => {
      // Set up memory
      const memory = new ConflictRepository();
      try {
        await memory.connect();
        agent.memory = memory;
      } catch {
        // If memory not available, continue without past resolution context
      }

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

        // Save resolved conflicts to memory
        if (agent.memory) {
          // Resolve "HEAD" refs to the actual branch name
          let currentBranch: string | null = null;
          try {
            const name = await gitCurrentBranch(repoPath);
            if (name !== 'HEAD') currentBranch = name;
          } catch {
            // Not a git repo or detached HEAD, then keep "HEAD" as-is
          }

          for (const edit of resolvedEdits) {
            try {
              const parsed = parseConflictBlock(edit.oldText);
              if (!parsed) continue;

              const conflictText = `${parsed.baseChange}\n${parsed.incomingChange}`;
              const vector = await createEmbedding(conflictText);
              const fileType = path.extname(edit.path).slice(1);

              const conflict: Conflict = {
                id: randomUUID(),
                embeddedConflict: vector,
                baseBranch:
                  currentBranch && parsed.baseBranch === 'HEAD'
                    ? currentBranch
                    : parsed.baseBranch,
                incomingBranch:
                  currentBranch && parsed.incomingBranch === 'HEAD'
                    ? currentBranch
                    : parsed.incomingBranch,
                baseChange: parsed.baseChange,
                incomingChange: parsed.incomingChange,
                resolution: edit.newText,
                resolvedAt: new Date().toISOString(),
                fileType,
              };

              await agent.memory.save(conflict);
            } catch {
              // Ignore failures to save individual conflicts, continue with others
            }
          }
        }
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

  const activePaneEvents =
    activePane === null
      ? events.filter((e) => !('subAgentId' in e) || !e.subAgentId)
      : events.filter((e) => 'subAgentId' in e && e.subAgentId === activePane);
  return {
    events: activePaneEvents,
    status,
    edits,
    error,
    todos,
    subAgentPanes,
    activePane,
    setActivePane,
    onApprove: handleApprove,
    onReject: handleReject,
  };
}
