import { tool } from '@langchain/core/tools';
import { readFile } from '../utils/read-file.js';
import { z } from 'zod';
import dedent from 'dedent';

export function makeReadTool(toolsNames: string[] = []) {
  const readSchema = z.object({
    path: z.string().describe(
      dedent`
        The absolute path to the file you want to read (for example /home/User/Desktop/coding/index.ts).
        You can get the base path of the project (for example: /home/User/Desktop/coding) from the path 
        of the codebase given. When analyzing a conflict, use the import paths inside the conflicting file to 
        locate and access related files for additional context. From the imports, take the file name or 
        relative path (for example: index.ts or utils/math.ts) and prepend it to the base path of the codebase.  
        For example: base_path=/home/User/Desktop/coding/, file_name=utils/math.ts, full_path=/home/User/Desktop/coding/utils/math.ts.  
        Always construct the full absolute path inside the project. Do not reference files outside the project root.
        Do not provide multiple paths, only a single file path. 
      `
    ),
  });

  return tool(
    async ({ path }: { path: string }) => {
      try {
        const data = await readFile(path);

        return data;
      } catch (err: any) {
        return `Error reading file: ${err.message}`;
      }
    },
    {
      name: 'read',
      description: dedent`
          Reads a file from the codebase to provide more context on how to resolve the conflict.
          You can access any file from the codebase by providing the absolute path to it directly by using this tool.
          Use this tool to read files that may be relevant to the code conflict. In particular, focus on files that are 
          directly imported or included by the code involved in the conflict.
          You need to use other tools with this tool (if they are available):
          ${toolsNames.map((t) => `- ${t}`)}
        `,
      schema: readSchema,
    }
  );
}
