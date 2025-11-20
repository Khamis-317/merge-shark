import { Box, Text } from 'ink';

interface ErrorDisplayProps {
  error: Error | null;
}

export function ErrorDisplay({ error }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="red"
      padding={1}
      marginTop={1}
    >
      <Text color="red" bold>
        ❌ Error occurred:
      </Text>
      <Text color="red">{error.message}</Text>
      {error.stack && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>
            Stack trace:
          </Text>
          <Text color="gray" dimColor>
            {error.stack}
          </Text>
        </Box>
      )}
    </Box>
  );
}
