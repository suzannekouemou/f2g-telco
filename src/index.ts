#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { doctorCommand } from './commands/doctor.js';
import { listCommand } from './commands/list.js';
import { updateCommand } from './commands/update.js';
import { statusCommand } from './commands/status.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { setVerbose, log } from './utils/logger.js';

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚠ Cancelled by user'));
  console.log(chalk.dim('  Partial configuration may remain. Run `f2g-telco init` to restart.'));
  process.exit(130);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  log.error(`Unexpected error: ${err.message}`);
  if (process.env.F2G_VERBOSE === '1') {
    console.error(err.stack);
  }
  process.exit(1);
});

const program = new Command();

program
  .name('f2g-telco')
  .description('Supercharge your AI coding environment — MCPs, skills, agents, memory pipelines')
  .version('0.1.0')
  .option('--verbose', 'Enable debug output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) {
      setVerbose(true);
      process.env.F2G_VERBOSE = '1';
    }
  });

program
  .command('init')
  .description('Interactive setup wizard — detects your tools and configures everything')
  .option('--provider <provider>', 'AI provider: copilot, ollama, nim, openai-compat')
  .option('--tool <tool>', 'Target tool: crush, kiro')
  .option('--yes', 'Skip prompts, use defaults')
  .option('--reconfigure', 'Re-run API key collection for existing setup')
  .action(initCommand);

program
  .command('doctor')
  .description('Check health of your AI environment')
  .action(doctorCommand);

program
  .command('list')
  .description('List available MCPs, skills, and agents')
  .option('--mcps', 'List MCP servers only')
  .option('--skills', 'List skills only')
  .option('--providers', 'List providers only')
  .action(listCommand);

program
  .command('update')
  .description('Pull latest configs and skills from the F2G-Telco registry')
  .action(updateCommand);

program
  .command('add <mcp>')
  .description('Install a single MCP by id (e.g., f2g-telco add mem0)')
  .action(addCommand);

program
  .command('remove <mcp>')
  .description('Remove a single MCP by id (e.g., f2g-telco remove mem0)')
  .action(removeCommand);

program
  .command('status')
  .description('Show current configuration at a glance')
  .action(statusCommand);

program.parse();
