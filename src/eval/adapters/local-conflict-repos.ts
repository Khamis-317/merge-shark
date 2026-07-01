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
  } catch {
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
  } catch {
    // Fall through to marker scanning.
  }

  try {
    const { stdout } = await execFileAsync('git', ['grep', '-l', '<<<<<<<'], { cwd: repoPath });
    for (const file of stdout.split('\n').map((line) => line.trim()).filter(Boolean)) {
      files.add(file);
    }
  } catch {
    // git grep exits with code 1 when no matches are found.
  }

  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repoPath });
    for (const file of stdout.split('\n').map((line) => line.trim()).filter(Boolean)) {
      if (await fileContainsConflictMarker(path.join(repoPath, file))) {
        files.add(file);
      }
    }
  } catch {
    // Ignore untracked-file scan failures.
  }

  return [...files];
}

async function fileContainsConflictMarker(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.includes('<<<<<<<');
  } catch {
    return false;
  }
}
