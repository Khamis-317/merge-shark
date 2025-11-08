import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { dedent } from '../utils/dedent.js';
import {
  getLastCommitsForFile,
  DEFAULT_MAX_COMMITS_PER_FILE,
} from '../utils/git-utils.js';

export interface GitLogToolInput {
  relativeFilePath: string;
  branchRef?: string;
  limit?: number;
}

export function makeGitLogTool(repoPath: string) {
  const recentCommitsSchema = z.object({
    relativeFilePath: z.string(),
    branchRef: z.string().default('HEAD').optional(),
    limit: z.number().default(DEFAULT_MAX_COMMITS_PER_FILE).optional(),
  });

  return tool(
    async ({
      relativeFilePath,
      branchRef = 'HEAD',
      limit = DEFAULT_MAX_COMMITS_PER_FILE,
    }: {
      relativeFilePath: string;
      branchRef: string;
      limit: number;
    }) => {
      const data = await getLastCommitsForFile(
        repoPath,
        relativeFilePath,
        branchRef,
        limit
      );
      return data;
    },
    {
      name: 'git_log',
      description: dedent`
        Retrieves detailed commit history for a specific file, including commit hash, author, date, and message.

        Input:
        - relativeFilePath: relative path to the file in the repository (e.g., "src/index.ts")
        - branchRef: branch name or commit ref (HEAD, MERGE_HEAD, etc.) - defaults to "HEAD"
        - limit: maximum number of commits to return - defaults to ${DEFAULT_MAX_COMMITS_PER_FILE}

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
