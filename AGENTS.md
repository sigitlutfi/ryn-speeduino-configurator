# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

RYN Speeduino Configurator is an Electron-based desktop application for tuning Speeduino ECUs (Engine Control Units). It provides real-time tuning, table editing, sensor calibration, and bidirectional ECU synchronization via SerialPort.

## Development Commands

```bash
# Start development server with hot reload
npm start

# Package application for distribution
npm run package

# Create installers (Squirrel/Windows, Zip/macOS, Deb/Linux, RPM/Linux)
npm run make

# Run protocol, configuration, pin and upgrade-gate tests
npm test

# Compare the app to the reviewed firmware checkout
npm run upgrade:check -- --firmware /path/to/firmware

# No linting currently configured
npm run lint
```

## Working Conventions

- Prefer Git Bash command syntax for terminal examples and repeatable workflows in this repository.
- Use PowerShell only when a Windows-native command is materially safer or clearer.
- For UI styling, prefer modern acrylic surfaces, restrained blur, compact spacing, and restrained neon accents over generic glassmorphism.

## Code Style

- Use JavaScript throughout the repo; do not introduce TypeScript unless explicitly requested.
- Keep `src/main/preload.js` in CommonJS style and use ES modules in `src/main/index.js`, `src/shared/*`, and `src/renderer/*`.
- Prefer 2-space indentation, single quotes, and no semicolons unless the surrounding file already differs.
- Use camelCase for variables and functions, PascalCase for React components, and SCREAMING_SNAKE_CASE for constants.

## Project Structure

- Put stateful domain screens under `src/renderer/features/`.
- Put reusable presentational building blocks under `src/renderer/ui/`.
- Keep ECU-agnostic parsing and protocol logic in `src/shared/`.
- Treat `src/renderer/core/store/index.js` and its slices as the canonical state layout.

## Architecture

### Electron Process Structure

**Main Process** (`src/main/index.js`):
- Manages window lifecycle and singleton state (`activePort`, `mainWindow`)
- Implements custom `atom://` protocol for serving local background images
- Exposes IPC handlers for serial communication, file I/O, and project management

**Preload Bridge** (`src/main/preload.js`):
- Context isolation bridge exposing three namespaced APIs:
  - `window.serial` - Serial port communication
  - `window.projects` - Project file I/O and recent projects
  - `window.config` - App configuration (window state, recent files)

**Renderer Process** (`src/renderer/`):
- React 19 + Vite + TailwindCSS
- State managed with Zustand (8 specialized slices)
- Routing via Wouter
- 3D visualizations with React Three Fiber

### State Management (Zustand)

The store (`src/renderer/core/store/index.js`) is composed of 8 slices:

1. **projectSlice** - Project lifecycle, INI parsing, ECU sync operations
2. **connectionSlice** - Serial connection state
3. **tableSlice** - In-memory tuning table data (VE, AFR, Ignition, Boost, VVT)
4. **realtimeSlice** - Live ECU telemetry (138/144-byte packets at 10Hz)
5. **settingsSlice** - App settings (theme, background images)
6. **unitsSlice** - Unit conversions (celsius/fahrenheit, kPa/PSI/bar, km/h/mph)
7. **notificationSlice** - Toast notifications
8. **uiSlice** - UI state (sidebar, dialogs, active table cell highlighting)

**Key Pattern**: Slices share cross-cutting actions (e.g., `updateConstants` triggers ECU RAM sync if connected).

### ECU Communication Protocol

**Transport Layer**:
- Real hardware: node-serialport via `window.serial` API
- Development: Mock serial (`src/shared/protocol/mock-serial.js`) simulates ECU responses with CRC32 validation

**Modern Protocol Format** (Speeduino 2025.04+):

**HYBRID PROTOCOL DISCOVERED:**

**Commands (TX to ECU):**
```
[PayloadLength (2B BE)] [Payload] [CRC32 (4B BE)]
```
- Uses modern protocol wrapper
- **BIG ENDIAN** for Length and CRC
- CRC32 validated by ECU

**Responses (RX from ECU):**
```
[RAW DATA BYTES]
```
- **Legacy format** - NO wrapper!
- NO CRC validation
- Data arrives **fragmented** across multiple packets
- Must accumulate until expected size reached

