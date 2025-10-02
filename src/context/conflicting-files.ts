import { exec } from '../utils/exec.js';

export async function getConflictingFiles(repoPath: string) {
  const command = 'git diff --name-only --diff-filter=U';
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }

  return result.stdout
    .toString()
    .split('\n')
    .filter((file) => file.length > 0);
}
