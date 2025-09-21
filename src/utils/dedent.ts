import invariant from 'tiny-invariant';

function isSpaces(text: string) {
  for (const c of text) {
    if (c !== ' ') {
      return false;
    }
  }

  return true;
}

function join(template: TemplateStringsArray, ...placeholders: unknown[]) {
  return template.reduce((acc, line, index) => {
    return acc + line + (placeholders[index] ?? '');
  }, '');
}

/**
 * Removes the indentation from a multiline string. The last line determines the indentation to be removed.
 * This function only handles spaces (doesn't work with tabs) and assumes that the first line is empty.
 *
 * @example
 * The following call returns `'hello\nworld'`. Notice that the last line is aligned with the indentation of the text.
 * ```ts
 * dedent`
 *   hello
 *   world
 *   `;
 */
export function dedent(
  template: TemplateStringsArray,
  ...placeholders: unknown[]
) {
  const text = join(template, ...placeholders);
  const lines = text.split('\n');
  const indentation = lines.at(-1)!;

  invariant(lines[0]!.length === 0, 'First line must be empty');
  invariant(isSpaces(indentation), 'Last line must only contain whitespace');

  return lines
    .slice(0, -1)
    .map((line) => {
      invariant(
        line.startsWith(indentation),
        'Line must start with indentation'
      );

      return line.slice(indentation.length);
    })
    .join('\n');
}
