import fs from 'node:fs/promises';
import path from 'node:path';
import { tableFromIPC } from 'apache-arrow';
import type { EvalCase } from '../types.js';
import { DEFAULT_EVAL_DATASETS_DIR, type DatasetAdapter, type AdapterOptions } from './adapter.js';

export class PromptedSnippetsAdapter implements DatasetAdapter {
  name = 'prompted-snippets';
  supports = {
    fullRepo: false,
    buildCheck: false,
    ragTracking: false
  };

  async *load(options: AdapterOptions): AsyncIterable<EvalCase> {
    const { limit } = options;
    const mergesDir = await findPromptedSnippetsPath(options.datasetPath);

    const entries = await fs.readdir(mergesDir, { withFileTypes: true });
    const langDirs = entries.filter(e => e.isDirectory() && (e.name.startsWith('repos_github_') || e.name.startsWith('repos_reaper_'))).map(e => e.name);

    let count = 0;

    for (const langDir of langDirs) {
      const language = inferLanguage(langDir);

      if (options.language && options.language !== language) {
        continue;
      }

      const testDir = path.join(mergesDir, langDir, 'dataset', 'test');
      let arrowFiles: string[] = [];
      try {
        const testEntries = await fs.readdir(testDir);
        arrowFiles = testEntries.filter(e => e.endsWith('.arrow'));
      } catch (error: unknown) {
        console.warn(`Could not read prompted snippet test directory ${testDir}: ${formatError(error)}`);
        continue;
      }

      for (const arrowFile of arrowFiles) {
        const arrowPath = path.join(testDir, arrowFile);
        const arrowData = await fs.readFile(arrowPath);
        
        const table = tableFromIPC(arrowData);
        
        for (let i = 0; i < table.numRows; i++) {
          if (limit && count >= limit) return;
          
          const row = table.get(i);
          if (!row) continue;
          
          const question = row['question'];
          const answer = row['answer'];
          
          if (typeof question !== 'string' || typeof answer !== 'string') continue;

          yield {
            id: `merges-hf-${langDir}-test-${i}`,
            dataset: 'prompted-snippets',
            language,
            conflictText: question,
            groundTruth: answer,
            metadata: {
              sourceFile: arrowFile,
              rowIndex: i
            }
          };
          count++;
        }
      }
    }
  }
}

export const MergesHfAdapter = PromptedSnippetsAdapter;

async function findPromptedSnippetsPath(datasetPath: string | undefined): Promise<string> {
  const basePath = path.resolve(datasetPath ?? DEFAULT_EVAL_DATASETS_DIR);
  const candidates = [
    basePath,
    path.join(basePath, 'merges')
  ];

  for (const candidate of candidates) {
    try {
      const entries = await fs.readdir(candidate, { withFileTypes: true });
      if (entries.some((entry) => entry.isDirectory() && (entry.name.startsWith('repos_github_') || entry.name.startsWith('repos_reaper_')))) {
        return candidate;
      }
    } catch (error: unknown) {
      if (!isNotFoundError(error)) {
        console.warn(`Could not inspect prompted snippet data path ${candidate}: ${formatError(error)}`);
      }
      continue;
    }
  }

  throw new Error(`Prompted snippet data not found. Expected repos_github_* or repos_reaper_* directories under one of: ${candidates.join(', ')}`);
}

function inferLanguage(langDir: string): string {
  const prefixes = ['repos_github_', 'repos_reaper_'];
  const prefix = prefixes.find((candidate) => langDir.startsWith(candidate));
  const datasetName = prefix ? langDir.slice(prefix.length) : langDir;

  if (datasetName === 'java_train') {
    return 'java';
  }

  const languageByDatasetName: Record<string, string> = {
    c: 'c',
    cpp: 'cpp',
    csharp: 'csharp',
    go: 'go',
    java: 'java',
    javascript: 'javascript',
    php: 'php',
    python: 'python',
    ruby: 'ruby',
    rust: 'rust',
    typescript: 'typescript'
  };

  return languageByDatasetName[datasetName] ?? 'unknown';
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT';
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
