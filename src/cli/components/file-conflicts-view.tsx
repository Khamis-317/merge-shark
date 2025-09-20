import { Box, Text } from 'ink';
import path from 'node:path';
import type { FileConflicts } from '../../model/resolution.js';
import { ConflictView } from './conflict-view.js';

export interface FileConflictsViewProps {
  file: FileConflicts;
}

export function FileConflictsView({ file }: FileConflictsViewProps) {
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
        <ConflictView
          key={conflict.conflict}
          conflict={conflict}
          language={language}
        />
      ))}
    </Box>
  );
}