**IMPORTANT:** This is a **mixed/hybrid protocol** - commands are wrapped (modern), responses are unwrapped (legacy)!

**Command Layer** (`src/shared/protocol/ecu-commands.js`):
- `formatWriteCommand(page, offset, length, value)` - Write to ECU RAM ('M' command)
- `formatBurnCommand(page)` - Persist page to EEPROM ('b' command)
- `formatReadCommand(page, offset, length)` - Read page from ECU ('p' command)

**Command Details**:
- **'M' (Write)**: `['M'] [0x00] [page] [offset LE] [length LE] [data...]` → Response: `0x00` (OK)
- **'b' (Burn)**: `['b'] [0x00] [page]` → Response: `0x04` (BURN_OK)
- **'p' (Read)**: `['p'] [0x00] [page] [offset LE] [length LE]` → Response: `0x00` + data
- **'C' (Handshake)**: `['C']` → Response: `0x00, 0xFF`
- **'Q' (Firmware Sig)**: `['Q']` → Response: `0x00` + "speeduino 202504-dev"
- **'S' (Product)**: `['S']` → Response: `0x00` + "Speeduino 2025.04-dev"

**Return Codes**:
- `0x00` - OK
- `0x04` - BURN_OK
- `0x80` - TIMEOUT
- `0x82` - CRC_ERR
- `0x83` - UNKNOWN_ERR
- `0x84` - RANGE_ERR
- `0x85` - BUSY_ERR

**Data Parsing**:
- `parseRealtime(bytes)` (`src/shared/protocol/realtime.js`) - Decodes 138/144-byte telemetry packets
- `parsePage(buffer, pageVars)` (`src/shared/protocol/binary-parser.js`) - Decodes page data using INI metadata

**Bidirectional Sync Pattern**:
1. **Live Sync**: UI changes immediately write to ECU RAM via 'M' command (safer tuning workflow)
2. **Burn**: Explicit EEPROM write via 'b' command (persists after ECU power cycle)
3. **Read from ECU**: `readPageFromECU(pageId)` uses 'p' command to pull ECU state into project file

### INI-Based Metadata System

The app is driven by TunerStudio INI files (`src/shared/ini-parser.js`):
- Parses `speeduino.ini` with preprocessor directives (`#if`, `#define`, `#else`, `#endif`)
- Defines pages, offsets, data types, scaling factors, and bit fields for all ECU variables
- Three variable types: `scalar` (single value), `array` (1D/2D tables), `bits` (bitfields)
- Supports table metadata (`[TableEditor]`) and curve metadata (`[CurveEditor]`)

**Fuzzy Metadata Lookup**: `getVarMetadata(parsedIni, name)` is case-insensitive and version-tolerant, allowing INI evolution without breaking projects.

### Data Flow Patterns

**Constants vs Tables Architecture**:
- **Constants** (`projectSlice.currentProject.constants`): Raw byte-level ECU data organized by page
- **Tables** (`tableSlice.tables`): Normalized, scaled display values for UI (e.g., AFR 14.7 instead of raw byte 147)
- Transform layer handles scaling/offset conversions bidirectionally

**Pattern 1: Project Load**
```
User picks .rynproj → window.projects.loadFile()
→ projectSlice.setProject()
→ parseIni(embedded content or disk)
→ Normalize constants to tables
→ Update recentProjects
```

**Pattern 2: Table Edit**
```
User edits cell → tableSlice.setTableCell() (local state, isDirty = true)
→ User clicks Save → Denormalize to raw bytes
→ updateConstants() (writes to ECU RAM if connected)
→ saveProject() (disk persistence)
→ Optional: burnPage() (EEPROM persistence)
```

**Pattern 3: Settings Edit**
```
User edits field → useTuningModule.setFieldValue() (local state)
→ User clicks Save → updateConstants({ pages: { ... } })
→ If connected: syncConstantToECU() (RAM write)
→ saveProject() (disk)
→ Optional: burnPage() (EEPROM)
```

