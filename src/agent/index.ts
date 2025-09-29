import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import path from 'node:path';
import dedent from 'dedent';
import { createSystemPrompt } from './system-prompt.js';
import { getConflictingFiles } from '../context/conflicting-files.js';
import { readFile } from '../utils/read-file.js';
import { makeReadTool } from '../tools/read.js';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import { makeGetRecentCommitsTool } from '../tools/get-recent-commits.js';
import { makeGetCommitMetadata } from '../tools/get-commit-metadata.js';
import { makeGetMergeInfoTool } from '../tools/get-merge-info.js';
import { makeGetDiffTool } from '../tools/get-diff.js';
import { makeGetChangedFilesTool } from '../tools/get-changed-files.js';
import { makeGetBlameTool } from '../tools/get-blame-tool.js';
import { makeGetLastMergeCommitsTool } from '../tools/get-last-merge-commits.js';


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

  const llm = new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash',
    temperature: 0.2,
  });

  const tools: DynamicStructuredTool[] = [makeReadTool(repoPath),
     makeGetBlameTool(repoPath),
      makeGetChangedFilesTool(repoPath),
      makeGetCommitMetadata(repoPath),
      makeGetDiffTool(repoPath),
      makeGetLastMergeCommitsTool(repoPath),
      makeGetMergeInfoTool(repoPath),
      makeGetRecentCommitsTool(repoPath)
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
}
