import chalk from 'chalk';
import { loadConfig } from '../utils/config.js';
import { log } from '../utils/logger.js';

export async function statusCommand() {
  const config = await loadConfig();
  if (!config) {
    log.error('No F2G-Telco config found. Run: f2g-telco init');
    return;
  }

  console.log(`
  ${chalk.bold('F2G-Telco')} v${config.version}

  Tool:      ${chalk.cyan(config.tool)}
  Provider:  ${chalk.cyan(config.provider)}
  MCPs:      ${chalk.green(String(config.installedMcps.length))} installed
  Config:    ${chalk.dim(config.paths.config)}
  Inventory: ${chalk.dim(config.paths.inventory)}
  `);
}
