import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
import {
  getLastCommitsForFile,
  DEFAULT_MAX_COMMITS_PER_FILE,
} from '../utils/git-utils.js';

export function makeGetRecentCommitsTool(repoPath: string) {
  const recentCommitsSchema = z.object({
    relativePath: z.string(),
    branchRef: z.string().default('HEAD').optional(),
    n: z.number().default(DEFAULT_MAX_COMMITS_PER_FILE).optional(),
  });

  return tool(
    async ({
      relativePath,
      branchRef = 'HEAD',
      n = DEFAULT_MAX_COMMITS_PER_FILE,
    }: {
      relativePath: string;
      branchRef: string;
      n: number;
    }) => {
      try {
        const data = await getLastCommitsForFile(
          repoPath,
          relativePath,
          branchRef,
          n
        );
        return data;
      } catch (err: unknown) {
        if (err instanceof Error) {
          return `Error retrieving commits for file: ${relativePath}, error: ${err.message}`;
        }
        return `An unknown error occurred: ${err}`;
      }
    },
    {
      name: 'get_recent_commits_for_file',
      description: dedent`
          Retrieves the last N commits that modified a specific file in a branch.
            Input:
            - relativePath: relative path to the file in the repository (e.g., "src/index.ts")
            - branchRef: branch name or commit ref (HEAD, MERGE_HEAD, etc.) - defaults to "HEAD"
            - n: maximum number of commits to return - defaults to ${DEFAULT_MAX_COMMITS_PER_FILE}

            Output:
           - Raw git output with commit hashes, one per line.

            When to use:
            - To understand recent history of a conflicted file on either our branch (HEAD) or their branch (MERGE_HEAD)
            - Branch references can be obtained from "get_merge_info" tool
            - Use the returned hashes with "get_commit_metadata", "get_changed_files_in_commit", "get_diff", or "get_recent_commits_for_file" for detailed analysis
        `,
      schema: recentCommitsSchema,
    }
  );
}
