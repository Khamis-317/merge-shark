import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import path from 'node:path';
import dedent from 'dedent';
import { createSystemPrompt } from './system-prompt.js';
import { getConflictingFiles } from '../context/conflicting-files.js';
import { readFile } from '../utils/read-file.js';
import { makeReadTool } from '../tools/read.js';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import type { DynamicStructuredTool } from '@langchain/core/tools';

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

  const tools: DynamicStructuredTool[] = [makeReadTool()];

  const agent = createReactAgent({
    llm: llm,
    tools: tools,
  });

  const systemPrompt = createSystemPrompt(
    {
      systemInfo: {
        operatingSystem: process.platform,
        date: new Date(),
        workingDirectory: repoPath,
      },
    },
    tools
  );

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

  const result = await agent.invoke({
    messages: messages,
  });

  console.log('\n\nRESPONSE:\n');

  // The Conflict resolution is in the content of the final message
  console.log(result.messages.at(-1)?.content);
}
