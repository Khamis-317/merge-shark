import type { ToolCallLog } from '../types.js';

export type ToolCategory =
  'edit' | 'exploration' | 'verification' | 'command' | 'other';

export interface ToolTaxonomy {
  categories: Record<Exclude<ToolCategory, 'command' | 'other'>, string[]>;
  commandToolNames: string[];
  verificationCommandPatterns: RegExp[];
}

export const DEFAULT_TOOL_TAXONOMY: ToolTaxonomy = {
  categories: {
    edit: ['edit', 'multi_edit', 'multi-edit'],
    exploration: [
      'read',
      'ls',
      'glob',
      'ripgrep',
      'codebase_explorer',
      'codebase-explorer',
    ],
    verification: ['lsp_validation', 'lsp-validation'],
  },
  commandToolNames: ['bash', 'shell', 'terminal'],
  verificationCommandPatterns: [
    /\b(test|check|lint|typecheck|tsc|pytest|mvn|gradle|cargo|go test|npm test|pnpm test|yarn test)\b/i,
  ],
};

export function classifyToolCall(
  call: ToolCallLog,
  taxonomy: ToolTaxonomy = DEFAULT_TOOL_TAXONOMY
): ToolCategory {
  if (call.category) {
    return call.category;
  }

  const normalizedToolName = normalizeToolName(call.toolName);

  if (matchesCategory(normalizedToolName, taxonomy.categories.edit)) {
    return 'edit';
  }
  if (matchesCategory(normalizedToolName, taxonomy.categories.exploration)) {
    return 'exploration';
  }
  if (matchesCategory(normalizedToolName, taxonomy.categories.verification)) {
    return 'verification';
  }
  if (matchesCategory(normalizedToolName, taxonomy.commandToolNames)) {
    return isVerificationCommand(call, taxonomy) ? 'verification' : 'command';
  }

  return 'other';
}

function matchesCategory(toolName: string, knownNames: string[]): boolean {
  return knownNames.some(
    (knownName) => normalizeToolName(knownName) === toolName
  );
}

function isVerificationCommand(
  call: ToolCallLog,
  taxonomy: ToolTaxonomy
): boolean {
  const command =
    typeof call.args['command'] === 'string' ? call.args['command'] : '';
  return taxonomy.verificationCommandPatterns.some((pattern) =>
    pattern.test(command)
  );
}

function normalizeToolName(toolName: string): string {
  return toolName.trim().toLowerCase();
}
