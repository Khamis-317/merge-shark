import { Box, Text, useInput } from 'ink';
import path from 'node:path';
import { CodeDiff } from './code-diff.js';
import type { Resolutions } from '../../model/resolution.js';

export interface ResolutionReviewerProps {
  resolutions: Resolutions;
  activeFileIndex: number;
  activeConflictIndex: number;
  onApply: (fileIndex: number, conflictIndex: number) => void;
  onReject: (fileIndex: number, conflictIndex: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onApplyAll: () => void;
  onRejectAll: () => void;
  onExit: () => void;
}

export function ResolutionReviewer({
  resolutions,
  activeFileIndex,
  activeConflictIndex,
  onApply,
  onReject,
  onNext,
  onPrevious,
  onApplyAll,
  onRejectAll,
  onExit,
}: ResolutionReviewerProps) {
  useInput((input, key) => {
    if (key.return && key.ctrl) {
      onApplyAll();
    } else if (input === 'r' && key.ctrl) {
      onRejectAll();
    } else if (key.escape || input === 'q') {
      onExit();
    } else if (key.return) {
      onApply(activeFileIndex, activeConflictIndex);
      onNext();
    } else if (input === 'r') {
      onReject(activeFileIndex, activeConflictIndex);
      onNext();
    } else if (key.leftArrow) {
      onPrevious();
    } else if (key.rightArrow) {
      onNext();
    }
  });

  const file = resolutions.files[activeFileIndex];
  if (!file) {
    return <Text>No conflicts to resolve!</Text>;
  }

  const conflict = file.conflicts[activeConflictIndex];
  if (!conflict) {
    return <Text>No conflict at this index!</Text>;
  }

  const language = path.extname(file.name).slice(1);

  const totalConflicts = resolutions.files.reduce(
    (sum, file) => sum + file.conflicts.length,
    0
  );
  let currentConflictNumber = 1;
  for (let i = 0; i < activeFileIndex; i++) {
    currentConflictNumber += resolutions.files[i]?.conflicts.length ?? 0;
  }
  currentConflictNumber += activeConflictIndex;

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
            📄 {file.name} - conflict {currentConflictNumber} of{' '}
            {totalConflicts}
          </Text>
        </Box>

        <CodeDiff conflict={conflict} language={language} />
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
