---
name: ui-patterns-speeduino
description: UI pattern guidance for Speeduino screens in this repository, including telemetry cards, settings sections, tuning toolbars, dialogs, and status treatments. Use when building or refining renderer components so screens stay consistent in density, hierarchy, and interaction style.
---

# UI Patterns Speeduino

Use this skill for repeatable screen patterns. Use `ui-acrylic-system` for the shared material layer and tokens.

## Canonical Patterns

1. Telemetry card: compact acrylic panel, one dominant value, one supporting label, optional status chip.
2. Settings section: dense grouped controls, short labels, clear save actions, minimal ornamental spacing.
3. Tuning toolbar: compact strip with table actions, sync state, and connection-sensitive controls.
4. Dialog or overlay: elevated acrylic panel with clear primary action and restrained copy.
5. Status badge: small, high-contrast, semantic color, readable at a glance.

## Layout Rules

1. Let the most important number or control win visually.
2. Keep repeated modules aligned in padding, radius, and header treatment.
3. Use section rails, dividers, and label rhythm to structure dense screens.
4. Preserve scan speed in settings and table-heavy views.

## Interaction Rules

1. Save and burn actions should be obvious and separated when both exist.
2. Connection state should be visible near controls that depend on it.
3. Disabled states should remain readable, not just dimmed into invisibility.
4. Notifications and warnings should use semantic color without turning the full screen into alert chrome.

## Do And Avoid

- Do reuse panel, toolbar, dialog, and badge patterns across features.
- Do keep dense screens feeling deliberate rather than cramped.
- Do bias toward operational clarity over decorative novelty.
- Avoid redesigning the same settings block differently on every page.
- Avoid oversized hero spacing or marketing-card composition in tuning screens.
- Avoid ambiguous action placement for save, sync, and burn flows.
