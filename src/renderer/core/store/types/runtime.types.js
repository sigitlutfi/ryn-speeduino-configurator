// Runtime profile state shape definitions

import { DEFAULT_RUNTIME_PROFILE_FIELDS } from "../utils/project.constants.js";
import { nowIso } from "../utils/project.utils.js";

export function createEmptyRuntimeProfileSession(raw = {}) {
  return {
    state: raw.state ?? "Disconnected",
    activeProfile: raw.activeProfile ?? null,
    baseline: raw.baseline ?? {},
    baselineTables: raw.baselineTables ?? {},
    currentValues: raw.currentValues ?? {},
    currentTables: raw.currentTables ?? {},
    history: raw.history ?? [],
    fields: Array.isArray(raw.fields) && raw.fields.length > 0
      ? Array.from(new Set(raw.fields))
      : [...DEFAULT_RUNTIME_PROFILE_FIELDS],
    tables: Array.isArray(raw.tables) && raw.tables.length > 0
      ? Array.from(new Set(raw.tables))
      : [],
    capturedAt: raw.capturedAt ?? null,
    lastResult: raw.lastResult ?? null,
  };
}

export function mergeRuntimeProfileSession(session, patch = {}) {
  const base = createEmptyRuntimeProfileSession(session);
  return createEmptyRuntimeProfileSession({
    ...base,
    ...patch,
    baseline: {
      ...(base.baseline || {}),
      ...(patch.baseline || {}),
    },
    baselineTables: {
      ...(base.baselineTables || {}),
      ...(patch.baselineTables || {}),
    },
    currentValues: {
      ...(base.currentValues || {}),
      ...(patch.currentValues || {}),
    },
    currentTables: {
      ...(base.currentTables || {}),
      ...(patch.currentTables || {}),
    },
    fields: Array.from(
      new Set([...(base.fields || []), ...(patch.fields || [])].filter(Boolean)),
    ),
    tables: Array.from(
      new Set([...(base.tables || []), ...(patch.tables || [])].filter(Boolean)),
    ),
  });
}

export function appendRuntimeProfileHistory(session, entry) {
  const history = [...(session?.history || [])];
  const logEntry = {
    at: nowIso(),
    ...entry,
  };
  history.push(logEntry);

  try {
    console.log("[runtime-profile]", logEntry);
  } catch {}

  return history.slice(-200);
}
