import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { exec } from '../utils/exec.js';
import { dedent } from '../utils/dedent.js';
import type { ExecException } from 'node:child_process';
import type { ToolContext } from '../utils/tool-context.js';

const bashInputSchema = z.object({
  command: z.string(),
});

export type BashToolInput = z.infer<typeof bashInputSchema>;

/**
 * List of git read-only commands that don't need approval.
 * These commands only read data and don't modify the repository state.
 */
const GIT_READ_COMMANDS = [
  'git log',
  'git diff',
  'git show',
  'git status',
  'git branch',
  'git tag',
  'git describe',
  'git rev-parse',
  'git ls-files',
  'git ls-tree',
  'git cat-file',
  'git blame',
  'git shortlog',
  'git reflog',
  'git config --get',
  'git config --list',
  'git remote -v',
  'git remote show',
  'git stash list',
  'git rev-list',
  'git name-rev',
  'git for-each-ref',
  'git count-objects',
  'git fsck',
  'git verify-commit',
  'git verify-tag',
];

/**
 * Checks if a command is a git read-only command that doesn't need approval.
 */
function isGitReadCommand(command: string): boolean {
  const trimmedCommand = command.trim();
  return GIT_READ_COMMANDS.some(
    (gitCmd) =>
      trimmedCommand === gitCmd || trimmedCommand.startsWith(gitCmd + ' ')
  );
}

export function makeBashTool(repoPath: string, context: ToolContext) {
  return tool(
    async ({ command }) => {
      // Check if the command needs approval
      if (!isGitReadCommand(command)) {
        const result = await context.onBashRequested({ command });

        if (!result.approved) {
          const message = result.feedback
            ? `Command rejected by user. User feedback: ${result.feedback}`
            : 'Command rejected by user. Consider another approach instead.';
          throw new Error(message);
        }
      }

      try {
        const { stdout, stderr } = await exec(command, {
          cwd: repoPath,
          env: { ...process.env, GIT_EDITOR: 'true' },
        });

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
