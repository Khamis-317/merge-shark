import { Box, Text } from 'ink';
import { useEffect, useState } from 'react';
import { ConflictResolutionAgent } from '../../agent/index.js';
import { SharkApp } from './shark-app.js';
import { Markdown } from './markdown.js';
import { ThinkingBlock } from './thinking-block.js';
import { ToolCallDisplay } from './tool-call-display.js';
import { ProgressIndicator } from './progress-indicator.js';
import { ReviewButton } from './review-button.js';
import type { FileEditOptions } from '../../utils/edit-file.js';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';

export interface LiveResolutionProps {
  agent: ConflictResolutionAgent;
  repoPath: string;
}

// Event types for the unified stream
type StreamEvent =
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
      status: 'running' | 'complete';
    };

type AgentStatus = 'resolving' | 'complete' | 'reviewing';

export function LiveResolution({ agent, repoPath }: LiveResolutionProps) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [status, setStatus] = useState<AgentStatus>('resolving');
  const [edits, setEdits] = useState<FileEditOptions[]>([]);

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
        setEvents((prev) =>
          prev.map((e) =>
            e.type === 'tool' && e.callId === callId
              ? { ...e, output: info.output, status: 'complete' as const }
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
      } catch (error) {
        console.error('Agent error:', error);
        setStatus('complete');
      }
    };

    runAgent();
  }, [agent]);

  const handleReview = () => {
    setStatus('reviewing');
  };

  if (status === 'reviewing') {
    return <SharkApp edits={edits} repoPath={repoPath} />;
  }

  return (
    <Box flexDirection="column" paddingX={1} alignItems="stretch">
      <Gradient name="cristal">
        <BigText text="Shark" font="block" />
      </Gradient>

      {/* Render events in order */}
      {events.map((event, index) => {
        const key = `${event.type}-${index}`;

        switch (event.type) {
          case 'message':
            return <Markdown key={key} content={event.content} />;

          case 'thinking':
            return (
              <ThinkingBlock
                key={key}
                content={event.content}
                isComplete={event.isComplete}
                startTime={event.startTime}
              />
            );

          case 'tool':
            return (
              <ToolCallDisplay
                key={key}
                toolName={event.name}
                input={event.input}
                output={event.output}
                status={event.status}
              />
            );

          default:
            return null;
        }
      })}

      {/* Progress indicator */}
      {status === 'resolving' && (
        <Box>
          <ProgressIndicator status="Resolving..." />
        </Box>
      )}

      {/* Review button when complete */}
      {status === 'complete' && edits.length > 0 && (
        <Box justifyContent="center" alignItems="center">
          <ReviewButton onReview={handleReview} />
        </Box>
      )}

      {/* No edits message */}
      {status === 'complete' && edits.length === 0 && (
        <Text color="yellow" bold>
          No conflicts to resolve.
        </Text>
      )}
    </Box>
  );
}
