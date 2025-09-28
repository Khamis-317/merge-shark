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
        async ({ n = DEFAULT_MAX_COMMITS_PER_FILE }) => {
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
                - You can use the returned commit hashes with other git tools.
            `,
            schema: lastMergeCommitsSchema,
        }
    );
}


// const repoPath = ""; 
 

// const toolInstance = makeGetLastMergeCommitsTool(repoPath);

//   const n = 25;
// toolInstance.invoke({n})
// .then(result => {
//     console.log("Tool output:\n", result);
// })
// .catch(err => {
//     console.error("Error running tool:", err);
// });
