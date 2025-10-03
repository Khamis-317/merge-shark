import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { globUtil } from '../utils/glob-files.js';
import { dedent } from '../utils/dedent.js';

export function makeGlobTool(repoPath: string) {
  const globSchema = z.object({
    pattern: z.string().optional(),
    ignoredPatterns: z.array(z.string()).optional(),
  });

  return tool(
    async ({
      pattern,
      ignoredPatterns,
    }: {
      pattern: string;
      ignoredPatterns?: string[];
    }) => {
      const matchedFiles = await globUtil(repoPath, pattern, ignoredPatterns);
      return matchedFiles.join('\n');
    },
    {
      name: 'glob',
      description: dedent`
        Finds files matching a glob pattern such as (e.g., "**/*.ts", "**/*.js, **/*.{c,cpp}).
        This tool is useful for locating files in the codebase based on patterns.
        Provide a glob pattern to search for files.
        You can also provide an array of glob patterns to ignore certain files or directories.
      `,
      schema: globSchema,
    }
  );
}
