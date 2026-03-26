# Professional "Ryn Config" Upgrade Plan

This plan outlines the transformation of the current Speeduino configurator from an MVP to a professional-grade software tool, focusing on both high-fidelity aesthetics and robust functional workflows.

## User Review Required

> [!IMPORTANT]
> **New Dependencies**: I propose adding `framer-motion` for professional animations and `lucide-react` for consistent, high-quality icons. 
> 
> **Advanced Interaction**: I will implement professional "Tuner-style" interactions for the 3D tables, including arrow-key navigation and multi-cell selection.

## Proposed Changes

### 1. Visual Aesthetics & Design System
#### [MODIFY] [tailwind.config.js](file:///c:/Users/ryn/node/ryn-speeduino-configurator/tailwind.config.js)
- Add specialized neon shadow utilities (`shadow-neon-cyan`, etc.).
- Define a "Premium Dark" surface hierarchy.

#### [MODIFY] [index.css](file:///c:/Users/ryn/node/ryn-speeduino-configurator/src/index.css)
- Implement a subtle "Scanning Line" or "CRT Flicker" effect option for panels.
- Add premium scrollbar and glassmorphism refinements.

### 2. Custom "Pro" UI Components
#### [NEW] `src/renderer/ui/NeonButton.jsx`
- Support for "Ghost", "Outline", and "Solid Neon" variants.
- Integrated `framer-motion` for interactive scaling and glowing transitions.

#### [NEW] `src/renderer/ui/StatusBadge.jsx`
- Sophisticated status indicator with pulse effects and integrated labels.

#### [MODIFY] [Index.jsx](file:///c:/Users/ryn/node/ryn-speeduino-configurator/src/renderer/ui/Gauge/Index.jsx)
- Add SVG tick marks for precise reading.
- Implement an optional needle for a classic automotive feel.

### 3. Functional Professionalism
#### [MODIFY] [TableEditor.jsx](file:///c:/Users/ryn/node/ryn-speeduino-configurator/src/renderer/features/tuning/TableEditor.jsx)
- **Arrow-Key Navigation**: Move between cells without entering edit mode.
- **Multi-Cell Selection**: Click + drag or Shift + click to select blocks of cells.
- **Bulk Operations**: Implement shortcuts (e.g., `[` and `]` keys) to increment/decrement selected values.

#### [MODIFY] [ProjectLauncher.jsx](file:///c:/Users/ryn/node/ryn-speeduino-configurator/src/renderer/features/projects/ProjectLauncher.jsx)
- **Recent Projects**: Store and display a list of previously opened projects with last-access timestamps.
- **Validation**: Improve error reporting when an [.ini](file:///c:/Users/ryn/node/ryn-speeduino-configurator/speeduino.ini) file is invalid or missing.

### 4. Tuning & Settings Modules
#### [NEW] [TriggerSetup.jsx](file:///c:/Users/ryn/node/ryn-speeduino-configurator/src/renderer/features/tuning/TriggerSetup.jsx)
- **Pixel-Perfect UI**: Implement a two-column grid layout matching the TunerStudio "Trigger Settings" dialog.
- **Dynamic Logic**: Conditional visibility for fields (e.g., "Missing Teeth" only appears when the "Missing Tooth" pattern is selected).
- **Validation**: Integrated Zod schema in `schemas.js` to ensure timing-critical values are safe.
- **Persistence**: Full sync with Page 4 constants and "Burn to ECU" support.

#### [MODIFY] [Navigation Components](file:///c:/Users/ryn/node/ryn-speeduino-configurator/src/renderer/App.jsx)
- Register `/settings/trigger` route in `routes.js`.
- Add "Trigger Setup" to the Sidebar under Settings.
- Implement `Ctrl+6` keyboard shortcut.

## Verification Plan

### Automated Tests
- None planned for UI; focus on manual verification of interactions.

### Manual Verification
1. **Calibration Check**: Verify that table bulk edits (increment/decrement) correctly update the underlying data model.
2. **Performance Audit**: Ensure that adding `framer-motion` and more SVG elements doesn't impact the frame rate during high-frequency data logging.
3. **UX Flow**: Test the end-to-end "New Project" to "Table Tuning" flow to ensure it feels fluid and professional.
