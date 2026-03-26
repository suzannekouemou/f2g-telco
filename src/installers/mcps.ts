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

  for (let i = 0; i < mcps.length; i++) {
    const mcp = mcps[i];
    const spinner = ora(`[${i + 1}/${mcps.length}] Installing ${mcp.name}...`).start();
    try {
      execSync(mcp.install, { stdio: 'pipe', timeout: 120_000 });
      installed.push(mcp.id);
      spinner.succeed(`${mcp.name} installed`);
    } catch {
      spinner.warn(`${mcp.name} — install failed, skipping`);
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

  // MCP section
  const mcpConfig: Record<string, unknown> = {};
  for (const mcp of mcps) {
    const env: Record<string, string> = { ...(mcp.env || {}) };
    for (const key of mcp.requiresEnv) {
      if (envVars[key]) env[key] = envVars[key];
    }
    mcpConfig[mcp.id] = {
      type: 'local',
      command: mcp.args ? [mcp.command, ...mcp.args] : [mcp.command],
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
    // Kiro tilde bug — use absolute paths
    let command = mcp.command;
    if (mcp.bridge && mcp.id === 'contextgraph') {
      command = `${home}/.local/bin/contextgraph-mcp`;
    }

    mcpServers[mcp.id] = {
      command,
      args: mcp.args || [],
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
