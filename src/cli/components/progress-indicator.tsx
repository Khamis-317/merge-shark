import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export interface ProgressIndicatorProps {
  status: string;
}

export function ProgressIndicator({ status }: ProgressIndicatorProps) {
  return (
    <Box>
      <Text color="cyan">
        <Spinner type="dots" />
      </Text>
      <Text> {status}</Text>
    </Box>
  );
}