**Pattern 4: Realtime Telemetry**
```
ECU sends 138-byte packet (10Hz) → window.serial.onData()
→ parseRealtime(bytes) → realtimeSlice.setRealtime()
→ Dashboard/Gauges re-render
→ TuningGrid highlights active cell based on RPM/load
```

### Project File Schema (.rynproj)

Version 2 schema with **embedded INI portability**:
```json
{
  "schemaVersion": 2,
  "projectName": "My Performance Build",
  "ini": {
    "path": "C:\\path\\to\\speeduino.ini",
    "signature": "speeduino 202504-dev",
    "version": "2.25",
    "content": "...entire INI text embedded..."  // Makes projects portable!
  },
  "constants": { "pages": { 1: {...}, 7: {...}, ... } },
  "tables": { "ve": {...}, "ign": {...}, ... },  // Optional cached display state
  "engine": { "displacement": 2000, "cylinders": 4, "type": "inline" },
  "units": { "temperature": "celsius", "pressure": "kpa", "speed": "kmh" },
  "filePath": "C:\\Users\\ryn\\my_project.rynproj",
  "color": "cyan"  // UI accent color
}
```

**Key Innovation**: Embedded INI content (`ini.content`) allows projects to be opened on any machine without requiring the original INI file.

## Common Development Patterns

### Adding a New Tuning Table

1. Add entry to `INITIAL_TABLES` in `src/renderer/core/store/tableSlice.js`:
```javascript
myNewTable: { values: [[]], rpmAxis: [], loadAxis: [] }
```

2. Add route in `src/renderer/core/routes.js`:
```javascript
{ path: '/tuning/my-table', component: MyTableView, category: 'tuning', label: 'My Table', icon: TableIcon }
```

3. Create component using `useTableSync` hook:
```javascript
import { useTableSync } from '../shared/hooks/useTableSync';

const { values, rpmAxis, loadAxis, handleSave, isDirty, isConnected }
  = useTableSync('myNewTable', 'myTableTbl'); // 2nd arg is INI table ID

return <TuningGrid values={values} rpmAxis={rpmAxis} loadAxis={loadAxis} ... />;
```

### Adding a New Settings Module

1. Identify target variables from `speeduino.ini` (e.g., `nCylinders`, `injLayout`)

2. Create component using `useTuningModule` hook:
```javascript
import { useTuningModule } from '../shared/hooks/useTuningModule';

const { getFieldValue, setFieldValue, handleSave, isDirty, isConnected }
  = useTuningModule(['nCylinders', 'injLayout', 'reqFuel']);

// Read value
const cylinders = getFieldValue('nCylinders');

// Write value
setFieldValue('nCylinders', 4);

// Save to ECU RAM + project file
handleSave(false); // false = RAM only, true = RAM + EEPROM burn
```

3. Render fields with metadata-driven controls (see `src/renderer/features/settings/EngineConstants.jsx` for examples)

### Reading/Writing ECU Data

**Using serialService directly** (advanced):
```javascript
import { serialService } from './core/services/serialService.js';
import { formatWriteCommand } from '../shared/protocol/ecu-commands.js';
import { validateResponse } from '../shared/protocol/response-utils.js';

// Write with automatic retry on BUSY_ERR
const cmd = formatWriteCommand(page, offset, length, value);
const response = await serialService.sendCommandWithRetry(cmd, 3); // Max 3 retries
validateResponse(response, 'write'); // Throws descriptive error if failed

// Or use store actions (recommended):
```

**Read entire page from ECU**:
```javascript
const pageData = await readPageFromECU(7); // Returns parsed object, handles modern protocol
```

**Write constants to ECU RAM**:
```javascript
updateConstants({
  pages: {
    1: { nCylinders: 4, algorithm: 0 }
  }
}); // Automatically syncs to ECU if connected, with response validation
```

**Burn page to EEPROM**:
```javascript
await burnPage(1); // Persists page 1 to EEPROM, validates BURN_OK response
```

### Working with Project Files

**Load project**:
```javascript
const projectData = await window.projects.loadFile(filePath);
setProject(projectData); // Triggers INI parsing and table normalization
```

**Save project**:
```javascript
saveProject(); // Serializes currentProject to disk at currentProject.filePath
```

**Update INI file**:
```javascript
updateIni(newIniPath); // Re-parses INI and updates metadata (dangerous - may invalidate constants)
```

