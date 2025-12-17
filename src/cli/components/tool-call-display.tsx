import { ToolSummary } from './tool-summary.js';
import { EditApproval } from './edit-approval.js';
import invariant from 'tiny-invariant';
import type { ToolState } from '../hooks/use-agent-resolution.js';

export type ToolCallDisplayProps = {
  toolName: string;
  input: unknown;
  output: unknown;
  repoPath: string;
  state: ToolState;
  onApproveEdit: () => void;
  onRejectEdit: () => void;
};

export function ToolCallDisplay({
  toolName,
  input,
  output,
  repoPath,
  state,
  onApproveEdit,
  onRejectEdit,
}: ToolCallDisplayProps) {
  if (state.status === 'awaiting-approval') {
    invariant(
      toolName === 'edit' || toolName === 'multiedit',
      'Edit approval can only be requested for edit or multiedit tools'
    );

    return (
      <EditApproval
        repoPath={repoPath}
        edit={state.edit}
        onApprove={onApproveEdit}
        onReject={onRejectEdit}
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
