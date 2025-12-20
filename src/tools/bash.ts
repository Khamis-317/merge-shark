import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { exec } from '../utils/exec.js';
import { dedent } from '../utils/dedent.js';
import type { ExecException } from 'node:child_process';

const bashInputSchema = z.object({
  command: z.string(),
});

export type BashToolInput = z.infer<typeof bashInputSchema>;

export function makeBashTool(repoPath: string) {
  return tool(
    async ({ command }) => {
      try {
        const { stdout, stderr } = await exec(command, { cwd: repoPath });

        if (stdout && stderr) {
          return dedent`
            STDOUT:
            ${stdout}

            STDERR:
            ${stderr}
            `;
        } else if (stdout) {
          return `STDOUT:\n${stdout}`;
        } else if (stderr) {
          return `STDERR:\n${stderr}`;
        }
        return 'Command executed successfully with no output.';
      } catch (error) {
        const execError = error as ExecException;
        return dedent`
          Error executing command: ${execError.message}
          Exit code: ${execError.code}
          ${execError.killed ? 'Process was killed.' : ''}
          STDERR:
          ${execError.stderr ?? ''}

          STDOUT:
          ${execError.stdout ?? ''}
          `;
      }
    },
    {
      name: 'bash',
      description: dedent`
        Executes a bash command in the terminal.
        Use this tool to run git commands, run check file status, or perform other terminal operations.
        The command will be executed in the root of the repository.
        `,
      schema: bashInputSchema,
    }
  );
}
