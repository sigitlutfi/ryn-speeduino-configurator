---
name: git-bash-workflow
description: Git Bash workflow guidance for this project when Codex needs terminal commands, search patterns, file inspection, git operations, or repeatable debugging steps on Windows. Use when command examples should default to Git Bash and avoid PowerShell drift.
---

# Git Bash Workflow

Use Git Bash as the default shell style for examples and workflows in this repository. Keep commands copy-pasteable in Git Bash unless there is a concrete Windows-native reason to prefer PowerShell.

## Preferred Shell Choice

1. Use Git Bash for navigation, search, git operations, and common file inspection.
2. Use PowerShell for Windows-specific inspection, registry or process tasks, and when native cmdlets are safer than shell composition.
3. When giving command examples, keep them copy-pasteable and avoid forcing both shells unless the distinction matters.

## Repo Rule

1. Write new workflow examples in Git Bash syntax first.
2. Do not convert a working Git Bash command into PowerShell just for consistency.
3. If PowerShell is shown, explain why it is the better fit for that case.

## Default Command Set

```bash
pwd
ls -la
rg -n "pattern" .
rg --files
cat path/to/file
git status --short
git diff -- path/to/file
npm start
```

## Common Equivalents

| Action | Git Bash (Preferred) | PowerShell (Fallback) | Notes |
|---|---|---|---|
| File search | `grep -n "pattern" file` | `Select-String -Path file -Pattern "pattern"` | Use `rg` first when available. |
| Recursive search | `rg -n "pattern" .` | `Get-ChildItem -Recurse | Select-String -Pattern "pattern"` | Prefer `rg` for speed. |
| File contents | `cat file` | `Get-Content file` | |
| Listing | `ls -la` | `Get-ChildItem -Force` | |
| Remove tree | `rm -rf path` | `Remove-Item -Recurse -Force path` | Prefer the safer native command for risky deletes. |
| Env var | `export NAME=value` | `$env:NAME = "value"` | |
| Null redirection | `> /dev/null` | `> $null` | |

## Speeduino INI Search

Use fast text search first:

```bash
rg -n "varName" speeduino.ini
rg -n -C 8 "DialogName" speeduino.ini
rg -n "array\\s*," speeduino.ini
```

Use PowerShell only when Git Bash tooling is unavailable or when a Windows-native pipeline is easier to read:

```powershell
Select-String -Path .\speeduino.ini -Pattern "varName"
Select-String -Path .\speeduino.ini -Pattern "DialogName" -Context 0,8
```

## Path and Quoting

1. In Git Bash examples, prefer forward slashes.
2. In PowerShell examples, prefer backslashes when showing native Windows paths.
3. Use quoting that matches the shell you are documenting.
4. Do not rewrite a working command into PowerShell unless there is a concrete benefit.

## Safe Habits

1. Prefer `rg` for search and `rg --files` for file discovery.
2. Avoid shell one-liners that are hard to read when a few simple commands are clearer.
3. Use native PowerShell only for operations that are genuinely safer there.
4. Keep git commands non-interactive.
