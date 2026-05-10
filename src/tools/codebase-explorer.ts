import { tool, type ToolRuntime } from '@langchain/core/tools';
import { z } from 'zod';
import { dedent } from '../utils/dedent.js';
import {
  CodebaseExplorerAgent,
  type CodebaseExplorerAgentCallbacks,
} from '../agent/codebase-explorer-agent.js';
import type { LanguageModelLike } from '@langchain/core/language_models/base';
import type { ConflictAgentCallbacks } from '../agent/conflict-resolution-agent.js';

const codebaseExplorerSchema = z.object({
  goal: z
    .string()
    .describe(
      'A clear, specific description of what information you are trying to find in the codebase.'
    ),
  startPaths: z
    .array(z.string())
    .optional()
    .describe(
      'Optional list of file or directory paths to start exploring from. Helpful if you already know where to look.'
    ),
});

export type CodebaseExplorerToolInput = z.infer<typeof codebaseExplorerSchema>;

export function makeCodebaseExplorerTool(
  repoPath: string,
  llm: LanguageModelLike,
  mainCallbacks: ConflictAgentCallbacks
) {
  return tool(
    async (
      { goal, startPaths }: CodebaseExplorerToolInput,
      config: ToolRuntime
    ) => {
      const subAgentId = config.toolCallId;
      // inject the subAgentId into the event stream
      const explorerCallbacks: CodebaseExplorerAgentCallbacks = {
        onMessageChunk: (chunk) =>
          mainCallbacks.onMessageChunk(chunk, subAgentId),
        onReasoningChunk: (chunk) =>
          mainCallbacks.onReasoningChunk(chunk, subAgentId),
        onToolStart: (info) => mainCallbacks.onToolStart(info, subAgentId),
        onToolEnd: (info) => mainCallbacks.onToolEnd(info, subAgentId),
      };

      const explorer = new CodebaseExplorerAgent(
        repoPath,
        llm,
        explorerCallbacks
      );

      const result = await explorer.explore(
        startPaths !== undefined ? { goal, startPaths } : { goal }
      );
      const lines = [
        dedent`## Findings
        `,
        result.findings,
      ];

      if (result.filesRead.length > 0) {
        lines.push(``);
        lines.push(dedent`## Files Read`);
        result.filesRead.forEach((file) => lines.push(`- ${file}`));
      }

      return lines.join('\n');
    },
    {
      name: 'codebase_explorer',
      description: dedent`
      Delegates a multi-step codebase exploration task to a dedicated sub-agent.
      Use this when understanding a conflict requires reading and cross-referencing 
      more than 2-3 files — for example, tracing how an interface is implemented 
      across modules, or understanding the full call chain behind a changed function.
      The sub-agent will navigate the codebase autonomously using read, ls, ripgrep, 
      and glob, then return a detailed written summary of its findings along with the file paths it explored.
      Prefer this over manual ripgrep + read chains when the exploration would take more than 5 steps to complete.
`,
      schema: codebaseExplorerSchema,
    }
  );
}
