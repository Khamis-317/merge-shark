import { exec } from './exec.js';


export const DEFAULT_MAX_COMMITS_PER_FILE = 7;

export async function getMergeTarget(repoPath: string): Promise<string> {
  const command: string = "git rev-parse MERGE_HEAD";
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr); 
  }

  return result.stdout.toString().trim();
}

export async function getMergeBase(repoPath: string, ours: string, theirs: string): Promise<string> {
  const command: string = `git merge-base ${ours} ${theirs}`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }
  return result.stdout.toString().trim();
}


export async function getFileContentFromCommit(repoPath: string, commit: string, filePath: string) {
  const command = `git show ${commit}:${filePath}`;
  const result = await exec(command, { cwd: repoPath });
  
  if (result.stderr) {
    return null;
  }
  
  return result.stdout.toString().trim();
}

export async function getLastNCommitsForFile(repoPath: string, filePath: string, branchRef: string, n: number)
            : Promise<{ commit_hash: string; message: string }[]> {

  const command = `git log -n ${n} --pretty=format:"%H %s" ${branchRef} -- ${filePath}`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }

  const commits = result.stdout.toString().trim();
  if (!commits) {
    return [];
  }

  return commits
    .split("\n")
    .map(line => {
      const spaceIdx = line.indexOf(" ");
      if (spaceIdx === -1) {
        return { commit_hash: line, message: "" };
      }
      return { 
        commit_hash: line.substring(0, spaceIdx), 
        message: line.substring(spaceIdx + 1) 
      };
    });
}


export async function getCommitMetaData(repoPath: string, commitHash: string):
            Promise<{ author: string; date: string; fullMessage: string }> {
  const command = `git log -1 --pretty=format:"%an%n%ad%n%B" ${commitHash}`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }

  const lines = result.stdout.toString().trim().split("\n");
  if (lines.length < 2) {
    throw new Error("Unexpected git log output format");
  }

  const author = lines[0] || "";
  const date = lines[1] || "";
  const fullMessage = lines.slice(2).join("\n").trim() || "";

  return { author, date, fullMessage };
}


export async function getDiffForFile(repoPath: string, commitHashX: string, commitHashY: string, filePath: string): Promise<string | null> {
  const command = `git diff ${commitHashX} ${commitHashY} -- ${filePath}`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }

  return result.stdout.toString().trim();
}

export async function getChangedFilesInCommit(repoPath: string, commitHash: string): Promise<{ status: string; filePath: string }[]> {
  const command = `git diff-tree --no-commit-id --name-status -r ${commitHash}`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr);
  }

  const output = result.stdout.toString().trim();
  if (!output) {
    return [];
  }

  return output
    .split("\n")
    .map(line => {
      const tabIndex = line.indexOf("\t");
      return {
        status: line.substring(0, tabIndex),
        filePath: line.substring(tabIndex + 1)
      };
    });
}

export async function getBlame(repoPath: string,relativePath: string, startLine: number, endLine: number): Promise<string> {
  const command = `git blame -L ${startLine},${endLine} ${relativePath}`;
  const result = await exec(command, { cwd: repoPath });

  if (result.stderr) {
    throw new Error(result.stderr.trim());
  }

  return result.stdout.toString().trim();
}


