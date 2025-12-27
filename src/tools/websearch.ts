import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { webSearch } from '../utils/web-search.js';
import { dedent } from '../utils/dedent.js';

const webSearchSchema = z.object({
  query: z
    .string()
    .describe('The search query to find information on the web.'),
  maxResults: z
    .number()
    .nonnegative()
    .default(5)
    .describe('Number of results to return.'),
});

export type WebSearchToolInput = z.infer<typeof webSearchSchema>;

export function makeWebSearchTool() {
  return tool(
    async ({ query, maxResults }) => {
      const results = await webSearch(query, maxResults);
      return results;
    },
    {
      name: 'web_search',
      description: dedent`
        Search the web for up-to-date information, documentation, or facts. Use this tool when you cannot find the answer in the local codebase.`,
      schema: webSearchSchema,
    }
  );
}
