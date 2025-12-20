import type { FileEditOptions } from './edit-file.js';

export interface ToolContext {
  // Map of absolute file paths to their modification time when last read
  readFiles: Map<string, Date>;
  // Callback to request edit approval from the user
  onEditRequested?: (edit: FileEditOptions) => Promise<boolean>;
}
