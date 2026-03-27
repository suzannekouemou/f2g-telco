import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import ora from 'ora';
import { loadConfig, getToolPaths } from '../utils/config.js';
import { log } from '../utils/logger.js';

export async function updateCommand() {
  log.header('F2G-Telco Update');

  const config = await loadConfig();
  if (!config) {
    log.error('No F2G-Telco config found. Run: npx f2g-telco init');
    return;
  }

  const home = os.homedir();
  let updated = 0;

  // 1. Check for CLI updates via npm
  const s1 = ora('Checking for f2g-telco updates...').start();
  try {
    const latest = execSync('npm view f2g-telco version 2>/dev/null', {
      encoding: 'utf-8', timeout: 15_000,
    }).trim();
    if (latest && latest !== config.version) {
      s1.succeed(`New version available: ${chalk.green(latest)} (current: ${config.version})`);
      console.log(chalk.dim(`  Run: npx f2g-telco@${latest} init  to upgrade`));
    } else {
      s1.succeed(`f2g-telco is up to date (v${config.version})`);
    }
  } catch {
    s1.info('Could not check npm registry (offline?)');
  }

  // 2. Update skill repositories
  const skillDirs = ['awesome-copilot', 'agency-agents', 'claude-best-practices'];
  const agentsDir = path.join(home, '.agents');

  for (const dir of skillDirs) {
    const repoPath = path.join(agentsDir, dir);
    if (!await fs.pathExists(path.join(repoPath, '.git'))) continue;

    const s = ora(`Updating ${dir}...`).start();
    try {
      const result = execSync(`git -C "${repoPath}" pull --ff-only 2>&1`, {
        encoding: 'utf-8', timeout: 30_000,
      });
      if (result.includes('Already up to date')) {
        s.succeed(`${dir} — already up to date`);
      } else {
        s.succeed(`${dir} — ${chalk.green('updated')}`);
        updated++;
      }
    } catch {
      s.warn(`${dir} — could not update (check manually)`);
    }
  }

  // 3. Refresh MCP config from registry
  const s3 = ora('Refreshing MCP configuration...').start();
  try {
    const registryPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname), '..', '..', 'registry', 'mcps.json'
    );
    // For npx usage, registry is bundled — just confirm config is intact
    const paths = getToolPaths(config.tool);
    if (await fs.pathExists(paths.mcpConfig)) {
      s3.succeed('MCP configuration intact');
    } else {
      s3.warn('MCP config file missing — run: npx f2g-telco init');
    }
  } catch {
    s3.info('MCP config check skipped');
  }

  // 4. Verify INVENTORY.md
  const s4 = ora('Checking INVENTORY.md...').start();
  if (await fs.pathExists(config.paths.inventory)) {
    s4.succeed('INVENTORY.md present');
  } else {
    s4.warn('INVENTORY.md missing — run: npx f2g-telco init');
  }

  // Summary
  console.log('');
  if (updated > 0) {
    log.success(`Update complete — ${updated} skill source(s) updated.`);
  } else {
    log.success('Everything is up to date.');
  }
  console.log(chalk.dim('  Run: npx f2g-telco doctor  to verify health'));
  console.log('');
}
