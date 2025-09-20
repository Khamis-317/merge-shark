import { Box, Text } from 'ink';
import path from 'node:path';
import type { FileConflicts } from '../../model/resolution.js';
import { CodeDiff } from './code-diff.js';

export interface FileDiffProps {
  file: FileConflicts;
}

export function FileDiff({ file }: FileDiffProps) {
  const language = path.extname(file.name).slice(1);

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      borderStyle="single"
      borderColor="gray"
      borderDimColor
    >
      <Box marginBottom={1}>
        <Text>📄 {file.name}</Text>
      </Box>

      {file.conflicts.map((conflict) => (
        <CodeDiff
          key={conflict.conflict}
          conflict={conflict}
          language={language}
        />
      ))}
    </Box>
  );
}
