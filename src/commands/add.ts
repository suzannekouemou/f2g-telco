import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { log, isVerbose } from '../utils/logger.js';
import { loadConfig, saveConfig, getToolPaths } from '../utils/config.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const registryDir = path.resolve(__dirname, '..', '..', 'registry');

interface McpEntry {
  id: string;
  name: string;
  description: string;
  install: string;
  npxCommand?: string[];
  command: string;
  args?: string[];
  requiresEnv: string[];
  setupSteps?: string[];
  envSetup?: string;
  env?: Record<string, string>;
  category: string;
  free: boolean;
  python?: boolean;
  bridge?: boolean;
  autoApprove?: string[];
}

/**
 * Draw a boxed panel for guided API key setup
 */
function drawSetupBox(name: string, description: string, steps: string[]): void {
  const width = 60;
  const topBorder = '╔' + '═'.repeat(width - 2) + '╗';
  const bottomBorder = '╚' + '═'.repeat(width - 2) + '╝';
  const emptyLine = '║' + ' '.repeat(width - 2) + '║';

  const padLine = (text: string): string => {
    const visible = text.replace(/\x1B\[[0-9;]*m/g, '');
    const padding = width - 2 - visible.length;
    return '║  ' + text + ' '.repeat(Math.max(0, padding - 2)) + '║';
  };

  console.log('\n' + chalk.cyan(topBorder));
  console.log(chalk.cyan(padLine(chalk.bold(`📦 ${name}`) + chalk.dim(` — ${description}`))));
  console.log(chalk.cyan(emptyLine));

  steps.forEach((step, i) => {
    const numbered = `${i + 1}. ${step}`;
    console.log(chalk.cyan(padLine(numbered)));
  });

  console.log(chalk.cyan(emptyLine));
  console.log(chalk.cyan(bottomBorder));
}

export async function addCommand(mcpId: string) {
  try {
    await runAdd(mcpId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(message);
    if (isVerbose() && err instanceof Error && err.stack) {
      console.error(chalk.dim(err.stack));
    }
    process.exit(1);
  }
}

async function runAdd(mcpId: string) {
  // Load existing config
  const config = await loadConfig();
  if (!config) {
    log.error('No existing configuration found. Run `f2g-telco init` first.');
    process.exit(1);
  }

  // Load MCP registry
  const registry = await fs.readJson(path.join(registryDir, 'mcps.json'));
  const mcp: McpEntry | undefined = registry.mcps.find((m: McpEntry) => m.id === mcpId);

  if (!mcp) {
    log.error(`MCP "${mcpId}" not found in registry`);
    log.dim('  Available MCPs:');
    for (const m of registry.mcps) {
      log.dim(`    ${m.id} — ${m.description}`);
    }
    process.exit(1);
  }

  // Check if already installed
  if (config.installedMcps.includes(mcpId)) {
    log.warn(`${mcp.name} is already installed`);
    const { reinstall } = await inquirer.prompt([{
      type: 'confirm',
      name: 'reinstall',
      message: 'Reinstall it?',
      default: false,
    }]);
    if (!reinstall) return;
  }

  // Collect API key if needed
  const envVars: Record<string, string> = {};
  
  if (mcp.requiresEnv && mcp.requiresEnv.length > 0) {
    for (const envKey of mcp.requiresEnv) {
      if (process.env[envKey]) {
        log.info(`Using ${envKey} from environment`);
        envVars[envKey] = process.env[envKey]!;
        continue;
      }

      const steps = mcp.setupSteps || [mcp.envSetup || `Get API key for ${mcp.name}`];
      drawSetupBox(mcp.name, mcp.description, steps);

      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: chalk.green('Enter API key'), value: 'enter' },
          { name: chalk.yellow('Skip — cancel installation'), value: 'skip' },
        ],
      }]);

      if (action === 'skip') {
        log.warn('Installation cancelled');
        return;
      }

      const { value } = await inquirer.prompt([{
        type: 'password',
        name: 'value',
        message: `${envKey}:`,
        mask: '*',
      }]);

      if (!value) {
        log.error(`${envKey} is required for ${mcp.name}`);
        return;
      }

      envVars[envKey] = value;
    }
  }

  // Install the MCP
  log.info(`Installing ${mcp.name}...`);
  const home = os.homedir();
  const userPrefix = path.join(home, '.local');

  try {
    if (mcp.python) {
      execSync(`pip3 install --user ${mcp.install.replace('pip install ', '')}`, { stdio: 'pipe', timeout: 120_000 });
    } else {
      const packageName = mcp.install.replace('npm install -g ', '');
      execSync(`npm install --prefix "${userPrefix}" ${packageName}`, { stdio: 'pipe', timeout: 120_000 });
    }
    log.success(`${mcp.name} installed`);
  } catch {
    log.warn(`npm install failed, will use npx`);
  }

  // Update tool config
  const paths = getToolPaths(config.tool);
  
  if (config.tool === 'crush') {
    await updateCrushConfig(mcp, paths.mcpConfig, envVars, home);
  } else if (config.tool === 'kiro') {
    await updateKiroConfig(mcp, paths.mcpConfig, envVars, home);
  }

  // Update saved config
  if (!config.installedMcps.includes(mcpId)) {
    config.installedMcps.push(mcpId);
    await saveConfig(config);
  }

  // Update INVENTORY.md
  await updateInventory(config.paths.inventory, mcp, config.installedMcps, registry.mcps, config.tool);

  log.success(`${mcp.name} added successfully!`);
  log.dim(`  Restart your ${config.tool} session to load the new MCP.`);
}

