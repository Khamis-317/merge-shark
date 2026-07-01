const CONFLICT_PATTERN = /<<<<<<< .+\n[\s\S]*?=======\n[\s\S]*?>>>>>>> .+/g;

const HEADER_PATTERN = /<<<<<<< (.+)/;
const SEPARATOR = '=======';
const FOOTER_PATTERN = />>>>>>> (.+)/;

export interface ParsedConflict {
  content: string;
  baseBranch: string;
  incomingBranch: string;
  baseChange: string;
  incomingChange: string;
}

export function parseConflictBlock(text: string): ParsedConflict | null {
  const lines = text.split('\n');

  const headerMatch = lines[0]?.match(HEADER_PATTERN);
  if (!headerMatch) return null;

  const separatorIndex = lines.indexOf(SEPARATOR);
  if (separatorIndex === -1) return null;

  const footerLine = lines.at(-1);
  const footerMatch = footerLine?.match(FOOTER_PATTERN);
  if (!footerMatch) return null;

  const baseBranch = headerMatch[1]!.trim();
  const incomingBranch = footerMatch[1]!.trim();
  const baseChange = lines.slice(1, separatorIndex).join('\n');
  const incomingChange = lines.slice(separatorIndex + 1, -1).join('\n');

  return {
    baseBranch,
    incomingBranch,
    baseChange,
    incomingChange,
    content: text,
  };
}

export function extractAllConflicts(fileContent: string): ParsedConflict[] {
  const matches = fileContent.match(CONFLICT_PATTERN);
  if (!matches) return [];

  const results: ParsedConflict[] = [];
  for (const match of matches) {
    const parsed = parseConflictBlock(match);
    if (parsed) results.push(parsed);
  }
  return results;
}
