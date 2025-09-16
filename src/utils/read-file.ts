import fs from 'node:fs/promises';

export const DEFAULT_FILE_READ_LINES_LIMIT = 2000;

/**
 * Reads a file with a limit on the number of lines.
 *
 * @param path The path of the file to read.
 * @param options The options for reading the file.
 * @returns The content of the file limited to the number of lines in `options.limit`.
 */
export async function readFile(
  path: string,
  { limit = DEFAULT_FILE_READ_LINES_LIMIT, offset = 0 } = {}
) {
  const content = await fs.readFile(path, 'utf8');
  const limited = content
    .split('\n')
    .slice(offset, limit + offset)
    .join('\n');
  return limited;
}
