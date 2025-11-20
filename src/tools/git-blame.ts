import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { dedent } from '../utils/dedent.js';
import { gitBlame } from '../utils/git-utils.js';

const gitBlameInputSchema = z.object({
  relativeFilePath: z.string(),
  startLine: z.number(),
  endLine: z.number(),
});

export type GitBlameToolInput = z.infer<typeof gitBlameInputSchema>;

export function makeGitBlameTool(repoPath: string) {
  return tool(
    async ({ relativeFilePath, startLine, endLine }) => {
      const blameOutput = await gitBlame(
        repoPath,
        relativeFilePath,
        startLine,
        endLine
      );
      return blameOutput;
    },
    {
      name: 'git_blame',
      description: dedent`
        Retrieves git blame information for a specific line range in a file

        Input:
        - relativeFilePath: relative path to the file in the repository (e.g., "src/index.ts")
        - startLine: starting line number (1-based)
        - endLine: ending line number (1-based, inclusive)

        Output:
        - Raw git blame output showing commit info and line content for each line in the range
        - Each line format: commit_hash (author timestamp line_number) line_content
        - Shows who last modified each line, when, and the actual line content
        - Returns empty string if file doesn't exist or line range is invalid
        
        When to use:
        - To identify who last modified specific lines in a file
        - To understand the history of changes for a particular code section
        - To track down the author of specific code changes
        `,
      schema: gitBlameInputSchema,
    }
  );
}
