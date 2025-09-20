import chalk from 'chalk';
import { highlight, type Theme } from 'cli-highlight';
import { Text } from 'ink';
import { useMemo } from 'react';

/** A simplified GitHub Dark theme. Works well for light mode too. */
const theme: Theme = {
  keyword: chalk.red,
  built_in: chalk.cyan,
  type: chalk.magenta,
  literal: chalk.cyan,
  number: chalk.magenta,
  regexp: chalk.blue,
  string: chalk.blue,
  subst: chalk.whiteBright,
  symbol: chalk.magenta,
  class: chalk.magenta,
  function: chalk.magenta,
  title: chalk.magenta,
  params: chalk.whiteBright,
  comment: chalk.gray.dim,
  doctag: chalk.gray,
  meta: chalk.cyan,
  'meta-keyword': chalk.cyan,
  'meta-string': chalk.blue,
  section: chalk.cyan.bold,
  tag: chalk.green,
  name: chalk.magenta,
  'builtin-name': chalk.cyan,
  attr: chalk.cyan,
  attribute: chalk.cyan,
  variable: chalk.yellow,
  'template-variable': chalk.whiteBright,
  'selector-id': chalk.magenta,
  'selector-class': chalk.magenta,
  'selector-attr': chalk.magenta,
  'selector-pseudo': chalk.magenta,
  emphasis: chalk.white.italic,
  strong: chalk.white.bold,
  link: chalk.blue.underline,
  quote: chalk.green,
  default: chalk.whiteBright,
};

export interface CodeBlockProps {
  code: string;
  language: string;
  startLine?: number;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language,
  startLine = 1,
  showLineNumbers = true,
}: CodeBlockProps) {
  const codeWithLineNumbers = useMemo(() => {
    const highlightedCode = highlight(code, { language, theme });

    if (showLineNumbers) {
      return addLineNumbers(highlightedCode, startLine);
    }

    return highlightedCode;
  }, [code, language, startLine, showLineNumbers]);

  return <Text>{codeWithLineNumbers}</Text>;
}

function addLineNumbers(code: string, startLine: number) {
  const lines = code.split('\n');

  const maxLine = startLine + lines.length;
  const lineNumberPadding = maxLine.toString().length + 2;

  return lines
    .map((line, index) => {
      const lineNumber = startLine + index;
      const paddedLineNumber = lineNumber
        .toString()
        .padStart(lineNumberPadding, ' ');

      return `${chalk.gray(paddedLineNumber)}    ${line}`;
    })
    .join('\n');
}
