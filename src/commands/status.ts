import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { loadConfig, getToolPaths } from '../utils/config.js';
import { log } from '../utils/logger.js';

export async function statusCommand() {
  const config = await loadConfig();
  if (!config) {
    log.error('No F2G-Telco config found. Run: npx f2g-telco init');
    return;
  }

  const home = os.homedir();
  const paths = getToolPaths(config.tool);

  // MCP config check
  let mcpCount = 0;
  try {
    if (config.tool === 'crush') {
      const crush = await fs.readJson(paths.mcpConfig);
      mcpCount = Object.keys(crush.mcp || {}).length;
    } else {
      const kiro = await fs.readJson(paths.mcpConfig);
      mcpCount = Object.keys(kiro.mcpServers || {}).length;
    }
  } catch { /* config unreadable */ }

  // Skills count
  let skillCount = 0;
  try {
    const entries = await fs.readdir(paths.skills);
    skillCount = entries.length;
  } catch { /* dir missing */ }

  // Inventory check
  const invExists = await fs.pathExists(config.paths.inventory);
  let invLines = 0;
  if (invExists) {
    const content = await fs.readFile(config.paths.inventory, 'utf-8');
    invLines = content.split('\n').length;
  }

  // Providers from config
  const providers = config.provider ? config.provider.split(',').map(p => p.trim()) : ['unknown'];

  console.log(`
  ${chalk.bold.blue('F2G-Telco')} v${config.version}
  ${'─'.repeat(40)}

  ${chalk.bold('Tool')}         ${chalk.cyan(config.tool)}
  ${chalk.bold('Providers')}    ${providers.map(p => chalk.cyan(p)).join(', ')}
  ${chalk.bold('MCPs')}         ${chalk.green(String(config.installedMcps.length))} configured (${mcpCount} in ${config.tool} config)
  ${chalk.bold('Skills')}       ${chalk.green(String(skillCount))} in ${paths.skills}
  ${chalk.bold('Inventory')}    ${invExists ? chalk.green(`${invLines} lines`) : chalk.red('missing')}

  ${chalk.bold('Configured MCPs:')}
  ${config.installedMcps.map(m => '    ' + chalk.dim('• ') + m).join('\n  ')}

  ${chalk.bold('Paths:')}
  ${chalk.dim('  Config:    ')} ${config.paths.config}
  ${chalk.dim('  Skills:    ')} ${paths.skills}
  ${chalk.dim('  Agents:    ')} ${paths.agents}
  ${chalk.dim('  MCP file:  ')} ${paths.mcpConfig}
  ${chalk.dim('  Inventory: ')} ${config.paths.inventory}
  ${chalk.dim('  Log:       ')} ${path.join(home, '.f2g-telco', 'f2g-telco.log')}
  `);
}
