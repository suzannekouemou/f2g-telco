import { execSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

export interface DetectedEnvironment {
  os: string;
  shell: string;
  node: string | null;
  python: string | null;
  git: string | null;
  tools: {
    crush: boolean;
    kiro: boolean;
    claudeCode: boolean;
  };
  providers: {
    copilot: boolean;
    ollama: boolean;
    nim: boolean;
  };
}

function which(cmd: string): string | null {
  try {
    return execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

function version(cmd: string): string | null {
  try {
    return execSync(`${cmd} --version 2>/dev/null`, { encoding: 'utf-8' }).trim().split('\n')[0];
  } catch {
    return null;
  }
}

export async function detectEnvironment(): Promise<DetectedEnvironment> {
  const home = os.homedir();

  return {
    os: `${os.platform()} ${os.arch()}`,
    shell: process.env.SHELL || 'unknown',
    node: version('node'),
    python: version('python3') || version('python'),
    git: version('git'),
    tools: {
      crush: !!which('crush'),
      kiro: !!which('kiro-cli'),
      claudeCode: !!which('claude'),
    },
    providers: {
      copilot: await fs.pathExists(path.join(home, '.config', 'crush', 'auth.json'))
        || !!process.env.GITHUB_COPILOT_TOKEN,
      ollama: !!which('ollama'),
      nim: !!process.env.NVIDIA_API_KEY,
    },
  };
}
