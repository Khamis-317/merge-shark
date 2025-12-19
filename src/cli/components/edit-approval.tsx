import { Box, Text, useInput } from 'ink';
import path from 'node:path';
import { CodeDiff } from './code-diff.js';
import type { FileEditOptions } from '../../utils/edit-file.js';

export interface EditApprovalProps {
  repoPath: string;
  edit: FileEditOptions;
  onApprove: () => void;
  onReject: () => void;
}

export function EditApproval({
  repoPath,
  edit,
  onApprove,
  onReject,
}: EditApprovalProps) {
  useInput((input, key) => {
    if (key.return) {
      onApprove();
    } else if (input === 'r') {
      onReject();
    }
  });

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
    </Box>
  );
}
