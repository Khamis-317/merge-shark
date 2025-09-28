import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
import { getBlame } from '../utils/git-utils.js';
export function makeGetBlameTool(repoPath: string){
    const blameSchema = z.object({
        relativePath: z.string(),
        startLine: z.number(),
        endLine: z.number(),
    });

    return tool(
        async ({relativePath, startLine, endLine}) =>{
           try {
            const blameOutput = await getBlame(repoPath, relativePath, startLine, endLine);
            return formatBlameAsXML(relativePath, startLine, endLine, blameOutput);
            } catch (err: unknown) {
                if (err instanceof Error) {
                    return `Error retrieving last merge commits: ${err.message}`;
                }
                return `An unknown error occurred: ${err}`;
            }
        },
        {
            name: 'get_blame',
            description: dedent`
                Retrieves git blame information for a specific line range in a file.

                Input:
                - relativePath: relative path to the file in the repository (e.g., "src/index.ts")
                - startLine: starting line number (1-based)
                - endLine: ending line number (1-based, inclusive)

                Output:
                - XML with blame information showing who last modified each line and when.

                <blame>
                  <file_path>relative/path/to/file.ts</file_path>
                  <line_range>startLine-endLine</line_range>
                  <content>
                    Git blame standared output showing commit hash, author, date, and line content for each line.
                  </content>
                </blame>

                When to use:
                - To identify who last modified specific lines in a file
                - To understand the history of changes for a particular code section
                - To track down the author of specific code changes
            `,
            schema: blameSchema,
        }
    );
}

function formatBlameAsXML(relativePath: string, startLine: number, endLine: number, blameOutput: string | null): string {
    return `<blame>
  <file_path>${relativePath}</file_path>
  <line_range>${startLine}-${endLine}</line_range>
  <content>
${blameOutput}
  </content>
</blame>`;
}

