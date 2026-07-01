import type { EvalCase } from '../types.js';

export interface AdapterOptions {
  datasetPath?: string;
  language?: string;
  conflictType?: string;
  limit?: number;
  mode: 'snippet' | 'full-repo';
}

export interface DatasetAdapter {
  name: string;
  load(options: AdapterOptions): AsyncIterable<EvalCase>;
  supports: {
    fullRepo: boolean;
    buildCheck: boolean;
    ragTracking: boolean;
  };
}

export const DEFAULT_EVAL_DATASETS_DIR = 'eval_datasets';

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function stripInvisibleChars(text: string): string {
  // ConGra pattern: r'[\s\x00-\x1f\x7f-\x9f]+'
  return Array.from(text)
    .filter((char) => {
      const codePoint = char.codePointAt(0);
      return (
        codePoint !== undefined &&
        !/\s/.test(char) &&
        !(codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
      );
    })
    .join('');
}
