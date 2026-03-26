# F2G-Telco

> CLI tool to supercharge AI coding environments — installs MCPs, skills, agents, and memory pipelines with provider-agnostic configuration.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node 18+](https://img.shields.io/badge/node-18+-blue.svg)](https://nodejs.org/)

## What It Does

One command to set up a fully configured AI development environment:

- **14 MCP servers** — memory, knowledge, reasoning, browser automation, diagrams, GitHub
- **Curated skills** — from awesome-copilot, agency-agents, and more
- **Provider-agnostic** — works with Copilot, Ollama, NVIDIA NIM, or any OpenAI-compatible API
- **Tool support** — Crush, Kiro CLI
- **INVENTORY.md** — dynamic discovery file so agents know what's available

## Quick Start

```bash
npx f2g-telco init
```

The wizard will:
1. Detect your OS, tools, and existing providers
2. Ask which AI provider you use (or want to set up)
3. Install and configure MCP servers
4. Clone and symlink curated skills
5. Generate INVENTORY.md for agent discovery

## Commands

| Command | Description |
|---------|-------------|
| `f2g-telco init` | Interactive setup wizard |
| `f2g-telco doctor` | Health check — verify everything works |
| `f2g-telco list` | Show available MCPs, skills, providers |
| `f2g-telco update` | Pull latest configs and skills |

## Providers

| Provider | Free? | Description |
|----------|-------|-------------|
| **GitHub Copilot** | Subscription | Claude, GPT, Gemini, Grok models via Copilot |
| **Ollama** | ✅ Free | Run models locally — private, no API keys |
| **NVIDIA NIM** | ✅ Free tier | Hosted Llama, DeepSeek with 1000 free credits |
| **OpenAI-Compatible** | Varies | Any OpenAI-compatible endpoint |

## MCP Servers Included

| Server | Category | Description |
|--------|----------|-------------|
| mem0 | Memory | Long-term memory across sessions |
| context7 | Knowledge | Up-to-date library documentation |
| sequential-thinking | Reasoning | Multi-step reasoning with branching |
| memory | Memory | Knowledge graph — entities and relations |
| filesystem | Core | File operations |
| fetch | Core | HTTP requests |
| github | Dev | PRs, issues, commits |
| playwright | Testing | Browser automation, E2E |
| mermaid | Docs | Diagram rendering |
| gitnexus | Dev | Codebase knowledge graph |
| contextgraph | Memory | Governed shared memory with provenance |

## Architecture

```
f2g-telco init
    │
    ├── Detect environment (OS, tools, providers)
    ├── Choose tool (Crush / Kiro)
    ├── Choose provider (Copilot / Ollama / NIM / Custom)
    ├── Collect API keys (only for MCPs that need them)
    ├── Install MCP servers (npm install -g)
    ├── Write MCP config (tool-specific format)
    ├── Clone & symlink skills (awesome-copilot, agency-agents)
    ├── Generate INVENTORY.md (agent discovery)
    └── Save F2G config (~/.f2g-telco/config.json)
```

## For Maintainers

### Adding a new MCP

Edit `registry/mcps.json` — add an entry with:
- `id`, `name`, `description`
- `install` command (npm/pip)
- `command` to run the server
- `requiresEnv` — API keys needed (empty array if none)
- `category`, `free` flag

### Adding a new provider

Edit `registry/providers.json` — add provider with models and config.

### Adding skills

Edit `registry/skills.json` — add a source with repo URL and curated picks.

## License

MIT
