import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import path from 'node:path';
import { createSystemPrompt } from './system-prompt.js';
import { getConflictingFiles } from '../context/conflicting-files.js';
import { readFile } from '../utils/read-file.js';
import { makeReadTool } from '../tools/read.js';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { makeGitLogTool } from '../tools/git-log.js';
import { makeGitDiffTool } from '../tools/git-diff.js';
import { makeGetChangedFilesTool } from '../tools/get-changed-files.js';
import { makeGitBlameTool } from '../tools/git-blame.js';
import { makeGetLastMergeCommitsTool } from '../tools/get-last-merge-commits.js';
import { makeEditTool } from '../tools/edit.js';
import type { FileEditOptions } from '../utils/edit-file.js';
import {
  gitMergeTarget,
  gitMergeBase,
  formatMergeInfo,
} from '../utils/git-utils.js';
import { dedent } from '../utils/dedent.js';

export async function resolveConflicts(repoPath: string) {
  const conflictingFiles = await getConflictingFiles(repoPath);
  const conflictingFilesContent = await Promise.all(
    conflictingFiles.map(async (file) => {
      return {
        name: file,
        content: await readFile(path.join(repoPath, file)),
      };
    })
  );
  const edits: FileEditOptions[] = [];

  // Try to get merge information (may fail in case of rebase)
  let mergeInfo: string | null = null;
  try {
    const mergeTarget = await gitMergeTarget(repoPath);
    const mergeBase = await gitMergeBase(repoPath, 'HEAD', mergeTarget);
    mergeInfo = formatMergeInfo(mergeTarget, mergeBase);
  } catch {
    // Merge info not available (likely a rebase operation)
    console.log('Merge info not available - this might be a rebase operation');
  }

  const llm = new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash',
    temperature: 0.2,
  });

  const tools: StructuredToolInterface[] = [
    makeReadTool(repoPath),
    makeEditTool(repoPath, edits),
    makeGitBlameTool(repoPath),
    makeGitDiffTool(repoPath),
    makeGetChangedFilesTool(repoPath),
    makeGetLastMergeCommitsTool(repoPath),
    makeGitLogTool(repoPath),
  ];

  const agent = createReactAgent({
    llm,
    tools,
  });

  const systemPrompt = createSystemPrompt({
    systemInfo: {
      operatingSystem: process.platform,
      date: new Date(),
      workingDirectory: repoPath,
    },
    mergeInfo,
  });

  const userPrompt = dedent`
    Resolve the conflicts in the following files:
    ${conflictingFilesContent.map((file) => `<file name="${file.name}">\n${file.content}\n</file name="${file.name}">`).join('\n\n')}
    `;

  console.log('SYSTEM PROMPT:\n');
  console.log(systemPrompt);

  console.log('\n\nUSER PROMPT:\n');
  console.log(userPrompt);

  const messages = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: userPrompt,
    },
  ];

  const result = await agent.invoke({ messages });

  console.log('\n\nRESPONSE:\n');
  console.log(result);

  return edits;
}
