import { rgPath } from '@vscode/ripgrep';
import { spawn } from 'child_process';

function rgSearch(
  currentWorkingDir: string,
  path: string,
  pattern: string,
  caseSensitive: boolean,
  ignored: string[] | undefined,
  linesBefore: number,
  linesAfter: number
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
    args.push(`-B`, linesBefore.toString());
    args.push(`-A`, linesAfter.toString());

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

    if (output.length === 0) {
      output = 'No results found';
    }

    rg.on('close', (code) => {
      if (code === 0 || code === 1) {
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
 * @param repoPath is need for setting the cwd for process which runs ripgrep
 * @param searchPath is the path within the repo to search
 * @param pattern or a text to be searched for
 * @param caseSensitive whether the search should be case sensitive or not @default false
 * @param ignored is an optional array of glob patterns to ignore certain files or directories @default []
 * @param linesBefore number of lines to show before the match @default 0
 * @param linesAfter number of lines to show after the match @default 0
 * @returns An array of strings, each representing a line from the ripgrep output.
 */

export async function ripgrep(
  repoPath: string,
  searchPath = `.`,
  pattern: string,
  caseSensitive = false,
  ignored?: string[],
  linesBefore = 0,
  linesAfter = 0
): Promise<string[]> {
  const result = await rgSearch(
    repoPath,
    searchPath,
    pattern,
    caseSensitive,
    ignored,
    linesBefore,
    linesAfter
  );
  return result.split('\n').filter((line) => line.trim() !== '');
}
