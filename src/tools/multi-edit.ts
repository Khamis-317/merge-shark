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

export interface MultiEditToolInput {
  relativePath: string;
  newEdits: EditOptions[];
}

export function makeMultiEditTool(
  repoPath: string,
  edits: FileEditOptions[],
  context: ToolContext
) {
  const multiEditSchema = z.object({
    relativePath: z.string().describe('The relative path to the file to edit'),
    newEdits: z
      .array(
        z
          .object({
            oldText: z.string().describe('The text to be replaced'),
            newText: z
              .string()
              .describe('The new text to replace the old text'),
            replaceAll: z
              .boolean()
              .optional()
              .default(false)
              .describe('Whether to replace all occurrences of the old text'),
          })
          .describe('The edit operation to be performed')
      )
      .describe('The list of edits to perform on the file'),
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

      if (context.lastReadPath !== absolutePath) {
        throw new Error(
          `Invalid usage: You must call 'read' on ${relativePath} immediately before editing it.`
        );
      }

      let fileContent = await getFileContent(absolutePath);
      const validEdits: FileEditOptions[] = [];

      for (const edit of newEdits) {
        await checkEditValidity(
          relativePath,
          fileContent,
          edit.oldText,
          edit.replaceAll
        );

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
      name: 'multiedit',
      description: dedent`
        This is a tool for making multiple edits to a single file in one operation.

        Before using this tool:
        1. Use the read tool to understand the file's contents and context
        2. Verify the directory path is correct

        To make multiple file edits, provide the following:
        1. relativePath: The relative path to the file to modify
        2. newEdits: An array of edit operations to perform, where each edit contains:
        - oldText: The text to replace
        - newText: The edited text to replace the oldText
        - replaceAll: Replace all occurences of oldText. This parameter is optional and defaults to false.

        IMPORTANT:
        - Prefer this tool over the edit tool when you need to make multiple edits to the same file
        - All edits are applied in sequence, in the order they are provided
        - Each edit operates on the result of the previous edit
        - If any edit fails, none will be applied
        `,
      schema: multiEditSchema,
    }
  );
}
