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
      try {
        const matchedFiles = await globUtil(repoPath, pattern, ignoredPatterns);
        return matchedFiles.join('\n');
      } catch (err: unknown) {
        if (err instanceof Error) {
          return `Error executing glob: ${err.message}`;
        }
        return `An unknown error occurred: ${err}`;
      }
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

/** 
 * System prompt for the glob tool based on Claude code sys-prompt.

 Fast file pattern matching tool that works with any codebase size
 - Supports glob patterns like "**/ /*.js" or "src/**/ /*.ts"
 - Returns matching file paths sorted by modification time
 - Use this tool when you need to find files by name patterns
 - When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead
 - You have the capability to call multiple tools in a single response.
 It is always better to speculatively perform multiple searches as a batch that are potentially useful.

*/
