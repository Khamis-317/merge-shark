import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
import {getCommitMetaData} from '../utils/git-utils.js';


export function makeGetCommitMetadata(repoPath: string){
    const commitMetadataSchema = z.object({
        commitHash: z
          .string(),
      });

   return tool (
    async ({commitHash}) => {
        try {
            const data = await getCommitMetaData(repoPath, commitHash);
            return formatCommitMetadataAsXML(commitHash, data);
        }catch (err: unknown) {
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
            Returns commit metadata in XML format exactly as shown:
            <commit_metadata>
                <hash>commit_hash_here</hash>
                <author>Author Name</author>
                <date>commit_date</date>
                <message>Full commit message text including multiple lines if present</message>
            </commit_metadata>

            When to use:
            - To understand the purpose and intent of changes.
            - Commit hashes can be obtained from HEAD, MERGE_HEAD, merge-base (you can get those from the tool named "get_merge_info)."
        `,
        schema: commitMetadataSchema,
    }
   )
}


function formatCommitMetadataAsXML(commitHash: string, metadata: { author: string; date: string; fullMessage: string }): string {
  return `<commit_metadata>
  <hash>${commitHash}</hash>
  <author>${metadata.author}</author>
  <date>${metadata.date}</date>
  <message>${metadata.fullMessage}</message>
</commit_metadata>`;
}




