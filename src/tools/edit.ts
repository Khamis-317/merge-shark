import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { dedent } from '../utils/dedent.js';
import path from 'path';
import { checkEditValidity, type FileEdit } from '../utils/edit-file.js';

export function makeEditTool(repoPath: string, edits: FileEdit[]) {
  const editSchema = z.object({
    relativePath: z.string(),
    oldText: z.string(),
    newText: z.string(),
    replaceAll: z.boolean().optional(),
  });

  return tool(
    async ({
      relativePath,
      oldText,
      newText,
      replaceAll = false,
    }: {
      relativePath: string;
      oldText: string;
      newText: string;
      replaceAll: boolean;
    }) => {
      try {
        const absolutePath: string = path.resolve(repoPath, relativePath);

        const editError = await checkEditValidity(
          absolutePath,
          oldText,
          replaceAll
        );
        if (editError) return editError;

        const edit: FileEdit = {
          path: absolutePath,
          oldText,
          newText,
          replaceAll,
        };

        edits.push(edit);

        return null;
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
        Performs exact string replacements in existing files.
        You MUST use the 'read' tool BEFORE calling this tool.
        Always preserve the exact formatting (indentation, tabs, spaces) of the text you replace.
        Do not include any line number prefixes in the 'oldText' or 'newText' values.
        Use 'replaceAll' if you intend to change every occurrence of a string (for example renaming a variable).
        The edit will FAIL if 'oldText' is not found or not unique in the file and 'replaceAll' is not 'true'
      `,
      schema: editSchema,
    }
  );
}
