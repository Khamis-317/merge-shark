import { exec } from './exec.js';


export const DEFAULT_MAX_COMMITS_PER_FILE = 7;

export async function getMergeTarget(repoPath: string): Promise<string> {
  const command: string = "git rev-parse MERGE_HEAD";
  const commit = await exec(command, { cwd: repoPath });

  if (commit.stderr) {
    throw new Error(commit.stderr); 
  }

  return commit.stdout.toString().trim();
}

export async function getMergeBase(repoPath: string, ours: string, theirs: string): Promise<string> {
  const command: string = `git merge-base ${ours} ${theirs}`;
  const commit = await exec(command, { cwd: repoPath });

  if (commit.stderr) {
    throw new Error(commit.stderr);
  }
  return commit.stdout.toString().trim();
}


// export async function getFileContentFromCommit(repoPath: string, commit: string, filePath: string) {
//   const command = `git show ${commit}:${filePath}`;
//   try {
//     const result = await exec(command, { cwd: repoPath });
//     return result.stdout.toString().trim();
//   } catch (error: any) {
//     // File doesn't exist in this commit
//     return null;
//   }
// }

export async function getLastNCommitsForFile(repoPath: string, filePath: string, branchRef: string, n: number)
            : Promise<{ commit_hash: string; message: string }[]> {

  const command = `git log -n ${n} --pretty=format:"%H %s" ${branchRef} -- ${filePath}`;
  const output = await exec(command, { cwd: repoPath });

  if (output.stderr) {
    throw new Error(output.stderr);
  }

  const commits = output.stdout.toString().trim();
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
  const output = await exec(command, { cwd: repoPath });

  if (output.stderr) {
    throw new Error(output.stderr);
  }

  const lines = output.stdout.toString().trim().split("\n");
  if (lines.length < 2) {
    throw new Error("Unexpected git log output format");
  }

  const author = lines[0] || "";
  const date = lines[1] || "";
  const fullMessage = lines.slice(2).join("\n").trim() || "";

  return { author, date, fullMessage };
}






// const commitHash: string = "";
// const repoPath: string = "";
// const output = await getCommitMetaData(repoPath,commitHash);
// console.log(output);
// // const filePath: string = "";
// // const n: number = 5;
// // const branchRef: string = "HEAD";
// // const result = await getLastNCommitsForFile(repoPath, filePath, branchRef, n);
// // console.log(result);
// // // const mergeTarget: string = await getMergeTarget(repoPath);
// // // const mergeBase: string = await getMergeBase(repoPath, "HEAD", mergeTarget);
// // // const fileContentTarget = await getFileContentFromCommit(repoPath, mergeTarget, filePath );
// // // const fileContentBase = await getFileContentFromCommit(repoPath, mergeBase, filePath );
// // // console.log("Content we are merging with");
// // // console.log("--------------");
// // // console.log(fileContentTarget);
// // // console.log("--------------");
// // // console.log("Content of the base");
// // // console.log("--------------");
// // // console.log(fileContentBase);
// // // console.log("--------------");
