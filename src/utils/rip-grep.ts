import { rgPath } from '@vscode/ripgrep';
import { spawn } from 'child_process';

function rgSearch(
  currentWorkingDir: string,
  pattern: string,
  path: string,
  caseSensitive: boolean,
  linesBefore: number,
  linesAfter: number,
  ignored?: string[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [`-H`, '-n', pattern, path];
    if (!caseSensitive) {
      args.push('-i');
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
 * @param repoPath is needed for setting the cwd for process which runs ripgrep
 * @param pattern or a text to be searched for
 * @param searchPath is the path within the repo to search @default '.' i.e. current directory
 * @param caseSensitive whether the search should be case sensitive or not @default false
 * @param linesBefore number of lines to show before the match @default 0
 * @param linesAfter number of lines to show after the match @default 0
 * @param ignored is an optional array of glob patterns to ignore certain files or directories
 * @returns An array of strings, each representing a line from the ripgrep output.
 */

export async function ripgrep(
  repoPath: string,
  pattern: string,
  searchPath: string,
  caseSensitive: boolean,
  linesBefore: number,
  linesAfter: number,
  ignored?: string[]
): Promise<string[]> {
  const result = await rgSearch(
    repoPath,
    pattern,
    searchPath,
    caseSensitive,
    linesBefore,
    linesAfter,
    ignored
  );
  return result.split('\n').filter((line) => line.trim() !== '');
}
