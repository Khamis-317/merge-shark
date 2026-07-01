import { exec } from './exec.js';

export const DEFAULT_MAX_COMMITS_PER_FILE = 7;

/**
 * Gets the merge target commit hash (MERGE_HEAD) for the current merge operation.
 *
 * @param repoPath The absolute path to the git repository.
 * @returns The commit hash of the merge target.
 */
export async function gitMergeTarget(repoPath: string): Promise<string> {
  const command: string = 'git rev-parse MERGE_HEAD';
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }

  return result.stdout.toString().trim();
}

/**
 * Finds the merge base commit between two branches or commits.
 *
 * @param repoPath The absolute path to the git repository.
 * @param ours The branch reference we are merging into.
 * @param theirs The incoming branch reference.
 * @returns The commit hash of the merge base.
 */
export async function gitMergeBase(
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

/**
 * Gets the current branch name for the repository.
 *
 * @param repoPath The absolute path to the git repository.
 * @returns The current branch name (e.g. "main"), or "HEAD" in detached state.
 */
export async function gitCurrentBranch(repoPath: string): Promise<string> {
  const command: string = 'git rev-parse --abbrev-ref HEAD';
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }

  return result.stdout.toString().trim();
}

/**
 * Retrieves detailed information about the last commits that modified a specific file.
 *
 * @param repoPath The absolute path to the git repository.
 * @param filePath The relative path to the file within the repository.
 * @param branchRef The branch or commit reference to search from.
 * @param limit The maximum number of commits to return.
 * @returns A string containing detailed commit info in format: hash|author|date|message (one per line).
 */
export async function getLastCommitsForFile(
  repoPath: string,
  filePath: string,
  branchRef: string,
  limit: number
): Promise<string> {
  const command = `git log -n ${limit} --pretty=format:"%H|%an|%ad|%s" --date=short ${branchRef} -- ${filePath}`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }

  return result.stdout.toString().trim();
}

/**
 * Gets the unified diff between two commits for a specific file.
 *
 * @param repoPath The absolute path to the git repository.
 * @param commitHashX The baseline commit hash.
 * @param commitHashY The target commit hash.
 * @param filePath The relative path to the file within the repository.
 * @returns The unified diff output as a string.
 */
export async function gitDiff(
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

/**
 * Lists all files that were changed in a specific commit.
 *
 * @param repoPath The absolute path to the git repository.
 * @param commitHash The commit hash to analyze.
 * @returns A string with file status and paths, one per line.
 */
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

/**
 * Retrieves git blame information for a specific line range in a file.
 *
 * @param repoPath The absolute path to the git repository.
 * @param relativePath The relative path to the file within the repository.
 * @param startLine The starting line number (1-based).
 * @param endLine The ending line number (1-based, inclusive).
 * @returns Git blame output showing commit info and content for each line.
 */
export async function gitBlame(
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

/**
 * Retrieves detailed information about the last merge commits from the repository.
 *
 * @param repoPath The absolute path to the git repository.
 * @param limit The maximum number of merge commits to return.
 * @returns A string containing detailed merge commit info in format: hash|author|date|message (one per line).
 */
export async function getLastMergeCommits(
  repoPath: string,
  limit: number
): Promise<string> {
  const command = `git log --merges -n ${limit} --pretty=format:"%H|%an|%ad|%s" --date=short`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr.trim());
  }

  return result.stdout.toString().trim();
}

/**
 * Formats merge information into XML structure.
 *
 * @param mergeTarget The merge target commit hash.
 * @param mergeBase The merge base commit hash.
 * @returns XML formatted merge information.
 */
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
