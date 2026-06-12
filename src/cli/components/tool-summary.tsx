import { Box, Text } from 'ink';
import type { ReadToolInput } from '../../tools/read.js';
import type { EditToolInput } from '../../tools/edit.js';
import type { MultiEditToolInput } from '../../tools/multi-edit.js';
import type { LsToolInput } from '../../tools/ls.js';
import type { RipgrepToolInput } from '../../tools/ripgrep.js';
import type { GlobToolInput } from '../../tools/glob.js';
import type { BashToolInput } from '../../tools/bash.js';
import chalk from 'chalk';
import { countLines } from '../../utils/count-lines.js';

export interface ToolSummaryProps {
  toolName: string;
  input: unknown;
  output: unknown;
  status: 'running' | 'complete' | 'failed';
}

type ToolInput =
  | ReadToolInput
  | EditToolInput
  | MultiEditToolInput
  | LsToolInput
  | RipgrepToolInput
  | GlobToolInput
  | BashToolInput;

function formatToolSummary(toolName: string, input: unknown): string {
  const toolInput = input as ToolInput;
  switch (toolName) {
    case 'read': {
      const readInput = toolInput as ReadToolInput;
      if (readInput.offset !== undefined && readInput.limit !== undefined) {
        const start = readInput.offset;
        const end = readInput.offset + readInput.limit;
        return `Read ${readInput.relativePath}, lines ${start} to ${end}`;
      }
      return `Read ${readInput.relativePath}`;
    }

    case 'edit': {
      const editInput = toolInput as EditToolInput;
      return `Edited ${editInput.relativePath} ${chalk.green('+' + countLines(editInput.newText))} ${chalk.red('-' + countLines(editInput.oldText))}`;
    }

    case 'multiedit': {
      const multiEditInput = toolInput as MultiEditToolInput;
      const additions = multiEditInput.newEdits.reduce(
        (acc, edit) => acc + countLines(edit.newText),
        0
      );
      const deletions = multiEditInput.newEdits.reduce(
        (acc, edit) => acc + countLines(edit.oldText),
        0
      );

      return `Edited ${multiEditInput.relativePath} ${chalk.green('+' + additions)} ${chalk.red('-' + deletions)}`;
    }

    case 'ls': {
      const lsInput = toolInput as LsToolInput;
      return `List directory: ${lsInput.directoryPath}`;
    }

    case 'ripgrep': {
      const ripgrepInput = toolInput as RipgrepToolInput;
      if (ripgrepInput.searchPath) {
        return `Search for "${ripgrepInput.pattern}" in ${ripgrepInput.searchPath}`;
      }
      return `Search for "${ripgrepInput.pattern}"`;
    }

    case 'glob': {
      const globInput = toolInput as GlobToolInput;
      return `Find files matching "${globInput.pattern}"`;
    }

    case 'bash': {
      const bashInput = toolInput as BashToolInput;
      return `Run command: ${bashInput.command}`;
    }

    case 'codebase_explorer': {
      const explorerInput = toolInput as { goal?: string };
      const goalPreview = explorerInput.goal
        ? explorerInput.goal.slice(0, 60) +
          (explorerInput.goal.length > 60 ? '…' : '')
        : 'codebase';
      return `Exploring: ${goalPreview}`;
    }

    default:
      return `${toolName}`;
  }
}

export function ToolSummary({
  toolName,
  input,
  output,
  status,
}: ToolSummaryProps) {
  const summary = formatToolSummary(toolName, input);

  return (
    <Box flexDirection="column" marginBottom={status === 'failed' ? 1 : 0}>
      <Box
        borderStyle="round"
        borderColor={status === 'failed' ? 'red' : 'gray'}
        paddingX={1}
        flexDirection="row"
        gap={1}
      >
        {status === 'running' ? (
          <Text color="yellow">↺</Text>
        ) : status === 'failed' ? (
          <Text color="red">✗</Text>
        ) : (
          <Text color="green">✓</Text>
        )}
        <Text>{summary}</Text>
      </Box>

      {status === 'failed' && !!output && (
        <Box paddingX={2}>
          <Text color="red">{output.toString()}</Text>
        </Box>
      )}
    </Box>
  );
}
