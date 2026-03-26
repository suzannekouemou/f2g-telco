import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { detectEnvironment } from '../utils/detect.js';
import { log } from '../utils/logger.js';
import { saveConfig, getToolPaths, type F2GConfig } from '../utils/config.js';
import { installMcps } from '../installers/mcps.js';
import { installSkills } from '../installers/skills.js';

// Load registry from package
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const registryDir = path.resolve(__dirname, '..', '..', 'registry');

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

  // Step 1: Detect environment
  log.header('Detecting environment...');
  const env = await detectEnvironment();

  log.info(`OS: ${env.os}`);
  log.info(`Node: ${env.node || chalk.red('not found')}`);
  log.info(`Python: ${env.python || chalk.dim('not found')}`);
  log.info(`Git: ${env.git || chalk.red('not found')}`);

  const detectedTools: string[] = [];
  if (env.tools.crush) detectedTools.push('crush');
  if (env.tools.kiro) detectedTools.push('kiro');
  if (env.tools.claudeCode) detectedTools.push('claude-code');

  if (detectedTools.length > 0) {
    log.success(`Detected tools: ${detectedTools.join(', ')}`);
  } else {
    log.warn('No AI coding tools detected. Install Crush or Kiro first.');
  }

  const detectedProviders: string[] = [];
  if (env.providers.copilot) detectedProviders.push('copilot');
  if (env.providers.ollama) detectedProviders.push('ollama');
  if (env.providers.nim) detectedProviders.push('nim');

  if (detectedProviders.length > 0) {
    log.success(`Detected providers: ${detectedProviders.join(', ')}`);
  }

  // Step 2: Choose tool
  let tool = options.tool;
  if (!tool) {
    const toolChoices = [
      ...(env.tools.crush ? [{ name: 'Crush (detected)', value: 'crush' }] : []),
      ...(env.tools.kiro ? [{ name: 'Kiro CLI (detected)', value: 'kiro' }] : []),
      ...(!env.tools.crush ? [{ name: 'Crush (not installed)', value: 'crush' }] : []),
      ...(!env.tools.kiro ? [{ name: 'Kiro CLI (not installed)', value: 'kiro' }] : []),
    ];
    const { selectedTool } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedTool',
      message: 'Which AI coding tool do you want to configure?',
      choices: toolChoices,
    }]);
    tool = selectedTool;
  }

  // Step 3: Choose provider
  const providers = await fs.readJson(path.join(registryDir, 'providers.json'));
  let provider = options.provider;
  if (!provider) {
    const providerChoices = providers.providers
      .filter((p: { tools: string[] }) => p.tools.includes(tool!))
      .map((p: { id: string; name: string; description: string; free: boolean | null }) => ({
        name: `${p.name}${p.free ? chalk.green(' (free)') : p.free === false ? chalk.yellow(' (subscription)') : ''} — ${p.description}`,
        value: p.id,
      }));
    const { selectedProvider } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedProvider',
      message: 'Which AI provider do you use?',
      choices: providerChoices,
    }]);
    provider = selectedProvider;
  }

  // Step 4: Collect required env vars
  const envVars: Record<string, string> = {};
  const mcpRegistry = await fs.readJson(path.join(registryDir, 'mcps.json'));

  // Collect env vars for MCPs that need them
  const allRequiredEnvs = new Set<string>();
  for (const mcp of mcpRegistry.mcps) {
    for (const envKey of mcp.requiresEnv) {
      if (!process.env[envKey]) allRequiredEnvs.add(envKey);
    }
  }

  // Collect provider env vars
  const providerConfig = providers.providers.find((p: { id: string }) => p.id === provider);
  if (providerConfig?.requiresEnv) {
    for (const envKey of providerConfig.requiresEnv) {
      if (!process.env[envKey]) allRequiredEnvs.add(envKey);
    }
  }

  if (allRequiredEnvs.size > 0 && !options.yes) {
    log.header('API Keys & Tokens');
    log.dim('Leave blank to skip MCPs that require this key.\n');

    for (const envKey of allRequiredEnvs) {
      // Find which MCP needs this
      const neededBy = mcpRegistry.mcps
        .filter((m: { requiresEnv: string[] }) => m.requiresEnv.includes(envKey))
        .map((m: { name: string }) => m.name);
      const setupHint = mcpRegistry.mcps
        .find((m: { requiresEnv: string[]; envSetup?: string }) =>
          m.requiresEnv.includes(envKey) && m.envSetup)?.envSetup || '';

      const { value } = await inquirer.prompt([{
        type: 'password',
        name: 'value',
        message: `${envKey}${neededBy.length ? ` (for ${neededBy.join(', ')})` : ''}:`,
        ...(setupHint ? { suffix: chalk.dim(` ${setupHint}`) } : {}),
      }]);
      if (value) envVars[envKey] = value;
    }
  }

  // Step 5: Select MCPs
  log.header('Installing MCP Servers...');
  const mcpsToInstall = mcpRegistry.mcps.filter((mcp: { requiresEnv: string[] }) => {
    // Skip MCPs whose required env vars weren't provided
    return mcp.requiresEnv.every(
      (key: string) => envVars[key] || process.env[key]
    );
  });

  const installedMcps = await installMcps(mcpsToInstall, tool!, envVars);

  // Step 6: Install skills
  log.header('Installing Skills...');
  const skillsRegistry = await fs.readJson(path.join(registryDir, 'skills.json'));
  const toolPaths = getToolPaths(tool!);
  await fs.ensureDir(toolPaths.skills);
  const skillCount = await installSkills(skillsRegistry.sources, toolPaths.skills);
  log.success(`${skillCount} skills symlinked into ${toolPaths.skills}`);

  // Step 7: Generate INVENTORY.md
  log.header('Generating INVENTORY.md...');
  const inventoryPath = path.join(os.homedir(), '.agents', 'INVENTORY.md');
  await fs.ensureDir(path.dirname(inventoryPath));
  await generateInventory(inventoryPath, installedMcps, mcpRegistry.mcps, tool!);
  log.success(`INVENTORY.md written to ${inventoryPath}`);

  // Step 8: Save config
  const config: F2GConfig = {
    version: '0.1.0',
    provider: provider!,
    tool: tool!,
    installedMcps,
    installedSkills: [],
    paths: {
      home: os.homedir(),
      config: toolPaths.config,
      skills: toolPaths.skills,
      agents: toolPaths.agents || '',
      inventory: inventoryPath,
    },
  };
  await saveConfig(config);

  // Done
  console.log(chalk.bold.green(`
  ✔ F2G-Telco setup complete!

  Tool:     ${tool}
  Provider: ${provider}
  MCPs:     ${installedMcps.length} installed
  Skills:   ${skillCount} symlinked

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
  const mcpRows = allMcps
    .filter(m => installedIds.includes(m.id))
    .map(m => `| ${m.name} | ${m.description} |`)
    .join('\n');

  const content = `# AI Environment Inventory
> Generated by F2G-Telco v0.1.0. Agents: read this to know what's available.

## MCP Servers (active)
| Server | Purpose |
|--------|---------|
${mcpRows}

## Skills Discovery
Skills are in the tool's skills directory. Each has a SKILL.md with a \`description\` field.
Match task to skill by reading descriptions. Do NOT preload all skills.

## Key Rules
- **gitnexus**: Run \`npx gitnexus analyze\` in a repo before querying (one-time per repo)
- **context7**: Use for up-to-date library documentation
- **sequential-thinking**: Use for complex multi-step reasoning

## Documentation Standard
- **Output format**: Word (.docx) via python-docx — NOT markdown
- **Diagrams**: Render mermaid code to PNG via mermaid MCP or mermaid.ink, embed inline
- Markdown is acceptable only for: README.md, AGENT_MEMORY.md, CHANGELOG.md (repo-level files)

---
*Tool: ${tool} | Generated: ${new Date().toISOString().split('T')[0]}*
`;

  await fs.writeFile(filePath, content);
}
