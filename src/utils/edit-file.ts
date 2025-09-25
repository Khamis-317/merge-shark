import fs from 'node:fs/promises';

export const DEFAULT_FILE_READ_LINES_LIMIT = 2000;

export type fileEdit = {
  path: string;
  oldText: string;
  newText: string;
  replaceAll: boolean;
};

/**
 * Edits a file.
 *
 * @param path The path of the file to edit.
 * @param oldText The text that needs to be edited.
 * @param newText The text the will be used for the edit.
 * @param replaceAll Option to replace all instances of `oldText` with `newText`.
 */
export async function editFile(
  path: string,
  oldText: string,
  newText: string,
  replaceAll: boolean = false
) {
  const data = await fs.readFile(path, 'utf-8');

  const editedData = replaceAll
    ? data.replaceAll(oldText, newText)
    : data.replace(oldText, newText);

  await fs.writeFile(path, editedData, 'utf8');
}

/**
 * Checks the validity of the edit.
 *
 * @param path The path of the file to edit.
 * @param oldText The text that needs to be edited.
 * @param replaceAll Option to replace all instances of `oldText` with `newText`.
 */
export async function checkEditValidity(
  path: string,
  oldText: string,
  replaceAll: boolean
) {
  const data = await fs.readFile(path, 'utf-8');

  const numOfOccurences = data.split(oldText).length - 1;

  if (!data.includes(oldText)) {
    return `Edit failed: the specified oldText was not found in ${path}.`;
  }

  if (numOfOccurences > 1 && !replaceAll) {
    return `Edit failed: oldText occurs ${numOfOccurences} times in ${path}.`;
  }

  return null;
}
