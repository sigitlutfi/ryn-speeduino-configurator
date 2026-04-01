---
description: How to add a new domain feature to Ryn Speeduino Configurator
---

# Feature Addition Workflow

Follow these steps to add a new feature (e.g., "Data Logger", "CAN Bus Config") to the project.

## 1. Define the Feature Directory
Create a new folder in `src/renderer/features/[feature-name]`.
Example: `src/renderer/features/logger/`.

## 2. Extend the Store (If needed)
Update the relevant slice under `src/renderer/core/store/`:
- Add initial state only in the slice that owns the feature.
- Add actions close to the domain that uses them.
- Follow the existing slice composition pattern from `src/renderer/core/store/index.js`.

## 3. Extract UI Components
If your feature needs a complex UI element (like a specific chart or gauge):
- Create it in `src/renderer/ui/[ComponentName]/Index.jsx`.
- Style it using the `neon-theming` skill tokens.
- Keep it stateless and generic.

## 4. Implement the Feature View
Create the main feature component in `src/renderer/features/[feature-name]/Index.jsx`.
- Import necessary UI components from `../../ui/`.
- Connect to the store via `useStore`.
- Apply acrylic surfaces, restrained blur, and compact professional spacing.

## 5. Register the Route
- Add a route entry in `src/renderer/core/routes.js`.
- Keep the category and label aligned with the existing navigation structure.
- Ensure the icon matches the feature intent.

## 6. Verify IPC (Optional)
If the feature requires background processing:
- Add handlers in `src/main/index.js`.
- Expose via `src/main/preload.js`.
- Access via `window.[api-name]` in the renderer.
