import { DynamicStructuredTool, tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
export function makeMultiEditTool(editTool: DynamicStructuredTool) {
  const multiEditSchema = z.object({
    relativePath: z.string(),
    edits: z
      .array(
        z.object({
          oldText: z.string(),
          newText: z.string(),
          replaceAll: z.boolean(),
        })
      )
      .describe('Array of edits to be applied in a sequential order'),
  });
  return tool(
    async ({
      relativePath,
      newEdits,
    }: {
      relativePath: string;
      newEdits: Array<{
        oldText: string;
        newText: string;
        replaceAll: boolean;
      }>;
    }) => {
      newEdits.forEach((edit) => {
        editTool.invoke({
          relativePath,
          oldText: edit.oldText,
          newText: edit.newText,
          replaceAll: edit.replaceAll,
        });
      });
    },
    {
      name: 'multi-edit',
      description: dedent`
        Applies multiple edits to a file inside the codebase in a single LLM call.
        Prefer this tool over the edit tool.`,
      schema: multiEditSchema,
    }
  );
}
