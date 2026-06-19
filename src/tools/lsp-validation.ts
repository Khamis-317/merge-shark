import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import path from 'path';
import { validateWithLSP } from '../utils/lsp.js';
import { dedent } from '../utils/dedent.js';
import process from 'process';

const lspValidationInputSchema = z.object({
  relativePath: z
    .string()
    .describe('The relative path to the file to validate.'),
  content: z
    .string()
    .describe(
      'The full code content of the file (including suggested edits) to be validated.'
    ),
  jdtlsPath: z
    .string()
    .optional()
    .describe(
      'The path to the JDTLS folder. Required only if validating Java files.'
    ),
});

export type LSPValidationToolInput = z.infer<typeof lspValidationInputSchema>;

export function makeLspValidationTool(repoPath: string) {
  return tool(
    async ({ relativePath, content, jdtlsPath }) => {
      try {
        const absolutePath = path.resolve(repoPath, relativePath);
        // Look up argument if jdtlsPath not provided but needed
        const argJdtlsPath =
          jdtlsPath ||
          process.argv.find((arg) => arg.startsWith('--jdtls='))?.split('=')[1];
        const result = await validateWithLSP(
          absolutePath,
          content,
          argJdtlsPath
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
