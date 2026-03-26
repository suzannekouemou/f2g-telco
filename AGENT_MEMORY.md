# F2G-Telco — Agent Memory

## Project Overview
F2G-Telco is a CLI tool that sets up a fully configured AI coding environment in one command. It installs MCP servers, curated skills/agents, memory pipelines, and generates an INVENTORY.md for agent discovery — all provider-agnostic.

## Architecture
```
f2g-telco init
    ├── Detect (OS, tools, providers)
    ├── Prompt (tool, provider, API keys)
    ├── Install MCPs (npm install -g)
    ├── Write FULL tool config (MCPs + providers + options + permissions + LSPs + models)
    ├── Clone & symlink skills
    ├── Write orchestrator agent
    ├── Generate INVENTORY.md
    └── Save ~/.f2g-telco/config.json
```

## File Structure
```
src/
├── index.ts              # CLI entry — commander setup
├── commands/
│   ├── init.ts           # Setup wizard (MAIN COMMAND)
│   ├── doctor.ts         # Health check
│   ├── list.ts           # List available components
│   └── update.ts         # Pull latest configs
├── installers/
│   ├── mcps.ts           # MCP server installer + config writer
│   └── skills.ts         # Skills cloner + symlinker
└── utils/
    ├── config.ts         # ~/.f2g-telco/config.json management
    ├── detect.ts         # Environment detection
    └── logger.ts         # Chalk-based pretty logging

registry/
├── mcps.json             # MCP servers (all free)
├── providers.json        # Providers (Copilot, Ollama, NIM, OpenAI-compat)
└── skills.json           # Skill sources (awesome-copilot, agency-agents)

templates/
├── crush/
│   └── autonomous.md     # Orchestrator agent template
├── kiro/
│   └── orchestrator.md   # Kiro orchestrator template
└── inventory.md          # INVENTORY.md template
```

## Tech Stack
- TypeScript (ES2022, ESM)
- commander, inquirer, chalk, ora, fs-extra

## GAP ANALYSIS — What's Missing (CRITICAL)

### 1. Missing MCPs in registry (registry/mcps.json)
Currently 11, should be 14:
- ❌ `postgresql` — database queries (`npm install -g mcp-server-postgres`)
- ❌ `notion` — Notion pages read/write (`npx -y notion-mcp-server`), needs NOTION_TOKEN
- ❌ `google` — Google Workspace 110+ tools (custom install path)

### 2. Crush config is INCOMPLETE — only writes MCPs
The init command only writes the `mcp` section of crush.json. A real Crush setup needs ALL of these:

```json
{
  "$schema": "https://charm.land/crush.json",
  "mcp": { ... },                    // ✅ We write this
  "providers": { ... },              // ❌ MISSING — custom providers (NIM, Ollama)
  "options": {                       // ❌ MISSING
    "skills_paths": ["~/.config/crush/skills", "~/.config/agents/skills"],
    "context_paths": ["~/.config/crush/agents/autonomous.md"],
    "disable_metrics": true,
    "disable_notifications": true,
    "attribution": { "trailer_style": "co-authored-by" }
  },
  "permissions": {                   // ❌ MISSING
    "allowed_tools": [38 auto-approved tools]
  },
  "lsp": {                           // ❌ MISSING
    "python": { "command": "pyright-langserver", "args": ["--stdio"], ... },
    "typescript": { "command": "typescript-language-server", "args": ["--stdio"], ... }
  },
  "models": {                        // ❌ MISSING
    "large": { "model": "claude-opus-4.6", "provider": "copilot" },
    "small": { "model": "claude-haiku-4.5", "provider": "copilot" }
  }
}
```

### 3. No orchestrator agent template
Crush loads an orchestrator via `context_paths`. We need:
- `templates/crush/autonomous.md` — orchestrator that reads INVENTORY.md, delegates to subagents
- The init command must copy this to `~/.config/crush/agents/autonomous.md`

### 4. No permissions config
38 tools are auto-approved in our setup. The init command must write these based on which MCPs are installed.

### 5. No LSP setup
Crush supports LSPs for code intelligence. We should:
- Detect if pyright/typescript-language-server are installed
- Write LSP config if found

### 6. No model config per provider
Each provider needs model mappings (large/small). Currently in providers.json but NOT written to crush.json.

