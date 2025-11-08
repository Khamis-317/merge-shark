import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ripgrep } from '../utils/rip-grep.js';
import path from 'path';
import { dedent } from '../utils/dedent.js';

export interface RipgrepToolInput {
  searchPath: string;
  pattern: string;
  caseSensitive?: boolean;
  ignored?: string[];
}

export function makeRipgrepTool(repoPath: string) {
  const ripgrepSchema = z.object({
    searchPath: z.string(),
    pattern: z.string(),
    caseSensitive: z.boolean().optional(),
    ignored: z.array(z.string()).optional(),
  });
  return tool(
    async ({
      searchPath,
      pattern,
      caseSensitive = false,
      ignored,
    }: {
      searchPath: string;
      pattern: string;
      caseSensitive: boolean;
      ignored?: string[];
    }) => {
      const absolutePath = path.resolve(repoPath, searchPath);
      const grepResults = await ripgrep(
        repoPath,
        absolutePath,
        pattern,
        caseSensitive,
        ignored
      );
      return grepResults.join('\n');
    },
    {
      name: 'ripgrep',
      description: dedent`
        Searches for a pattern in files within the specified path using ripgrep.
        This tool is useful for finding specific text or code snippets in the codebase.
        Provide a relative path to the directory you want to search (e.g., "src" or "./src/utils") and the text pattern to search for.
        You can also specify whether the search should be case sensitive and provide an array of glob patterns to ignore certain files or directories.
        Output is lines containing the pattern, prefixed by file absolute path and line number separated by a colon (e.g,-when grepping for 'await' "absolute/path/to/file.ts:66:    const result = await foo();").
        `,
      schema: ripgrepSchema,
    }
  );
}
