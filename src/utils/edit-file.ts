import fs from 'node:fs/promises';
import type { ToolContext } from './tool-context.js';

export interface EditOptions {
  oldText: string;
  newText: string;
  replaceAll: boolean;
}

export interface FileEditOptions extends EditOptions {
  path: string;
}

/**
 * Validates that a file has been read and hasn't been modified since the last read.
 *
 * @param path The absolute path of the file to validate.
 * @param context The tool context containing read file information.
 * @throws Error if the file hasn't been read or has been modified since the last read.
 */
export async function validateFileReadStatus(
  path: string,
  context: ToolContext
): Promise<void> {
  const lastReadTime = context.readFiles.get(path);

  if (!lastReadTime) {
    throw new Error(
      `Invalid usage: You must call 'read' on this file before editing it.`
    );
  }

  // Check if the file has been modified since it was last read
  const stats = await fs.stat(path);
  const currentModTime = stats.mtime;

  if (currentModTime > lastReadTime) {
    throw new Error(
      `Invalid usage: The file has been modified since you last read it. Please call 'read' again before editing.`
    );
  }
}

/**
 * Edits a file.
 *
 * @param edit the edit to be applied
 * @param edit.path The path of the file to edit.
 * @param edit.oldText The text that needs to be edited.
 * @param edit.The text the will be used for the edit.
 * @param edit.replaceAll Option to replace all instances of `oldText` with `newText`.
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
}
