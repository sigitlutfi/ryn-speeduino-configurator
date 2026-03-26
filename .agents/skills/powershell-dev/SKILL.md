---
name: powershell-dev
description: Development standards for PowerShell in this project. All terminal interactions across the .agents directory should follow these Windows-native guidelines.
---

# PowerShell Development Standards

To ensure optimal performance and compatibility on the USER's Windows system, follow these PowerShell (`pwsh`) standard practices.

## 🛠️ Preferred Command Aliases & Equivalents

| Action | Linux (Avoid) | PowerShell (Use) | Notes |
|---|---|---|---|
| **File Search** | `grep` | `Select-String` | Use `Select-String -Path <path> -Pattern "<regex>"` |
| **Content View** | `cat` | `Get-Content` | Use `Get-Content -Path <file>` |
| **Listing** | `ls -la` | `Get-ChildItem` | Or just `ls` (standard pwsh alias) |
| **Removal** | `rm -rf` | `Remove-Item -Recurse -Force` | |
| **Environment** | `export VAR=val` | `$env:VAR = "val"` | |
| **Null Redirection** | `> /dev/null` | `> $null` | |

---

## 🔍 In-depth File Searching (The Speeduino ID Guide)

Since `speeduino.ini` is large (~6,000 lines), use high-performance PowerShell filtering:

### 1. Simple Variable Search
```powershell
Select-String -Path c:\Users\ryn\speeduino\speeduino\reference\speeduino.ini -Pattern "varName"
```

### 2. Contextual Search (like grep -C)
```powershell
Select-String -Path c:\Users\ryn\speeduino\speeduino\reference\speeduino.ini -Pattern "DialogName" -Context 0,10
```

### 3. List all Bins/Arrays
```powershell
Select-String -Path c:\Users\ryn\speeduino\speeduino\reference\speeduino.ini -Pattern "array\s*,"
```

---

## 📂 Path & Variable Handling

1.  **Backslashes**: Always use `\` for file paths in commands to ensure Windows native compatibility.
2.  **Quoting**: Use single quotes `'` for literal strings and double quotes `"` only when variable expansion (interpolasi) is needed.
3.  **Variable Assignment**: Use `$variable = value` for local pwsh variables.

---

## ⚡ Integration with speeduino-ini Skill

When using technical blueprints from the `speeduino-ini` skill, translate any Linux-style examples into the PowerShell equivalents listed here. This maintains consistency and avoids terminal errors in the current workspace.
