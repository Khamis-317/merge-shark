import { Box, Text } from 'ink';
import { useAgentResolution } from '../hooks/use-agent-resolution.js';
import { Header } from './live-resolution/header.js';
import { EventList } from './live-resolution/event-list.js';
import { StatusIndicator } from './live-resolution/status-indicator.js';
import { ErrorDisplay } from './live-resolution/error-display.js';
import type { LanguageModelLike } from '@langchain/core/language_models/base';

export interface LiveResolutionProps {
  repoPath: string;
  llm: LanguageModelLike;
  model: string;
  yolo: boolean;
}

export function LiveResolution({
  repoPath,
  llm,
  model,
  yolo = false,
}: LiveResolutionProps) {
  const { events, status, edits, error, onApprove, onReject } =
    useAgentResolution({ repoPath, llm, yolo });

  return (
    <Box flexDirection="column" paddingX={1} alignItems="stretch">
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        <Header />
        <Text color="blue">{model}</Text>
      </Box>

      {/* Render events in order - edit approval is now handled separately */}
      <EventList
        events={events}
        repoPath={repoPath}
        onApprove={onApprove}
        onReject={onReject}
      />

      {/* Progress indicator */}
      <StatusIndicator
        status={status}
        events={events}
        edits={edits}
        error={error}
      />

      {/* Error message */}
      <ErrorDisplay error={error} />
    </Box>
  );
}
