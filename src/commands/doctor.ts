import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs-extra';
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

  // Tool
  log.header(`Tool: ${config.tool}`);
  const toolInstalled = config.tool === 'crush' ? env.tools.crush : env.tools.kiro;
  check(`${config.tool} installed`, toolInstalled);

  const paths = getToolPaths(config.tool);
  check('Config directory exists', await fs.pathExists(paths.config), paths.config);
  check('MCP config exists', await fs.pathExists(paths.mcpConfig), paths.mcpConfig);
  check('Skills directory exists', await fs.pathExists(paths.skills), paths.skills);

  // MCPs
  log.header('MCP Servers');
  for (const mcpId of config.installedMcps) {
    let found = false;
    try {
      execSync(`which ${mcpId === 'contextgraph' ? 'contextgraph-mcp' : mcpId.startsWith('mcp-') ? mcpId : `mcp-server-${mcpId}`} 2>/dev/null`, { encoding: 'utf-8' });
      found = true;
    } catch {
      // Try the command directly
      try {
        execSync(`which ${mcpId} 2>/dev/null`, { encoding: 'utf-8' });
        found = true;
      } catch { /* not found */ }
    }
    check(mcpId, found);
  }

  // INVENTORY.md
  log.header('Discovery');
  check('INVENTORY.md exists', await fs.pathExists(config.paths.inventory), config.paths.inventory);

  // Summary
  console.log(`\n${chalk.bold('Summary:')} ${chalk.green(`${pass} passed`)}, ${fail > 0 ? chalk.red(`${fail} failed`) : chalk.green('0 failed')}\n`);
}
