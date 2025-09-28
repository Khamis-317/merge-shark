import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
import { getLastMergeCommits, DEFAULT_MAX_COMMITS_PER_FILE } from '../utils/git-utils.js';

export function makeGetLastMergeCommitsTool(repoPath: string) {
    const lastMergeCommitsSchema = z.object({
        n: z
          .number()
          .default(DEFAULT_MAX_COMMITS_PER_FILE)
          .optional(),
    });

    return tool(
        async ({ 
            n = DEFAULT_MAX_COMMITS_PER_FILE 
        }: {
            n: number;
        }) => {
            try {
                const mergeCommitsOutput = await getLastMergeCommits(repoPath, n);
                return mergeCommitsOutput;
            } catch (err: unknown) {
                if (err instanceof Error) {
                    return `Error retrieving last merge commits: ${err.message}`;
                }
                return `An unknown error occurred: ${err}`;
            }
        },
        {
            name: 'get_last_merge_commits',
            description: dedent`
                Retrieves the last N merge commits reachable from HEAD.

                Input:
                - n: maximum number of merge commits to return - defaults to ${DEFAULT_MAX_COMMITS_PER_FILE}

                Output:
                - Raw git output with commit hashes, one per line.
                - Returns empty string if no merge commits are found.

                When to use:
                - To find recent merge commits that integrated branches
                - Provides insight into how past merges were handled.
                - Use the returned hashes with "get_commit_metadata", "get_changed_files_in_commit", "get_diff", or "get_recent_commits_for_file" for detailed analysis
            `,
            schema: lastMergeCommitsSchema,
        }
    );
}

