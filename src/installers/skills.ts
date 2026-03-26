import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import ora from 'ora';
import { log } from '../utils/logger.js';

interface SkillSource {
  id: string;
  name: string;
  repo: string;
  description: string;
  license: string;
  install: string;
  picks?: {
    agents?: string[];
    skills?: string[];
    instructions?: string[];
  };
}

export async function installSkills(
  sources: SkillSource[],
  targetDir: string,
): Promise<number> {
  let totalInstalled = 0;
  const agentsDir = path.join(os.homedir(), '.agents');
  await fs.ensureDir(agentsDir);

  for (const source of sources) {
    const spinner = ora(`Cloning ${source.name}...`).start();
    const cloneDir = path.join(agentsDir, source.id);

    try {
      if (await fs.pathExists(cloneDir)) {
        spinner.info(`${source.name} already exists, skipping clone`);
      } else if (source.install === 'sparse-clone') {
        const dirs = [];
        if (source.picks?.agents) dirs.push('agents');
        if (source.picks?.skills) dirs.push('skills');
        if (source.picks?.instructions) dirs.push('instructions');

        execSync(
          `git clone --depth 1 --filter=blob:none --sparse https://github.com/${source.repo}.git ${cloneDir}`,
          { stdio: 'pipe', timeout: 60_000 },
        );
        if (dirs.length > 0) {
          execSync(`git sparse-checkout set ${dirs.join(' ')}`, {
            cwd: cloneDir, stdio: 'pipe',
          });
        }
        spinner.succeed(`${source.name} cloned`);
      } else {
        execSync(
          `git clone --depth 1 https://github.com/${source.repo}.git ${cloneDir}`,
          { stdio: 'pipe', timeout: 60_000 },
        );
        spinner.succeed(`${source.name} cloned`);
      }

      // Symlink picked skills into target
      if (source.picks?.skills) {
        for (const skill of source.picks.skills) {
          const src = path.join(cloneDir, 'skills', skill);
          const dest = path.join(targetDir, skill);
          if ((await fs.pathExists(src)) && !(await fs.pathExists(dest))) {
            await fs.symlink(src, dest);
            totalInstalled++;
          }
        }
      }
    } catch (e) {
      spinner.warn(`${source.name} — failed: ${e}`);
    }
  }

  return totalInstalled;
}
