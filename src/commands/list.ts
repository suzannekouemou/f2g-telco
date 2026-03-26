import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { log } from '../utils/logger.js';
import { loadConfig } from '../utils/config.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const registryDir = path.resolve(__dirname, '..', '..', 'registry');

interface ListOptions {
  mcps?: boolean;
  skills?: boolean;
  providers?: boolean;
}

export async function listCommand(options: ListOptions) {
  const config = await loadConfig();
  const showAll = !options.mcps && !options.skills && !options.providers;

  if (showAll || options.mcps) {
    log.header('MCP Servers');
    const registry = await fs.readJson(path.join(registryDir, 'mcps.json'));
    for (const mcp of registry.mcps) {
      const installed = config?.installedMcps.includes(mcp.id);
      const status = installed ? chalk.green('✔') : chalk.dim('○');
      const freeTag = mcp.free ? chalk.green(' free') : '';
      console.log(`  ${status} ${chalk.bold(mcp.name)}${freeTag} — ${mcp.description}`);
      if (mcp.requiresEnv.length > 0) {
        console.log(chalk.dim(`      requires: ${mcp.requiresEnv.join(', ')}`));
      }
    }
  }

  if (showAll || options.providers) {
    log.header('Providers');
    const registry = await fs.readJson(path.join(registryDir, 'providers.json'));
    for (const p of registry.providers) {
      const active = config?.provider === p.id;
      const status = active ? chalk.green('✔') : chalk.dim('○');
      const freeTag = p.free ? chalk.green(' free') : p.free === false ? chalk.yellow(' paid') : '';
      console.log(`  ${status} ${chalk.bold(p.name)}${freeTag} — ${p.description}`);
    }
  }

  if (showAll || options.skills) {
    log.header('Skill Sources');
    const registry = await fs.readJson(path.join(registryDir, 'skills.json'));
    for (const s of registry.sources) {
      console.log(`  ${chalk.bold(s.name)} — ${s.description}`);
      if (s.picks) {
        const counts = [];
        if (s.picks.agents) counts.push(`${s.picks.agents.length} agents`);
        if (s.picks.skills) counts.push(`${s.picks.skills.length} skills`);
        if (s.picks.instructions) counts.push(`${s.picks.instructions.length} instructions`);
        console.log(chalk.dim(`      picks: ${counts.join(', ')}`));
      }
    }
  }
}
