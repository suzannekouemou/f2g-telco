#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { doctorCommand } from './commands/doctor.js';
import { listCommand } from './commands/list.js';
import { updateCommand } from './commands/update.js';

const program = new Command();

program
  .name('f2g-telco')
  .description('Supercharge your AI coding environment — MCPs, skills, agents, memory pipelines')
  .version('0.1.0');

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

program.parse();
