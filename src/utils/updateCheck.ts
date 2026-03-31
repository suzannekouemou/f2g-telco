import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

const CHECK_FILE = path.join(os.homedir(), '.f2g-telco', 'last-update-check.json');
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface CheckData {
  lastCheck: number;
  latestVersion: string | null;
}

async function readCheckData(): Promise<CheckData> {
  try {
    if (await fs.pathExists(CHECK_FILE)) {
      return await fs.readJson(CHECK_FILE);
    }
  } catch { /* ignore */ }
  return { lastCheck: 0, latestVersion: null };
}

async function writeCheckData(data: CheckData): Promise<void> {
  await fs.ensureDir(path.dirname(CHECK_FILE));
  await fs.writeJson(CHECK_FILE, data);
}

/**
 * Background update check — runs silently, never blocks, never throws.
 * Shows a one-line notice if a newer version exists.
 */
export async function checkForUpdates(currentVersion: string): Promise<void> {
  try {
    const data = await readCheckData();
    const now = Date.now();

    // Skip if checked recently
    if (now - data.lastCheck < CHECK_INTERVAL_MS) {
      if (data.latestVersion && data.latestVersion !== currentVersion) {
        showUpdateNotice(currentVersion, data.latestVersion);
      }
      return;
    }

    // Check npm in background (non-blocking, 5s timeout)
    let latest: string | null = null;
    try {
      latest = execSync('npm view f2g-telco version 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
    } catch {
      // Offline or npm issue — skip silently
      await writeCheckData({ lastCheck: now, latestVersion: null });
      return;
    }

    await writeCheckData({ lastCheck: now, latestVersion: latest });

    if (latest && latest !== currentVersion) {
      showUpdateNotice(currentVersion, latest);
    }
  } catch {
    // Never crash the main command for an update check
  }
}

function showUpdateNotice(current: string, latest: string): void {
  console.log('');
  console.log(chalk.yellow(`  ╭─────────────────────────────────────────────╮`));
  console.log(chalk.yellow(`  │                                             │`));
  console.log(chalk.yellow(`  │   Update available: ${chalk.dim(current)} → ${chalk.green(latest)}${' '.repeat(Math.max(0, 13 - current.length - latest.length))}│`));
  console.log(chalk.yellow(`  │   Run ${chalk.cyan('npx f2g-telco update')} to update       │`));
  console.log(chalk.yellow(`  │                                             │`));
  console.log(chalk.yellow(`  ╰─────────────────────────────────────────────╯`));
  console.log('');
}
