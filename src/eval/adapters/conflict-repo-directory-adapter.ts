import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { EvalCase } from '../types.js';
import { DEFAULT_EVAL_DATASETS_DIR, type AdapterOptions, type DatasetAdapter } from './adapter.js';

const execFileAsync = promisify(execFile);

export class ConflictRepoDirectoryAdapter implements DatasetAdapter {
  name = 'local-conflict-repos';
  supports = {
    fullRepo: true,
    buildCheck: true,
    ragTracking: true
  };

  async *load(options: AdapterOptions): AsyncIterable<EvalCase> {
    if (options.mode !== 'full-repo') {
      throw new Error('Local conflict repos require full-repo mode.');
    }

    const rootPath = path.resolve(options.datasetPath ?? path.join(DEFAULT_EVAL_DATASETS_DIR, 'local-conflict-repos'));
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      if (options.limit && count >= options.limit) return;
      if (!entry.isDirectory()) continue;

      const repoPath = path.join(rootPath, entry.name);
      if (!await isGitRepo(repoPath)) continue;

      const conflictingFiles = await listConflictingFiles(repoPath);
      if (conflictingFiles.length === 0) continue;

      yield {
        id: `local-${entry.name}`,
        dataset: 'local-conflict-repos',
        language: options.language ?? 'unknown',
        conflictText: '',
        groundTruth: '',
        repoPath,
        metadata: {
          repoName: entry.name,
          repoPath,
          conflictingFiles
        }
      };
      count++;
    }
  }
}

export const LocalConflictReposAdapter = ConflictRepoDirectoryAdapter;

async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    await fs.stat(path.join(repoPath, '.git'));
    return true;
  } catch (error: unknown) {
    if (!isNotFoundError(error)) {
      console.warn(`Could not inspect git metadata for ${repoPath}: ${formatError(error)}`);
    }
    return false;
  }
}

async function listConflictingFiles(repoPath: string): Promise<string[]> {
  const files = new Set<string>();

  try {
    const { stdout } = await execFileAsync('git', ['diff', '--name-only', '--diff-filter=U'], { cwd: repoPath });
    for (const file of stdout.split('\n').map((line) => line.trim()).filter(Boolean)) {
      files.add(file);
    }
  } catch (error: unknown) {
    console.warn(`Could not list unmerged files in ${repoPath}; falling back to marker scanning: ${formatError(error)}`);
  }

  try {
    const { stdout } = await execFileAsync('git', ['grep', '-l', '<<<<<<<'], { cwd: repoPath });
    for (const file of stdout.split('\n').map((line) => line.trim()).filter(Boolean)) {
      files.add(file);
    }
  } catch (error: unknown) {
    if (!isExitCode(error, 1)) {
      console.warn(`Could not scan tracked files for conflict markers in ${repoPath}: ${formatError(error)}`);
    }
  }

  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repoPath });
    for (const file of stdout.split('\n').map((line) => line.trim()).filter(Boolean)) {
      if (await fileContainsConflictMarker(path.join(repoPath, file))) {
        files.add(file);
      }
    }
  } catch (error: unknown) {
    console.warn(`Could not scan untracked files for conflict markers in ${repoPath}: ${formatError(error)}`);
  }

  return [...files];
}

async function fileContainsConflictMarker(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.includes('<<<<<<<');
  } catch (error: unknown) {
    if (!isNotFoundError(error)) {
      console.warn(`Could not read ${filePath} while scanning conflict markers: ${formatError(error)}`);
    }
    return false;
  }
}

function isExitCode(error: unknown, code: number): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code;
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT';
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
