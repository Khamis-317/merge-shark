import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { dedent } from '../utils/dedent.js';
import path from 'path';
import {
  checkEditValidity,
  getFileContent,
  validateFileReadStatus,
  type FileEditOptions,
} from '../utils/edit-file.js';
import type { ToolContext } from '../utils/tool-context.js';

const editInputSchema = z.object({
  relativePath: z.string(),
  oldText: z.string(),
  newText: z.string(),
  replaceAll: z.boolean().optional().default(false),
});

export type EditToolInput = z.infer<typeof editInputSchema>;

export function makeEditTool(
  repoPath: string,
  edits: FileEditOptions[],
  context: ToolContext
) {
  return tool(
    async ({ relativePath, oldText, newText, replaceAll }) => {
      const absolutePath: string = path.resolve(repoPath, relativePath);

      // Validate that the file has been read and hasn't changed since
      await validateFileReadStatus(absolutePath, context);

      const fileContent = await getFileContent(absolutePath);

      await checkEditValidity(relativePath, fileContent, oldText, replaceAll);

      const fileEdit: FileEditOptions = {
        path: absolutePath,
        oldText,
        newText,
        replaceAll,
      };

      edits.push(fileEdit);

      return null;
    },
    {
      name: 'edit',
      description: dedent`
        Performs exact string replacements in existing files.
        Always preserve the exact formatting (indentation, tabs, spaces) of the text you replace.
        Do not include any line number prefixes in the 'oldText' or 'newText' values.
        Use 'replaceAll' if you intend to change every occurrence of a string (for example renaming a variable).
        The edit will FAIL if 'oldText' is not found or not unique in the file and 'replaceAll' is not 'true'
        `,
      schema: editInputSchema,
    }
  );
}
