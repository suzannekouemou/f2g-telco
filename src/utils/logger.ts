import chalk from 'chalk';
import { logToFile } from './fileLogger.js';

export const log = {
  info: (msg: string) => { console.log(chalk.blue('ℹ'), msg); logToFile('INFO', msg); },
  success: (msg: string) => { console.log(chalk.green('✔'), msg); logToFile('OK', msg); },
  warn: (msg: string) => { console.log(chalk.yellow('⚠'), msg); logToFile('WARN', msg); },
  error: (msg: string) => { console.log(chalk.red('✖'), msg); logToFile('ERROR', msg); },
  step: (n: number, total: number, msg: string) => {
    console.log(chalk.cyan(`[${n}/${total}]`), msg);
    logToFile('STEP', `[${n}/${total}] ${msg}`);
  },
  header: (msg: string) => { console.log('\n' + chalk.bold.underline(msg)); logToFile('INFO', `--- ${msg} ---`); },
  dim: (msg: string) => { console.log(chalk.dim(msg)); logToFile('DEBUG', msg); },
};

let verbose = false;

export function setVerbose(v: boolean): void {
  verbose = v;
}

export function isVerbose(): boolean {
  return verbose;
}
