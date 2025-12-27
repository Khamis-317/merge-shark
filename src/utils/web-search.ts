import { TavilySearch } from '@langchain/tavily';

/**
 * @param searchQuery a query to search for on the web
 * @param numberOfResults number of results to return @default 5
 * @returns search results as an array of JSON objects with attributes url, title, content
 */

export async function webSearch(
  searchQuery: string,
  numberOfResults = 5
): Promise<{ url: string; title: string; content: string }[]> {
  const tavilyTool = new TavilySearch({
    maxResults: numberOfResults,
    tavilyApiKey: process.env['TAVILY_API_KEY']!,
  });

  const result = await tavilyTool.invoke({ query: searchQuery });
  return result.results.map(
    (res: { url: string; title: string; content: string }) => ({
      url: res.url,
      title: res.title,
      content: res.content,
    })
  );
}
