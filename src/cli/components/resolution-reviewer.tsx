import { Box, Text, useInput } from 'ink';
import path from 'node:path';
import { CodeDiff } from './code-diff.js';
import type { FileEditOptions } from '../../utils/edit-file.js';

export interface ResolutionReviewerProps {
  repoPath: string;
  edits: FileEditOptions[];
  activeEditIndex: number;
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
  onApply,
  onReject,
  onNext,
  onPrevious,
  onApplyAll,
  onRejectAll,
  onExit,
}: ResolutionReviewerProps) {
  const edit = edits[activeEditIndex]!;

  useInput((input, key) => {
    if (key.return && key.ctrl) {
      onApplyAll();
    } else if (input === 'r' && key.ctrl) {
      onRejectAll();
    } else if (key.escape || input === 'q') {
      onExit();
    } else if (key.return) {
      onApply(edit);
      onNext();
    } else if (input === 'r') {
      onReject(edit);
      onNext();
    } else if (key.leftArrow) {
      onPrevious();
    } else if (key.rightArrow) {
      onNext();
    }
  });

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
