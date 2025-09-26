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
      edits,
    }: {
      relativePath: string;
      edits: Array<{
        oldText: string;
        newText: string;
        replaceAll?: boolean;
      }>;
    }) => {
      edits.forEach((edit) => {
        editTool.invoke({
          relativePath,
          oldText: edit.oldText,
          newText: edit.newText,
          replaceAll: edit.replaceAll ?? false,
        });
      });
    },
    {
      name: 'multiedit',
      description: dedent`
        This tool performs multiple edits to a file within the codebase in one operation.
        It is built on top of 'edit' tool allowing multiple exact string replacements in a single atomic operation.

        <usage>
          This tool is ideal when you need to make several changes to different parts of the same file.
          Prefer this tool over the 'edit' tool.
          You MUST use the 'read' tool BEFORE calling this tool.
          All edits are performed in sequence, in the order they are provided.
          Each edit operates on the result of the previous edit.
          All edits must be valid for the operation to succeed or none will be performed.
          Since edits are applied in sequence, ensure that earlier edits don't affect the text that later edits are trying to find.

          <input>
            <relativePath>The path of the file to edit relative to repoPath(from the 'edit' tool).</relativePath>
            <edits>
              An array of edit operations to perform, where each edit contains:
              - old_string: The text to replace (must match the file contents exactly, including all whitespace and indentation).
              - new_string: The edited text to replace the old_string.
              - replace_all: Replace all occurences of old_string within the current file. This parameter is optional and defaults to false.
            </edits>
          </input>
        </usage>

        <requirements>
          <requirement>All edits follow the same requirements as the single 'edit' tool.</requirement>
          <requirement>The edits are atomic - either all succeed or none are applied.</requirement>
          <requirement>Plan your edits carefully to avoid conflicts between sequential operations.</requirement>
          <requirement>Ensure edits result in valid, idiomatic code.</requirement>
        </requirements>

        <failure_modes>
          <failure_mode>The tool will fail if edits.old_string doesn't match the file contents exactly (including whitespace).</failure_mode>
          <failure_mode>The tool will fail if edits.old_string and edits.new_string are the same.</failure_mode>
        </failure_modes>
      `,
      schema: multiEditSchema,
    }
  );
}
