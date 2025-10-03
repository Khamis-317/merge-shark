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
      const absolutePath = path.resolve(repoPath, dirPath);
      const listedFiles = await listFiles(absolutePath);
      return listedFiles.map((file) => file).join('\n');
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
