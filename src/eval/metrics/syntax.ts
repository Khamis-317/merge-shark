import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { SyntaxResult } from '../types.js';

const execAsync = promisify(exec);

export function checkConflictMarkers(text: string): boolean {
  const markerRegex = /^(<<<<<<<|=======|>>>>>>>)/m;
  return !markerRegex.test(text);
}

export async function checkCompilation(
  repoPath: string,
  cmd: string
): Promise<boolean> {
  try {
    await execAsync(cmd, { cwd: repoPath });
    return true;
  } catch {
    return false;
  }
}

export async function checkLint(
  repoPath: string,
  cmd: string
): Promise<boolean> {
  try {
    await execAsync(cmd, { cwd: repoPath });
    return true;
  } catch {
    return false;
  }
}

export async function evaluateSyntax(
  resolution: string,
  repoPath?: string,
  buildCmd?: string,
  lintCmd?: string
): Promise<SyntaxResult> {
  const markersClean = checkConflictMarkers(resolution);
  let compiles: boolean | undefined = undefined;
  let lints: boolean | undefined = undefined;
  const errors: string[] = [];

  if (!markersClean) {
    errors.push('Resolution still contains conflict markers.');
  }

  if (repoPath) {
    if (buildCmd) {
      compiles = await checkCompilation(repoPath, buildCmd);
      if (!compiles) errors.push('Compilation failed.');
    }
    if (lintCmd) {
      lints = await checkLint(repoPath, lintCmd);
      if (!lints) errors.push('Linting failed.');
    }
  }

  return {
    markersClean,
    ...(compiles !== undefined ? { compiles } : {}),
    ...(lints !== undefined ? { lints } : {}),
    errors,
  };
}
