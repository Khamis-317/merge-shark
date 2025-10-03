import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { dedent } from '../utils/dedent.js';
import { getChangedFilesInCommit } from '../utils/git-utils.js';

export function makeGetChangedFilesTool(repoPath: string) {
  const changedFilesSchema = z.object({
    commitHash: z.string(),
  });

  return tool(
    async ({ commitHash }: { commitHash: string }) => {
      const changedFiles = await getChangedFilesInCommit(repoPath, commitHash);
      return changedFiles;
    },
    {
      name: 'get_changed_files_in_commit',
      description: dedent`
        Retrieves the list of files that were changed (added, modified, deleted) in a specific commit.
        
        Input:
        - commitHash: the commit hash to get changed files for.

        Output:
        - Raw git output showing changed files with their status, one file per line.
        - Each line format: STATUS<tab>filepath

        When to use:
        - To see what files were affected by a specific commit
        - To understand the scope of changes in a commit
        - Use the returned file paths with "git_diff", "git_log", and "git_blame" for detailed analysis of specific files
        `,
      schema: changedFilesSchema,
    }
  );
}
