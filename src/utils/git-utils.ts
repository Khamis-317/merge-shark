import { exec } from './exec.js';

export const DEFAULT_MAX_COMMITS_PER_FILE = 7;

export async function getMergeTarget(repoPath: string): Promise<string> {
  const command: string = 'git rev-parse MERGE_HEAD';
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }

  return result.stdout.toString().trim();
}

export async function getMergeBase(
  repoPath: string,
  ours: string,
  theirs: string
): Promise<string> {
  const command: string = `git merge-base ${ours} ${theirs}`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }
  return result.stdout.toString().trim();
}

export async function getLastCommitsForFile(
  repoPath: string,
  filePath: string,
  branchRef: string,
  n: number
): Promise<string> {
  const command = `git log -n ${n} --pretty=format:"%H" ${branchRef} -- ${filePath}`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }

  return result.stdout.toString().trim();
}

export async function getCommitMetaData(
  repoPath: string,
  commitHash: string
): Promise<string> {
  const command = `git log -1 --pretty=format:"%an%n%ad%n%B" ${commitHash}`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }
  return result.stdout.toString().trim();
}

export async function getDiffForFile(
  repoPath: string,
  commitHashX: string,
  commitHashY: string,
  filePath: string
): Promise<string> {
  const command = `git diff ${commitHashX} ${commitHashY} -- ${filePath}`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }

  return result.stdout.toString().trim();
}

export async function getChangedFilesInCommit(
  repoPath: string,
  commitHash: string
): Promise<string> {
  const command = `git diff-tree --no-commit-id --name-status -r ${commitHash}`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }

  return result.stdout.toString().trim();
}

export async function getBlame(
  repoPath: string,
  relativePath: string,
  startLine: number,
  endLine: number
): Promise<string> {
  const command = `git blame -L ${startLine},${endLine} ${relativePath}`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr.trim());
  }

  return result.stdout.toString().trim();
}

export async function getLastMergeCommits(
  repoPath: string,
  n: number
): Promise<string> {
  const command = `git log --merges -n ${n} --pretty=format:"%H"`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr.trim());
  }

  return result.stdout.toString().trim();
}

export function formatMergeInfo(
  mergeTarget: string,
  mergeBase: string
): string {
  return `<merge_info>
  <merge_target>
    <hash>${mergeTarget}</hash>
  </merge_target>
  <merge_base>
    <hash>${mergeBase}</hash>
  </merge_base>
</merge_info>`;
}
