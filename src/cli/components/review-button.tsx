import { Box, Text, useInput } from 'ink';

export interface ReviewButtonProps {
  onReview: () => void;
}

export function ReviewButton({ onReview }: ReviewButtonProps) {
  useInput((_input, key) => {
    if (key.return) {
      onReview();
    }
  });

  return (
    <Box backgroundColor="green" paddingX={1}>
      <Text color="black" bold>
        review (enter)
      </Text>
    </Box>
  );
}
