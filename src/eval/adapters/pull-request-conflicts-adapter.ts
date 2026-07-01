import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import type { EvalCase } from '../types.js';
import {
  DEFAULT_EVAL_DATASETS_DIR,
  type DatasetAdapter,
  type AdapterOptions,
} from './adapter.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface PrRecord {
  pr_key: string;
  repo_full_name: string;
  primary_language?: string;
  base_oid: string;
  head_oid: string;
  agent?: string;
}

interface RepoRecord {
  repo_full_name: string;
  primary_language?: string;
}

interface ConflictFileRecord {
  pr_key: string;
  repo_full_name: string;
  file_path: string;
  num_regions_in_file?: string;
  conflict_type?: string;
}

export class PullRequestConflictsAdapter implements DatasetAdapter {
  name = 'pull-request-conflicts';
  supports = {
    fullRepo: true,
    buildCheck: true,
    ragTracking: true,
  };

  async *load(options: AdapterOptions): AsyncIterable<EvalCase> {
    if (options.mode !== 'full-repo') {
      throw new Error(
        'AgenticFlict requires full-repo mode because it does not provide snippet ground-truth resolutions.'
      );
    }

    const { limit } = options;
    const agenticFlictDir = await findPullRequestConflictsPath(
      options.datasetPath
    );
    const repoCacheBasePath = pullRequestConflictCacheBase(agenticFlictDir);

    const prCsvPath = path.join(agenticFlictDir, 'agenticflict_pr_clean.csv');
    const conflictFilesCsvPath = path.join(
      agenticFlictDir,
      'agenticflict_conflict_files_clean.csv'
    );
    const repoCsvPath = path.join(agenticFlictDir, 'agentflict_repo_clean.csv');

    const prCsvContent = await fs.readFile(prCsvPath, 'utf8');
    const conflictFilesCsvContent = await fs.readFile(
      conflictFilesCsvPath,
      'utf8'
    );
    const repoCsvContent = await fs.readFile(repoCsvPath, 'utf8');

    const prRecords = parse(prCsvContent, {
      columns: true,
      skip_empty_lines: true,
    }) as PrRecord[];
    const fileRecords = parse(conflictFilesCsvContent, {
      columns: true,
      skip_empty_lines: true,
    }) as ConflictFileRecord[];
    const repoRecords = parse(repoCsvContent, {
      columns: true,
      skip_empty_lines: true,
    }) as RepoRecord[];

    const prMap = new Map<string, PrRecord>();
    for (const pr of prRecords) {
      prMap.set(pr.pr_key, pr);
    }

    const languageByRepo = new Map<string, string>();
    for (const repo of repoRecords) {
      if (repo.primary_language) {
        languageByRepo.set(repo.repo_full_name, repo.primary_language);
      }
    }

    let count = 0;

    for (const fileRec of fileRecords) {
      if (limit && count >= limit) return;

      const pr = prMap.get(fileRec.pr_key);
      if (!pr) continue;

      const language =
        languageByRepo.get(pr.repo_full_name) ||
        pr.primary_language ||
        'unknown';
      if (
        options.language &&
        language.toLowerCase() !== options.language.toLowerCase()
      ) {
        continue;
      }

      const regionCount = Number.parseInt(
        fileRec.num_regions_in_file ?? '0',
        10
      );
      if (!Number.isNaN(regionCount) && regionCount <= 0) {
        continue;
      }
      if (
        options.conflictType &&
        fileRec.conflict_type !== options.conflictType
      ) {
        continue;
      }

      let repoPath: string | undefined;
      let conflictText = '';

      if (options.mode === 'full-repo') {
        repoPath =
          (await this.setupRepoCache(
            repoCacheBasePath,
            pr.repo_full_name,
            pr.base_oid,
            pr.head_oid
          )) ?? undefined;
        if (!repoPath) {
          console.warn(`Failed to setup repo for ${pr.pr_key}`);
          continue;
        }

        try {
          const filePath = path.join(repoPath, fileRec.file_path);
          conflictText = await fs.readFile(filePath, 'utf8');
        } catch (error: unknown) {
          console.warn(
            `Could not read conflicted file ${fileRec.file_path} for ${pr.pr_key}: ${formatError(error)}`
          );
        }
      }

      const evalCase: EvalCase = {
        id: `agenticflict-${fileRec.pr_key}-${fileRec.file_path}`,
        dataset: 'pull-request-conflicts',
        language,
        ...(fileRec.conflict_type
          ? { conflictType: fileRec.conflict_type }
          : {}),
        conflictText,
        groundTruth: '', // No ground truth resolution in AgenticFlict
        metadata: {
          pullRequest: pr.pr_key,
          repository: pr.repo_full_name,
          filePath: fileRec.file_path,
          conflictType: fileRec.conflict_type,
          expectedFiles: [fileRec.file_path],
          baseOid: pr.base_oid,
          headOid: pr.head_oid,
          agent: pr.agent,
        },
      };
      if (repoPath) {
        evalCase.repoPath = repoPath;
      }

      yield evalCase;

      count++;
    }
  }

