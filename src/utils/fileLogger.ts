import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const LOG_DIR = path.join(os.homedir(), '.f2g-telco');
const LOG_FILE = path.join(LOG_DIR, 'f2g-telco.log');

let initialized = false;

async function ensureLogFile(): Promise<void> {
  if (!initialized) {
    await fs.ensureDir(LOG_DIR);
    initialized = true;
  }
}

function timestamp(): string {
  return new Date().toISOString();
}

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

export async function logToFile(level: string, message: string): Promise<void> {
  await ensureLogFile();
  const line = `[${timestamp()}] [${level}] ${stripAnsi(message)}\n`;
  await fs.appendFile(LOG_FILE, line);
}

export async function logSection(title: string): Promise<void> {
  await logToFile('INFO', `\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}`);
}

export async function logSystemInfo(): Promise<void> {
  await logSection('F2G-Telco Session');
  await logToFile('INFO', `Version: 0.1.0`);
  await logToFile('INFO', `OS: ${os.platform()} ${os.arch()} ${os.release()}`);
  await logToFile('INFO', `Node: ${process.version}`);
  await logToFile('INFO', `Home: ${os.homedir()}`);
  await logToFile('INFO', `Date: ${timestamp()}`);
  await logToFile('INFO', `Args: ${process.argv.slice(2).join(' ')}`);
}

export function getLogPath(): string {
  return LOG_FILE;
}
