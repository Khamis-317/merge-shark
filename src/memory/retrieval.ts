import path from 'node:path';
import fs from 'node:fs/promises';
import { dedent } from '../utils/dedent.js';
import { ConflictRepository, type Conflict } from './db.js';
import { createEmbedding } from './embedder.js';
import { extractAllConflicts } from '../utils/parse-conflicts.js';

export function formatPastResolution(record: Conflict): string {
  return dedent`
    <resolution file_type="${record.fileType}" resolved_at="${record.resolvedAt}">
    <conflict>
      Base change:
      ${record.baseChange}

      Incoming change:
      ${record.incomingChange}
    </conflict>
    <outcome>
      ${record.resolution}
    </outcome>
    </resolution>
    `;
}

export async function queryPreviousResolutions(
  memory: ConflictRepository,
  repoPath: string,
  conflictingFiles: string[]
): Promise<string | null> {
  const blocks: string[] = [];
  const seenIds = new Set<string>();

  for (const file of conflictingFiles) {
    const absolutePath = path.resolve(repoPath, file);
    let content: string;
    try {
      content = await fs.readFile(absolutePath, 'utf-8');
    } catch {
      continue;
    }

    const conflicts = extractAllConflicts(content);
    const fileType = path.extname(file).slice(1);
    if (!fileType || conflicts.length === 0) continue;

    for (const conflict of conflicts) {
      const conflictText = `${conflict.baseChange}\n${conflict.incomingChange}`;
      let vector: number[];
      try {
        vector = await createEmbedding(conflictText);
      } catch {
        continue;
      }

      try {
        const similar = await memory.findSimilar(vector, fileType, 3);
        for (const record of similar) {
          if (seenIds.has(record.id)) continue;
          seenIds.add(record.id);
          blocks.push(formatPastResolution(record));
        }
      } catch {
        continue;
      }
    }
  }

  if (blocks.length === 0) return null;
  return blocks.join('\n');
}
