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

## ✅ COMPLETED — Guided Onboarding UX

Implemented guided onboarding flow with boxed panels for API key setup:
- `setupSteps` array added to registry/mcps.json for mem0, github, notion
- `setupSteps` array added to registry/providers.json for NVIDIA NIM, Google AI Studio
- Boxed panel UI with chalk (no external deps)
- Enter/Skip choice for each service
- End summary showing configured vs skipped
- `--reconfigure` flag for re-running API key collection

## NEXT TASK — Fix MCP Install Permissions

### Problem
`npm install -g` fails on Linux/WSL without sudo due to EACCES on `/usr/lib/node_modules/`.

### Solution: npx + user prefix
1. **Install step**: Use `npm install --prefix ~/.local <package>` instead of `npm install -g`
2. **MCP config command**: Use `npx -y <package>` as the command (works even if install failed)
3. **Fallback**: If the global binary already exists, use it directly

### Changes needed
- `registry/mcps.json`: Add `npxCommand` field to each MCP entry (e.g. `["npx", "-y", "mem0-mcp-server"]`)
- `src/installers/mcps.ts`: Change install command to use `--prefix ~/.local`, update config writer to use npx commands
- Both Crush and Kiro config writers need to output npx-style commands:
  - Crush: `"command": ["npx", "-y", "mem0-mcp-server"]`
  - Kiro: `"command": "npx", "args": ["-y", "mem0-mcp-server"]`
- Python MCPs (contextgraph): Use `pip3 install --user` (already done)
- Add `~/.local/bin` to PATH check in doctor command

### Priority
High — without this, first-time users on Linux/WSL will get permission errors on every MCP install.

## NEXT TASK — npm Publish Prep + Error Handling

### 1. npm publish readiness
- Verify `"files"` field in package.json includes everything needed: `dist/`, `registry/`, `templates/`, `README.md`, `LICENSE`
- Ensure `"bin"` entry has correct shebang (`#!/usr/bin/env node`) in dist/index.js
- Add `"publishConfig": { "access": "public" }` to package.json
- Test with `npm pack --dry-run` to verify the tarball contents
- Add `.npmignore` if needed (exclude tests, src, .github)

### 2. Error handling + edge cases
- Wrap the entire init flow in try/catch with graceful Ctrl+C handling
- Handle no internet (git clone fails, npm install fails) — show clear message
- Handle missing git — show "Install git first" instead of crash
- Handle partial completion — if user Ctrl+C mid-install, don't leave broken config
- Add `--verbose` flag for debug output

### 3. Add `f2g-telco add <mcp>` command
- Install a single MCP by id: `f2g-telco add mem0`
- Prompt for API key if needed (reuse guided onboarding box)
- Update the existing tool config (don't overwrite)
- Update INVENTORY.md

### Implementation notes
- Keep it minimal — don't over-engineer
- Commit after each item
