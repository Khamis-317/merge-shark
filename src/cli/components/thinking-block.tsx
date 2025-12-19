import { Box, Text } from 'ink';
import { Markdown } from './markdown.js';
import chalk from 'chalk';

export interface ThinkingBlockProps {
  content: string;
  isComplete: boolean;
  startTime: number;
}

export function ThinkingBlock({
  content,
  isComplete,
  startTime,
}: ThinkingBlockProps) {
  if (isComplete) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    return (
      <Box marginY={1}>
        <Text dimColor>💭 Thought for {duration}s</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingLeft={2} marginY={1}>
      <Text>💭 Thinking...</Text>
      <Box paddingLeft={2}>
        <Text>
          <Markdown content={content} text={chalk.dim} />
        </Text>
      </Box>
    </Box>
  );
}
