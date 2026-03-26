import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import ora from 'ora';
import { log } from '../utils/logger.js';
import { getToolPaths } from '../utils/config.js';

interface McpEntry {
  id: string;
  name: string;
  description: string;
  install: string;
  npxCommand?: string[];
  command: string;
  args?: string[];
  requiresEnv: string[];
  env?: Record<string, string>;
  category: string;
  free: boolean;
  python?: boolean;
  bridge?: boolean;
  autoApprove?: string[];
}

interface ProviderEntry {
  id: string;
  crushProvider?: Record<string, unknown>;
  models: { large: { model: string; provider: string }; small: { model: string; provider: string } };
}

export async function installMcps(
  mcps: McpEntry[],
  tool: string,
  envVars: Record<string, string>,
): Promise<string[]> {
  const installed: string[] = [];
  const home = os.homedir();
  const userPrefix = path.join(home, '.local');

  for (let i = 0; i < mcps.length; i++) {
    const mcp = mcps[i];
    const spinner = ora(`[${i + 1}/${mcps.length}] Installing ${mcp.name}...`).start();
    try {
      if (mcp.python) {
        // Python packages: use pip install --user
        execSync(`pip3 install --user ${mcp.install.replace('pip install ', '')}`, { stdio: 'pipe', timeout: 120_000 });
      } else {
        // Node packages: use npm install --prefix ~/.local (avoids sudo)
        const packageName = mcp.install.replace('npm install -g ', '');
        execSync(`npm install --prefix "${userPrefix}" ${packageName}`, { stdio: 'pipe', timeout: 120_000 });
      }
      installed.push(mcp.id);
      spinner.succeed(`${mcp.name} installed`);
    } catch {
      // Install failed, but npx will still work — mark as installed
      installed.push(mcp.id);
      spinner.warn(`${mcp.name} — npm install failed, will use npx`);
    }
  }

  return installed;
}

export async function writeToolConfig(
  mcps: McpEntry[],
  installedIds: string[],
  tool: string,
  envVars: Record<string, string>,
  provider: ProviderEntry,
): Promise<void> {
  const activeMcps = mcps.filter(m => installedIds.includes(m.id));
  const paths = getToolPaths(tool);
  const home = os.homedir();

  if (tool === 'crush') {
    await writeCrushConfig(activeMcps, paths, envVars, provider, home);
  } else if (tool === 'kiro') {
    await writeKiroConfig(activeMcps, paths, envVars, home);
  }
}

async function writeCrushConfig(
  mcps: McpEntry[],
  paths: ReturnType<typeof getToolPaths>,
  envVars: Record<string, string>,
  provider: ProviderEntry,
  home: string,
): Promise<void> {
  let config: Record<string, unknown> = {};
  if (await fs.pathExists(paths.mcpConfig)) {
    config = await fs.readJson(paths.mcpConfig);
  }

  // MCP section — use npxCommand for reliable execution
  const mcpConfig: Record<string, unknown> = {};
  for (const mcp of mcps) {
    const env: Record<string, string> = { ...(mcp.env || {}) };
    for (const key of mcp.requiresEnv) {
      if (envVars[key]) env[key] = envVars[key];
    }

    // Use npxCommand if available (preferred for permission-free execution)
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
  }
  config.mcp = mcpConfig;

  // Providers section
  if (provider.crushProvider) {
    config.providers = provider.crushProvider;
  }

  // Models section
  config.models = provider.models;

  // Options section
  config.options = {
    skills_paths: [
      `${home}/.config/crush/skills`,
      `${home}/.config/agents/skills`,
    ],
    context_paths: [
      `${home}/.config/crush/agents/autonomous.md`,
    ],
    disable_metrics: true,
    disable_notifications: true,
    attribution: { trailer_style: 'co-authored-by', generated_with: false },
  };

  // Permissions — auto-approve safe tools + MCP read tools
  const allowedTools = [
    'view', 'ls', 'grep', 'glob', 'edit', 'multiedit', 'write',
    'fetch', 'agentic_fetch', 'download',
    'lsp_diagnostics', 'lsp_references', 'todos', 'agent',
  ];
  for (const mcp of mcps) {
    if (mcp.autoApprove) {
      for (const tool of mcp.autoApprove) {
        allowedTools.push(`mcp_${mcp.id}_${tool}`);
      }
    }
  }
  config.permissions = { allowed_tools: allowedTools };

  // LSP section — detect available language servers
  const lsp: Record<string, unknown> = {};
  try {
    execSync('which pyright-langserver 2>/dev/null', { encoding: 'utf-8' });
    lsp.python = {
      command: 'pyright-langserver', args: ['--stdio'],
      filetypes: ['py'],
      root_markers: ['pyproject.toml', 'setup.py', 'requirements.txt', '.venv'],
    };
  } catch { /* not installed */ }
  try {
    execSync('which typescript-language-server 2>/dev/null', { encoding: 'utf-8' });
    lsp.typescript = {
      command: 'typescript-language-server', args: ['--stdio'],
      filetypes: ['ts', 'tsx', 'js', 'jsx'],
      root_markers: ['package.json', 'tsconfig.json'],
    };
  } catch { /* not installed */ }
  if (Object.keys(lsp).length > 0) {
    config.lsp = lsp;
  }

  config.$schema = 'https://charm.land/crush.json';

  await fs.ensureDir(paths.config);
  await fs.writeJson(paths.mcpConfig, config, { spaces: 2 });
  log.success(`Crush config written to ${paths.mcpConfig}`);
}

async function writeKiroConfig(
  mcps: McpEntry[],
  paths: ReturnType<typeof getToolPaths>,
  envVars: Record<string, string>,
  home: string,
): Promise<void> {
  const mcpServers: Record<string, unknown> = {};

  for (const mcp of mcps) {
    const env: Record<string, string> = { ...(mcp.env || {}) };
    for (const key of mcp.requiresEnv) {
      if (envVars[key]) env[key] = envVars[key];
    }

    // Use npxCommand for Kiro — split into command + args
    let command: string;
    let args: string[];

    if (mcp.bridge && mcp.id === 'contextgraph') {
      // Python bridge — use absolute path
      command = `${home}/.local/bin/contextgraph-mcp`;
      args = [];
    } else if (mcp.npxCommand) {
      // npx-based command: first element is command, rest are args
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
  }

  const mcpDir = path.dirname(paths.mcpConfig);
  await fs.ensureDir(mcpDir);
  await fs.writeJson(paths.mcpConfig, { mcpServers }, { spaces: 2 });
  log.success(`Kiro MCP config written to ${paths.mcpConfig}`);
}
