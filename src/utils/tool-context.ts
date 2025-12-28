import type { FileEditOptions } from './edit-file.js';

export type ApprovalResult =
  | { approved: true }
  | { approved: false; feedback?: string | undefined };

export interface BashCommandRequest {
  command: string;
}

export interface ToolContext {
  // Map of absolute file paths to their modification time when last read
  readFiles: Map<string, Date>;
  // Callback to request edit approval from the user
  onEditRequested: (edit: FileEditOptions) => Promise<ApprovalResult>;
  // Callback to request bash command approval from the user
  onBashRequested: (request: BashCommandRequest) => Promise<ApprovalResult>;
}
