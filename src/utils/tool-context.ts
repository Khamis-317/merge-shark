export interface ToolContext {
  // Map of absolute file paths to their modification time when last read
  readFiles: Map<string, Date>;
}
