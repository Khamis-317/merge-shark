import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import { useState, type ReactNode } from 'react';

export interface ApprovalPromptProps {
  title: string;
  feedbackPrompt: string;
  children: ReactNode;
  onApprove: () => void;
  onReject: (feedback?: string) => void;
}

export function ApprovalPrompt({
  title,
  feedbackPrompt,
  children,
  onApprove,
  onReject,
}: ApprovalPromptProps) {
  const [isTakingFeedback, setIsTakingFeedback] = useState(false);

  useInput(
    (input, key) => {
      if (key.return) {
        onApprove();
      } else if (input === 'r') {
        setIsTakingFeedback(true);
      }
    },
    { isActive: !isTakingFeedback }
  );

  const handleSubmit = (value: string) => {
    onReject(value.trim() || undefined);
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box
        flexDirection="column"
        paddingX={1}
        borderStyle="round"
        borderColor="blue"
      >
        <Box marginBottom={1}>
          <Text color="blue" bold>
            {title}
          </Text>
        </Box>

        {children}
      </Box>

      {isTakingFeedback ? (
        <Box marginTop={1} paddingX={1} flexDirection="column">
          <Box marginBottom={1}>
            <Text color="yellow" bold>
              {feedbackPrompt}
            </Text>
          </Box>
          <TextInput
            placeholder="Enter feedback (optional)"
            onSubmit={handleSubmit}
          />
          <Box marginTop={1} gap={2}>
            <Text dimColor>Press enter to submit</Text>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1} paddingX={1}>
          <Box gap={2}>
            <Box backgroundColor="green" paddingX={1}>
              <Text color="black" bold>
                approve (enter)
              </Text>
            </Box>
            <Box backgroundColor="red" paddingX={1}>
              <Text color="black" bold>
                reject (r)
              </Text>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
