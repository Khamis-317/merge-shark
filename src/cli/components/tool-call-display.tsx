import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ReadToolInput } from '../../tools/read.js';
import type { EditToolInput } from '../../tools/edit.js';
import type { MultiEditToolInput } from '../../tools/multi-edit.js';
import type { LsToolInput } from '../../tools/ls.js';
import type { RipgrepToolInput } from '../../tools/ripgrep.js';
import type { GlobToolInput } from '../../tools/glob.js';
import type { GitBlameToolInput } from '../../tools/git-blame.js';
import type { GitDiffToolInput } from '../../tools/git-diff.js';
import type { GitLogToolInput } from '../../tools/git-log.js';
import type { GetChangedFilesToolInput } from '../../tools/get-changed-files.js';
import type { GetLastMergeCommitsToolInput } from '../../tools/get-last-merge-commits.js';
import chalk from 'chalk';
import { countLines } from '../../utils/count-lines.js';

export interface ToolCallDisplayProps {
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
  | GitBlameToolInput
  | GitDiffToolInput
  | GitLogToolInput
  | GetChangedFilesToolInput
  | GetLastMergeCommitsToolInput;

function formatToolSummary(toolName: string, input: unknown): string {
  const inputObj = input as ToolInput;

  switch (toolName) {
    case 'read': {
      const readInput = inputObj as ReadToolInput;
      if (readInput.offset !== undefined && readInput.limit !== undefined) {
        const start = readInput.offset;
        const end = readInput.offset + readInput.limit;
        return `Read ${readInput.relativePath}, lines ${start} to ${end}`;
      }
      return `Read ${readInput.relativePath}`;
    }

    case 'edit': {
      const editInput = inputObj as EditToolInput;
      return `Edited ${editInput.relativePath} ${chalk.green('+' + countLines(editInput.newText))} ${chalk.red('-' + countLines(editInput.oldText))}`;
    }

    case 'multiedit': {
      const multiEditInput = inputObj as MultiEditToolInput;
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
      const lsInput = inputObj as LsToolInput;
      return `List directory: ${lsInput.directoryPath}`;
    }

    case 'ripgrep': {
      const ripgrepInput = inputObj as RipgrepToolInput;
      if (ripgrepInput.searchPath) {
        return `Search for "${ripgrepInput.pattern}" in ${ripgrepInput.searchPath}`;
      }
      return `Search for "${ripgrepInput.pattern}"`;
    }

    case 'glob': {
      const globInput = inputObj as GlobToolInput;
      return `Find files matching "${globInput.pattern}"`;
    }

    case 'git_blame': {
      const blameInput = inputObj as GitBlameToolInput;
      if (
        blameInput.startLine !== undefined &&
        blameInput.endLine !== undefined
      ) {
        return `Git blame ${blameInput.relativeFilePath}, lines ${blameInput.startLine}-${blameInput.endLine}`;
      }
      return `Git blame ${blameInput.relativeFilePath}`;
    }

    case 'git_diff': {
      const diffInput = inputObj as GitDiffToolInput;
      if (diffInput.relativeFilePath) {
        return `Git diff ${diffInput.relativeFilePath} (${diffInput.from}..${diffInput.to})`;
      }
      if (diffInput.from && diffInput.to) {
        return `Git diff ${diffInput.from}..${diffInput.to}`;
      }
      return 'Git diff';
    }

    case 'git_log': {
      const logInput = inputObj as GitLogToolInput;
      if (logInput.relativeFilePath) {
        return `Git log ${logInput.relativeFilePath}${logInput.limit ? ` (${logInput.limit} commits)` : ''}`;
      }
      return `Git log${logInput.limit ? ` (${logInput.limit} commits)` : ''}`;
    }

    case 'get_changed_files_in_commit': {
      const changedFilesInput = inputObj as GetChangedFilesToolInput;
      return `Get changed files in ${changedFilesInput.commitHash.substring(0, 7)}`;
    }

    case 'get_last_merge_commits': {
      const mergeCommitsInput = inputObj as GetLastMergeCommitsToolInput;
      return `Get last merge commits${mergeCommitsInput.limit ? ` (${mergeCommitsInput.limit} commits)` : ''}`;
    }

    default:
      return `${toolName}`;
  }
}

export function ToolCallDisplay({
  toolName,
  input,
  output,
  status,
}: ToolCallDisplayProps) {
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
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
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
