import { Box } from 'ink';
import { ConflictResolutionAgent } from '../../agent/index.js';
import { SharkApp } from './shark-app.js';
import { ReviewButton } from './review-button.js';
import { useAgentResolution } from '../hooks/use-agent-resolution.js';
import { Header } from './live-resolution/header.js';
import { EventList } from './live-resolution/event-list.js';
import { StatusIndicator } from './live-resolution/status-indicator.js';
import { ErrorDisplay } from './live-resolution/error-display.js';

export interface LiveResolutionProps {
  agent: ConflictResolutionAgent;
  repoPath: string;
}

export function LiveResolution({ agent, repoPath }: LiveResolutionProps) {
  const { events, status, setStatus, edits, error } = useAgentResolution(agent);

  const handleReview = () => {
    setStatus('reviewing');
  };

  if (status === 'reviewing') {
    return <SharkApp edits={edits} repoPath={repoPath} />;
  }

  return (
    <Box flexDirection="column" paddingX={1} alignItems="stretch">
      <Header />

      {/* Render events in order */}
      <EventList events={events} />

      {/* Progress indicator */}
      <StatusIndicator
        status={status}
        events={events}
        edits={edits}
        error={error}
      />

      {/* Review button when complete */}
      {status === 'complete' && edits.length > 0 && (
        <Box marginTop={1}>
          <ReviewButton onReview={handleReview} />
        </Box>
      )}

      {/* Error message */}
      <ErrorDisplay error={error} />
    </Box>
  );
}
