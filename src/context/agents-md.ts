import fs from 'node:fs/promises';
import path from 'node:path';
import { globUtil } from '../utils/glob-files.js';

export const AGENTS_MD_FILENAME = 'AGENTS.md';

export interface AgentsMdContext {
  repoPath: string;
  agentsMdPaths: Set<string>;
  loadedPaths: Set<string>;
  processedDirs: Set<string>;
}

export async function findRepoLevelAgentsMd(
  repoPath: string
): Promise<{ absolutePath: string; content: string } | null> {
  const absolutePath = path.join(repoPath, AGENTS_MD_FILENAME);
  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return { absolutePath, content };
  } catch {
    return null;
  }
}

export async function globAllAgentsMdPaths(
  repoPath: string
): Promise<Set<string>> {
  const paths = await globUtil(repoPath, '**/' + AGENTS_MD_FILENAME, undefined);
  return new Set(paths);
}

export async function collectDirectoryContexts(
  absoluteFilePath: string,
  context: AgentsMdContext
): Promise<string> {
  const collected: string[] = [];
  let dir = path.dirname(absoluteFilePath);

  while (true) {
    if (context.processedDirs.has(dir)) break;
    context.processedDirs.add(dir);

    const candidate = path.join(dir, AGENTS_MD_FILENAME);
    if (
      context.agentsMdPaths.has(candidate) &&
      !context.loadedPaths.has(candidate)
    ) {
      try {
        const content = await fs.readFile(candidate, 'utf-8');
        context.loadedPaths.add(candidate);
        const relativePath = path.relative(context.repoPath, candidate);
        collected.push(
          `<project-context source="${relativePath}">\n${content}\n</project-context>`
        );
      } catch {
        // Avoid letting an unreachable AGENTS.md crash the parent tool call
      }
    }

    if (dir === context.repoPath) break;
    dir = path.dirname(dir);
  }

  return collected.join('\n');
}