## Protocol Utilities

### Response Validation (`src/shared/protocol/response-utils.js`)

Helper functions for working with ECU responses:

```javascript
import { isOK, isBurnOK, isRetryable, validateResponse, getErrorMessage } from '../shared/protocol/response-utils.js';

// Check response status
if (isOK(response)) { /* success */ }
if (isBurnOK(response)) { /* burn succeeded */ }
if (isRetryable(response)) { /* can retry */ }

// Validate and throw descriptive error
validateResponse(response, 'write'); // Throws user-friendly error if failed

// Get error message
const msg = getErrorMessage(response.status, 'burn'); // "ECU is busy processing. Wait a moment and retry"
```

### Serial Service (`src/renderer/core/services/serialService.js`)

High-level API for ECU communication:

```javascript
import { serialService } from './core/services/serialService.js';

// Send command with automatic retry
const response = await serialService.sendCommandWithRetry(cmd, maxRetries, timeout, retryDelay);

// Listen to realtime data
serialService.onRealtime((bytes) => {
  const data = parseRealtime(bytes);
  // Handle telemetry
});

// Handshake on connect
await serialService.handshake(); // Verifies ECU is ready
```

### Modern Protocol Parser (`src/shared/protocol/response-parser.js`)

Automatically handles:
- CRC32 validation
- Payload unwrapping
- Realtime vs command response separation
- Error code parsing

## Key Domain Concepts

- **Page**: ECU memory is organized into 15 pages (0-14). Each page contains related variables (e.g., page 1 = engine constants, page 7 = VE table 1).
- **Constants**: Raw byte-level ECU data stored in `currentProject.constants.pages`.
- **Tables**: Normalized display values stored in `tableSlice.tables` (e.g., AFR 14.7 instead of byte 147).
- **Normalization**: Converting raw ECU bytes to scaled display values using INI metadata (`addhigh`, `addlow`, `multiplier`).
- **Denormalization**: Reverse process when writing back to ECU.
- **Burn**: Writing ECU RAM to EEPROM for persistence across power cycles.
- **Realtime**: Live telemetry from ECU (RPM, MAP, TPS, temperatures, status flags).

## Build Configuration

- **Electron Forge**: Build pipeline (`forge.config.js`)
- **Vite**: Bundler for main, preload, and renderer processes (`vite.main.config.mjs`, `vite.preload.config.mjs`, `vite.renderer.config.mjs`)
- **TailwindCSS**: Utility-first styling (`tailwind.config.js`)
- **Makers**: Squirrel (Windows), Zip (macOS), Deb (Linux), RPM (Linux)

## Testing Notes

- Node tests are available through `npm test`; set `RYN_FIRMWARE_ROOT` to run
  paired-checkout rejection tests as well. `upgrade:check --full` supplies it.
- Follow `UPGRADE_WORKFLOW.md` for firmware/INI/pin changes; generated assets
  come from `upgrade:sync` after the reviewed firmware baseline is committed.
- Development uses mock serial (`src/shared/protocol/mock-serial.js`) for testing without hardware
- Mock serial simulates realistic ECU responses with:
  - Modern protocol support (CRC32 validation)
  - In-memory ECU page storage (16 pages × 512 bytes)
  - Full command support: 'M' (write), 'b' (burn), 'p' (read), 'C' (handshake), 'Q'/'S' (version info)
  - Realtime telemetry packets (138 bytes at 10 Hz)

## Important Caveats

1. **INI Version Compatibility**: The app uses fuzzy matching for variable names to tolerate INI evolution, but major INI structural changes may break older projects.

2. **RAM vs EEPROM**: Changes are written to ECU RAM immediately for safety. Always explicitly burn to EEPROM when tuning is complete.

3. **Page Management**: Updating constants may span multiple pages. Use `getVarMetadata()` to determine which page a variable belongs to.

4. **Embedded INI Portability**: Schema v2 projects embed full INI content, making them portable. Schema v1 projects require the INI file to be present at the original path.

5. **Realtime Packet Versions**: Support both 138-byte (standard) and 144-byte (extended with racing features) telemetry packets. Detect via packet length.
