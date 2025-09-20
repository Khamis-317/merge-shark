import { Box } from 'ink';
import { CodeBlock } from './code-block.js';
import type { Conflict } from '../../model/resolution.js';

export interface CodeDiffProps {
  conflict: Conflict;
  language: string;
}

export function CodeDiff({ conflict, language }: CodeDiffProps) {
  return (
    <>
      <Box backgroundColor="#280a0a">
        <CodeBlock code={conflict.conflict} language={language} />
      </Box>
      <Box backgroundColor="#0a280a">
        <CodeBlock code={conflict.resolution} language={language} />
      </Box>
    </>
  );
}
