# F2G-Telco

> CLI tool to supercharge AI coding environments — installs MCPs, skills, agents, and memory pipelines with provider-agnostic configuration.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node 18+](https://img.shields.io/badge/node-18+-blue.svg)](https://nodejs.org/)

## What It Does

One command to set up a fully configured AI development environment:

- **13 MCP servers** — memory, knowledge, reasoning, browser automation, diagrams, GitHub, databases
- **Curated skills** — from awesome-copilot, agency-agents, and more
- **Provider-agnostic** — works with Copilot, Ollama, NVIDIA NIM, Google AI Studio, or any OpenAI-compatible API
- **Tool support** — Crush, Kiro CLI
- **Complete config** — MCPs, providers, models, permissions, LSPs, orchestrator agent
- **INVENTORY.md** — dynamic discovery file so agents know what's available

## Quick Start

```bash
npx f2g-telco init
```

The wizard will:
1. Detect your OS, tools, and existing providers
2. Ask which AI coding tool you use (Crush or Kiro)
3. Ask which AI provider you use (or want to set up)
4. Collect API keys (only for MCPs/providers that need them)
5. Install and configure MCP servers
6. Write complete tool config (MCPs + providers + models + permissions + LSPs)
7. Set up orchestrator agent
8. Clone and symlink curated skills
9. Generate INVENTORY.md for agent discovery
10. Save config for future updates

## Commands

| Command | Description |
|---------|-------------|
| `f2g-telco init` | Interactive setup wizard |
| `f2g-telco doctor` | Health check — verify everything works |
| `f2g-telco list` | Show available MCPs, skills, providers |
| `f2g-telco update` | Pull latest configs and skills |

## Providers

| Provider | Free? | Models | Description |
|----------|-------|--------|-------------|
| **GitHub Copilot** | Subscription | Claude Opus/Sonnet/Haiku, GPT, Gemini, Grok | Full model catalog via Copilot |
| **Ollama** | ✅ Free | Qwen3, Llama, Mistral, etc. | Run models locally — private, no API keys |
| **NVIDIA NIM** | ✅ Free tier | Llama 3.3 70B, DeepSeek R1, Kimi K2.5 | 1000 free credits |
| **Google AI Studio** | ✅ Free tier | Gemini 2.5 Pro, Gemini 2.5 Flash | Free API key from aistudio.google.com |
| **OpenAI-Compatible** | Varies | Any model | LM Studio, vLLM, or any compatible endpoint |

## MCP Servers Included

| Server | Category | Free | Description |
|--------|----------|------|-------------|
| mem0 | Memory | ✅ | Long-term memory across sessions |
| contextgraph | Memory | ✅ | Governed shared memory with provenance + entity extraction |
| memory | Memory | ✅ | Knowledge graph — entities and relations |
| context7 | Knowledge | ✅ | Up-to-date library documentation |
| sequential-thinking | Reasoning | ✅ | Multi-step reasoning with branching |
| filesystem | Core | ✅ | File operations |
| fetch | Core | ✅ | HTTP requests |
| github | Dev | ✅ | PRs, issues, commits |
| gitnexus | Dev | ✅ | Codebase knowledge graph |
| postgresql | Dev | ✅ | Database queries |
| playwright | Testing | ✅ | Browser automation, E2E |
| mermaid | Docs | ✅ | Diagram rendering |
| notion | Productivity | ✅ | Notion pages and databases |

## What Gets Configured

### For Crush
- MCP servers with environment variables
- Custom provider (NIM, Ollama, Google AI, etc.)
- Model selection (large/small per provider)
- Permissions (38+ tools auto-approved)
- LSP servers (pyright, typescript-language-server)
- Skills paths + orchestrator agent
- Metrics/notifications disabled

### For Kiro
- MCP servers with autoApprove arrays
- Environment variables per MCP
- Orchestrator settings

## Architecture

```
f2g-telco init
    │
    ├── 1. Detect environment (OS, Node, Python, Git, tools, providers)
    ├── 2. Choose tool (Crush / Kiro)
    ├── 3. Choose provider (Copilot / Ollama / NIM / Google AI / Custom)
    ├── 4. Collect API keys (only what's needed)
    ├── 5. Install MCP servers (npm install -g / pip install)
    ├── 6. Write COMPLETE tool config
    ├── 7. Set up orchestrator agent
    ├── 8. Clone & symlink skills
    ├── 9. Generate INVENTORY.md
    └── 10. Save ~/.f2g-telco/config.json
```

## For Maintainers

### Adding a new MCP
Edit `registry/mcps.json` — add entry with id, install command, env vars, autoApprove list.

### Adding a new provider
Edit `registry/providers.json` — add provider with models and crushProvider config.

### Adding skills
Edit `registry/skills.json` — add source with repo URL and curated picks.

## License

MIT
