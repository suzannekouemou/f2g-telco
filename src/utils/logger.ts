import chalk from 'chalk';

let verboseMode = false;

export function setVerbose(enabled: boolean): void {
  verboseMode = enabled;
}

export function isVerbose(): boolean {
  return verboseMode;
}

export const log = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✔'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.log(chalk.red('✖'), msg),
  step: (n: number, total: number, msg: string) =>
    console.log(chalk.cyan(`[${n}/${total}]`), msg),
  header: (msg: string) => console.log('\n' + chalk.bold.underline(msg)),
  dim: (msg: string) => console.log(chalk.dim(msg)),
  debug: (msg: string) => {
    if (verboseMode) console.log(chalk.gray('🔍'), chalk.dim(msg));
  },
};
