import { createRequire } from 'module';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { detectEnvironment } from '../utils/detect.js';
import { log, isVerbose } from '../utils/logger.js';
import { saveConfig, loadConfig, getToolPaths, type F2GConfig } from '../utils/config.js';
import { installMcps, writeToolConfig } from '../installers/mcps.js';
import { getLogPath } from '../utils/fileLogger.js';
import { installSkills } from '../installers/skills.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const registryDir = path.resolve(__dirname, '..', '..', 'registry');
const templatesDir = path.resolve(__dirname, '..', '..', 'templates');
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

interface InitOptions {
  provider?: string;
  tool?: string;
  yes?: boolean;
  reconfigure?: boolean;
}

interface McpEntry {
  id: string;
  name: string;
  description: string;
  requiresEnv: string[];
  setupSteps?: string[];
  envSetup?: string;
  autoApprove?: string[];
  category?: string;
  free?: boolean;
  python?: boolean;
  bridge?: boolean;
  install?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

interface ProviderEntry {
  id: string;
  name: string;
  description: string;
  free: boolean | null;
  setup?: string;
  setupSteps?: string[];
  requiresEnv?: string[];
  tools: string[];
  models?: Record<string, { model: string; provider: string }>;
  crushProvider?: Record<string, unknown>;
}

interface OnboardingResult {
  configured: string[];
  skipped: string[];
}

/**
 * Draw a boxed panel for guided API key setup
 */
function drawSetupBox(name: string, description: string, steps: string[]): void {
  const width = 60;
  const topBorder = '╔' + '═'.repeat(width - 2) + '╗';
  const bottomBorder = '╚' + '═'.repeat(width - 2) + '╝';
  const emptyLine = '║' + ' '.repeat(width - 2) + '║';

  const padLine = (text: string): string => {
    const visible = text.replace(/\x1B\[[0-9;]*m/g, ''); // Strip ANSI for length calc
    const padding = width - 2 - visible.length;
    return '║  ' + text + ' '.repeat(Math.max(0, padding - 2)) + '║';
  };

  console.log('\n' + chalk.cyan(topBorder));
  console.log(chalk.cyan(padLine(chalk.bold(`📦 ${name}`) + chalk.dim(` — ${description}`))));
  console.log(chalk.cyan(emptyLine));

  steps.forEach((step, i) => {
    const numbered = `${i + 1}. ${step}`;
    console.log(chalk.cyan(padLine(numbered)));
  });

  console.log(chalk.cyan(emptyLine));
  console.log(chalk.cyan(bottomBorder));
}

/**
 * Prompt for a single MCP/provider API key with guided setup
 */
async function promptApiKey(
  name: string,
  description: string,
  envKey: string,
  steps: string[],
): Promise<{ key: string; skipped: boolean }> {
  drawSetupBox(name, description, steps);

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: chalk.green('Enter API key'), value: 'enter' },
      { name: chalk.yellow('Skip — install without this service'), value: 'skip' },
    ],
  }]);

  if (action === 'skip') {
    return { key: '', skipped: true };
  }

  const { value } = await inquirer.prompt([{
    type: 'password',
    name: 'value',
    message: `${envKey}:`,
    mask: '*',
  }]);

  return { key: value || '', skipped: !value };
}

/**
 * Show the end summary of configured vs skipped services
 */
function showOnboardingSummary(results: OnboardingResult): void {
  console.log('\n' + chalk.bold('  Configuration Summary:'));
  console.log();

  for (const name of results.configured) {
    console.log(chalk.green(`    ✅ ${name}`) + chalk.dim(' (API key saved)'));
  }

  for (const name of results.skipped) {
    console.log(chalk.yellow(`    ⏭️  ${name}`) + chalk.dim(' (skipped)'));
  }

  if (results.skipped.length > 0) {
    console.log();
    console.log(chalk.dim('  Skipped services can be added later with: f2g-telco init --reconfigure'));
  }
  console.log();
}

/**
 * Guided onboarding flow for collecting API keys
 */
