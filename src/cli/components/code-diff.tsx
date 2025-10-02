import { Box } from 'ink';
import { CodeBlock } from './code-block.js';
import type { FileEditOptions } from '../../utils/edit-file.js';

export interface CodeDiffProps {
  edit: FileEditOptions;
  language: string;
}

export function CodeDiff({ edit, language }: CodeDiffProps) {
  return (
    <>
      <Box backgroundColor="#280a0a">
        <CodeBlock code={edit.oldText} language={language} />
      </Box>
      <Box backgroundColor="#0a280a">
        <CodeBlock code={edit.newText} language={language} />
      </Box>
    </>
  );
}
