# AGENT.md - Ryn Speeduino Configurator Developer Guide

## Project Overview

Ryn Speeduino Configurator is an Electron-based desktop application for configuring and monitoring Speeduino ECUs. It uses React for the UI, Zustand for state management, and Tailwind CSS for styling. Communication with the ECU happens over Serial (using `serialport`).

---

## Commands

### Development
```bash
pnpm install      # Install dependencies
pnpm start        # Start the application in development mode
```

### Packaging & Distribution
```bash
pnpm run package  # Package the application
pnpm run make     # Create installers (Squirrel, Deb, RPM, etc.)
```

---

## Code Style Guidelines

### Language
- **JavaScript** - No TypeScript in this project.
- **CommonJS** - Used in `src/main/preload.js`.
- **ES Modules (ESM)** - Used in `src/main/index.js`, `src/shared/*`, and `src/renderer/*`.

### Formatting
- 2-space indentation.
- Single quotes for strings (`'`), except when double quotes are necessary.
- No semicolons at the end of statements.
- One space after keywords (`if (...)`, `async function`).
- No space between function name and parentheses (`func()`).

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Variables / Functions | camelCase | `activePort`, `parseRealtime()` |
| Components | PascalCase | `ConnectionPanel.jsx`, `VETable.jsx` |
| Constants | SCREAMING_SNAKE | `BAUD_RATES`, `REALTIME_PACKET_SIZE` |
| Files (Logic) | kebab-case | `ts-commands.js`, `ini-parser.js` |
| Files (Components) | PascalCase | `Dashboard.jsx` |
| Store State | camelCase | `currentProject`, `realtime` |

### State Management
- Use **Zustand** for global application state.
- Store is located at `src/renderer/core/store.js`.
- Use `setTableCell` for updating 2D tuning tables.

### Design Aesthetics
- **Theme**: Premium "Neon Dark" Theme.
- **Background**: `#040608` (Deep Background).
- **Styling**: Tailwind CSS with glassmorphism and glow effects.
- **Typography**: Orbitron (Headers), Inter (Body), Roboto Mono (Numbers).

---

## Project Workflow (Project-Based)

Users must initialize a Project before accessing the dashboard:
1.  **Lobby**: Choose "New Project" or "Open Existing".
2.  **Configuration**: Selection of a `.ini` file (e.g., `speeduino.ini`) is required.
3.  **Persistence**: Project metadata is stored in `.rynproj` files (JSON).

---

## Project Structure

```
src/
├── main/                  # Electron Main Process
│   ├── index.js           # Main entry (IPC & Window)
│   └── preload.js         # Preload bridge (Internal & projects API)
├── shared/                # Shared Logic (Protocols, Parsers)
│   ├── protocol/          # ECU Serial Protocol
│   └── ini-parser.js      # Speeduino .ini file parser
└── renderer/              # React Frontend
    ├── core/              # Global state (Zustand) & Logic
    ├── ui/                # Reusable UI Components (Gauges, Layout)
    └── features/          # Domain-Specific Features
        ├── projects/      # Project Launcher & Management
        ├── dashboard/     # Realtime gauges & monitoring
        ├── tuning/        # VE, Ignition, AFR table editors
        └── connection/    # Serial connectivity management
```

---

## Technical Stack

- **Framework**: Electron + React (Vite)
- **Serial**: `node-serialport`
- **Plotting**: `uPlot` (High-performance data charts)
- **State**: `zustand`
- **Styling**: `tailwindcss` (Vanilla CSS with glow utilities)

---

## Protocol Notes

- **Realtime Packet**: 138 bytes (standard Speeduino/TunerStudio format).
- **Commands**: Follows the TunerStudio Serial Protocol.
- **INI Reference**: `.ini` files contain the offsets, scaling, and table metadata.
