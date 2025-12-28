import { Box, Text } from 'ink';
import path from 'node:path';
import { CodeDiff } from './code-diff.js';
import { ApprovalPrompt } from './approval-prompt.js';
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
  const language = path.extname(edit.path).slice(1);
  const relativePath = path.relative(repoPath, edit.path);

  return (
    <ApprovalPrompt
      title="Edit Approval Required"
      feedbackPrompt="What should shark do instead?"
      onApprove={onApprove}
      onReject={onReject}
    >
      <Box marginBottom={1}>
        <Text>📄 {relativePath}</Text>
      </Box>

      <CodeDiff edit={edit} language={language} />
    </ApprovalPrompt>
  );
}
