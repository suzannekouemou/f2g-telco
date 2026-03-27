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
    log.error('No F2G-Telco config found. Run: npx f2g-telco init');
    return;
  }

  const env = await detectEnvironment();
  let pass = 0;
  let warn = 0;
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

  const advisory = (name: string, ok: boolean, detail?: string) => {
    if (ok) {
      console.log(chalk.green('  ✔'), name, detail ? chalk.dim(detail) : '');
      pass++;
    } else {
      console.log(chalk.yellow('  ⚠'), name, detail ? chalk.dim(detail) : '');
      warn++;
    }
  };

  // Prerequisites
  log.header('Prerequisites');
  check('Node.js', !!env.node, env.node || 'not found — required');
  check('Git', !!env.git, env.git || 'not found — required for skill cloning');
  advisory('Python', !!env.python, env.python || 'optional — needed only for contextgraph MCP');

  // Tool
  log.header(`Tool: ${config.tool}`);
  const toolInstalled = config.tool === 'crush' ? env.tools.crush : env.tools.kiro;
  if (toolInstalled) {
    check(`${config.tool} binary`, true, 'found in PATH');
  } else {
    advisory(`${config.tool} binary`, false,
      config.tool === 'crush'
        ? 'not in PATH — install: go install github.com/charmbracelet/crush@latest'
        : 'not in PATH — install: npm i -g @anthropic-ai/kiro');
  }

  const paths = getToolPaths(config.tool);
  check('Config directory', await fs.pathExists(paths.config), paths.config);
  check('MCP config file', await fs.pathExists(paths.mcpConfig), paths.mcpConfig);
  check('Skills directory', await fs.pathExists(paths.skills), paths.skills);

  // MCPs — all Node MCPs use npx, so they're always "available"
  log.header('MCP Servers');
  const home = os.homedir();
  for (const mcpId of config.installedMcps) {
    if (mcpId === 'contextgraph') {
      // Python MCP — check the bridge script exists
      const bridgePath = path.join(home, '.local', 'bin', 'contextgraph-mcp');
      const exists = await fs.pathExists(bridgePath);
      if (exists) {
        check(mcpId, true, 'bridge script found');
      } else {
        advisory(mcpId, false, 'bridge not found — run: npx f2g-telco add contextgraph');
      }
    } else {
      // Node MCPs use npx — always available, just check config entry exists
      check(mcpId, true, 'configured (npx auto-downloads at runtime)');
    }
  }

  // INVENTORY.md
  log.header('Discovery');
  check('INVENTORY.md', await fs.pathExists(config.paths.inventory), config.paths.inventory);

  // Summary
  const parts = [chalk.green(`${pass} passed`)];
  if (warn > 0) parts.push(chalk.yellow(`${warn} warnings`));
  if (fail > 0) parts.push(chalk.red(`${fail} failed`));
  console.log(`\n${chalk.bold('Summary:')} ${parts.join(', ')}\n`);

  if (!toolInstalled) {
    console.log(chalk.yellow(`Note: ${config.tool} binary not found, but config is ready.`));
    console.log(chalk.dim(`Install ${config.tool} and your environment will work immediately.\n`));
  }
}
