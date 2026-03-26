---
description: How to add a new domain feature to Ryn Speeduino Configurator
---

# Feature Addition Workflow

Follow these steps to add a new feature (e.g., "Data Logger", "CAN Bus Config") to the project.

## 1. Define the Feature Directory
Create a new folder in `src/renderer/features/[feature-name]`.
Example: `src/renderer/features/logger/`.

## 2. Extend the Store (If needed)
Update `src/renderer/core/store.js`:
- Add the initial state.
- Add actions for the new feature.
- Follow the modular selector pattern.

## 3. Extract UI Components
If your feature needs a complex UI element (like a specific chart or gauge):
- Create it in `src/renderer/ui/[ComponentName]/Index.jsx`.
- Style it using the `neon-theming` skill tokens.
- Keep it stateless and generic.

## 4. Implement the Feature View
Create the main feature component in `src/renderer/features/[feature-name]/Index.jsx`.
- Import necessary UI components from `../../ui/`.
- Connect to the store via `useStore`.
- Apply neon aesthetics (glassmorphism, glows).

## 5. Register in App.jsx
- Add a new tab entry in the `TABS` constant.
- Add the case in the `renderContent` switch statement.
- Ensure proper icon usage.

## 6. Verify IPC (Optional)
If the feature requires background processing:
- Add handlers in `src/main/index.js`.
- Expose via `src/main/preload.js`.
- Access via `window.[api-name]` in the renderer.
