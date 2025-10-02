import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { listFiles } from '../utils/list-files.js';
import path from 'path';
import { dedent } from '../utils/dedent.js';

export function makeLsTool(repoPath: string) {
  const lsSchema = z.object({
    dirPath: z.string(),
  });

  return tool(
    async ({ dirPath }: { dirPath: string }) => {
      try {
        const absolutePath = path.resolve(repoPath, dirPath);
        const listedFiles = await listFiles(absolutePath);
        return listedFiles.map((file) => file).join('\n');
      } catch (err: unknown) {
        if (err instanceof Error) {
          return `Error listing directory: ${err.message}`;
        }
        return `An unknown error occurred: ${err}`;
      }
    },
    {
      name: 'ls',
      description: dedent`
        Lists files and directories in the specified path.
        This tool shows contents of a directory.
        Use this tool when you need to explore the structure of the codebase.
        Sub-Directories will have a trailing slash (/).
        Provide a relative path to the directory you want to list (e.g., "src" or "src/tools").
      `,
      schema: lsSchema,
    }
  );
}

/** 
Lists files and directories in a given path. 
The path parameter must be an absolute path, not a relative path. 
You can optionally provide an array of glob patterns to ignore with the ignore parameter. 
You should generally prefer the Glob and Grep tools, if you know which directories to search.
*/