async function updateCrushConfig(
  mcp: McpEntry,
  configPath: string,
  envVars: Record<string, string>,
  home: string,
): Promise<void> {
  let config: Record<string, unknown> = {};
  if (await fs.pathExists(configPath)) {
    config = await fs.readJson(configPath);
  }

  const mcpConfig = (config.mcp as Record<string, unknown>) || {};
  
  const env: Record<string, string> = { ...(mcp.env || {}) };
  for (const key of mcp.requiresEnv) {
    if (envVars[key]) env[key] = envVars[key];
  }

  let command: string[];
  if (mcp.npxCommand) {
    command = mcp.npxCommand;
  } else if (mcp.bridge && mcp.id === 'contextgraph') {
    command = [`${home}/.local/bin/contextgraph-mcp`];
  } else if (mcp.args) {
    command = [mcp.command, ...mcp.args];
  } else {
    command = [mcp.command];
  }

  mcpConfig[mcp.id] = {
    type: 'local',
    command,
    enabled: true,
    ...(Object.keys(env).length > 0 ? { environment: env } : {}),
  };

  config.mcp = mcpConfig;

  // Update permissions with new autoApprove tools
  const permissions = (config.permissions as { allowed_tools?: string[] }) || { allowed_tools: [] };
  const allowedTools = permissions.allowed_tools || [];
  
  if (mcp.autoApprove) {
    for (const tool of mcp.autoApprove) {
      const fullName = `mcp_${mcp.id}_${tool}`;
      if (!allowedTools.includes(fullName)) {
        allowedTools.push(fullName);
      }
    }
  }
  config.permissions = { allowed_tools: allowedTools };

  await fs.writeJson(configPath, config, { spaces: 2 });
  log.success(`Updated ${configPath}`);
}

async function updateKiroConfig(
  mcp: McpEntry,
  configPath: string,
  envVars: Record<string, string>,
  home: string,
): Promise<void> {
  let config: { mcpServers?: Record<string, unknown> } = {};
  if (await fs.pathExists(configPath)) {
    config = await fs.readJson(configPath);
  }

  const mcpServers = config.mcpServers || {};

  const env: Record<string, string> = { ...(mcp.env || {}) };
  for (const key of mcp.requiresEnv) {
    if (envVars[key]) env[key] = envVars[key];
  }

  let command: string;
  let args: string[];

  if (mcp.bridge && mcp.id === 'contextgraph') {
    command = `${home}/.local/bin/contextgraph-mcp`;
    args = [];
  } else if (mcp.npxCommand) {
    command = mcp.npxCommand[0];
    args = mcp.npxCommand.slice(1);
  } else if (mcp.args) {
    command = mcp.command;
    args = mcp.args;
  } else {
    command = mcp.command;
    args = [];
  }

  mcpServers[mcp.id] = {
    command,
    args,
    disabled: false,
    ...(Object.keys(env).length > 0 ? { env } : {}),
    ...(mcp.autoApprove && mcp.autoApprove.length > 0 ? { autoApprove: mcp.autoApprove } : {}),
  };

  config.mcpServers = mcpServers;
  await fs.writeJson(configPath, config, { spaces: 2 });
  log.success(`Updated ${configPath}`);
}

async function updateInventory(
  inventoryPath: string,
  newMcp: McpEntry,
  installedIds: string[],
  allMcps: McpEntry[],
  tool: string,
): Promise<void> {
  const rows = allMcps
    .filter(m => installedIds.includes(m.id))
    .map(m => `| ${m.name} | ${m.description} |`)
    .join('\n');

  await fs.writeFile(inventoryPath, `# AI Environment Inventory
> Generated by F2G-Telco v0.1.0. Agents: read this to know what's available.

## MCP Servers (active)
| Server | Purpose |
|--------|---------|
${rows}

## Skills Discovery
Skills are in the tool's skills directory. Each has a SKILL.md with a \`description\` field.
Match task to skill by reading descriptions. Do NOT preload all skills.

## Key Rules
- **gitnexus**: Run \`npx gitnexus analyze\` in a repo before querying
- **context7**: Use for up-to-date library documentation
- **sequential-thinking**: Use for complex multi-step reasoning
- **mem0**: Check for prior context before starting work
- **contextgraph**: Use for structured recall with entity relationships

---
*Tool: ${tool} | Generated: ${new Date().toISOString().split('T')[0]} | F2G-Telco v0.1.0*
`);
  log.success(`Updated INVENTORY.md`);
}
