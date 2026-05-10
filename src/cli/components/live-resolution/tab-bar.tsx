import { Box, Text } from 'ink';
import type { SubAgentPane } from '../../hooks/use-agent-resolution.js';
interface TabBarProps {
  subAgentPanes: SubAgentPane[];
  activePane: string | null; // null = main
}

function truncateGoal(goal: string, maxLength: number = 20): string {
  if (goal.length <= maxLength) return goal;
  return goal.slice(0, maxLength - 1) + '…';
}

function statusColor(status: 'running' | 'complete' | 'failed'): string {
  switch (status) {
    case 'running':
      return 'yellow';
    case 'complete':
      return 'green';
    case 'failed':
      return 'red';
  }
}

function statusIcon(status: 'running' | 'complete' | 'failed'): string {
  switch (status) {
    case 'running':
      return '↺';
    case 'complete':
      return '✓';
    case 'failed':
      return '✗';
  }
}
export function TabBar({ subAgentPanes, activePane }: TabBarProps) {
  // Don't render if there are no sub-agents
  if (subAgentPanes.length === 0) return null;

  const isMainActive = activePane === null;

  return (
    <Box marginTop={1} flexDirection="row" gap={1}>
      {/* Main tab */}
      <Text bold={isMainActive} color={isMainActive ? 'cyan' : 'gray'}>
        [{isMainActive ? '>' : ' '}Main]
      </Text>

      {/* Sub-agent tabs */}
      {subAgentPanes.map((pane) => {
        const isActive = activePane === pane.callId;
        return (
          <Text
            key={pane.callId}
            bold={isActive}
            color={isActive ? 'cyan' : 'gray'}
          >
            [{isActive ? '>' : ' '}
            {pane.paneNumber}: {truncateGoal(pane.goal)}{' '}
            <Text color={statusColor(pane.status)}>
              {statusIcon(pane.status)}
            </Text>
            ]
          </Text>
        );
      })}

      {/* Navigation hint */}
      <Text dimColor> 0-{Math.min(subAgentPanes.length, 9)} to switch</Text>
    </Box>
  );
}
