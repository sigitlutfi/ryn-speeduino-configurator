---
name: ui-acrylic-system
description: Design-system guidance for implementing the repo's modern acrylic UI language with restrained blur, compact spacing, restrained neon accents, and dense professional telemetry surfaces. Use when creating or refining shared tokens, utility classes, panel styles, dialogs, forms, or dashboard shells.
---

# UI Acrylic System

Turn the repo's visual direction into reusable implementation rules. Prefer shared tokens and durable utility classes over one-off styling.

## Scope

1. Define shared color, blur, border, and shadow tokens.
2. Create reusable classes such as `acrylic-panel`, `acrylic-elevated`, and `acrylic-strip`.
3. Keep spacing compact enough for tuning UI and telemetry-heavy screens.
4. Use `neon-theming` for the visual language and this skill for turning it into a system.

## Token Priorities

1. Surface colors: deep shell, panel, elevated panel.
2. Material effects: blur strength, saturation, inner highlight, border opacity.
3. Density: panel padding, row height, control gaps, label spacing.
4. Accent usage: cyan and green for active or healthy states, orange and red for warnings.

## Implementation Pattern

1. Prefer CSS variables or Tailwind theme extensions for shared values.
2. Create a small utility layer for acrylic materials before styling individual screens.
3. Keep blur and surface values consistent across cards, dialogs, and toolbars.
4. Use local component variants only after a shared pattern exists.

## Canonical Surfaces

1. `acrylic-panel`: default card or module surface.
2. `acrylic-elevated`: modal, popover, or inspector surface.
3. `acrylic-strip`: header, toolbar, section rail, status row.

## Density Rules

1. Prefer `p-3`, `p-4`, or `px-4 py-3` over oversized padding.
2. Prefer `gap-2` or `gap-3` for dense controls and settings groups.
3. Keep labels close to their values or inputs.
4. Reserve wide whitespace for page framing, not routine module internals.

## Do And Avoid

- Do build consistency from tokens first.
- Do preserve readability in tuning grids, forms, and data cards.
- Do use blur as material, not decoration.
- Avoid generic transparent cards with thin borders only.
- Avoid overusing glow when contrast and blur already carry the hierarchy.
- Avoid mixing multiple spacing scales inside the same module without a reason.
