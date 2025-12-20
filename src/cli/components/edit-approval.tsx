import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import path from 'node:path';
import { useState } from 'react';
import { CodeDiff } from './code-diff.js';
import type { FileEditOptions } from '../../utils/edit-file.js';

export interface EditApprovalProps {
  repoPath: string;
  edit: FileEditOptions;
  onApprove: () => void;
  onReject: (feedback?: string) => void;
}

export function EditApproval({
  repoPath,
  edit,
  onApprove,
  onReject,
}: EditApprovalProps) {
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

  const language = path.extname(edit.path).slice(1);
  const relativePath = path.relative(repoPath, edit.path);

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
            Edit Approval Required
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text>📄 {relativePath}</Text>
        </Box>

        <CodeDiff edit={edit} language={language} />
      </Box>

      {isTakingFeedback ? (
        <Box marginTop={1} paddingX={1} flexDirection="column">
          <Box marginBottom={1}>
            <Text color="yellow" bold>
              What should shark do instead?
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
