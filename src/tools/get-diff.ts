import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
import { getDiffForFile } from '../utils/git-utils.js';

export function makeGetDiffTool(repoPath: string) {
  const diffSchema = z.object({
    from: z.string(),
    to: z.string(),
    relativePath: z.string(),
  });

  return tool(
    async ({ from, to, relativePath }) => {
      try {
        const diffOutput = await getDiffForFile(repoPath, from, to, relativePath);
        return formatDiffAsXML(from, to, relativePath, diffOutput);
      } catch (err: unknown) {
        if (err instanceof Error) {
          return `Error generating diff for ${relativePath} between ${from} and ${to}: ${err.message}`;
        }
        return `An unknown error occurred: ${err}`;
      }
    },
    {
      name: 'get_diff',
      description: dedent`
        Retrieves the diff for a specific file between two commits (or branches).

        Input:
        - from: the baseline commit hash or branch name.
        - to: the target commit hash or branch name.
        - relativePath: relative path to the file in the repository (e.g., "src/index.ts")

        Output:
        - XML with unified diff content if the file exists in either commit.

        <diff>
          <from>commit_hash_or_branch_here</from>
          <to>commit_hash_or_branch_here</to>
          <file_path>relative/path/to/file.ts</file_path>
          <content>
            Unified diff content here.
          </content>
        </diff>

        When to use:
        - To see exactly what changed in a file between two commits or branches.
        - Commit hashes can be obtained from "get_merge_info", "get_recent_commits_for_file".
      `,
      schema: diffSchema,
    }
  );
}

function formatDiffAsXML(from: string, to: string, relativePath: string, diffOutput: string | null): string {
  if (diffOutput === null || diffOutput.trim() === '') {
    return `<diff>
  <from>${from}</from>
  <to>${to}</to>
  <file_path>${relativePath}</file_path>
  <content>No differences found (files are identical or file doesn't exist in both commits)</content>
</diff>`;
  }

  return `<diff>
  <from>${from}</from>
  <to>${to}</to>
  <file_path>${relativePath}</file_path>
  <content>
${diffOutput}
  </content>
</diff>`;
}




