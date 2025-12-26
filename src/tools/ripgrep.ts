import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ripgrep } from '../utils/rip-grep.js';
import path from 'path';
import { dedent } from '../utils/dedent.js';

const ripgrepInputSchema = z.object({
  searchPath: z.string(),
  pattern: z.string(),
  caseSensitive: z.boolean().optional(),
  ignored: z.array(z.string()).optional(),
  linesBefore: z.number().default(0),
  linesAfter: z.number().default(0),
});

export type RipgrepToolInput = z.infer<typeof ripgrepInputSchema>;

export function makeRipgrepTool(repoPath: string) {
  return tool(
    async ({
      searchPath,
      pattern,
      caseSensitive = false,
      ignored,
      linesBefore,
      linesAfter,
    }) => {
      const absolutePath = path.resolve(repoPath, searchPath);
      const grepResults = await ripgrep(
        repoPath,
        absolutePath,
        pattern,
        caseSensitive,
        ignored,
        linesBefore,
        linesAfter
      );
      return grepResults.join('\n');
    },
    {
      name: 'ripgrep',
      description: dedent`
        Searches for a pattern in files within the specified path using ripgrep.
        This tool is useful for finding specific text or code snippets in the codebase.
        Provide a relative path to the directory you want to search (e.g., "src" or "./src/utils") and the text pattern to search for.
        You can also specify whether the search should be case sensitive, provide an array of glob patterns to ignore certain files or directories prefixed with '!'.
        You can also specify the number of lines to show before and after the match to provide a clearer context.
        Output is lines containing the pattern, prefixed by file absolute path and line number separated by a colon (e.g- when grepping for 'await' "absolute/path/to/file.ts:66:    const result = await foo();").
        `,
      schema: ripgrepInputSchema,
    }
  );
}
