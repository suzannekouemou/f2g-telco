import { execSync } from 'child_process';
import fs from 'fs-extra';
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
  envSetup?: string;
  env?: Record<string, string>;
  category: string;
  free: boolean;
  python?: boolean;
}

export async function installMcps(
  mcps: McpEntry[],
  tool: string,
  envVars: Record<string, string>,
): Promise<string[]> {
  const installed: string[] = [];
  const paths = getToolPaths(tool);
  const total = mcps.length;

  for (let i = 0; i < mcps.length; i++) {
    const mcp = mcps[i];
    const spinner = ora(`[${i + 1}/${total}] Installing ${mcp.name}...`).start();

    try {
      // Install the package
      execSync(mcp.install, { stdio: 'pipe', timeout: 120_000 });
      spinner.succeed(`${mcp.name} installed`);
      installed.push(mcp.id);
    } catch {
      spinner.warn(`${mcp.name} — install failed, skipping`);
    }
  }

  // Write MCP config for the target tool
  await writeMcpConfig(mcps.filter(m => installed.includes(m.id)), tool, envVars);

  return installed;
}

async function writeMcpConfig(
  mcps: McpEntry[],
  tool: string,
  envVars: Record<string, string>,
): Promise<void> {
  const paths = getToolPaths(tool);

  if (tool === 'kiro') {
    const config: Record<string, unknown> = {};
    for (const mcp of mcps) {
      const entry: Record<string, unknown> = {
        command: mcp.command,
        args: mcp.args || [],
        disabled: false,
      };
      // Add env vars this MCP needs
      const env: Record<string, string> = { ...(mcp.env || {}) };
      for (const key of mcp.requiresEnv) {
        if (envVars[key]) env[key] = envVars[key];
      }
      if (Object.keys(env).length > 0) entry.env = env;
      config[mcp.id] = entry;
    }
    await fs.ensureDir(paths.config);
    const mcpPath = paths.mcpConfig;
    await fs.ensureDir(mcpPath.substring(0, mcpPath.lastIndexOf('/')));
    await fs.writeJson(mcpPath, { mcpServers: config }, { spaces: 2 });
  }

  if (tool === 'crush') {
    // Crush uses a different format inside crush.json
    const crushPath = paths.mcpConfig;
    let crushConfig: Record<string, unknown> = {};
    if (await fs.pathExists(crushPath)) {
      crushConfig = await fs.readJson(crushPath);
    }
    const mcpConfig: Record<string, unknown> = {};
    for (const mcp of mcps) {
      const entry: Record<string, unknown> = {
        type: 'local',
        command: mcp.args ? [mcp.command, ...mcp.args] : [mcp.command],
        enabled: true,
      };
      const env: Record<string, string> = { ...(mcp.env || {}) };
      for (const key of mcp.requiresEnv) {
        if (envVars[key]) env[key] = envVars[key];
      }
      if (Object.keys(env).length > 0) entry.environment = env;
      mcpConfig[mcp.id] = entry;
    }
    crushConfig.mcp = mcpConfig;
    await fs.ensureDir(paths.config);
    await fs.writeJson(crushPath, crushConfig, { spaces: 2 });
  }

  log.success(`MCP config written to ${paths.mcpConfig}`);
}
