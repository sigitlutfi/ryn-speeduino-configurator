---
name: speeduino-workflow
description: Repo-specific workflow guidance for implementing Speeduino features, wiring ECU data flows, adding tuning modules, extending routes, and handling project or sync behavior in this application. Use when a task touches store slices, hooks, ECU sync, page constants, tables, or renderer-to-main integration.
---

# Speeduino Workflow

Use this skill for execution flow inside the repo. Use `speeduino-ini` for low-level INI and variable details.

## Task Routing

1. New tuning table: store table state, route entry, feature view, `useTableSync`, save and burn flow.
2. New settings module: metadata lookup, `useTuningModule`, constants update, project save, optional burn.
3. ECU sync issue: inspect command formatting, serial service, response validation, and slice actions that trigger writes.
4. Realtime issue: trace packet parsing, subscription flow, and affected UI consumers.

## Main Paths

1. `src/renderer/core/store/`: slice ownership and cross-slice actions.
2. `src/renderer/shared/hooks/`: feature integration helpers such as tuning hooks.
3. `src/shared/protocol/`: command formatting, parsing, validation.
4. `src/main/` and preload bridge: IPC or hardware-facing changes.

## Working Checklist

1. Identify whether the task changes constants, tables, realtime data, or IPC.
2. Locate the owning slice or hook before editing UI code.
3. Confirm whether the change is RAM-only, burn-to-EEPROM, or readback-related.
4. Preserve project-file behavior when connected and disconnected.
5. Check whether the feature depends on INI metadata or page ownership.

## Common Traps

1. Mixing display values with raw ECU bytes.
2. Updating UI state without updating constants or save flow.
3. Forgetting page ownership when syncing to ECU.
4. Breaking disconnected project workflows while fixing connected ECU behavior.

## Preferred Pattern

1. Change the owning hook or slice first.
2. Keep feature views thin and metadata-driven.
3. Reuse existing table, settings, and notification patterns before inventing new state flow.
