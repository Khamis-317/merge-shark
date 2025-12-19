import { Box, Text, useInput } from 'ink';
import path from 'node:path';
import { CodeDiff } from './code-diff.js';
import type { FileEditOptions } from '../../utils/edit-file.js';

export interface ResolutionReviewerProps {
  repoPath: string;
  edits: FileEditOptions[];
  activeEditIndex: number;
  allProcessed: boolean;
  onApply: (edit: FileEditOptions) => void;
  onReject: (edit: FileEditOptions) => void;
  onNext: () => void;
  onPrevious: () => void;
  onApplyAll: () => void;
  onRejectAll: () => void;
  onExit: () => void;
}

export function ResolutionReviewer({
  repoPath,
  edits,
  activeEditIndex,
  allProcessed,
  onApply,
  onReject,
  onNext,
  onPrevious,
  onApplyAll,
  onRejectAll,
  onExit,
}: ResolutionReviewerProps) {
  const edit = edits[activeEditIndex];

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onExit();
    }

    // Don't process other inputs if all items are processed
    if (allProcessed) {
      return;
    }

    if (key.return && key.ctrl) {
      onApplyAll();
    } else if (input === 'r' && key.ctrl) {
      onRejectAll();
    } else if (key.return && edit) {
      onApply(edit);
      onNext();
    } else if (input === 'r' && edit) {
      onReject(edit);
      onNext();
    } else if (key.leftArrow) {
      onPrevious();
    } else if (key.rightArrow) {
      onNext();
    }
  });

  // Show "All done" message when all items are processed
  if (allProcessed) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight={10}
        paddingY={3}
      >
        <Text color="green" bold>
          All done ✅
        </Text>
        <Box marginTop={2}>
          <Text dimColor>Press esc or q to exit</Text>
        </Box>
      </Box>
    );
  }

  if (!edit) {
    return <Text>No edit to review!</Text>;
  }

  const language = path.extname(edit.path).slice(1);

  const totalEdits = edits.length;
  let currentEditNumber = 1;
  currentEditNumber += activeEditIndex;

  return (
    <Box flexDirection="column">
      <Box
        flexDirection="column"
        paddingX={1}
        borderStyle="single"
        borderColor="gray"
        borderDimColor
      >
        <Box marginBottom={1}>
          <Text>
            📄 {path.relative(repoPath, edit.path)} - edit {currentEditNumber}{' '}
            of {totalEdits}
          </Text>
        </Box>

        <CodeDiff edit={edit} language={language} />
      </Box>

      <Box marginTop={1} paddingX={1}>
        <Box gap={2}>
          <Box backgroundColor="green" paddingX={1}>
            <Text color="black" bold>
              apply (enter)
            </Text>
          </Box>
          <Box backgroundColor="yellow" paddingX={1}>
            <Text color="black" bold>
              reject (r)
            </Text>
          </Box>
          <Text dimColor>← → navigate</Text>
          <Text dimColor>apply all (ctrl+enter)</Text>
          <Text dimColor>reject all (ctrl+r)</Text>
          <Text dimColor>exit (esc/q)</Text>
        </Box>
      </Box>
    </Box>
  );
}
