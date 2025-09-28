import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
import { getChangedFilesInCommit } from '../utils/git-utils.js';

export function makeGetChangedFilesTool(repoPath: string) {
  const changedFilesSchema = z.object({
    commitHash: z
      .string(),
  });

  return tool(
    async ({ 
        commitHash 
    }: {
        commitHash: string;
    }) => {
      try {
        const changedFiles = await getChangedFilesInCommit(repoPath, commitHash);
        return changedFiles;
      } catch (err: unknown) {
        if (err instanceof Error) {
          return `Error retrieving changed files for commit ${commitHash}: ${err.message}`;
        }
        return `An unknown error occurred: ${err}`;
      }
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
        - Commit hashes can be obtained from "get_merge_info", "get_recent_commits_for_file", "get_last_merge_commits", and "get_blame"
        - Use the returned file paths with "get_diff", "get_recent_commits_for_file", and "get_blame" for detailed analysis of specific files
      `,
      schema: changedFilesSchema,
    }
  );
}
