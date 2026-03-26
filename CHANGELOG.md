# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/suzannekouemou/f2g-telco/releases/tag/v0.1.0
