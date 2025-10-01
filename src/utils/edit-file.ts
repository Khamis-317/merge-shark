import fs from 'node:fs/promises';

export const DEFAULT_FILE_READ_LINES_LIMIT = 2000;

export interface Edit {
  oldText: string;
  newText: string;
  replaceAll?: boolean;
}

export interface FileEdit extends Edit {
  path: string;
}

/**
 * Edits a file.
 *
 * @param edit the edit to be applied, includes:
 * - path The path of the file to edit.
 * - oldText The text that needs to be edited.
 * - newText The text the will be used for the edit.
 * - replaceAll Option to replace all instances of `oldText` with `newText`.
 */
export async function editFile(edit: FileEdit) {
  const data = await fs.readFile(edit.path, 'utf-8');

  const editedData = edit.replaceAll
    ? data.replaceAll(edit.oldText, edit.newText)
    : data.replace(edit.oldText, edit.newText);

  await fs.writeFile(edit.path, editedData, 'utf-8');
}

/**
 * Checks the validity of the edit.
 *
 * @param path The path of the file to edit.
 * @param oldText The text that needs to be edited.
 * @param replaceAll Option to replace all instances of `oldText` with `newText`.
 *
 * @returns An error message if any, or `null` if the edit is valid.
 *
 */
export async function checkEditValidity(
  path: string,
  oldText: string,
  replaceAll: boolean
) {
  const data = await fs.readFile(path, 'utf-8');

  const numOfOccurences = data.split(oldText).length - 1;

  if (numOfOccurences === 0) {
    return `Edit failed: the specified oldText was not found in ${path}.`;
  }

  if (numOfOccurences > 1 && !replaceAll) {
    return `Edit failed: oldText occurs ${numOfOccurences} times in ${path}.`;
  }

  return null;
}
