import { glob } from 'glob';

/**
 *
 * @param pattern glob pattern to search for
 * @param ignoredPatterns optional array of glob patterns to ignore
 * @returns files matching the glob pattern
 */

export async function globUtil(
  pattern: string,
  ignoredPatterns: string[] | undefined
): Promise<string[]> {
  const options = ignoredPatterns ? { ignore: ignoredPatterns } : {};
  return await glob(pattern, options);
}
