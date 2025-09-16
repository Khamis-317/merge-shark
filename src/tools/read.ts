import { tool } from '@langchain/core/tools';
import { DEFAULT_FILE_READ_LINES_LIMIT, readFile } from '../utils/read-file.js';
import { z } from 'zod';
import dedent from 'dedent';
import path from 'path';

export function makeReadTool(repoPath: string) {
  const readSchema = z.object({
    relativePath: z
      .string()
      .describe(
        'The relative path to the file you want to read (for example src/index.ts)'
      ),
    limit: z
      .number()
      .describe(
        'Maximum number of lines to read from the file (by default 2000)'
      ),
  });

  return tool(
    async ({
      relativePath,
      limit = DEFAULT_FILE_READ_LINES_LIMIT,
    }: {
      relativePath: string;
      limit: number;
    }) => {
      try {
        const absolutePath: string = path.resolve(repoPath, relativePath);

        const data = await readFile(absolutePath, { limit });

        return data;
      } catch (err: any) {
        return `Error reading file: ${err.message}`;
      }
    },
    {
      name: 'read',
      description: dedent`
          Reads a file from the codebase to provide more context on how to resolve the conflict.
          You can access any file from the codebase by providing the relative path to the tool (for example src/index.ts).
          Use this tool to read files that may be relevant to the code conflict. In particular, focus on files that are 
          directly imported or included in the code involved in the conflict.
          By default it reads up to 2000 lines starting from the beginning of the file.
          You can optionally specify a line offset and limit (especially handy for long files)
          but it's recommended to read the whole file by not providing these parameters.
          You need to use other tools with this tool (if they are available):
        `,
      schema: readSchema,
    }
  );
}
