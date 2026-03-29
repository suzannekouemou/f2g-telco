# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.9] - 2026-03-29

### Added
- CLI tools registry (`registry/cli-tools.json`) with 6 tools
- **ghgrab** v1.2.0 — cherry-pick files from GitHub repos (npm: @ghgrab/ghgrab)
- **vera** v0.11.2 — semantic code search with local ONNX models, 64 languages, MCP server built-in (npm: @vera-ai/cli)
- **vera** MCP server (#18) — 9 tools: index_project, search_code, regex_search, get_overview, get_stats, find_references, find_dead_code, update_project, watch_project
- **everything-claude-code** skill source (affaan-m/everything-claude-code, 25 curated skills)
- **ai-agent-stack** skill source (DavidBritto/ai-agent-stack, 6 skills)
- CLI Tools section in INVENTORY.md generation

### Changed
- Registry versions: mcps.json → 1.4.0, skills.json → 1.3.0

## [0.1.0] - 2026-03-26

### Added
- `f2g-telco init` — interactive setup wizard with 10-step flow
- `f2g-telco doctor` — health check for AI environment
- `f2g-telco list` — show available MCPs, skills, providers
- `f2g-telco update` — pull latest configs and skills
- Guided onboarding UX — boxed panels with step-by-step API key setup
- `--reconfigure` flag to re-run API key collection
- 13 MCP servers in registry (all free)
- 5 AI providers: GitHub Copilot, Ollama, NVIDIA NIM, Google AI Studio, OpenAI-compatible
- 3 skill sources: awesome-copilot (curated), agency-agents, claude-best-practices
- Complete Crush config: MCPs, providers, models, permissions (38+ tools), LSP, orchestrator
- Complete Kiro config: MCPs with autoApprove, env vars, absolute paths
- ContextGraph bridge with mem0 hydration on session boot
- INVENTORY.md generation for agent discovery
- npx + user prefix install strategy (no sudo required)
- Doctor checks ~/.local/bin in PATH
- Orchestrator agent templates for Crush and Kiro

[0.1.9]: https://github.com/suzannekouemou/f2g-telco/releases/tag/v0.1.9
[0.1.0]: https://github.com/suzannekouemou/f2g-telco/releases/tag/v0.1.0