### 7. Kiro config is also incomplete
Kiro needs:
- `autoApprove` arrays per MCP (we don't write these)
- `MEM0_DEFAULT_USER_ID` env var for mem0
- Orchestrator skill or settings

### 8. No ContextGraph bridge setup
The mem0→ContextGraph hydration wrapper at `~/.local/bin/contextgraph-mcp` is not installed.
Need to: pip install contextgraph, create the bridge wrapper script, point MCP config to it.

### 9. Skills count mismatch
- Crush has 32 skills, Kiro has 140
- f2g-telco only installs from 2 sources (awesome-copilot picks + agency-agents)
- Missing: claude-best-practices, presentation-assets, context-hub, memory-consolidator, GSD subagents

## TODO — Priority Order (Updated)
1. ~~**Complete Crush config writer**~~ ✅ DONE — writes providers, options, permissions, lsp, models
2. ~~**Complete Kiro config writer**~~ ✅ DONE — autoApprove, env vars, absolute paths
3. ~~**Add missing MCPs**~~ ✅ DONE — 13 MCPs (added postgresql, notion)
4. ~~**Add orchestrator templates**~~ ✅ DONE — autonomous.md + orchestrator.md
5. ~~**Add permissions generator**~~ ✅ DONE — builds allowed_tools from installed MCPs
6. ~~**Add LSP detection**~~ ✅ DONE — auto-detects pyright, typescript-language-server
7. ~~**Add Google AI Studio**~~ ✅ DONE — 5 providers total
8. ~~**Fix TypeScript build**~~ ✅ DONE — compiles clean
9. ~~**Add ContextGraph bridge installer**~~ ✅ DONE — pip install + wrapper script in init flow
10. ~~**Add more skill sources**~~ ✅ DONE — claude-best-practices, GSD agents, presentation-assets (5 sources)
11. ~~**npx support**~~ ✅ DONE — bin entry + shebang verified
12. ~~**E2E test**~~ ✅ DONE — build → init → doctor cycle works

## Provider Config Formats

### Crush (crush.json) — FULL FORMAT
```json
{
  "$schema": "https://charm.land/crush.json",
  "mcp": {
    "mem0": {
      "type": "local",
      "command": ["mem0-mcp-server"],
      "enabled": true,
      "environment": { "MEM0_API_KEY": "...", "MEM0_DEFAULT_USER_ID": "..." }
    }
  },
  "providers": {
    "nvidia": {
      "type": "openai-compat",
      "base_url": "https://integrate.api.nvidia.com/v1",
      "api_key": "env:NVIDIA_API_KEY",
      "models": [{ "id": "moonshotai/kimi-k2.5", "name": "Kimi K2.5" }]
    }
  },
  "options": {
    "skills_paths": ["~/.config/crush/skills", "~/.config/agents/skills"],
    "context_paths": ["~/.config/crush/agents/autonomous.md"],
    "disable_metrics": true,
    "disable_notifications": true,
    "attribution": { "trailer_style": "co-authored-by" }
  },
  "permissions": {
    "allowed_tools": ["view", "ls", "grep", "glob", "edit", "write", "fetch", ...]
  },
  "lsp": {
    "python": { "command": "pyright-langserver", "args": ["--stdio"], "filetypes": ["py"] },
    "typescript": { "command": "typescript-language-server", "args": ["--stdio"], "filetypes": ["ts","tsx","js","jsx"] }
  },
  "models": {
    "large": { "model": "claude-opus-4.6", "provider": "copilot" },
    "small": { "model": "claude-haiku-4.5", "provider": "copilot" }
  }
}
```

### Kiro (mcp.json) — WITH autoApprove
```json
{
  "mcpServers": {
    "mem0": {
      "command": "mem0-mcp-server",
      "args": [],
      "env": { "MEM0_API_KEY": "...", "MEM0_DEFAULT_USER_ID": "..." },
      "autoApprove": ["add_memory", "search_memories", "get_memories"],
      "disabled": false
    },
    "contextgraph": {
      "command": "/home/USER/.local/bin/contextgraph-mcp",
      "args": [],
      "autoApprove": ["contextgraph_store", "contextgraph_recall", "contextgraph_relate", "contextgraph_watch", "contextgraph_notifications", "contextgraph_review"],
      "disabled": false
    }
  }
}
```

## Rules
- All tools/services must be FREE (no paid API keys required for core functionality)
- MIT license
- Minimal code — don't over-engineer
- Registry-driven — add new MCPs/providers/skills by editing JSON, not code
- Support users WITHOUT GitHub Copilot subscription
- Use absolute paths (not ~) in generated configs for Kiro (tilde bug)

## NEXT TASK — Guided Onboarding UX

Replace the flat password prompts in init.ts Step 4 with a guided onboarding flow.

### Requirements
For each MCP that needs an API key, show a boxed panel with:
1. Service name and description
2. Step-by-step instructions (go to URL, create account, copy key)
3. Input field for the key
4. Skip option ("Enter key" or "Skip — install without this MCP")

### Setup Instructions per MCP (add to registry/mcps.json as `setupSteps` array)
- **mem0**: Go to https://app.mem0.ai/ → Sign up free → Settings → API Keys → Create Key → Copy
- **GitHub**: Go to https://github.com/settings/tokens → Generate new token (classic) → Select scopes: repo, read:org → Copy
- **Notion**: Go to https://www.notion.so/my-integrations → New integration → Copy Internal Integration Secret
- **NVIDIA NIM**: Go to https://build.nvidia.com/ → Sign up free → API Key → Generate → Copy
- **Google AI Studio**: Go to https://aistudio.google.com/apikey → Create API Key → Copy

### Visual Format (use chalk + boxen or manual box drawing)
```
╔═══════════════════════════════════════════════════════╗
║  📦 mem0 — Long-term memory across sessions          ║
║                                                       ║
║  1. Go to: https://app.mem0.ai/                       ║
║  2. Sign up for a free account                        ║
║  3. Go to Settings → API Keys → Create Key            ║
║  4. Copy the key and paste below                      ║
║                                                       ║
║  API Key: ▌                                           ║
║                                                       ║
║  [Enter key]  or  [Skip]                              ║
╚═══════════════════════════════════════════════════════╝
```

### End Summary
After all MCPs are prompted, show:
```
  Configured:
    ✅ mem0 (API key saved)
    ✅ GitHub (token saved)
    ⏭️  Notion (skipped)
    ✅ NVIDIA NIM (API key saved)
    ⏭️  Google AI Studio (skipped)

  Skipped MCPs can be added later with: f2g-telco init --reconfigure
```

### Also add `--reconfigure` flag
Add to the init command options so users can re-run just the API key collection step.

### Implementation Notes
- Use inquirer prompts with chalk formatting for the boxes
- Add `setupSteps` array to each MCP entry in registry/mcps.json
- Keep it simple — no external deps like boxen, just chalk + manual box chars
- The skip option should remove that MCP from the install list
