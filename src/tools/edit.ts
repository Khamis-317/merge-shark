import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { dedent } from '../utils/dedent.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  checkEditValidity,
  getFileContent,
  validateFileReadStatus,
  editFile,
  type FileEditOptions,
} from '../utils/edit-file.js';
import type { ToolContext } from '../utils/tool-context.js';
import type { LSPManager } from '../utils/lsp.js';

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
  context: ToolContext,
  lspManager: LSPManager
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

      const result = await context.onEditRequested(fileEdit);

      if (!result.approved) {
        const message = result.feedback
          ? `Edit rejected by user. User feedback: ${result.feedback}`
          : 'Edit rejected by user. Consider another edit instead.';
        throw new Error(message);
      }

      // Apply the edit
      await editFile(fileEdit);

      const stats = await fs.stat(absolutePath);
      context.readFiles.set(absolutePath, stats.mtime);

      // Keep track of edits for logging/history
      edits.push(fileEdit);

      // Dispatch LSP validation on the persisted file
      if (lspManager.hasLSPSupport(absolutePath)) {
        const lspResult = await lspManager.validate(absolutePath);
        return `Edit applied successfully.\n\nLSP Validation Result:\n${lspResult}`;
      }

      return 'Edit applied successfully. No LSP available for this file type — consider using bash to verify compilation.';
    },
    {
      name: 'edit',
      description: dedent`
        Performs exact string replacements in existing files.
        Always preserve the exact formatting (indentation, tabs, spaces) of the text you replace.
        Do not include any line number prefixes in the 'oldText' or 'newText' values.
        Use 'replaceAll' if you intend to change every occurrence of a string (for example renaming a variable).
        The edit will FAIL if 'oldText' is not found or not unique in the file and 'replaceAll' is not 'true'
        After the edit is applied and persisted on disk, the file is automatically validated by the LSP.
        If the LSP reports errors, you should fix them by applying another edit.
        `,
      schema: editInputSchema,
    }
  );
}
