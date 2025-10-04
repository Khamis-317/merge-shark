import fs from 'node:fs/promises';

export interface EditOptions {
  oldText: string;
  newText: string;
  replaceAll: boolean;
}

export interface FileEditOptions extends EditOptions {
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
export async function editFile(edit: FileEditOptions) {
  const data = await fs.readFile(edit.path, 'utf-8');

  const editedData = edit.replaceAll
    ? data.replaceAll(edit.oldText, edit.newText)
    : data.replace(edit.oldText, edit.newText);

  await fs.writeFile(edit.path, editedData, 'utf-8');
}

/**
 * Reads the content of a file.
 *
 * @param path The path of the file to read.
 * @returns The content of the file as a string.
 */
export async function getFileContent(path: string) {
  return await fs.readFile(path, 'utf-8');
}

/**
 * Checks the validity of the edit.
 *
 * @param path The path of the file to edit.
 * @param content The file content.
 * @param oldText The text that needs to be edited.
 * @param replaceAll Option to replace all instances of `oldText` with `newText`.
 *
 * @returns `null` if the edit is valid.
 * @throws Error if the edit is invalid.
 */
export async function checkEditValidity(
  path: string,
  content: string,
  oldText: string,
  replaceAll: boolean
) {
  const numOfOccurences = content.split(oldText).length - 1;

  if (numOfOccurences === 0) {
    throw new Error(
      `Edit failed: the specified oldText was not found in ${path}.`
    );
  }

  if (numOfOccurences > 1 && !replaceAll) {
    throw new Error(
      `Edit failed: oldText occurs ${numOfOccurences} times in ${path}.`
    );
  }

  return null;
}
