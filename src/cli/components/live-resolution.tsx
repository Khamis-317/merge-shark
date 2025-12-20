import { Box, Text } from 'ink';
import { ConflictResolutionAgent } from '../../agent/index.js';
import { useAgentResolution } from '../hooks/use-agent-resolution.js';
import { Header } from './live-resolution/header.js';
import { EventList } from './live-resolution/event-list.js';
import { StatusIndicator } from './live-resolution/status-indicator.js';
import { ErrorDisplay } from './live-resolution/error-display.js';

export interface LiveResolutionProps {
  agent: ConflictResolutionAgent;
  repoPath: string;
  model: string;
}

export function LiveResolution({
  agent,
  repoPath,
  model,
}: LiveResolutionProps) {
  const { events, status, edits, error, onApproveEdit, onRejectEdit } =
    useAgentResolution(agent);

  return (
    <Box flexDirection="column" paddingX={1} alignItems="stretch">
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        <Header />
        <Text color="blue">{model}</Text>
      </Box>

      {/* Render events in order - edit approval is now handled within ToolCallDisplay */}
      <EventList
        events={events}
        repoPath={repoPath}
        onApproveEdit={onApproveEdit}
        onRejectEdit={onRejectEdit}
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
