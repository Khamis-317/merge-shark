import invariant from 'tiny-invariant';

/**
 * Checks whether the provided text consists exclusively of space characters.
 */
function isSpaces(text: string) {
  for (const c of text) {
    if (c !== ' ') return false;
  }

  return true;
}

/**
 * Extracts indentation state for the last line of the provided text buffer.
 */
function getLineIndentation(text: string) {
  const lastNewline = text.lastIndexOf('\n');
  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
  const linePrefix = text.slice(lineStart);
  const match = linePrefix.match(/^ */)!;
  const indentation = match[0];
  const isLineStart = linePrefix === indentation;

  return { indentation, isLineStart };
}

/**
 * Formats placeholder content so that embedded new lines retain the correct indentation.
 */
function formatPlaceholder(
  value: unknown,
  context: { indentation: string; isLineStart: boolean },
  baseIndentation: string
) {
  const placeholder = String(value);
  if (placeholder.length === 0) return '';

  const needsIndentation = context.isLineStart
    ? context.indentation
    : baseIndentation;

  return placeholder
    .split('\n')
    .map((line, index) => {
      if (index === 0) return line;

      return `\n${needsIndentation}${line}`;
    })
    .join('');
}

/**
 * Interpolates the template parts and placeholders while preserving indentation semantics.
 */
function interpolateTemplate(
  template: TemplateStringsArray,
  placeholders: unknown[],
  baseIndentation: string
) {
  let result = '';

  template.forEach((part, index) => {
    result += part;

    if (index === template.length - 1) return;

    const context = getLineIndentation(result);
    result += formatPlaceholder(placeholders[index], context, baseIndentation);
  });

  return result;
}

/**
 * Determines the indentation defined by the trailing line of the template literal.
 */
function getLastLineIndentation(template: TemplateStringsArray): string {
  const lastPart = template.at(-1)!;
  const lastNewlineIndex = lastPart.lastIndexOf('\n');
  invariant(lastNewlineIndex !== -1);

  const indentation = lastPart.slice(lastNewlineIndex + 1);
  invariant(isSpaces(indentation), 'Last line must only contain spaces');

  return indentation;
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
  const baseIndentation = getLastLineIndentation(template);
  const text = interpolateTemplate(template, placeholders, baseIndentation);
  const lines = text.split('\n');

  invariant(lines[0]!.length === 0, 'First line must be empty');

  return lines
    .slice(1, -1)
    .map((line) => {
      invariant(
        line.length === 0 || line.startsWith(baseIndentation),
        `Line "${line}" must start with indentation`
      );

      return line.slice(baseIndentation.length);
    })
    .join('\n');
}
