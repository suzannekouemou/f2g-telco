import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export interface F2GConfig {
  version: string;
  provider: string;
  tool: string;
  installedMcps: string[];
  installedSkills: string[];
  paths: {
    home: string;
    config: string;
    skills: string;
    agents: string;
    inventory: string;
  };
}

const CONFIG_DIR = path.join(os.homedir(), '.f2g-telco');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export async function loadConfig(): Promise<F2GConfig | null> {
  if (await fs.pathExists(CONFIG_FILE)) {
    return fs.readJson(CONFIG_FILE);
  }
  return null;
}

export async function saveConfig(config: F2GConfig): Promise<void> {
  await fs.ensureDir(CONFIG_DIR);
  await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

export function getToolPaths(tool: string) {
  const home = os.homedir();
  if (tool === 'crush') {
    return {
      config: path.join(home, '.config', 'crush'),
      skills: path.join(home, '.config', 'crush', 'skills'),
      agents: path.join(home, '.config', 'crush', 'agents'),
      mcpConfig: path.join(home, '.config', 'crush', 'crush.json'),
    };
  }
  if (tool === 'kiro') {
    return {
      config: path.join(home, '.kiro'),
      skills: path.join(home, '.kiro', 'skills'),
      agents: path.join(home, '.kiro', 'agents'),
      mcpConfig: path.join(home, '.kiro', 'settings', 'mcp.json'),
    };
  }
  throw new Error(`Unknown tool: ${tool}`);
}
