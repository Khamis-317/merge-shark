import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
import {
  getLastCommitsForFile,
  DEFAULT_MAX_COMMITS_PER_FILE,
} from '../utils/git-utils.js';

export function makeGitLogTool(repoPath: string) {
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
      name: 'git_log',
      description: dedent`
          Retrieves detailed commit history for a specific file, including commit hash, author, date, and message.
            Input:
            - relativePath: relative path to the file in the repository (e.g., "src/index.ts")
            - branchRef: branch name or commit ref (HEAD, MERGE_HEAD, etc.) - defaults to "HEAD"
            - n: maximum number of commits to return - defaults to ${DEFAULT_MAX_COMMITS_PER_FILE}

            Output:
            - Detailed commit information in format: hash|author|date|message (one commit per line)

            When to use:
            - To understand recent history and context of a conflicted file on either our branch (HEAD) or their branch (MERGE_HEAD)
            - Use the returned commit hashes with "git_diff" or "git_blame" for detailed analysis if the commit appears relevant based on its message
        `,
      schema: recentCommitsSchema,
    }
  );
}
