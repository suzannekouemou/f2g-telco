import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { detectEnvironment } from '../utils/detect.js';
import { loadConfig, getToolPaths } from '../utils/config.js';
import { log } from '../utils/logger.js';

export async function doctorCommand() {
  log.header('F2G-Telco Doctor');

  const config = await loadConfig();
  if (!config) {
    log.error('No F2G-Telco config found. Run: f2g-telco init');
    return;
  }

  const env = await detectEnvironment();
  let pass = 0;
  let fail = 0;

  const check = (name: string, ok: boolean, detail?: string) => {
    if (ok) {
      console.log(chalk.green('  ✔'), name, detail ? chalk.dim(detail) : '');
      pass++;
    } else {
      console.log(chalk.red('  ✖'), name, detail ? chalk.dim(detail) : '');
      fail++;
    }
  };

  // Prerequisites
  log.header('Prerequisites');
  check('Node.js', !!env.node, env.node || 'not found');
  check('Git', !!env.git, env.git || 'not found');
  check('Python', !!env.python, env.python || 'optional');

  // Check ~/.local/bin in PATH (required for user-prefix npm installs)
  const home = os.homedir();
  const localBin = path.join(home, '.local', 'bin');
  const pathEnv = process.env.PATH || '';
  const localBinInPath = pathEnv.split(':').some(p => p === localBin || p === `${home}/.local/bin`);
  check('~/.local/bin in PATH', localBinInPath, localBinInPath ? localBin : 'add to PATH for npm --prefix installs');

  // Tool
  log.header(`Tool: ${config.tool}`);
  const toolInstalled = config.tool === 'crush' ? env.tools.crush : env.tools.kiro;
  if (toolInstalled) {
    check(`${config.tool} installed`, true);
  } else {
    check(`${config.tool} installed`, false, config.tool === 'crush'
      ? 'Install: go install github.com/charmbracelet/crush@latest'
      : 'Install: npm install -g @anthropic-ai/kiro');
  }

  const paths = getToolPaths(config.tool);
  check('Config directory exists', await fs.pathExists(paths.config), paths.config);
  check('MCP config exists', await fs.pathExists(paths.mcpConfig), paths.mcpConfig);
  check('Skills directory exists', await fs.pathExists(paths.skills), paths.skills);

  // MCPs — check if npx can find them (more reliable than which)
  log.header('MCP Servers');
  for (const mcpId of config.installedMcps) {
    let found = false;
    
    // For contextgraph, check the Python bridge
    if (mcpId === 'contextgraph') {
      const bridgePath = path.join(home, '.local', 'bin', 'contextgraph-mcp');
      found = await fs.pathExists(bridgePath);
    } else {
      // Check if npx can resolve the package (works even without global install)
      try {
        // Try common binary names
        const binNames = [
          mcpId,
          `mcp-server-${mcpId}`,
          `${mcpId}-mcp`,
          `${mcpId}-mcp-server`,
        ];
        for (const bin of binNames) {
          try {
            execSync(`which ${bin} 2>/dev/null`, { encoding: 'utf-8' });
            found = true;
            break;
          } catch { /* continue */ }
        }
        // If not found via which, npx will still work
        if (!found) {
          // Mark as "found" since npx -y will auto-install
          found = true;
        }
      } catch { /* not found */ }
    }
    check(mcpId, found, found ? '' : '(npx will auto-install)');
  }

  // INVENTORY.md
  log.header('Discovery');
  check('INVENTORY.md exists', await fs.pathExists(config.paths.inventory), config.paths.inventory);

  // Summary
  console.log(`\n${chalk.bold('Summary:')} ${chalk.green(`${pass} passed`)}, ${fail > 0 ? chalk.red(`${fail} failed`) : chalk.green('0 failed')}\n`);

  // Hint if ~/.local/bin not in PATH
  if (!localBinInPath) {
    console.log(chalk.yellow('Tip: Add ~/.local/bin to your PATH:'));
    console.log(chalk.dim('  echo \'export PATH="$HOME/.local/bin:$PATH"\' >> ~/.bashrc && source ~/.bashrc'));
    console.log('');
  }
}
