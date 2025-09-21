import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
import fs from 'node:fs/promises';
import path from 'path';

export function makeEditTool(repoPath: string) {
  const editSchema = z.object({
    relativePath: z
      .string()
      .describe(
        'The relative path to the file you want to edit (for example src/index.ts).'
      ),
    conflict: z.string().describe('The section of code that is in conflict.'),
    resolution: z
      .string()
      .describe('The generated resoultion of the conflicted code.'),
  });

  return tool(
    async ({
      relativePath,
      conflict,
      resolution,
    }: {
      relativePath: string;
      conflict: string;
      resolution: string;
    }) => {
      try {
        const absolutePath: string = path.resolve(repoPath, relativePath);

        const data = await fs.readFile(absolutePath, 'utf-8');

        const editedData = data.replace(conflict, resolution);

        fs.writeFile(absolutePath, editedData, 'utf8');

        return `EDITED SUCCESSFULLY:\n\n${editedData}`;
      } catch (err: unknown) {
        if (err instanceof Error) {
          return `Error editing file: ${err.message}`;
        }
        return `An unknown error occured: ${err}`;
      }
    },
    {
      name: 'edit',
      description: dedent`
        Applies an accepted resolution to the codebase by performing exact string replacements.  
        This tool replaces conflicted code with the resolution you generated.  
        You must call the 'read' tool at least once before editing.
        Use this tool if the user approves the resolution.  
        When applying edits, preserve exact indentation (tabs/spaces) exactly as it appears AFTER the line number prefix.
      `,
      schema: editSchema,
    }
  );
}
