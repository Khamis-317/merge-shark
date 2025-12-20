import { Box } from 'ink';
import { ApprovalPrompt } from './approval-prompt.js';
import { CodeBlock } from './code-block.js';
import type { BashCommandRequest } from '../../utils/tool-context.js';

export interface BashApprovalProps {
  request: BashCommandRequest;
  onApprove: () => void;
  onReject: (feedback?: string) => void;
}

export function BashApproval({
  request,
  onApprove,
  onReject,
}: BashApprovalProps) {
  return (
    <ApprovalPrompt
      title="Bash Command Approval Required"
      feedbackPrompt="What should shark do instead?"
      onApprove={onApprove}
      onReject={onReject}
    >
      <Box backgroundColor="#1a1a2e" paddingX={1}>
        <CodeBlock code={request.command} language="bash" />
      </Box>
    </ApprovalPrompt>
  );
}
