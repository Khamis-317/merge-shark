import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
import { getCommitMetaData } from '../utils/git-utils.js';

export function makeGetCommitMetadata(repoPath: string) {
  const commitMetadataSchema = z.object({
    commitHash: z.string(),
  });

  return tool(
    async ({ commitHash }: { commitHash: string }) => {
      try {
        const data = await getCommitMetaData(repoPath, commitHash);
        return data;
      } catch (err: unknown) {
        if (err instanceof Error) {
          return `Error retrieving metadata for commit: ${commitHash}, error: ${err.message}`;
        }
        return `An unknown error occurred: ${err}`;
      }
    },
    {
      name: 'get_commit_metadata',
      description: dedent`
          Retrieves metadata for a specific commit (author, date, commit message text).
            Input:
             commitHash: the commit hash (from HEAD, MERGE_HEAD, merge-base, or any commit hash you get from provided tools).

            Output:
            - Raw git output with commit metadata in the following format:
              Line 1: Author name
              Line 2: date
              Line 3+: Full commit message (can be multiple lines)

            When to use:
            - To understand the purpose and intent of changes
            - Commit hashes can be obtained from "get_merge_info", "get_recent_commits_for_file", "get_last_merge_commits", and "get_blame"
        `,
      schema: commitMetadataSchema,
    }
  );
}
