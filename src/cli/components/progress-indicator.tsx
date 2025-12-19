import { Box, Text } from 'ink';

export interface ProgressIndicatorProps {
  status: string;
}

export function ProgressIndicator({ status }: ProgressIndicatorProps) {
  return (
    <Box>
      <Text color="cyan">↺</Text>
      <Text> {status}</Text>
    </Box>
  );
}
