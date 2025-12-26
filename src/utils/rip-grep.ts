import { rgPath } from '@vscode/ripgrep';
import { spawn } from 'child_process';

function rgSearch(
  currentWorkingDir: string,
  path: string,
  pattern: string,
  caseSensitive: boolean,
  ignored: string[] | undefined,
  linesBeforeAndAfter: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    let args = [`-H`, '-n', pattern, path];
    if (!caseSensitive) {
      args = ['-i', ...args];
    }
    if (ignored && ignored.length > 0) {
      ignored.forEach((ignoredPattern) => {
        args.push('--glob', ignoredPattern);
      });
    }
    args.push(`-C`, linesBeforeAndAfter.toString());

    const rg = spawn(rgPath, args, {
      cwd: currentWorkingDir,
    });
    let output = '';
    let errorOutput = '';

    rg.stdout.on('data', (data) => {
      output += data.toString();
    });

    rg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    rg.on('close', (code) => {
      if (code === 0 || errorOutput.length === 0) {
        resolve(output);
      } else {
        reject(
          new Error(`ripgrep process exited with code ${code}: ${errorOutput}`)
        );
      }
    });
  });
}

/**
 *
 * @param repoPath is need for setting the cwd for process which runs ripgrep
 * @param searchPath is the path within the repo to search
 * @param pattern or a text to be searched for
 * @param caseSensitive whether the search should be case sensitive or not
 * @param ignored is an optional array of glob patterns to ignore certain files or directories
 * @returns An array of strings, each representing a line from the ripgrep output.
 */

export async function ripgrep(
  repoPath: string,
  searchPath: string,
  pattern: string,
  caseSensitive = false,
  ignored?: string[],
  linesBeforeAndAfter = 0
): Promise<string[]> {
  const result = await rgSearch(
    repoPath,
    searchPath,
    pattern,
    caseSensitive,
    ignored,
    linesBeforeAndAfter
  );
  return result.split('\n').filter((line) => line.trim() !== '');
}
