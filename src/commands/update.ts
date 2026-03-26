import chalk from 'chalk';
import { execSync } from 'child_process';
import ora from 'ora';
import { log } from '../utils/logger.js';
import { loadConfig } from '../utils/config.js';

export async function updateCommand() {
  log.header('F2G-Telco Update');

  const config = await loadConfig();
  if (!config) {
    log.error('No F2G-Telco config found. Run: f2g-telco init');
    return;
  }

  // Update the CLI itself
  const spinner = ora('Updating f2g-telco...').start();
  try {
    execSync('npm update -g f2g-telco', { stdio: 'pipe', timeout: 60_000 });
    spinner.succeed('f2g-telco updated');
  } catch {
    spinner.info('f2g-telco is up to date (or not installed globally)');
  }

  // Update skill repos
  const spinner2 = ora('Updating skill repositories...').start();
  try {
    const agentsDir = `${process.env.HOME}/.agents`;
    const dirs = ['awesome-copilot', 'agency-agents'];
    for (const dir of dirs) {
      try {
        execSync(`git -C ${agentsDir}/${dir} pull --ff-only 2>/dev/null`, {
          stdio: 'pipe', timeout: 30_000,
        });
      } catch { /* skip if not cloned */ }
    }
    spinner2.succeed('Skill repositories updated');
  } catch {
    spinner2.warn('Some repositories could not be updated');
  }

  log.success('Update complete. Run: f2g-telco doctor');
}
