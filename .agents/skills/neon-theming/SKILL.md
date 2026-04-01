---
name: neon-theming
description: Visual direction guidance for the repo's restrained neon automotive identity, including accent color usage, telemetry emphasis, glow discipline, and background mood. Use when a task needs the right visual character on top of the shared acrylic UI system.
---

# Neon Theming Skill

Use this skill for visual character, not for the shared material system. Pair it with `ui-acrylic-system` when a task needs reusable surfaces, spacing, or utility classes.

## Visual Direction

1. Build around dark graphite and petrol-blue surfaces instead of pure black.
2. Use cyan and green as signal colors, with orange and red reserved for warnings or hot states.
3. Keep the look technical, focused, and instrument-like rather than flashy.
4. Use glow as a minor accent only; contrast and hierarchy should carry most of the emphasis.
5. Avoid anything that makes the UI feel like a generic cyberpunk template.

## Color Palette

Add the following to your `tailwind.config.js`:

```javascript
neon: {
  green: '#69f0ae',
  cyan: '#3be7ff',
  blue: '#4d7cff',
  orange: '#ff8a3d',
  red: '#ff5f57',
  yellow: '#ffd166',
},
bg: {
  deep: '#04070b',
  shell: '#0a1017',
  panel: '#101826',
  elevated: '#162235',
}
```

## Typography

Use `Orbitron` for display labels, `Share Tech Mono` for numeric readouts, and a clean UI sans only for supporting text.

- Headers and section labels: uppercase, tight leading, moderate tracking.
- Numeric readouts: large mono, tabular spacing, bright foreground.
- Supporting UI copy: neutral and quieter than telemetry values.

## Do And Avoid

- Do use restrained cyan and green accents to guide attention.
- Do let one or two key signals own the accent color in each module.
- Do keep the UI feeling operational and professional.
- Avoid heavy glow on every edge, number, and divider.
- Avoid rainbow accents or decorative color noise.
- Avoid generic glassmorphism decisions here; leave surface rules to `ui-acrylic-system`.

## Glow System

- Use cyan glow for active telemetry, focus states, and highlighted panel headers.
- Use green glow for healthy or connected states.
- Use orange or red for warnings, limit thresholds, or destructive actions.
- Keep glow narrow and local. It should support hierarchy, not replace it.

## Background Treatment

Use a layered background, not a flat fill. Combine a dark gradient wash, restrained radial light pools, and a subtle technical pattern only when it helps the page.

```css
.neon-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    linear-gradient(rgba(59, 231, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 231, 255, 0.04) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.9), transparent);
}
```

## Usage Rules

1. Apply this skill after the base surface and spacing system is already in place.
2. Use accent color and glow to mark state changes, active modules, and key telemetry.
3. Keep most text neutral so highlighted values actually stand out.

## Usage Example

```jsx
<section className="acrylic-panel relative overflow-hidden rounded-xl px-4 py-3">
  <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 bg-neon-cyan/10 blur-3xl" />

  <p className="font-orbitron text-xs uppercase tracking-[0.28em] text-white/45">
    Live Telemetry
  </p>

  <h2 className="mt-1 font-orbitron text-base font-semibold uppercase tracking-[0.18em] text-neon-cyan">
    Telemetry
  </h2>

  <div className="mt-3 flex items-end justify-between gap-3">
    <div className="font-mono text-4xl text-white">12,500 RPM</div>
    <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-neon-green">
      SYNCED
    </div>
  </div>

  <div className="mt-2 h-px w-full bg-gradient-to-r from-neon-cyan/50 via-white/10 to-transparent" />
</section>
```
