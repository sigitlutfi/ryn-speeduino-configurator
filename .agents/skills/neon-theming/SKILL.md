---
name: neon-theming
description: Guidelines and utility classes for implementing the premium "Neon Dark" theme inspired by ryn-race-timer.
---

# Neon Theming Skill

This skill provides the design tokens and utility patterns for creating high-performance, visually stunning automotive dashboards with a "Neon/Cyberpunk" aesthetic.

## 🎨 Color Palette (Tailwind Config)

Add the following to your `tailwind.config.js`:

```javascript
neon: {
  green: '#00ffb4',
  cyan: '#00d4ff',
  orange: '#ff6b35',
  purple: '#a855f7',
  red: '#f43f5e',
  yellow: '#eab308',
},
bg: {
  deep: '#040608',
  primary: '#080b14',
  card: '#0d1220',
}
```

## 🔡 Typography

Use Google Fonts: `Orbitron`, `Share Tech Mono`, and `Inter`.

- **Headers/Display**: `font-orbitron` (Uppercase, tracking-widest).
- **Data/Readouts**: `font-mono` (`Share Tech Mono`).
- **UI/Body**: `font-inter`.

## ✨ Core Utilities

### Glassmorphism
Apply to panels for depth:
- `glass`: Subtle blur with `rgba(8, 12, 20, 0.85)`.
- `glass-strong`: Heavier blur and shadow for overlays.

### Neon Glows
- `glow-cyan`: `text-shadow: 0 0 8px rgba(0, 212, 255, 0.8)`.
- `box-glow-green`: Subtle outer and inner shadow for badges/indicators.

### Background Overlay
Include the `neon-grid` class in your main container:
```css
.neon-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px);
  background-size: 48px 48px;
}
```

## 🏗️ Component Architecture

To maintain modularity and reusability, follow these architectural rules:

### 1. Features vs UI
- **`src/renderer/features/`**: Contains domain-specific, stateful components (e.g., `Dashboard`, `VETable`). 
  - They *can* import from the store.
  - They are organized by business domain.
- **`src/renderer/ui/`**: Contains stateless, atomic, or layout components (e.g., `Gauge`, `Button`, `TableEditor`).
  - They *should not* import the store directly (prefer props).
  - They are highly reusable across different features.

### 2. State Access
- Always import the store from `../../core/store.js`.
- Use selective selectors: `const rpm = useStore(s => s.realtime.rpm)`.

### 3. Shared Logic
- Place ECU-agnostic logic (parsers, utility functions) in `src/shared/`.
- Ensure main and renderer processes can import from `shared/` without circular dependencies.

## 🛠️ Usage Example

```jsx
<div className="glass p-4 rounded-xl border-white/5 shadow-2xl overflow-hidden relative">
  {/* Add a subtle top-right glow light source */}
  <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-3xl pointer-events-none" />
  
  <h2 className="text-lg font-orbitron font-bold text-neon-cyan uppercase glow-cyan">
    Telemetry
  </h2>
  
  <div className="text-3xl font-mono text-white">12,500 RPM</div>
</div>
```
