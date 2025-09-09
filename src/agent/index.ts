import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import path from 'node:path';
import dedent from 'dedent';
import { createSystemPrompt } from './system-prompt.js';
import { getConflictingFiles } from '../context/conflicting-files.js';
import { readFile } from '../utils/read-file.js';

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

  const systemTemplate = ChatPromptTemplate.fromMessages([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  const chain = systemTemplate.pipe(llm);
  const result = await chain.invoke({});

  console.log('\n\nRESPONSE:\n');
  console.log(result.content);
}
