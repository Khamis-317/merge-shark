import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import path from 'path';
import fs from 'node:fs/promises';
import type { LSPManager } from '../utils/lsp.js';
import { dedent } from '../utils/dedent.js';

const lspValidationInputSchema = z.object({
  relativePath: z
    .string()
    .describe('The relative path to the file to validate.'),
});

export type LSPValidationToolInput = z.infer<typeof lspValidationInputSchema>;

export function makeLspValidationTool(
  repoPath: string,
  lspManager: LSPManager
) {
  return tool(
    async ({ relativePath }) => {
      try {
        const absolutePath = path.resolve(repoPath, relativePath);

        // Verify the file exists on disk before validating
        await fs.access(absolutePath);

        const result = await lspManager.validate(absolutePath);
        return result;
      } catch (err: unknown) {
        return `Error during LSP validation: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
    {
      name: 'lsp_validation',
      description: dedent`
        Validates a file on disk using the corresponding Language Server Protocol (LSP).
        Provides diagnostics (syntax errors, type validation errors, etc.) for the current state of the file.
        This tool reads the file content directly from disk — the file must already be saved.
        Supported extensions: .java, .ts, .tsx, .js, .jsx, .py, .c, .cpp, .h, .hpp.
      `,
      schema: lspValidationInputSchema,
    }
  );
}