async function guidedOnboarding(
  mcps: McpEntry[],
  providerConfig: ProviderEntry | undefined,
  existingEnvVars: Record<string, string>,
): Promise<{ envVars: Record<string, string>; skippedMcps: Set<string> }> {
  const envVars: Record<string, string> = { ...existingEnvVars };
  const skippedMcps = new Set<string>();
  const results: OnboardingResult = { configured: [], skipped: [] };

  // First: handle provider API key if needed
  if (providerConfig?.requiresEnv && providerConfig.requiresEnv.length > 0) {
    for (const envKey of providerConfig.requiresEnv) {
      if (process.env[envKey] || envVars[envKey]) {
        results.configured.push(providerConfig.name);
        continue;
      }

      const steps = providerConfig.setupSteps || [
        providerConfig.setup || `Set up ${providerConfig.name}`,
      ];

      const { key, skipped } = await promptApiKey(
        providerConfig.name,
        providerConfig.description,
        envKey,
        steps,
      );

      if (skipped) {
        results.skipped.push(providerConfig.name);
      } else {
        envVars[envKey] = key;
        results.configured.push(providerConfig.name);
      }
    }
  }

  // Then: handle each MCP that requires an API key
  for (const mcp of mcps) {
    if (!mcp.requiresEnv || mcp.requiresEnv.length === 0) continue;

    for (const envKey of mcp.requiresEnv) {
      if (process.env[envKey] || envVars[envKey]) {
        results.configured.push(mcp.name);
        continue;
      }

      const steps = mcp.setupSteps || [
        mcp.envSetup || `Get API key for ${mcp.name}`,
      ];

      const { key, skipped } = await promptApiKey(
        mcp.name,
        mcp.description,
        envKey,
        steps,
      );

      if (skipped) {
        results.skipped.push(mcp.name);
        skippedMcps.add(mcp.id);
      } else {
        envVars[envKey] = key;
        results.configured.push(mcp.name);
      }
    }
  }

  showOnboardingSummary(results);

  return { envVars, skippedMcps };
}

export async function initCommand(options: InitOptions) {
  try {
    await runInit(options);
  } catch (err) {
    handleInitError(err);
    process.exit(1);
  }
}

function handleInitError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  
  // Network errors
  if (message.includes('ENOTFOUND') || message.includes('getaddrinfo') || message.includes('ECONNREFUSED')) {
    log.error('No internet connection');
    log.dim('  Check your network and try again. Some MCPs require downloading packages.');
    return;
  }
  
  // Git not installed
  if (message.includes('git') && (message.includes('ENOENT') || message.includes('not found'))) {
    log.error('Git is not installed');
    log.dim('  Install Git first: https://git-scm.com/downloads');
    return;
  }
  
  // npm permission errors
  if (message.includes('EACCES') || message.includes('permission denied')) {
    log.error('Permission denied during installation');
    log.dim('  F2G-Telco installs to ~/.local — check your permissions.');
    return;
  }
  
  // Generic error
  log.error(message);
  if (isVerbose() && err instanceof Error && err.stack) {
    console.error(chalk.dim(err.stack));
  }
}

