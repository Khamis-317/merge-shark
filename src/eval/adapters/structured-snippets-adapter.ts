import fs from 'node:fs/promises';
import path from 'node:path';
import type { EvalCase } from '../types.js';
import { DEFAULT_EVAL_DATASETS_DIR, type DatasetAdapter, type AdapterOptions } from './adapter.js';

export class StructuredSnippetsAdapter implements DatasetAdapter {
  name = 'structured-snippets';
  supports = {
    fullRepo: false,
    buildCheck: false,
    ragTracking: false
  };

  async *load(options: AdapterOptions): AsyncIterable<EvalCase> {
    const { limit } = options;
    const congraPath = await findCongraDataPath(options.datasetPath);

    const datasetsDir = path.join(congraPath, 'congra_full_datasets');
    let count = 0;
    
    const languages = options.language ? [options.language] : ['c', 'cpp', 'java', 'python'];
    for (const lang of languages) {
      const langDir = path.join(datasetsDir, lang);
      let types: string[] = [];
      try {
        const entries = await fs.readdir(langDir, { withFileTypes: true });
        types = entries.filter(e => e.isDirectory()).map(e => e.name);
      } catch (error: unknown) {
        if (options.language || !isNotFoundError(error)) {
          console.warn(`Could not read structured snippet language directory ${langDir}: ${formatError(error)}`);
        }
        continue;
      }

      if (options.conflictType) {
        types = types.filter(t => t === options.conflictType);
      }

      for (const type of types) {
        const metaPath = path.join(langDir, type, 'meta_list.txt');
        let metaContent: string;
        try {
          metaContent = await fs.readFile(metaPath, 'utf8');
        } catch (error: unknown) {
          console.warn(`Could not read structured snippet metadata ${metaPath}: ${formatError(error)}`);
          continue;
        }

        const lines = metaContent.split('\n').filter(l => l.trim() !== '');
        for (const line of lines) {
          if (limit && count >= limit) return;

          const parts = line.split(':').map(p => p.trim());
          if (parts.length < 3) continue;
          
          const rawRelativePath = parts[0];
          const hashedName = parts[1];
          const conflictNumStr = parts[2];
          if (!rawRelativePath || !hashedName || !conflictNumStr) continue;

          const conflictNum = parseInt(conflictNumStr, 10);
          if (Number.isNaN(conflictNum)) continue;
          
          const rawDirPath = conflictDirFromMetaPath(congraPath, rawRelativePath);
          const rawFilePath = filePathFromMetaPath(rawRelativePath);
          if (!rawFilePath) continue;
          
          try {
            const caseData = await this.loadConflictCase(rawDirPath, rawFilePath, hashedName, conflictNum, lang, type);
            if (caseData) {
              yield caseData;
              count++;
            }
          } catch (err) {
            console.error(`Failed to load ConGra case ${hashedName}:`, err);
          }
        }
      }
    }
  }

  private async loadConflictCase(rawDirPath: string, file: string, hashedName: string, conflictNum: number, language: string, type: string): Promise<EvalCase | null> {
    const mergedDir = path.join(rawDirPath, 'merged_without_base');
    const regionDir = path.join(rawDirPath, 'regions');
    const resolvedDir = path.join(rawDirPath, 'resolved');

    const mergedFilePath = path.join(mergedDir, file);
    const regionFilePath = path.join(regionDir, file + '.region');
    const resolvedFilePath = path.join(resolvedDir, file);

    const mergedContent = await fs.readFile(mergedFilePath, 'utf8');
    const regionContent = await fs.readFile(regionFilePath, 'utf8');
    const resolvedContent = await fs.readFile(resolvedFilePath, 'utf8');

    const regionLines = regionContent.split('\n').filter(l => l.trim() !== '' && !l.startsWith('#'));
    if (conflictNum > regionLines.length) return null;
    
    const regionLine = regionLines[conflictNum - 1];
    if (!regionLine) return null;

    const [sc, ec, sr, er] = parseRegionLine(regionLine);
    if (sc === undefined || ec === undefined || sr === undefined || er === undefined) return null;
    if ([sc, ec, sr, er].some(Number.isNaN)) return null;

    const mergedLines = mergedContent.split('\n');
    const resolvedLines = resolvedContent.split('\n');

    const startIdx = sc - 1;
    const endIdx = ec;
    
    const conflictText = mergedLines.slice(startIdx, endIdx).join('\n');
    
    const contextN = 10;
    const conflictContext = mergedLines.slice(Math.max(0, startIdx - contextN), Math.min(mergedLines.length, endIdx + contextN)).join('\n');

    const resStartIdx = sr - 1;
    const resEndIdx = er;
    const groundTruth = resolvedLines.slice(Math.max(0, resStartIdx), resEndIdx).join('\n');

    return {
      id: `congra-${hashedName}-${conflictNum}`,
      dataset: 'structured-snippets',
      language,
      conflictType: type,
      conflictText,
      conflictContext,
      groundTruth,
      metadata: {
        rawDirPath,
        file
      }
    };
  }
}

export const CongraAdapter = StructuredSnippetsAdapter;

function conflictDirFromMetaPath(congraPath: string, rawRelativePath: string): string {
  const mergedMarker = `${path.sep}merged_without_base${path.sep}`;
  const rawPath = path.join(congraPath, 'raw_datasets', rawRelativePath);
  const markerIndex = rawPath.indexOf(mergedMarker);
  return markerIndex === -1 ? rawPath : rawPath.slice(0, markerIndex);
}

function filePathFromMetaPath(rawRelativePath: string): string | null {
  const parts = rawRelativePath.split(/[\\/]+merged_without_base[\\/]+/);
  return parts[1] || null;
}

function parseRegionLine(regionLine: string): number[] {
  return Array.from(regionLine.matchAll(/\d+/g), (match) => Number.parseInt(match[0], 10));
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.stat(candidatePath);
    return true;
  } catch (error: unknown) {
    if (!isNotFoundError(error)) {
      console.warn(`Could not inspect structured snippet path ${candidatePath}: ${formatError(error)}`);
    }
    return false;
  }
}

async function findCongraDataPath(datasetPath: string | undefined): Promise<string> {
  const basePath = path.resolve(datasetPath ?? DEFAULT_EVAL_DATASETS_DIR);
  const candidates = [
    basePath,
    path.join(basePath, 'Congra_datasets'),
    path.join(basePath, 'ConGra/data')
  ];

  for (const candidate of candidates) {
    if (
      await pathExists(path.join(candidate, 'congra_full_datasets')) &&
      await pathExists(path.join(candidate, 'raw_datasets'))
    ) {
      return candidate;
    }
  }

  throw new Error(`Structured snippet data not found. Expected congra_full_datasets and raw_datasets under one of: ${candidates.join(', ')}`);
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
