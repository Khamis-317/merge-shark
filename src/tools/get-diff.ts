import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
import { getDiffForFile } from '../utils/git-utils.js';

export function makeGetDiffTool(repoPath: string) {
  const diffSchema = z.object({
    from: z.string(),
    to: z.string(),
    relativePath: z.string(),
  });

  return tool(
    async ({ 
        from, 
        to, 
        relativePath 
    }: {
        from: string;
        to: string;
        relativePath: string;
    }) => {
      try {
        const diffOutput = await getDiffForFile(repoPath, from, to, relativePath);
        return diffOutput;
      } catch (err: unknown) {
        if (err instanceof Error) {
          return `Error generating diff for ${relativePath} between ${from} and ${to}: ${err.message}`;
        }
        return `An unknown error occurred: ${err}`;
      }
    },
    {
      name: 'get_diff',
      description: dedent`
        Retrieves the diff for a specific file between two commits (or branches).

        Input:
        - from: the baseline commit hash or branch name.
        - to: the target commit hash or branch name.
        - relativePath: relative path to the file in the repository (e.g., "src/index.ts")

        Output:
        - Standard git diff output showing the unified diff between the two commits for the specified file.
        - Returns empty string if there are no differences between the commits.

        When to use:
        - To see exactly what changed in a file between two commits or branches
        - Commit hashes can be obtained from "get_merge_info", "get_recent_commits_for_file", "get_last_merge_commits", and "get_blame"
        - File paths can be obtained from "get_changed_files_in_commit"
      `,
      schema: diffSchema,
    }
  );
}