  private async setupRepoCache(
    datasetBase: string,
    repoName: string,
    baseOid: string,
    headOid: string
  ): Promise<string | null> {
    if (
      !isSafeRepoName(repoName) ||
      !isSafeGitOid(baseOid) ||
      !isSafeGitOid(headOid)
    ) {
      console.error(`Invalid AgenticFlict git metadata for ${repoName}`);
      return null;
    }

    const cacheDir = path.join(datasetBase, 'cache_repos');
    await fs.mkdir(cacheDir, { recursive: true });

    const safeRepoName = repoName.replaceAll('/', '_');
    const repoPath = path.join(cacheDir, safeRepoName);

    try {
      const gitUrl = `https://github.com/${repoName}.git`;

      try {
        await fs.stat(repoPath);
        await execFileAsync('git', ['fetch', 'origin'], { cwd: repoPath });
      } catch (error: unknown) {
        if (!isNotFoundError(error)) {
          console.warn(
            `Could not reuse cached repo ${repoPath}; cloning a fresh copy: ${formatError(error)}`
          );
        }
        await execFileAsync('git', ['clone', gitUrl, repoPath]);
      }

      await execFileAsync('git', ['reset', '--hard'], { cwd: repoPath });
      await execFileAsync('git', ['clean', '-fd'], { cwd: repoPath });
      await execFileAsync('git', ['checkout', '-f', baseOid], {
        cwd: repoPath,
      });

      try {
        await execFileAsync('git', ['merge', '--no-commit', headOid], {
          cwd: repoPath,
        });
      } catch (err: unknown) {
        if (isMergeConflictError(err)) {
          return repoPath;
        }
        throw err;
      }

      return null;
    } catch (e) {
      console.error(`Repo cache setup failed for ${repoName}`, e);
      return null;
    }
  }
}

export const AgenticFlictAdapter = PullRequestConflictsAdapter;

function pullRequestConflictCacheBase(cleanDataPath: string): string {
  if (
    path.basename(cleanDataPath) === 'clean' &&
    path.basename(path.dirname(cleanDataPath)) === 'data'
  ) {
    return path.dirname(path.dirname(cleanDataPath));
  }
  return cleanDataPath;
}

async function findPullRequestConflictsPath(
  datasetPath: string | undefined
): Promise<string> {
  const basePath = path.resolve(datasetPath ?? DEFAULT_EVAL_DATASETS_DIR);
  const candidates = [
    basePath,
    path.join(basePath, 'data/clean'),
    path.join(basePath, '20118379/data/clean'),
  ];

  for (const candidate of candidates) {
    try {
      await fs.stat(path.join(candidate, 'agenticflict_pr_clean.csv'));
      await fs.stat(
        path.join(candidate, 'agenticflict_conflict_files_clean.csv')
      );
      return candidate;
    } catch (error: unknown) {
      if (!isNotFoundError(error)) {
        console.warn(
          `Could not inspect pull-request conflict data path ${candidate}: ${formatError(error)}`
        );
      }
      continue;
    }
  }

  throw new Error(
    `Pull-request conflict data not found. Expected clean CSV files under one of: ${candidates.join(', ')}`
  );
}

function isSafeRepoName(repoName: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoName);
}

function isSafeGitOid(oid: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(oid);
}

function isMergeConflictError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const record = error as Record<string, unknown>;
  const text = [record['message'], record['stdout'], record['stderr']]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');

  return /CONFLICT|Automatic merge failed|Merge conflict/i.test(text);
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
