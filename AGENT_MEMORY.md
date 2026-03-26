# F2G-Telco — Agent Memory

## Project Overview
F2G-Telco is a CLI tool that sets up a fully configured AI coding environment in one command. It installs MCP servers, curated skills/agents, memory pipelines, and generates an INVENTORY.md for agent discovery — all provider-agnostic.

## Architecture
```
f2g-telco init
    ├── Detect (OS, tools, providers)
    ├── Prompt (tool, provider, API keys)
    ├── Install MCPs (npm install -g)
    ├── Write MCP config (tool-specific format)
    ├── Clone & symlink skills
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
├── mcps.json             # 11 MCP servers (all free)
├── providers.json        # 4 providers (Copilot, Ollama, NIM, OpenAI-compat)
└── skills.json           # 2 skill sources (awesome-copilot, agency-agents)

templates/
└── inventory.md          # INVENTORY.md template
```

## Tech Stack
- TypeScript (ES2022, ESM)
- commander (CLI framework)
- inquirer (interactive prompts)
- chalk (colors), ora (spinners)
- fs-extra (file ops)

## Key Design Decisions
1. **Provider-agnostic**: Users without Copilot get Ollama/NIM/custom configs
2. **Registry-driven**: All MCPs, providers, skills defined in JSON — easy to extend
3. **Tool-specific config writers**: Crush uses crush.json format, Kiro uses mcp.json format
4. **Symlink-based skills**: Clone once to ~/.agents/, symlink into tool's skills dir
5. **INVENTORY.md generation**: Agents discover capabilities via this file

## Provider Config Formats

### Crush (crush.json)
```json
{
  "mcp": {
    "mem0": {
      "type": "local",
      "command": ["mem0-mcp-server"],
      "enabled": true,
      "environment": { "MEM0_API_KEY": "..." }
    }
  },
  "provider": {
    "nim": {
      "type": "openai",
      "baseUrl": "https://integrate.api.nvidia.com/v1",
      "apiKey": "env:NVIDIA_API_KEY"
    }
  }
}
```

### Kiro (mcp.json)
```json
{
  "mcpServers": {
    "mem0": {
      "command": "mem0-mcp-server",
      "args": [],
      "env": { "MEM0_API_KEY": "..." },
      "disabled": false
    }
  }
}
```

## Current Status
- [x] Project scaffolded (18 files)
- [x] CLI entry with 4 commands
- [x] Registry files (MCPs, providers, skills)
- [x] Init wizard with environment detection
- [x] MCP installer + config writer
- [x] Skills installer (sparse clone + symlink)
- [x] Doctor health check
- [x] List command
- [x] Update command
- [x] README with full docs

## TODO — Priority Order
1. **Build & test**: `npm install && npm run build` — fix any TypeScript errors
2. **Provider config writing**: init.ts needs to write provider config into crush.json (not just MCPs)
3. **Crush agent setup**: Write orchestrator agent (autonomous.md) + context_paths config
4. **Memory pipeline**: Add ContextGraph bridge setup (mem0 → ContextGraph hydration wrapper)
5. **Permissions config**: Auto-approve safe MCP tools (read operations)
6. **npx support**: Ensure `npx f2g-telco init` works without global install
7. **Error handling**: Graceful failures when npm/git not available
8. **E2E test**: Full init → doctor cycle on clean machine

## Rules
- All tools/services must be FREE (no paid API keys required for core functionality)
- MIT license
- Minimal code — don't over-engineer
- Registry-driven — add new MCPs/providers/skills by editing JSON, not code
- Support users WITHOUT GitHub Copilot subscription
