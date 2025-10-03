import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { dedent } from '../utils/dedent.js';
import {
  checkEditValidity,
  getFileContent,
  type EditOptions,
  type FileEditOptions,
} from '../utils/edit-file.js';
import path from 'path';
import type { ToolContext } from '../utils/tool-context.js';
export function makeMultiEditTool(
  repoPath: string,
  edits: FileEditOptions[],
  context: ToolContext
) {
  const multiEditSchema = z.object({
    relativePath: z.string(),
    newEdits: z.array(
      z.object({
        oldText: z.string(),
        newText: z.string(),
        replaceAll: z.boolean().optional().default(false),
      })
    ),
  });
  return tool(
    async ({
      relativePath,
      newEdits,
    }: {
      relativePath: string;
      newEdits: EditOptions[];
    }) => {
      const absolutePath: string = path.resolve(repoPath, relativePath);
      if (context.lastFileRead !== absolutePath) {
        throw new Error(
          `Invalid usage: You must call 'read' on ${relativePath} immediately before editing it.`
        );
      }
      let fileContent = await getFileContent(absolutePath);
      const validEdits: FileEditOptions[] = [];

      for (const edit of newEdits) {
        const editError = await checkEditValidity(
          absolutePath,
          fileContent,
          edit.oldText,
          edit.replaceAll
        );
        if (editError) return editError;

        fileContent = edit.replaceAll
          ? fileContent.replaceAll(edit.oldText, edit.newText)
          : fileContent.replace(edit.oldText, edit.newText);

        const fileEdit: FileEditOptions = {
          path: absolutePath,
          ...edit,
        };
        validEdits.push(fileEdit);
      }

      edits.push(...validEdits);
      return null;
    },
    {
      name: 'multi-edit',
      description: dedent`
        This is a tool for making multiple edits to a single file in one operation.
        Prefer this tool over the edit tool when you need to make multiple edits to the same file.

        Before using this tool:
        1. Use the read tool to understand the file's contents and context
        2. Verify the directory path is correct

        To make multiple file edits, provide the following:
        1. relativePath: The relative path to the file to modify (must be absolute, not relative)
        2. edits: An array of edit operations to perform, where each edit contains:
        - oldText: The text to replace
        - newText: The edited text to replace the oldText
        - replace_all: Replace all occurences of oldText. This parameter is optional and defaults to false.

        IMPORTANT:
        - All edits are applied in sequence, in the order they are provided
        - Each edit operates on the result of the previous edit
        - If any edit fails, none will be applied
        - This tool is ideal when you need to make several changes to different parts of the same file
      `,
      schema: multiEditSchema,
    }
  );
}
