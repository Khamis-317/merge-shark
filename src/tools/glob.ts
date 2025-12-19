import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { globUtil } from '../utils/glob-files.js';
import { dedent } from '../utils/dedent.js';

const globInputSchema = z.object({
  pattern: z.string(),
  ignoredPatterns: z.array(z.string()).optional(),
});

export type GlobToolInput = z.infer<typeof globInputSchema>;

export function makeGlobTool(repoPath: string) {
  return tool(
    async ({ pattern, ignoredPatterns }) => {
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
      schema: globInputSchema,
    }
  );
}
