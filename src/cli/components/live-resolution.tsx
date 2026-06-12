import { Box, Text, useInput } from 'ink';
import { useAgentResolution } from '../hooks/use-agent-resolution.js';
import { Header } from './live-resolution/header.js';
import { EventList } from './live-resolution/event-list.js';
import { StatusIndicator } from './live-resolution/status-indicator.js';
import { ErrorDisplay } from './live-resolution/error-display.js';
import { TabBar } from './live-resolution/tab-bar.js';
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
  const {
    events,
    status,
    edits,
    error,
    onApprove,
    onReject,
    subAgentPanes,
    activePane,
    setActivePane,
  } = useAgentResolution({ repoPath, llm, yolo });

  useInput(
    (input) => {
      const num = parseInt(input, 10);
      if (num >= 1 && num <= 9) {
        const targetPane = subAgentPanes.find((p) => p.paneNumber === num);
        if (targetPane) {
          // toggle: pressing the active pane number again returns to main
          setActivePane(
            activePane === targetPane.callId ? null : targetPane.callId
          );
        }
      }
    },
    { isActive: status !== 'awaiting-approval' }
  );
  const activePaneInfo = activePane
    ? subAgentPanes.find((p) => p.callId === activePane)
    : null;
  return (
    <Box flexDirection="column" paddingX={1} alignItems="stretch">
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        {activePaneInfo ? (
          <>
            <Text color="cyan" bold>
              Sub-Agent #{activePaneInfo.paneNumber}
            </Text>
            <Text color="gray">Exploring: {activePaneInfo.goal}</Text>
          </>
        ) : (
          <>
            <Header />
            <Text color="blue">{model}</Text>
          </>
        )}
      </Box>

      {/* Render events in order - edit approval is now handled separately */}
      <EventList
        events={events}
        repoPath={repoPath}
        onApprove={onApprove}
        onReject={onReject}
      />

      {/* Progress indicator */}
      {!activePane && (
        <StatusIndicator
          status={status}
          events={events}
          edits={edits}
          error={error}
        />
      )}

      {/* Error message */}
      {!activePane && <ErrorDisplay error={error} />}
      <TabBar subAgentPanes={subAgentPanes} activePane={activePane} />
    </Box>
  );
}
