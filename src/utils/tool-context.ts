export interface ToolContext {
  lastFileRead: string | null;
}

export function createToolContext(): ToolContext {
  return { lastFileRead: null };
}
