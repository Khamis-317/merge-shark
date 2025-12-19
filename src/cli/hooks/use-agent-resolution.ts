import { useState, useEffect } from 'react';
import { ConflictResolutionAgent } from '../../agent/index.js';
import type { FileEditOptions } from '../../utils/edit-file.js';

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
      status: 'running' | 'complete' | 'failed';
    };

export type AgentStatus = 'resolving' | 'complete' | 'reviewing';

export function useAgentResolution(agent: ConflictResolutionAgent) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [status, setStatus] = useState<AgentStatus>('resolving');
  const [edits, setEdits] = useState<FileEditOptions[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Set up callbacks
    agent.setCallbacks({
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
          const updatedEvents = prev.map((e) =>
            e.type === 'thinking' && !e.isComplete
              ? { ...e, isComplete: true }
              : e
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
              status: 'running' as const,
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
          prev.map((e) =>
            e.type === 'tool' && e.callId === callId
              ? { ...e, output: info.output, status }
              : e
          )
        );
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
  }, [agent]);

  return {
    events,
    status,
    setStatus,
    edits,
    error,
  };
}
