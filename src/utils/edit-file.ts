import fs from 'node:fs/promises';

export const DEFAULT_FILE_READ_LINES_LIMIT = 2000;

/**
 * Edits a file.
 *
 * @param path The path of the file to edit.
 * @param oldText The text that needs to be edited.
 * @param newText The text the will be used for the edit.
 */
export async function editFile(path: string, oldText: string, newText: string) {
  const data = await fs.readFile(path, 'utf-8');

  const editedData = data.replace(oldText, newText);

  fs.writeFile(path, editedData, 'utf8');
}
