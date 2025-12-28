import { ToolSummary } from './tool-summary.js';
import { EditApproval } from './edit-approval.js';
import { BashApproval } from './bash-approval.js';
import invariant from 'tiny-invariant';
import type { ToolState } from '../hooks/use-agent-resolution.js';

export type ToolCallDisplayProps = {
  toolName: string;
  input: unknown;
  output: unknown;
  repoPath: string;
  state: ToolState;
  onApprove: () => void;
  onReject: (feedback?: string) => void;
};

export function ToolCallDisplay({
  toolName,
  input,
  output,
  repoPath,
  state,
  onApprove,
  onReject,
}: ToolCallDisplayProps) {
  if (state.status === 'awaiting-edit-approval') {
    invariant(
      toolName === 'edit' || toolName === 'multiedit',
      'Edit approval can only be requested for edit or multiedit tools'
    );

    return (
      <EditApproval
        repoPath={repoPath}
        edit={state.edit}
        onApprove={onApprove}
        onReject={onReject}
      />
    );
  }

  if (state.status === 'awaiting-bash-approval') {
    invariant(
      toolName === 'bash',
      'Bash approval can only be requested for bash tool'
    );

    return (
      <BashApproval
        request={state.request}
        onApprove={onApprove}
        onReject={onReject}
      />
    );
  }

  return (
    <ToolSummary
      toolName={toolName}
      input={input}
      output={output}
      status={state.status}
    />
  );
}
