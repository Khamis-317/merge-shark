import fs from 'node:fs/promises';

/**
 * Lists all files and directories in a given path.
 *
 * @param path The path to list files from.
 * @returns An array of file and directory names.
 */

export async function listFiles(path: string): Promise<string[]> {
  const nodes = await fs.readdir(path, { withFileTypes: true });
  return nodes.map((node) => {
    if (node.isDirectory()) {
      return `${node.name}/`;
    } else {
      return node.name;
    }
  });
}
