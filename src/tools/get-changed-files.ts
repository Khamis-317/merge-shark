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
    async ({ commitHash }) => {
      try {
        const changedFiles = await getChangedFilesInCommit(repoPath, commitHash);
        return formatChangedFilesAsXML(commitHash, changedFiles);
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
        - commitHash: the commit hash to get changed files for (from HEAD, MERGE_HEAD, merge-base, or any commit hash you get from provided tools)

        Output:
        Returns changed files in XML format exactly as shown:
        <changed_files count="number of changed files">
          <commit_hash>commit_hash_here</commit_hash>
          <file>
            <status>M</status>
            <path>src/index.ts</path>
          </file>
          <file>
            <status>A</status>
            <path>src/newfile.ts</path>
          </file>
          <file>
            <status>D</status>
            <path>src/oldfile.ts</path>
          </file>
        </changed_files>

        Status meanings:
        - A: Added
        - M: Modified
        - D: Deleted
        - R: Renamed
        - C: Copied

        When to use:
        - To see what files were affected by a specific commit
        - To understand the scope of changes in a commit
        - Commit hashes can be obtained from "get_merge_info", "get_recent_commits_for_file", or other git tools
        - Use the returned file paths (relative paths) with "get_file_at_commit" or "get_diff" for detailed analysis
      `,
      schema: changedFilesSchema,
    }
  );
}

function formatChangedFilesAsXML(commitHash: string, changedFiles: { status: string; filePath: string }[]): string {
  if (changedFiles.length === 0) {
    return `<changed_files count="0">
  <commit_hash>${commitHash}</commit_hash>
  <message>No files changed in this commit</message>
</changed_files>`;
  }

  const filesXML = changedFiles
    .map(file => 
      `  <file>
    <status>${file.status}</status>
    <path>${file.filePath}</path>
  </file>`
    )
    .join('\n');

  return `<changed_files count="${changedFiles.length}">
  <commit_hash>${commitHash}</commit_hash>
${filesXML}
</changed_files>`;
}

// const repoPath = ""; 
//   const commitHash: string = "e9726c59e8a63e3a99095701c5fe5f66ad429f12";
 

//   const toolInstance = makeGetChangedFilesTool(repoPath);

  
//   toolInstance.invoke({ commitHash})
//     .then(result => {
//       console.log("Tool output:\n", result);
//     })
//     .catch(err => {
//       console.error("Error running tool:", err);
//     });
