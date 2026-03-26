import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { detectEnvironment } from '../utils/detect.js';
import { log } from '../utils/logger.js';
import { saveConfig, getToolPaths, type F2GConfig } from '../utils/config.js';
import { installMcps, writeToolConfig } from '../installers/mcps.js';
import { installSkills } from '../installers/skills.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const registryDir = path.resolve(__dirname, '..', '..', 'registry');
const templatesDir = path.resolve(__dirname, '..', '..', 'templates');

interface InitOptions {
  provider?: string;
  tool?: string;
  yes?: boolean;
}

export async function initCommand(options: InitOptions) {
  console.log(chalk.bold(`
  ╔═══════════════════════════════════════╗
  ║         F2G-Telco  v0.1.0            ║
  ║   Supercharge your AI environment    ║
  ╚═══════════════════════════════════════╝
  `));

  // Step 1: Detect
  log.header('Step 1 — Detecting environment');
  const env = await detectEnvironment();
  log.info(`OS: ${env.os}`);
  log.info(`Node: ${env.node || chalk.red('not found — required')}`);
  log.info(`Python: ${env.python || chalk.dim('not found — some MCPs need it')}`);
  log.info(`Git: ${env.git || chalk.red('not found — required')}`);

  if (!env.node || !env.git) {
    log.error('Node.js and Git are required. Install them first.');
    process.exit(1);
  }

  const detected: string[] = [];
  if (env.tools.crush) detected.push('Crush');
  if (env.tools.kiro) detected.push('Kiro');
  if (detected.length > 0) log.success(`Tools: ${detected.join(', ')}`);

  const detectedProviders: string[] = [];
  if (env.providers.copilot) detectedProviders.push('Copilot');
  if (env.providers.ollama) detectedProviders.push('Ollama');
  if (env.providers.nim) detectedProviders.push('NIM');
  if (detectedProviders.length > 0) log.success(`Providers: ${detectedProviders.join(', ')}`);

  // Step 2: Choose tool
  log.header('Step 2 — Choose your AI coding tool');
  let tool = options.tool;
  if (!tool) {
    const { selectedTool } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedTool',
      message: 'Which tool do you want to configure?',
      choices: [
        { name: `Crush${env.tools.crush ? chalk.green(' (detected)') : ''}`, value: 'crush' },
        { name: `Kiro CLI${env.tools.kiro ? chalk.green(' (detected)') : ''}`, value: 'kiro' },
      ],
    }]);
    tool = selectedTool;
  }

  // Step 3: Choose provider
  log.header('Step 3 — Choose your AI provider');
  const providers = await fs.readJson(path.join(registryDir, 'providers.json'));
  let provider = options.provider;
  if (!provider) {
    const choices = providers.providers
      .filter((p: { tools: string[] }) => p.tools.includes(tool!))
      .map((p: { id: string; name: string; description: string; free: boolean | null }) => ({
        name: `${p.name}${p.free === true ? chalk.green(' (free)') : p.free === false ? chalk.yellow(' (subscription)') : ''} — ${p.description}`,
        value: p.id,
      }));
    const { selectedProvider } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedProvider',
      message: 'Which AI provider do you use?',
      choices,
    }]);
    provider = selectedProvider;
  }

  const providerConfig = providers.providers.find((p: { id: string }) => p.id === provider);

  // Step 4: Collect API keys
  log.header('Step 4 — API Keys');
  const envVars: Record<string, string> = {};
  const mcpRegistry = await fs.readJson(path.join(registryDir, 'mcps.json'));

  // Gather all required env vars
  const allEnvs = new Map<string, { neededBy: string[]; setup?: string }>();
  for (const mcp of mcpRegistry.mcps) {
    for (const key of mcp.requiresEnv) {
      if (!process.env[key]) {
        const entry = allEnvs.get(key) || { neededBy: [] as string[], setup: mcp.envSetup };
        entry.neededBy.push(mcp.name);
        allEnvs.set(key, entry);
      }
    }
  }
  if (providerConfig?.requiresEnv) {
    for (const key of providerConfig.requiresEnv) {
      if (!process.env[key] && !allEnvs.has(key)) {
        allEnvs.set(key, { neededBy: [providerConfig.name], setup: providerConfig.setup });
      }
    }
  }

  if (allEnvs.size > 0 && !options.yes) {
    log.dim('Leave blank to skip MCPs that require this key.\n');
    for (const [key, info] of allEnvs) {
      const hint = info.setup ? chalk.dim(` (${info.setup})`) : '';
      const { value } = await inquirer.prompt([{
        type: 'password',
        name: 'value',
        message: `${key} — for ${info.neededBy.join(', ')}${hint}:`,
      }]);
      if (value) envVars[key] = value;
    }
  }

  // Step 5: Install MCPs
  log.header('Step 5 — Installing MCP servers');
  const mcpsToInstall = mcpRegistry.mcps.filter((mcp: { requiresEnv: string[] }) =>
    mcp.requiresEnv.every((key: string) => envVars[key] || process.env[key])
  );
  const installedIds = await installMcps(mcpsToInstall, tool!, envVars);

  // Step 6: Write complete tool config
  log.header('Step 6 — Writing tool configuration');
  await writeToolConfig(mcpRegistry.mcps, installedIds, tool!, envVars, providerConfig);

  // Step 7: Install orchestrator
  log.header('Step 7 — Setting up orchestrator agent');
  const toolPaths = getToolPaths(tool!);
  const home = os.homedir();

  if (tool === 'crush') {
    const agentsDir = path.join(home, '.config', 'crush', 'agents');
    await fs.ensureDir(agentsDir);
    const tpl = await fs.readFile(path.join(templatesDir, 'crush', 'autonomous.md'), 'utf-8');
    await fs.writeFile(path.join(agentsDir, 'autonomous.md'), tpl);
    log.success('Orchestrator agent written to ~/.config/crush/agents/autonomous.md');
  } else if (tool === 'kiro') {
    const tpl = await fs.readFile(path.join(templatesDir, 'kiro', 'orchestrator.md'), 'utf-8');
    const content = tpl.replace(/USER/g, path.basename(home));
    const settingsDir = path.join(home, '.kiro', 'settings');
    await fs.ensureDir(settingsDir);
    await fs.writeFile(path.join(settingsDir, 'orchestrator.md'), content);
    log.success('Orchestrator written to ~/.kiro/settings/orchestrator.md');
  }

  // Step 8: Install skills
  log.header('Step 8 — Installing skills');
  const skillsRegistry = await fs.readJson(path.join(registryDir, 'skills.json'));
  await fs.ensureDir(toolPaths.skills);
  const skillCount = await installSkills(skillsRegistry.sources, toolPaths.skills);
  log.success(`${skillCount} skills symlinked`);

  // Step 9: Generate INVENTORY.md
  log.header('Step 9 — Generating INVENTORY.md');
  const inventoryPath = path.join(home, '.agents', 'INVENTORY.md');
  await fs.ensureDir(path.dirname(inventoryPath));
  await generateInventory(inventoryPath, installedIds, mcpRegistry.mcps, tool!);
  log.success(`INVENTORY.md → ${inventoryPath}`);

  // Step 10: Save config
  const config: F2GConfig = {
    version: '0.1.0',
    provider: provider!,
    tool: tool!,
    installedMcps: installedIds,
    installedSkills: [],
    paths: {
      home,
      config: toolPaths.config,
      skills: toolPaths.skills,
      agents: toolPaths.agents || '',
      inventory: inventoryPath,
    },
  };
  await saveConfig(config);

  console.log(chalk.bold.green(`
  ✔ F2G-Telco setup complete!

  Tool:        ${tool}
  Provider:    ${providerConfig.name}
  MCPs:        ${installedIds.length} installed
  Skills:      ${skillCount} symlinked
  Orchestrator: ✔
  Permissions: ${tool === 'crush' ? '38+ tools auto-approved' : 'configured'}

  Next steps:
    f2g-telco doctor    Check everything is working
    f2g-telco list      See what's installed
    f2g-telco update    Pull latest configs
  `));
}

async function generateInventory(
  filePath: string,
  installedIds: string[],
  allMcps: Array<{ id: string; name: string; description: string }>,
  tool: string,
): Promise<void> {
  const rows = allMcps
    .filter(m => installedIds.includes(m.id))
    .map(m => `| ${m.name} | ${m.description} |`)
    .join('\n');

  await fs.writeFile(filePath, `# AI Environment Inventory
> Generated by F2G-Telco v0.1.0. Agents: read this to know what's available.

## MCP Servers (active)
| Server | Purpose |
|--------|---------|
${rows}

## Skills Discovery
Skills are in the tool's skills directory. Each has a SKILL.md with a \`description\` field.
Match task to skill by reading descriptions. Do NOT preload all skills.

## Key Rules
- **gitnexus**: Run \`npx gitnexus analyze\` in a repo before querying
- **context7**: Use for up-to-date library documentation
- **sequential-thinking**: Use for complex multi-step reasoning
- **mem0**: Check for prior context before starting work
- **contextgraph**: Use for structured recall with entity relationships

---
*Tool: ${tool} | Generated: ${new Date().toISOString().split('T')[0]} | F2G-Telco v0.1.0*
`);
}
