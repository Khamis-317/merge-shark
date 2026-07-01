import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface SkillMetaData {
  name: string;
  description: string;
  dirPath: string;
}

export type SkillRegistry = Map<string, SkillMetaData>;

function stripQuotes(value: string): string {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1).trim();
  }
  return v;
}

function parseFrontmatter(
  content: string,
  dirName: string
): { name: string; description: string } | null {
  try {
    if (!content.startsWith('---')) return null;

    const afterFirstNewline = content.indexOf('\n');
    if (afterFirstNewline === -1) return null;

    const secondFence = content.indexOf('---', afterFirstNewline + 1);
    if (secondFence === -1) return null;

    const frontmatter = content.slice(afterFirstNewline + 1, secondFence);

    let name: string | undefined;
    let description: string | undefined;

    for (const line of frontmatter.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const key = line.slice(0, colonIdx).trim();
      const rawValue = line.slice(colonIdx + 1).trim();

      if (key === 'name' && name === undefined) {
        const stripped = stripQuotes(rawValue);
        if (stripped.length > 0) name = stripped;
      }
      if (key === 'description' && description === undefined) {
        const stripped = stripQuotes(rawValue);
        if (stripped.length > 0) description = stripped;
      }
    }

    if (!description) return null;

    return {
      name: name !== undefined ? name : dirName,
      description,
    };
  } catch {
    return null;
  }
}

export async function discoverSkills(
  repoPath: string,
  homeDir: string = os.homedir()
): Promise<SkillRegistry> {
  const home = homeDir;
  const searchPaths = [
    path.join(repoPath, '.mergeshark', 'skills'),
    path.join(repoPath, '.claude', 'skills'),
    path.join(repoPath, '.agents', 'skills'),
    path.join(home, '.config', 'mergeshark', 'skills'),
    path.join(home, '.claude', 'skills'),
    path.join(home, '.agents', 'skills'),
  ];

  const registry: SkillRegistry = new Map();

  for (const searchPath of searchPaths) {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(searchPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(searchPath, entry.name);
      const skillMdPath = path.join(skillDir, 'SKILL.md');

      let content: string;
      try {
        content = await fs.readFile(skillMdPath, 'utf-8');
      } catch {
        continue;
      }

      const parsed = parseFrontmatter(content, entry.name);
      if (!parsed) continue;

      if (registry.has(parsed.name)) continue;

      registry.set(parsed.name, {
        name: parsed.name,
        description: parsed.description,
        dirPath: skillDir,
      });
    }
  }

  return registry;
}
