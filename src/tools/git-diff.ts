import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { dedent } from '../utils/dedent.js';
import { gitDiff } from '../utils/git-utils.js';

const gitDiffInputSchema = z.object({
  from: z.string(),
  to: z.string(),
  relativeFilePath: z.string(),
});

export type GitDiffToolInput = z.infer<typeof gitDiffInputSchema>;

export function makeGitDiffTool(repoPath: string) {
  return tool(
    async ({ from, to, relativeFilePath }) => {
      const diffOutput = await gitDiff(repoPath, from, to, relativeFilePath);
      return diffOutput;
    },
    {
      name: 'git_diff',
      description: dedent`
        Retrieves the diff for a specific file between two commits (or branches).
        Input:
        - from: the baseline commit hash or branch name.
        - to: the target commit hash or branch name.
        - relativeFilePath: relative path to the file in the repository (e.g., "src/index.ts")

        Output:
        - Standard git diff output showing the unified diff between the two commits for the specified file.
        - Returns empty string if there are no differences between the commits.

        When to use:
        - To see exactly what changed in a file between two commits or branches
        - Commit hashes can be obtained from "git_log", "get_last_merge_commits", and "git_blame"
        - File paths can be obtained from "get_changed_files_in_commit"
        `,
      schema: gitDiffInputSchema,
    }
  );
}
