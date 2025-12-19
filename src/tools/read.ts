import { tool } from '@langchain/core/tools';
import { DEFAULT_FILE_READ_LINES_LIMIT, readFile } from '../utils/read-file.js';
import { z } from 'zod';
import path from 'path';
import fs from 'node:fs/promises';
import type { ToolContext } from '../utils/tool-context.js';
import { dedent } from '../utils/dedent.js';

const readInputSchema = z.object({
  relativePath: z.string(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export type ReadToolInput = z.infer<typeof readInputSchema>;

export function makeReadTool(repoPath: string, context: ToolContext) {
  return tool(
    async ({
      relativePath,
      limit = DEFAULT_FILE_READ_LINES_LIMIT,
      offset = 0,
    }) => {
      const absolutePath: string = path.resolve(repoPath, relativePath);

      const data = await readFile(absolutePath, { limit, offset });

      // Track the file's modification time when it was read
      const stats = await fs.stat(absolutePath);
      context.readFiles.set(absolutePath, stats.mtime);

      return data;
    },
    {
      name: 'read',
      description: dedent`
        Reads a file from the codebase to provide more context on how to resolve the conflict.
        You can access any file from the codebase by providing the relative path to the tool (for example src/index.ts).
        Use this tool to read files that may be relevant to the code conflict. In particular, focus on files that are 
        directly imported or included in the code involved in the conflict.
        By default it reads up to ${DEFAULT_FILE_READ_LINES_LIMIT} lines starting from the beginning of the file.
        You can optionally specify a line offset and limit (especially handy for long files)
        but it's recommended to read the whole file by not providing these parameters.
        You need to use other tools with this tool (if they are available):
        `,
      schema: readInputSchema,
    }
  );
}
