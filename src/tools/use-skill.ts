import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { SkillRegistry } from '../context/skills.js';
import { dedent } from '../utils/dedent.js';

const useSkillInputSchema = z.object({
  name: z.string(),
});

export type UseSkillToolInput = z.infer<typeof useSkillInputSchema>;

async function collectSupportingFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.name !== 'SKILL.md') {
        files.push(entryPath);
      }
    }
  }

  await walk(dirPath);
  return files;
}

export function makeUseSkillTool(registry: SkillRegistry) {
  return tool(
    async ({ name }) => {
      const skill = registry.get(name);

      if (!skill) {
        const available = [...registry.keys()].join(', ');
        return `Skill "${name}" not found. Available skills: ${available || 'none'}.`;
      }

      const skillMdPath = path.join(skill.dirPath, 'SKILL.md');
      const skillContent = await fs.readFile(skillMdPath, 'utf-8');
      const supportingFiles = await collectSupportingFiles(skill.dirPath);

      const filesSection =
        supportingFiles.length > 0
          ? supportingFiles.join('\n')
          : 'No supporting files found in this skill directory.';

      return `[SKILL CONTENT]\n${skillContent}\n\n[SKILL FILES]\n${filesSection}`;
    },
    {
      name: 'use_skill',
      description: dedent`
        Loads the full content of a skill by name.
        Use this when a skill listed in <available_skills> matches the current conflict context.
        Returns the skill's full instructions and the absolute paths of any supporting files
        (references, scripts, assets) you can access with the read or bash tools.
        Do not call this tool for a skill you have already loaded in this session.
      `,
      schema: useSkillInputSchema,
    }
  );
}
