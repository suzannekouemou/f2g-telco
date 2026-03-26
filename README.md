# F2G-Telco

[![CI](https://github.com/suzannekouemou/f2g-telco/actions/workflows/ci.yml/badge.svg)](https://github.com/suzannekouemou/f2g-telco/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node 18+](https://img.shields.io/badge/node-18+-blue.svg)](https://nodejs.org/)

CLI to set up a fully configured AI coding environment in one command—MCPs, providers, skills, orchestrators, and inventories for Crush and Kiro.

## Install

```bash
npx f2g-telco init
```

## What You Get
- **13 MCP servers** for memory, knowledge, reasoning, browser automation, diagrams, GitHub, databases
- **Curated skills** from multiple sources with orchestrator templates
- **Provider-agnostic configs** for Copilot, Ollama, NVIDIA NIM, Google AI Studio, and any OpenAI-compatible API
- **Complete tool wiring**: MCPs, providers, models, permissions, LSPs, orchestrator agent, INVENTORY.md

## Why F2G-Telco vs. Manual Setup
| Step | f2g-telco | Manual setup |
|------|-----------|--------------|
| Install MCP servers | Auto-installs with user prefix and fallbacks | Repeated npm/pip commands, sudo issues |
| Tool config | Writes full Crush/Kiro configs (MCPs, providers, models, permissions, LSP) | Hand-edit JSON with multiple schemas |
| Skills & orchestrator | Clones, symlinks, and wires orchestrator templates | Manual git clone + path wiring |
| Provider keys | Guided boxed prompts with skip/retry | Ad hoc env collection |
| Inventory | Generates INVENTORY.md for agents | Manual docs |
| Recovery | Verbose mode + doctor checks | Debug on your own |

## Command Reference
| Command | Description |
|---------|-------------|
| `f2g-telco init` | Interactive setup wizard (tools, providers, MCPs, skills, configs) |
| `f2g-telco add <mcp>` | Install and configure a single MCP by id |
| `f2g-telco remove <mcp>` | Uninstall and remove a single MCP by id |
| `f2g-telco list [--mcps|--providers|--skills]` | Show available components and installed status |
| `f2g-telco update` | Pull latest registries and refresh configs |
| `f2g-telco doctor` | Health check (Node, git, PATH, MCP binaries) |

## Providers
| Provider | Free? | Models | Description |
|----------|-------|--------|-------------|
| **GitHub Copilot** | Subscription | Claude Opus/Sonnet/Haiku, GPT, Gemini, Grok | Full catalog via Copilot |
| **Ollama** | ✅ Free | Qwen3, Llama, Mistral, etc. | Local models, private |
| **NVIDIA NIM** | ✅ Free tier | Llama 3.3 70B, DeepSeek R1, Kimi K2.5 | 1000 free credits |
| **Google AI Studio** | ✅ Free tier | Gemini 2.5 Pro/Flash | Free key from aistudio.google.com |
| **OpenAI-Compatible** | Varies | Any compatible model | LM Studio, vLLM, custom endpoints |

## MCP Servers Included
| Server | Category | Free | Description |
|--------|----------|------|-------------|
| mem0 | Memory | ✅ | Long-term memory across sessions |
| contextgraph | Memory | ✅ | Shared memory with provenance + entities |
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
### Crush
- MCP servers with env vars
- Providers and model mappings (large/small)
- Permissions (38+ tools auto-approved)
- LSP servers (pyright, typescript-language-server)
- Skills paths, orchestrator agent, metrics/notifications off

### Kiro
- MCP servers with autoApprove arrays
- Env vars per MCP, orchestrator settings

## Contributing
Pull requests are welcome. Please run `npm run build` and `npm test` before submitting.

## License
MIT
