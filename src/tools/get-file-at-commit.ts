import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
import { getFileContentFromCommit } from '../utils/git-utils.js';



export function makeGetFileAtCommitTool(repoPath: string) {
  const fileAtCommitSchema = z.object({
    relativePath: z
      .string(),
    commitHash: z
      .string(),
  });

  return tool(
    async ({ relativePath, commitHash }) => {
      try {
        const content = await getFileContentFromCommit(repoPath, commitHash, relativePath);
        return formatFileContentAsXML(commitHash, relativePath, content);
      } catch (err: unknown) {
        if (err instanceof Error) {
          return `Error retrieving file content for ${relativePath} at commit ${commitHash}: ${err.message}`;
        }
        return `An unknown error occurred: ${err}`;
      }
    },
    {
      name: 'get_file_at_commit',
      description: dedent`
        Retrieves the content of a specific file at a specific commit.
        
        Input:
        - commitHash: the commit hash to retrieve the file from (from HEAD, MERGE_HEAD, merge-base, or any commit hash you get from provided tools)
        - relativePath: relative path to the file in the repository (e.g., "src/index.ts")

        Output:
        - XML with file content if the file exists in the given commit.  
        - If the file is missing in that commit, <content> will be "File does not exist in this commit".  

        <file_content>
        <commit_hash>commit_hash_here</commit_hash>
        <file_path>relative/path/to/file.ts</file_path>
        <content>File content here...</content>
        </file_content>

        When to use:
        - To see how a file looked at a specific point in history
        - Commit hashes can be obtained from "get_merge_info", "get_recent_commits_for_file", or other git tools
      `,
      schema: fileAtCommitSchema,
    }
  );
}


function formatFileContentAsXML(commitHash: string, relativePath: string, content: string | null): string {
  if (content === null) {
    return `<file_content>
  <commit_hash>${commitHash}</commit_hash>
  <file_path>${relativePath}</file_path>
  <content>File does not exist in this commit</content>
</file_content>`;
  }

  return `<file_content>
  <commit_hash>${commitHash}</commit_hash>
  <file_path>${relativePath}</file_path>
  <content>${content}</content>
</file_content>`;
}




// const repoPath = ""; 
//   const commitHash = """; 
//   const relativePath = "";
//   const toolInstance = makeGetFileAtCommitTool(repoPath);

  
//   toolInstance.invoke({ commitHash, relativePath })
//     .then(result => {
//       console.log("Tool output:\n", result);
//     })
//     .catch(err => {
//       console.error("Error running tool:", err);
//     });