async function runInit(options: InitOptions) {
  const version = pkg.version;
  console.log('');
  console.log(chalk.cyan.bold('  ███████╗██████╗  ██████╗ '));
  console.log(chalk.cyan.bold('  ██╔════╝╚════██╗██╔════╝ '));
  console.log(chalk.cyan.bold('  █████╗   █████╔╝██║  ███╗'));
  console.log(chalk.cyan.bold('  ██╔══╝  ██╔═══╝ ██║   ██║'));
  console.log(chalk.cyan.bold('  ██║     ███████╗╚██████╔╝'));
  console.log(chalk.cyan.bold('  ╚═╝     ╚══════╝ ╚═════╝ '));
  console.log('');
  console.log(chalk.bold('  F2G-Telco') + chalk.dim(` v${version}`) + chalk.white(' — Supercharge your AI environment'));
  console.log(chalk.dim('  https://github.com/suzannekouemou/f2g-telco'));
  console.log('');

  // Handle --reconfigure: jump straight to API key collection
  if (options.reconfigure) {
    const existingConfig = await loadConfig();
    if (!existingConfig) {
      log.error('No existing configuration found. Run `f2g-telco init` first.');
      process.exit(1);
    }

    log.header('Reconfiguring API Keys');
    const mcpRegistry = await fs.readJson(path.join(registryDir, 'mcps.json'));
    const providers = await fs.readJson(path.join(registryDir, 'providers.json'));
    const providerConfig = providers.providers.find((p: ProviderEntry) => p.id === existingConfig.provider);

    const { envVars, skippedMcps } = await guidedOnboarding(mcpRegistry.mcps, providerConfig, {});

    // Reinstall MCPs with new keys
    log.header('Reinstalling MCP servers');
    const mcpsToInstall = mcpRegistry.mcps.filter((mcp: McpEntry) =>
      !skippedMcps.has(mcp.id) && mcp.requiresEnv.every((key: string) => envVars[key] || process.env[key])
    );
    const installedIds = await installMcps(mcpsToInstall, existingConfig.tool, envVars);

    // Rewrite config
    log.header('Updating configuration');
    await writeToolConfig(mcpRegistry.mcps, installedIds, existingConfig.tool, envVars, providerConfig);

    // Update saved config
    existingConfig.installedMcps = installedIds;
    await saveConfig(existingConfig);

    log.success('Reconfiguration complete!');
    return;
  }

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
      .filter((p: ProviderEntry) => p.tools.includes(tool!))
      .map((p: ProviderEntry) => ({
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

  const providerConfig = providers.providers.find((p: ProviderEntry) => p.id === provider);

  // Step 4: Guided API key collection
  log.header('Step 4 — Service Configuration');
  const mcpRegistry = await fs.readJson(path.join(registryDir, 'mcps.json'));

  let envVars: Record<string, string> = {};
  let skippedMcps = new Set<string>();

  if (!options.yes) {
    const result = await guidedOnboarding(mcpRegistry.mcps, providerConfig, {});
    envVars = result.envVars;
    skippedMcps = result.skippedMcps;
  }

  // Step 5: Install MCPs
  log.header('Step 5 — Installing MCP servers');
  const mcpsToInstall = mcpRegistry.mcps.filter((mcp: McpEntry) =>
    !skippedMcps.has(mcp.id) && mcp.requiresEnv.every((key: string) => envVars[key] || process.env[key])
  );
  const installedIds = await installMcps(mcpsToInstall, tool!, envVars);

  // Step 5b: Install ContextGraph bridge (Python wrapper) if available
  if (installedIds.includes('contextgraph') && env.python) {
    await installContextGraphBridge(os.homedir(), envVars);
  }

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

  // Step 10: Generate AGENT_MEMORY.md (if not exists)
  const agentMemoryPath = path.join(home, '.agents', 'AGENT_MEMORY.md');
  if (!await fs.pathExists(agentMemoryPath)) {
    await fs.writeFile(agentMemoryPath, `# Agent Memory
> Agents: check this before any code change. Update after every change.

## Recent Changes
_No changes recorded yet._

## Active Context
_No active context._

## Decisions
_No decisions recorded._
`);
    log.success(`AGENT_MEMORY.md → ${agentMemoryPath}`);
  } else {
    log.info('AGENT_MEMORY.md already exists — skipped');
  }

  // Step 11: Save config
  const config: F2GConfig = {
    version: pkg.version,
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
    npx f2g-telco doctor    Check everything is working
    npx f2g-telco list      See what's installed
    npx f2g-telco update    Pull latest configs

  Log file: ${getLogPath()}
  `));
}

async function generateInventory(
  filePath: string,
  installedIds: string[],
  allMcps: Array<{ id: string; name: string; description: string }>,
  tool: string,
): Promise<void> {
  const home = os.homedir();
  const paths = getToolPaths(tool);
  const rows = allMcps
    .filter(m => installedIds.includes(m.id))
    .map(m => `| ${m.name} | ${m.description} |`)
    .join('\n');

  // Load CLI tools registry
  const cliToolsRegistry = await fs.readJson(path.join(registryDir, 'cli-tools.json'));
  const cliRows = cliToolsRegistry.tools
    .map((t: { name: string; description: string }) => `| ${t.name} | ${t.description} |`)
    .join('\n');

  const content = `# AI Environment Inventory
> Generated by F2G-Telco v${pkg.version}. Agents: read this to know what's available.

## MCP Servers (active)
| Server | Purpose |
|--------|---------|
${rows}

## CLI Tools
| Tool | Purpose |
|------|---------|
${cliRows}

## Skills Discovery
Skills are in \`${paths.skills}\`. Each has a SKILL.md with a \`description\` field.
Match task to skill by reading descriptions. Do NOT preload all skills.

## Key Rules
- **vera**: On session start, if in a git repo and \`.vera/\` does not exist, run \`vera index .\` silently. This enables semantic code search for the session.
- **gitnexus**: Run \`npx gitnexus analyze\` in a repo before querying (one-time per repo)
- **context7**: Use for up-to-date library documentation before coding against third-party APIs
- **sequential-thinking**: Use for complex multi-step reasoning
- **mem0**: Check for prior context before starting work, save checkpoints after major steps
- **contextgraph**: Use for structured recall with entity relationships and provenance

## Memory Pipeline
\`\`\`
mem0 (cloud, persistent) → hydrates on boot → ContextGraph (local, session-scoped)
\`\`\`
- **mem0**: Flat text memory — preferences, facts, session context. Persists across sessions.
- **ContextGraph**: Structured claims with entity extraction, provenance chains, trust scoring. Session-scoped, auto-hydrated from mem0 on every boot.
- Agents use both: mem0 for persistent storage, ContextGraph for entity-aware recall + relation paths.

## Documentation Standard
- **Output format**: Word (.docx) via python-docx — NOT markdown
- **Diagrams**: Render mermaid code to PNG via mermaid MCP or mermaid.ink, embed inline
- **Tables**: Use proper Word tables, not ASCII/markdown tables
- **Code blocks**: Consolas font, indented
- Markdown is acceptable only for: README.md, AGENT_MEMORY.md, CHANGELOG.md (repo-level files)
- All other documentation deliverables → Word

## Mermaid Diagram Rendering
1. If \`generate\` tool is in your tool list → use mermaid MCP directly
2. Otherwise → render via shell using mermaid.ink API:
\`\`\`python
import base64, urllib.request
encoded = base64.urlsafe_b64encode(mermaid_code.encode()).decode()
req = urllib.request.Request(f"https://mermaid.ink/img/{encoded}", headers={"User-Agent": "Mozilla/5.0"})
data = urllib.request.urlopen(req, timeout=30).read()
open("diagram.png", "wb").write(data)
\`\`\`

---
*Tool: ${tool} | Generated: ${new Date().toISOString().split('T')[0]} | F2G-Telco v${pkg.version}*
`;

  await fs.writeFile(filePath, content);
}
/**
 * Install ContextGraph Python package and create bridge wrapper script.
 * The wrapper script allows MCP tools to invoke contextgraph-mcp.
 */
async function installContextGraphBridge(home: string, envVars: Record<string, string>): Promise<void> {
  const binDir = path.join(home, '.local', 'bin');
  const wrapperPath = path.join(binDir, 'contextgraph-mcp');

  log.info('Setting up ContextGraph bridge with mem0 hydration...');

  try {
    execSync('pip3 install contextgraph[server,mcp] --quiet --break-system-packages 2>/dev/null || pip3 install contextgraph[server,mcp] --quiet', {
      stdio: 'pipe',
      timeout: 120_000,
    });

    await fs.ensureDir(binDir);

    // Determine mem0 config for hydration
    const mem0Key = envVars.MEM0_API_KEY || process.env.MEM0_API_KEY || '';
    const mem0User = envVars.MEM0_DEFAULT_USER_ID || process.env.MEM0_DEFAULT_USER_ID || process.env.USER || 'default';

    // Python wrapper that hydrates from mem0 on boot, then starts MCP server
    const wrapperScript = `#!/usr/bin/env python3
"""ContextGraph MCP server with mem0 hydration — generated by F2G-Telco."""
import json, logging, os, sys, urllib.request

MEM0_API_KEY = os.environ.get("MEM0_API_KEY", ${JSON.stringify(mem0Key)})
MEM0_USER_ID = os.environ.get("MEM0_USER_ID", ${JSON.stringify(mem0User)})
HYDRATE_LIMIT = 50

os.environ.setdefault("CG_AGENT_NAME", "f2g-agent")
os.environ.setdefault("CG_AGENT_ORG", MEM0_USER_ID)

logging.basicConfig(level="WARNING", format="%(asctime)s %(name)s %(levelname)s %(message)s", stream=sys.stderr)
logger = logging.getLogger("contextgraph-bridge")

def fetch_mem0():
    if not MEM0_API_KEY:
        return []
    payload = json.dumps({"filters": {"AND": [{"user_id": MEM0_USER_ID}]}, "page": 1, "page_size": HYDRATE_LIMIT}).encode()
    req = urllib.request.Request("https://api.mem0.ai/v2/memories/", data=payload, headers={
        "Authorization": f"Token {MEM0_API_KEY}", "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
            return (data if isinstance(data, list) else data.get("results", []))[:HYDRATE_LIMIT]
    except Exception as e:
        logger.warning("mem0 fetch failed: %s", e)
        return []

def hydrate(service, agent_id, memories):
    stored = 0
    for mem in memories:
        text = mem.get("memory", "")
        if not text or len(text) < 20:
            continue
        if (mem.get("metadata") or {}).get("type") == "consolidation":
            continue
        try:
            service.store_memory(agent_id=agent_id, content=text, visibility="org",
                evidence=["hydrated from mem0"], citations=[f"mem0:{mem.get('id', '?')}"])
            stored += 1
        except Exception:
            pass
    return stored

def main():
    from contextgraph.bootstrap import create_service
    from contextgraph.mcp_server import _try_run_mcp_sdk, _JsonRpcServer
    service = create_service()
    agent = service.register_agent(name=os.environ.get("CG_AGENT_NAME", "f2g-agent"),
        org_id=os.environ.get("CG_AGENT_ORG", "default"))
    memories = fetch_mem0()
    count = hydrate(service, agent.agent_id, memories) if memories else 0
    sys.stderr.write(f"[contextgraph] Hydrated {count}/{len(memories)} mem0 memories\\n")
    if not _try_run_mcp_sdk(service, agent.agent_id):
        _JsonRpcServer(service, agent.agent_id).run()

if __name__ == "__main__":
    main()
`;

    await fs.writeFile(wrapperPath, wrapperScript);
    await fs.chmod(wrapperPath, 0o755);
    log.success(`ContextGraph bridge with mem0 hydration → ${wrapperPath}`);
  } catch {
    log.warn('ContextGraph bridge setup failed — install Python 3.11+ and retry');
  }
}
