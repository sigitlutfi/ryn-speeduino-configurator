# .agents

This folder contains repo-local agent guidance that supplements the root `AGENTS.md`.

## Structure

- `skills/`: reusable domain or workflow skills for this repository.
- `workflows/`: short task playbooks for recurring implementation flows.

## Current Intent

- Keep project-wide architecture and product truth in `../AGENTS.md`.
- Keep focused execution guidance in `.agents/skills/*/SKILL.md`.
- Keep step-by-step task recipes in `.agents/workflows/*.md`.

## Conventions

- Prefer Git Bash as the default shell for examples and workflows.
- Allow PowerShell equivalents only when they are clearly better for Windows-native tasks.
- Keep skills short, task-oriented, and non-duplicative with `AGENTS.md`.
- Update `.agents` docs when project structure changes enough to make workflows stale.
