import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import path from 'path';
import { validateWithLSP } from '../utils/lsp.js';
import { dedent } from '../utils/dedent.js';

const lspValidationInputSchema = z.object({
  relativePath: z
    .string()
    .describe('The relative path to the file to validate.'),
  content: z
    .string()
    .describe(
      'The full code content of the file (including suggested edits) to be validated.'
    ),
});

export type LSPValidationToolInput = z.infer<typeof lspValidationInputSchema>;

export function makeLspValidationTool(
  repoPath: string,
  jdtlsPath?: string,
  jdltlsDataPath?: string
) {
  return tool(
    async ({ relativePath, content }) => {
      try {
        const absolutePath = path.resolve(repoPath, relativePath);
        const result = await validateWithLSP(
          absolutePath,
          content,
          jdtlsPath,
          jdltlsDataPath
        );
        return result;
      } catch (err: unknown) {
        return `Error during LSP validation: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
    {
      name: 'lsp_validation',
      description: dedent`
        Validates the suggested changes to a file using the corresponding Language Server Protocol (LSP).
        Provides diagnostics (syntax errors, type validation errors, etc.) before writing the changes to disk.
        You must use this tool to validate your suggested edits against the LSP BEFORE calling any edit or multi-edit tools and before asking the user for approval.
        Supported extensions: .java, .ts, .tsx, .js, .jsx, .py, .c, .cpp, .h, .hpp.
      `,
      schema: lspValidationInputSchema,
    }
  );
}
