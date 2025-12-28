import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ripgrep } from '../utils/rip-grep.js';
import { dedent } from '../utils/dedent.js';

const ripgrepInputSchema = z.object({
  pattern: z.string(),
  searchPath: z.string().default('.'),
  caseSensitive: z.boolean().default(false),
  linesBefore: z.number().nonnegative().default(0),
  linesAfter: z.number().nonnegative().default(0),
  ignored: z.array(z.string()).optional(),
});

export type RipgrepToolInput = z.infer<typeof ripgrepInputSchema>;

export function makeRipgrepTool(repoPath: string) {
  return tool(
    async ({
      pattern,
      searchPath,
      caseSensitive,
      linesBefore,
      linesAfter,
      ignored,
    }) => {
      const grepResults = await ripgrep(
        repoPath,
        pattern,
        searchPath,
        caseSensitive,
        linesBefore,
        linesAfter,
        ignored
      );
      return grepResults.join('\n');
    },
    {
      name: 'ripgrep',
      description: dedent`
        Searches for a pattern in files within the specified path using ripgrep.
        This tool is useful for finding specific text or code snippets in the codebase.
        Provide a relative path to the repo's root directory -project root- you want to search within (e.g., "src" or "./src/utils") and the text pattern to search for.
        You can also specify whether the search should be case sensitive, provide an array of glob patterns to ignore certain files or directories prefixed with '!'.
        You can also specify the number of lines to show before and after the match to provide a clearer context.
        Output is lines containing the pattern, prefixed by the file's path and line number separated by a colon (e.g- when grepping for 'await' "src/path/to/file.ts:66:    const result = await foo();").
        `,
      schema: ripgrepInputSchema,
    }
  );
}
