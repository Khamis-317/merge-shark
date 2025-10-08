import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { dedent } from '../utils/dedent.js';
import path from 'path';
import {
  checkEditValidity,
  getFileContent,
  type FileEditOptions,
} from '../utils/edit-file.js';
import type { ToolContext } from '../utils/tool-context.js';

export function makeEditTool(
  repoPath: string,
  edits: FileEditOptions[],
  context: ToolContext
) {
  const editSchema = z.object({
    relativePath: z.string(),
    oldText: z.string(),
    newText: z.string(),
    replaceAll: z.boolean().optional().default(false),
  });

  return tool(
    async ({
      relativePath,
      oldText,
      newText,
      replaceAll,
    }: {
      relativePath: string;
      oldText: string;
      newText: string;
      replaceAll: boolean;
    }) => {
      const absolutePath: string = path.resolve(repoPath, relativePath);

      if (context.lastReadPath !== absolutePath) {
        throw new Error(
          `Invalid usage: You must call 'read' on ${relativePath} immediately before editing it.`
        );
      }

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
