import { Box, Text } from 'ink';
import { ProgressIndicator } from '../progress-indicator.js';
import type {
  StreamEvent,
  AgentStatus,
} from '../../hooks/use-agent-resolution.js';
import type { FileEditOptions } from '../../../utils/edit-file.js';

interface StatusIndicatorProps {
  status: AgentStatus;
  events: StreamEvent[];
  edits: FileEditOptions[];
  error: Error | null;
}

function isInProgress(event?: StreamEvent) {
  if (!event) {
    return false;
  }

  switch (event.type) {
    case 'message':
      return false;
    case 'thinking':
      return !event.isComplete;
    case 'tool':
      return event.status === 'running';
  }
}

export function StatusIndicator({
  status,
  events,
  edits,
  error,
}: StatusIndicatorProps) {
  if (status === 'resolving' && !isInProgress(events.at(-1))) {
    return (
      <Box>
        <ProgressIndicator status="Resolving..." />
      </Box>
    );
  }

  if (status === 'complete' && edits.length === 0 && !error) {
    return (
      <Text color="yellow" bold>
        No conflicts to resolve.
      </Text>
    );
  }

  return null;
}
