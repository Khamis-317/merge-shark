import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { dedent } from '../utils/dedent.js';
import {
  getLastMergeCommits,
  DEFAULT_MAX_COMMITS_PER_FILE,
} from '../utils/git-utils.js';

export interface GetLastMergeCommitsToolInput {
  limit?: number;
}

export function makeGetLastMergeCommitsTool(repoPath: string) {
  const lastMergeCommitsSchema = z.object({
    limit: z.number().default(DEFAULT_MAX_COMMITS_PER_FILE).optional(),
  });

  return tool(
    async ({ limit = DEFAULT_MAX_COMMITS_PER_FILE }: { limit: number }) => {
      const mergeCommitsOutput = await getLastMergeCommits(repoPath, limit);
      return mergeCommitsOutput;
    },
    {
      name: 'get_last_merge_commits',
      description: dedent`
        Retrieves detailed information about the last merge commits reachable from HEAD.

        Input:
        - limit: maximum number of merge commits to return - defaults to ${DEFAULT_MAX_COMMITS_PER_FILE}

        Output:
        - Detailed merge commit information in format: hash|author|date|message (one commit per line)
        - Each line contains: commit_hash|author_name|commit_date|commit_message
        - Returns empty string if no merge commits are found

        When to use:
        - To find recent merge commits that integrated branches with full context
        - Use the returned commit hashes with "git_diff" or "git_blame" for detailed analysis about how the past merges were done
        `,
      schema: lastMergeCommitsSchema,
    }
  );
}
