import { z } from 'zod';
import { tool, type StructuredTool } from '@langchain/core/tools';
import { createAgent } from 'langchain';
import { makeLsTool } from './ls.js';
import { makeRipgrepTool } from './ripgrep.js';
import { makeGlobTool } from './glob.js';
import { makeReadTool } from './read.js';
import type { ToolContext } from '../utils/tool-context.js';
import { dedent } from '../utils/dedent.js';
import { models } from '../models/index.js';

function createSearchAgentSystemPrompt(): string {
  return dedent`
    You are a Code Discovery Agent specialized in searching and analyzing codebases.
    Your goal is to locate code definitions, usages, or specific files and provide accurate information.

    TOOLS AVAILABLE:
    - 'ls': Explore directory structures and list files
    - 'glob': Find files by pattern (e.g., "**/*.test.ts", "src/**/*.js")
    - 'ripgrep': Search for text patterns in files (e.g., "function processUser", "class MyComponent")  
    - 'read': Read file content to verify and analyze code

    SEARCH STRATEGY:
    1. Locate: Use 'ls', 'glob', or 'ripgrep' to find candidate files
    2. Verify: Use 'read' to examine the actual code and confirm it matches the search criteria
    3. Analyze: Focus on finding definitions, not just imports or references
    4. Report: Provide precise file paths and relevant code context

    CONSTRAINTS:
    - You are READ-ONLY - do not suggest modifications
    - Be efficient - don't read entire large files unless necessary  
    - Focus on accuracy - verify findings before reporting
  `;
}

const searchAgentInputSchema = z.object({
  mission: z
    .string()
    .describe(
      "The detailed search mission (e.g., 'Find where the User interface is defined and check if it has an email field')."
    ),
});

export type SearchAgentInput = z.infer<typeof searchAgentInputSchema>;

export function makeSearchAgentTool(
  repoPath: string,
  context: ToolContext
): StructuredTool {
  
  const searchAgentModel = models['devstral-2-free']!.factory();
  
  const tools: StructuredTool[] = [
    makeLsTool(repoPath),
    makeRipgrepTool(repoPath),
    makeGlobTool(repoPath),
    makeReadTool(repoPath, context),
  ];

  const agent = createAgent({
    model: searchAgentModel,
    tools
  });

  return tool(
    async ({ mission }: SearchAgentInput) => {
      const systemPrompt = createSearchAgentSystemPrompt();
  
      const result = await agent.invoke(
          {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: mission },
            ],
          },
          { recursionLimit: 15 } 
        );

      if (result && result.messages && Array.isArray(result.messages)) {
        const finalMessage = result.messages[result.messages.length - 1];
        if (finalMessage && finalMessage.content) {
          return typeof finalMessage.content === 'string' 
            ? finalMessage.content 
            : JSON.stringify(finalMessage.content);
        }
      }
      return 'Search completed but no results found.';
    },
    {
      name: 'codebase_search_agent',
      description: dedent`
        Intelligent codebase search and exploration tool that efficiently locates code definitions, usages, and files across the entire project.
        
        This tool combines multiple search strategies (directory traversal, pattern matching, text search, and file analysis) to provide comprehensive results.
        
        Use this tool to:
        - Find function, class, interface, type, or variable definitions
        - Locate all usages and references of code symbols
        - Search for code patterns or similar implementations
        - Explore project structure and discover related files
        - Understand codebase architecture and dependencies
        
        The tool automatically verifies findings and provides accurate file paths with relevant context.
      `,
      schema: searchAgentInputSchema,
    }
  );
}