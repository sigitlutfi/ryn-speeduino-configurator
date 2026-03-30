import { Buffer } from "buffer";
import { parseIni, getVarMetadata } from "../../../shared/ini-parser.js";
import {
  formatReadCommand,
} from "../../../shared/protocol/ecu-commands.js";
import { parsePage } from "../../../shared/protocol/binary-parser.js";
import { serializeValue } from "../../../shared/protocol/binary-serializer.js";
import {
  createPageSnapshot,
  decodePageSnapshot,
  decodePageSnapshots,
  findDirtyRegion,
  isPageSnapshot,
  serializeDecodedPage,
} from "../../../shared/protocol/page-cache.js";
import {
  buildRuntimeFieldWrite,
  readRuntimeFieldFromBuffer,
  resolveRuntimeField,
  runtimeFieldValuesEqual,
} from "../../../shared/protocol/runtime-fields.js";
import {
  RUNTIME_PROFILE_TABLE_DEFS,
  buildRuntimeTableOverlay,
  readRuntimeTableFromDecodedPage,
  resolveRuntimeTable,
  runtimeTablesEqual,
  summarizeRuntimeTableDiff,
} from "../../../shared/protocol/runtime-tables.js";
import { serialService } from "../services/serialService.js";
import { INITIAL_CONNECTION } from "./connectionSlice.js";
import { INITIAL_TABLES } from "./tableSlice.js";

export const SCHEMA_VERSION = 4;

export const DEFAULT_PROJECT_UNITS = {
  temperature: "celsius",
  pressure: "kpa",
  speed: "kmh",
};

export const DEFAULT_RUNTIME_PROFILE_FIELDS = [
  "fuel2Mode",
  "fuel2SwitchVariable",
  "fuel2SwitchValue",
  "spark2Mode",
  "spark2SwitchVariable",
  "spark2SwitchValue",
  "rumbleIdleEnabled",
  "alsEnabled",
  "alsMaxDuration",
];

export const DEFAULT_RUNTIME_PROFILE_GUARDS = {
  max_tps_pct: 5,
  max_rpm: 1500,
  engine_not_cranking: true,
};

const DEFAULT_ACTIVE_PAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

function nowIso() {
  return new Date().toISOString();
}

function createEmptyRuntimeProfileSession(raw = {}) {
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

function mergeRuntimeProfileSession(session, patch = {}) {
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

function evaluateRuntimeProfileGuards(realtime, requirements = {}) {
  const reasons = [];
  const rpm = realtime?.rpm ?? 0;
  const tps = realtime?.tps ?? 0;
  const cranking = !!realtime?.engine?.cranking;

  if (requirements.engine_not_cranking !== false && cranking) {
    reasons.push("Engine is cranking");
  }

  if (
    Number.isFinite(requirements.max_tps_pct) &&
    tps > requirements.max_tps_pct
  ) {
    reasons.push(`TPS ${tps}% exceeds ${requirements.max_tps_pct}%`);
  }

  if (
    Number.isFinite(requirements.max_rpm) &&
    rpm > requirements.max_rpm
  ) {
    reasons.push(`RPM ${rpm} exceeds ${requirements.max_rpm}`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    snapshot: {
      rpm,
      tps,
      cranking,
    },
  };
}

function appendRuntimeProfileHistory(session, entry) {
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

function summarizeExpectedActualTableDiff(expectedTable, actualTable) {
  const expectedValues = Array.from(expectedTable?.rawValues || []);
  const actualValues = Array.from(actualTable?.rawValues || []);
  const expectedRpm = Array.from(expectedTable?.rawRpmAxis || []);
  const actualRpm = Array.from(actualTable?.rawRpmAxis || []);
  const expectedLoad = Array.from(expectedTable?.rawLoadAxis || []);
  const actualLoad = Array.from(actualTable?.rawLoadAxis || []);

  let firstValueMismatch = -1;
  const valueSize = Math.max(expectedValues.length, actualValues.length);
  for (let index = 0; index < valueSize; index += 1) {
    if (expectedValues[index] !== actualValues[index]) {
      firstValueMismatch = index;
      break;
    }
  }

  let firstRpmMismatch = -1;
  const rpmSize = Math.max(expectedRpm.length, actualRpm.length);
  for (let index = 0; index < rpmSize; index += 1) {
    if (expectedRpm[index] !== actualRpm[index]) {
      firstRpmMismatch = index;
      break;
    }
  }

  let firstLoadMismatch = -1;
  const loadSize = Math.max(expectedLoad.length, actualLoad.length);
  for (let index = 0; index < loadSize; index += 1) {
    if (expectedLoad[index] !== actualLoad[index]) {
      firstLoadMismatch = index;
      break;
    }
  }

  return {
    expectedLengths: {
      values: expectedValues.length,
      rpm: expectedRpm.length,
      load: expectedLoad.length,
    },
    actualLengths: {
      values: actualValues.length,
      rpm: actualRpm.length,
      load: actualLoad.length,
    },
    firstValueMismatch,
    firstRpmMismatch,
    firstLoadMismatch,
    expectedAtMismatch:
      firstValueMismatch >= 0 ? expectedValues[firstValueMismatch] : null,
    actualAtMismatch:
      firstValueMismatch >= 0 ? actualValues[firstValueMismatch] : null,
  };
}

function buildDisplayTablesFromDecodedPages(
  parsedIni,
  decodedPages = {},
  baseTables = INITIAL_TABLES,
) {
  const nextTables = { ...INITIAL_TABLES, ...(baseTables || {}) };
  if (!parsedIni || !decodedPages) return nextTables;

  for (const definition of Object.values(RUNTIME_PROFILE_TABLE_DEFS)) {
    try {
      const tableDef = resolveRuntimeTable(parsedIni, definition.key);
      const decodedPage = decodedPages?.[tableDef.page];
      if (!decodedPage) continue;

      const runtimeTable = readRuntimeTableFromDecodedPage(decodedPage, tableDef);
      nextTables[definition.storeKey] = {
        values: runtimeTable.displayValues,
        rpmAxis: runtimeTable.displayRpmAxis,
        loadAxis: runtimeTable.displayLoadAxis,
      };
    } catch (error) {
      console.warn(
        `[project] Failed to build display table '${definition.key}' from ECU data:`,
        error,
      );
    }
  }

  return nextTables;
}

function createEmptyEcuState(raw = {}) {
  const mergedActivePages = Array.from(
    new Set([...(raw.sync?.activePages ?? []), ...DEFAULT_ACTIVE_PAGES]),
  ).sort((a, b) => a - b);

  return {
    signature: raw.signature ?? null,
    product: raw.product ?? null,
    protocol: {
      probe: raw.protocol?.probe ?? null,
      envelope: raw.protocol?.envelope ?? "msEnvelope_1.0",
      baud: raw.protocol?.baud ?? 115200,
    },
    sync: {
      state: raw.sync?.state ?? "needs-initial-sync",
      activePages: mergedActivePages,
      lastConnectedAt: raw.sync?.lastConnectedAt ?? null,
      lastSyncAt: raw.sync?.lastSyncAt ?? null,
    },
  };
}

function matrixFromFlatValues(flatValues = [], rows = 16, cols = 16) {
  const matrix = [];
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    matrix.push(flatValues.slice(rowIndex * cols, (rowIndex + 1) * cols));
  }
  return matrix;
}

function createNeutralRuntimeTablePreset(tableDef, baselineTable = null, fillValue = 100) {
  const totalCells = Math.max(1, (tableDef?.rows || 16) * (tableDef?.cols || 16));
  const rawValues = Array(totalCells).fill(fillValue);

  return {
    key: tableDef.logicalName,
    label: tableDef.label,
    tableId: tableDef.tableId,
    page: tableDef.page,
    xBinsVar: tableDef.xBinsVar,
    yBinsVar: tableDef.yBinsVar,
    zBinsVar: tableDef.zBinsVar,
    rows: tableDef.rows,
    cols: tableDef.cols,
    operation: "fill",
    source: "ve2-base",
    value: fillValue,
    rawValues,
    rawRpmAxis: Array.from(baselineTable?.rawRpmAxis || []),
    rawLoadAxis: Array.from(baselineTable?.rawLoadAxis || []),
    displayValues: matrixFromFlatValues(rawValues, tableDef.rows, tableDef.cols),
    displayRpmAxis: Array.from(baselineTable?.displayRpmAxis || []),
    displayLoadAxis: Array.from(baselineTable?.displayLoadAxis || []),
  };
}

function summarizeAppliedRuntimeTable(table) {
  const rawValues = Array.from(table?.rawValues || []);
  const uniqueValues = Array.from(new Set(rawValues));

  return {
    key: table.key,
    operation: table.operation,
    source: table.source,
    changedCells: table.changedCells ?? rawValues.length,
    axesChanged: !!table.axesChanged,
    summary:
      uniqueValues.length === 1 && rawValues.length > 0
        ? `flat ${uniqueValues[0]}`
        : `${rawValues.length} cells`,
  };
}

function splitLegacyConstants(constants = {}) {
  const decodedPages = {};
  const pageSnapshots = {};

  if (constants?.decodedPages) {
    Object.assign(decodedPages, constants.decodedPages);
  }

  if (constants?.pages) {
    for (const [pageId, value] of Object.entries(constants.pages)) {
      if (isPageSnapshot(value)) {
        pageSnapshots[pageId] = value;
      } else if (value && typeof value === "object") {
        decodedPages[pageId] = value;
      }
    }
  }

  for (const [key, value] of Object.entries(constants || {})) {
    if (key === "pages" || key === "decodedPages") continue;
    if (!Number.isNaN(Number(key)) && value && typeof value === "object") {
      decodedPages[key] = value;
    }
  }

  return { decodedPages, pageSnapshots };
}

function deriveProjectSyncState(constants, activePages = DEFAULT_ACTIVE_PAGES) {
  const pageSnapshots = constants?.pages || {};
  if (!Object.keys(pageSnapshots).length) return "needs-initial-sync";

  let verified = 0;
  let relevant = 0;

  for (const pageId of activePages) {
    const snapshot = pageSnapshots[pageId] || pageSnapshots[String(pageId)];
    if (!snapshot) continue;
    relevant += 1;
    if (snapshot.syncState === "verified") verified += 1;
  }

  if (relevant === 0) return "needs-initial-sync";
  if (verified === relevant) return "fully-verified";
  return "partially-synced";
}

function createDefaultRuntimeProfilePreset(parsedIni, decodedPages, name, fillValue = 100) {
  const preset = {
    name,
    tablePresets: {},
    options: {
      fuel2Mode: 1,
    },
  };

  if (!parsedIni) return preset;

  try {
    const ve2Def = resolveRuntimeTable(parsedIni, "ve2");
    const ve2DecodedPage =
      decodedPages?.[ve2Def.page] || decodedPages?.[String(ve2Def.page)];
    const ve2BaseTable = ve2DecodedPage
      ? readRuntimeTableFromDecodedPage(ve2DecodedPage, ve2Def)
      : null;

    preset.tablePresets.ve2 = buildRuntimeTableOverlay(
      null,
      ve2Def,
      { target: "ve2", operation: "fill", value: fillValue },
      ve2BaseTable,
    );

    if (!preset.tablePresets.ve2?.rawValues?.length) {
      preset.tablePresets.ve2 = createNeutralRuntimeTablePreset(
        ve2Def,
        ve2BaseTable,
        fillValue,
      );
    }

    const afr1Def = resolveRuntimeTable(parsedIni, "afr1");
    const afr1DecodedPage =
      decodedPages?.[afr1Def.page] || decodedPages?.[String(afr1Def.page)];
    const afr1BaseTable = afr1DecodedPage
      ? readRuntimeTableFromDecodedPage(afr1DecodedPage, afr1Def)
      : null;

    preset.tablePresets.afr1 = buildRuntimeTableOverlay(
      null,
      afr1Def,
      { target: "afr1", operation: "fill", value: 14.7 },
      afr1BaseTable,
    );
  } catch (error) {
    console.warn(`[project] Failed to seed runtime profile preset '${name}':`, error);
    if (parsedIni) {
      try {
        const ve2Def = resolveRuntimeTable(parsedIni, "ve2");
        const decodedPage =
          decodedPages?.[ve2Def.page] || decodedPages?.[String(ve2Def.page)];
        const baseTable = decodedPage
          ? readRuntimeTableFromDecodedPage(decodedPage, ve2Def)
          : null;
        preset.tablePresets.ve2 = createNeutralRuntimeTablePreset(
          ve2Def,
          baseTable,
          fillValue,
        );
      } catch (fallbackError) {
        console.warn(
          `[project] Failed to create neutral runtime profile preset '${name}':`,
          fallbackError,
        );
      }
    }
  }

  return preset;
}

function normalizeRuntimeProfiles(rawRuntimeProfiles = {}, parsedIni = null, decodedPages = {}) {
  const defaults = {
    eco: createDefaultRuntimeProfilePreset(parsedIni, decodedPages, "ECO", 100),
    racing: createDefaultRuntimeProfilePreset(parsedIni, decodedPages, "RACING", 100),
    extreme: createDefaultRuntimeProfilePreset(parsedIni, decodedPages, "EXTREME", 100),
  };

  const withFallbackTablePreset = (profileKey) => {
    const rawPreset = rawRuntimeProfiles?.[profileKey] || {};
    const merged = {
      ...defaults[profileKey],
      ...rawPreset,
      tablePresets: {
        ...(defaults[profileKey]?.tablePresets || {}),
        ...(rawPreset?.tablePresets || {}),
      },
      options: {
        ...(defaults[profileKey]?.options || {}),
        ...(rawPreset?.options || {}),
      },
    };

    if (!merged.tablePresets?.ve2 && defaults[profileKey]?.tablePresets?.ve2) {
      merged.tablePresets = {
        ...(merged.tablePresets || {}),
        ve2: defaults[profileKey].tablePresets.ve2,
      };
    }

    return merged;
  };

  return {
    eco: withFallbackTablePreset("eco"),
    racing: withFallbackTablePreset("racing"),
    extreme: withFallbackTablePreset("extreme"),
  };
}

function ensureProjectRuntimeProfiles(project, parsedIniOverride = null) {
  if (!project) return project;

  const parsedIni = parsedIniOverride || parseIniFromProject(project);
  const decodedPages = project.constants?.decodedPages || {};

  return {
    ...project,
    runtimeProfiles: normalizeRuntimeProfiles(
      project.runtimeProfiles,
      parsedIni,
      decodedPages,
    ),
  };
}

function parseIniFromProject(project) {
  const iniContent = project?.ini?.content;
  if (!iniContent) return null;

  try {
    const symbols = {
      CELSIUS: project?.units?.temperature === "celsius",
      FAHRENHEIT: project?.units?.temperature === "fahrenheit",
    };
    return parseIni(iniContent, symbols);
  } catch (error) {
    console.warn("[project] Failed to parse embedded INI for runtime profile defaults:", error);
    return null;
  }
}

function normalizeProjectV3(raw, parsedIni = null) {
  if (!raw) return null;

  const migratedAt = nowIso();
  const { decodedPages: legacyDecodedPages, pageSnapshots } = splitLegacyConstants(
    raw.constants || {},
  );

  let decodedPages = { ...legacyDecodedPages };
  if (parsedIni && Object.keys(pageSnapshots).length > 0) {
    decodedPages = {
      ...decodedPages,
      ...decodePageSnapshots(parsedIni, pageSnapshots),
    };
  }

  if (parsedIni) {
    for (const [pageId, decodedPage] of Object.entries(decodedPages)) {
      if (pageSnapshots[pageId]) continue;
      const pageBuffer = serializeDecodedPage(parsedIni, Number(pageId), decodedPage);
      if (pageBuffer.length > 0) {
        pageSnapshots[pageId] = createPageSnapshot({
          pageId: Number(pageId),
          size: pageBuffer.length,
          buffer: pageBuffer,
          source: "generated",
          syncState: "unknown",
        });
      }
    }
  }

  const ecu = createEmptyEcuState(raw.ecu || {});
  ecu.sync.state = deriveProjectSyncState(
    { pages: pageSnapshots },
    ecu.sync.activePages,
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    projectName: raw.projectName || raw.name || "Unnamed Project",
    description: raw.description ?? "",
    engine: {
      displacement: null,
      cylinders: null,
      type: null,
      ...(raw.engine ?? {}),
    },
    ini: {
      path: raw.ini?.path ?? raw.iniPath ?? "",
      signature: raw.ini?.signature ?? "",
      version: raw.ini?.version ?? "",
      content: raw.ini?.content ?? null,
    },
    ecu,
    units: { ...DEFAULT_PROJECT_UNITS, ...(raw.units ?? {}) },
    constants: {
      pages: pageSnapshots,
      decodedPages,
    },
    runtimeProfiles: normalizeRuntimeProfiles(
      raw.runtimeProfiles,
      parsedIni,
      decodedPages,
    ),
    tables: raw.tables ?? null,
    ui: {
      accentColor: raw.ui?.accentColor ?? raw.color ?? "cyan",
    },
    createdAt: raw.createdAt ?? raw.created ?? migratedAt,
    updatedAt: raw.updatedAt ?? migratedAt,
    filePath: raw.filePath ?? "",
  };
}

function serializeProjectForSave(project, tables) {
  const normalizedProject = ensureProjectRuntimeProfiles(project);

  return {
    ...normalizedProject,
    constants: {
      pages: normalizedProject.constants?.pages || {},
    },
    runtimeProfiles: normalizedProject.runtimeProfiles || {},
    tables,
    updatedAt: nowIso(),
  };
}

function getDecodedPages(constants) {
  return constants?.decodedPages || {};
}

function readRuntimeFieldFromProjectPages(currentProject, field) {
  const decodedPages = getDecodedPages(currentProject?.constants);
  const decodedPage = decodedPages?.[field.page] || decodedPages?.[String(field.page)];

  if (!decodedPage) {
    throw new Error(`Project page ${field.page} is unavailable`);
  }

  if (decodedPage[field.name] !== undefined) return decodedPage[field.name];
  if (decodedPage[field.key] !== undefined) return decodedPage[field.key];

  throw new Error(`Project field '${field.name || field.key}' is unavailable`);
}

function getActiveProjectPages(currentProject) {
  const decodedPages = getDecodedPages(currentProject?.constants);
  return Object.keys(decodedPages).map(Number).filter((value) => !Number.isNaN(value));
}

function getPendingBurnPages(currentProject) {
  const pageSnapshots = currentProject?.constants?.pages || {};
  return Object.entries(pageSnapshots)
    .filter(([, snapshot]) => snapshot?.syncState === "burn-pending")
    .map(([pageId]) => Number(pageId))
    .filter((value) => !Number.isNaN(value));
}

function updatePageSnapshotStates(currentProject, updates) {
  const existingPages = currentProject?.constants?.pages || {};
  const nextPages = { ...existingPages };

  for (const [pageId, patch] of Object.entries(updates || {})) {
    const existing = existingPages[pageId] || existingPages[String(pageId)] || {};
    nextPages[pageId] = { ...existing, ...patch };
  }

  return nextPages;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function migrateProject(raw) {
  return normalizeProjectV3(raw);
}

export const createProjectSlice = (set, get) => ({
  currentProject: null,
  parsedIni: null,
  recentProjects: [],
  runtimeProfileSession: createEmptyRuntimeProfileSession(),

  setProject: async (raw) => {
    try {
      let project = normalizeProjectV3(raw);
      if (!project) return;

      const symbols = {
        CELSIUS: project.units?.temperature === "celsius",
        FAHRENHEIT: project.units?.temperature === "fahrenheit",
      };

      let parsedIni = null;
      let iniContent = project.ini.content;

      if (iniContent) {
        console.log("[project] Loading from embedded INI content");
        try {
          parsedIni = parseIni(iniContent, symbols);
        } catch (e) {
          console.warn("[project] Failed to parse embedded INI, falling back to path.", e);
          iniContent = null;
        }
      }

      if (!parsedIni && project.ini.path) {
        console.log("[project] Fetching INI from disk:", project.ini.path);
        try {
          const diskContent = await window.projects.loadIni(project.ini.path);
          if (typeof diskContent === "string") {
            iniContent = diskContent;
            parsedIni = parseIni(iniContent, symbols);
            project.ini.content = iniContent;
          }
        } catch (e) {
          console.error("[project] INI on disk unavailable:", e);
        }
      }

      if (parsedIni) {
        project = normalizeProjectV3(project, parsedIni);
        if (parsedIni.info.signature) project.ini.signature = parsedIni.info.signature;
        if (parsedIni.info.mtVersion) project.ini.version = parsedIni.info.mtVersion;
      }

      project = ensureProjectRuntimeProfiles(project, parsedIni);

      const hydratedTables =
        project.tables &&
        Object.keys(project.tables).length > 0
          ? { ...INITIAL_TABLES, ...project.tables }
          : buildDisplayTablesFromDecodedPages(
              parsedIni,
              project.constants?.decodedPages,
              INITIAL_TABLES,
            );

      set({ tables: hydratedTables });
      project.tables = hydratedTables;

      const recent = await window.projects.addRecent(project);
      set({
        currentProject: project,
        parsedIni,
        recentProjects: recent,
        runtimeProfileSession: createEmptyRuntimeProfileSession({
          state: "Disconnected",
        }),
      });
    } catch (err) {
      console.error("[project] setProject failed:", err);
    }
  },

  saveProject: async () => {
    try {
      const { currentProject, tables } = get();
      console.log("[project] Attempting to save:", currentProject?.filePath);

      if (!currentProject) {
        console.error("[project] Save failed: No active project");
        return { ok: false, error: "No active project" };
      }

      if (!currentProject.filePath) return await get().saveProjectAs();

      const projectData = serializeProjectForSave(currentProject, tables);

      console.log("[project] Data prepared, sending to main process...");
      const result = await window.projects.saveFile(
        currentProject.filePath,
        projectData,
      );

      if (result?.error) {
        console.error("[project] Main process returned error:", result.error);
        throw new Error(result.error);
      }

      console.log("[project] Save successful!");
      const normalizedSavedProject = ensureProjectRuntimeProfiles(projectData);
      const recent = await window.projects.addRecent(normalizedSavedProject);
      set((s) => ({
        currentProject: {
          ...normalizedSavedProject,
          constants: {
            ...(normalizedSavedProject.constants || {}),
            decodedPages: s.currentProject?.constants?.decodedPages || {},
          },
        },
        recentProjects: recent,
      }));

      return { ok: true };
    } catch (err) {
      console.error("[project] saveProject failed:", err);
      return { ok: false, error: err.message };
    }
  },

  saveProjectAs: async () => {
    try {
      const { currentProject, tables } = get();
      const name = currentProject?.projectName || "New Project";
      console.log("[project] Opening pickSave dialog for:", name);

      const filePath = await window.projects.pickSave(name);
      if (!filePath) {
        console.log("[project] Save As cancelled by user");
        return { ok: false, error: "Save cancelled" };
      }

      const newProject = ensureProjectRuntimeProfiles({
        ...(currentProject || {}),
        filePath,
        updatedAt: nowIso(),
      });

      console.log("[project] Saving new file to:", filePath);
      const savePayload = serializeProjectForSave(newProject, tables);
      const result = await window.projects.saveFile(filePath, savePayload);

      if (result?.error) {
        console.error("[project] saveFile as returned error:", result.error);
        throw new Error(result.error);
      }

      console.log("[project] Save As successful!");
      const recent = await window.projects.addRecent(savePayload);
      set({
        currentProject: ensureProjectRuntimeProfiles(newProject),
        recentProjects: recent,
      });
      return { ok: true };
    } catch (err) {
      console.error("[project] saveProjectAs failed:", err);
      return { ok: false, error: err.message };
    }
  },

  closeProject: async () => {
    try {
      await window.serial.disconnect();
    } catch (error) {
      console.warn("[project] closeProject disconnect failed:", error);
    }

    set({
      currentProject: null,
      parsedIni: null,
      connection: { ...INITIAL_CONNECTION },
      tables: INITIAL_TABLES,
      runtimeProfileSession: createEmptyRuntimeProfileSession(),
    });

    return { ok: true };
  },

  removeRecentProject: async (filePath) => {
    try {
      const recent = await window.projects.removeRecent(filePath);
      set({ recentProjects: recent });
      return { ok: true };
    } catch (err) {
      console.error("[project] removeRecentProject failed:", err);
      return { ok: false, error: err.message };
    }
  },

  updateProjectField: (path, value) => {
    set((s) => {
      if (!s.currentProject) return {};
      const proj = { ...s.currentProject };
      const parts = path.split(".");
      if (parts.length === 1) {
        proj[parts[0]] = value;
      } else {
        proj[parts[0]] = { ...(proj[parts[0]] ?? {}), [parts[1]]: value };
      }
      return { currentProject: proj };
    });
  },

  updateRuntimeProfilePreset: (profileKey, patch = {}) => {
    set((s) => {
      if (!s.currentProject) return {};

      const existingProfiles = s.currentProject.runtimeProfiles || {};
      const existingPreset = existingProfiles[profileKey] || {};
      const nextProject = ensureProjectRuntimeProfiles({
        ...s.currentProject,
        runtimeProfiles: {
          ...existingProfiles,
          [profileKey]: {
            ...existingPreset,
            ...patch,
            tablePresets: {
              ...(existingPreset.tablePresets || {}),
              ...(patch.tablePresets || {}),
            },
            options: {
              ...(existingPreset.options || {}),
              ...(patch.options || {}),
            },
          },
        },
      });

      return {
        currentProject: nextProject,
      };
    });
  },

  updateECUConnectionInfo: (info = {}) => {
    set((s) => {
      if (!s.currentProject) return {};
      return {
        currentProject: {
          ...s.currentProject,
          ecu: {
            ...s.currentProject.ecu,
            signature: info.signature ?? s.currentProject.ecu.signature,
            product: info.product ?? s.currentProject.ecu.product,
            protocol: {
              ...s.currentProject.ecu.protocol,
              probe: info.probe ?? s.currentProject.ecu.protocol.probe,
              baud: info.baud ?? s.currentProject.ecu.protocol.baud,
            },
            sync: {
              ...s.currentProject.ecu.sync,
              lastConnectedAt: nowIso(),
            },
          },
        },
      };
    });
  },

  updateConstants: async (newConstants) => {
    const { parsedIni } = get();

    set((s) => {
      if (!s.currentProject) return {};

      const currentConstants = s.currentProject.constants || {};
      const currentDecodedPages = getDecodedPages(currentConstants);
      const currentRawPages = currentConstants.pages || {};

      const decodedUpdates = {};
      const rawUpdates = {};

      for (const [key, value] of Object.entries(newConstants || {})) {
        if (key === "pages" && value && typeof value === "object") {
          for (const [pageId, pageValue] of Object.entries(value)) {
            if (isPageSnapshot(pageValue)) rawUpdates[pageId] = pageValue;
            else {
              decodedUpdates[pageId] = {
                ...(currentDecodedPages[pageId] || {}),
                ...pageValue,
              };
            }
          }
        } else if (!Number.isNaN(Number(key)) && value && typeof value === "object") {
          decodedUpdates[key] = {
            ...(currentDecodedPages[key] || {}),
            ...value,
          };
        }
      }

      const nextDecodedPages = {
        ...currentDecodedPages,
        ...decodedUpdates,
      };

      const generatedRawPages = { ...currentRawPages };
      if (parsedIni) {
        for (const [pageId, decodedPage] of Object.entries(decodedUpdates)) {
          const pageBuffer = serializeDecodedPage(parsedIni, Number(pageId), decodedPage);
          if (pageBuffer.length > 0) {
            const previous = currentRawPages[pageId];
            generatedRawPages[pageId] = createPageSnapshot({
              pageId: Number(pageId),
              size: pageBuffer.length,
              buffer: pageBuffer,
              source: previous?.source || "generated",
              syncState: "dirty-local",
              lastReadAt: previous?.lastReadAt || null,
              lastVerifiedAt: previous?.lastVerifiedAt || null,
            });
          }
        }
      }

      const nextConstants = {
        pages: {
          ...generatedRawPages,
          ...rawUpdates,
        },
        decodedPages: nextDecodedPages,
      };

      return {
        currentProject: {
          ...s.currentProject,
          ecu: {
            ...s.currentProject.ecu,
            sync: {
              ...s.currentProject.ecu.sync,
              state: deriveProjectSyncState(
                nextConstants,
                s.currentProject.ecu.sync.activePages,
              ),
            },
          },
          constants: nextConstants,
        },
      };
    });
  },

  syncPagesToECU: async (pageIds = [], options = {}) => {
    const {
      connection,
      currentProject,
      notify,
      readPageFromECU,
      burnPage,
      setOperation,
      updateOperation,
      clearOperation,
    } = get();
    if (connection.status !== "connected") {
      return { ok: false, error: "Not connected" };
    }

    const targetPages = (pageIds?.length ? pageIds : getActiveProjectPages(currentProject))
      .map(Number)
      .filter((value) => !Number.isNaN(value));

    const results = { ok: true, pages: {}, errors: [] };

    serialService.suspendOutputChannelsPolling();
    try {
      setOperation({
        type: options.burn ? "upload" : "write",
        stage: "read",
        label: options.burn ? "Preparing ECU upload" : "Preparing RAM sync",
        current: 0,
        total: targetPages.length,
        scope: "sync",
      });

      for (let index = 0; index < targetPages.length; index += 1) {
        const pageId = targetPages[index];
        try {
          const localSnapshot =
            currentProject?.constants?.pages?.[pageId] ||
            currentProject?.constants?.pages?.[String(pageId)];
          if (!localSnapshot) {
            results.ok = false;
            results.errors.push({ pageId, error: "Missing local snapshot" });
            updateOperation({
              stage: "error",
              label: `Missing local snapshot for page ${pageId}`,
              current: index + 1,
              total: targetPages.length,
            });
            continue;
          }

          updateOperation({
            stage: "read",
            label: `Reading ECU page ${pageId}`,
            current: index,
            total: targetPages.length,
          });

          set((s) => {
            if (!s.currentProject) return {};
            const nextPages = updatePageSnapshotStates(s.currentProject, {
              [pageId]: { syncState: "write-pending" },
            });
            return {
              currentProject: {
                ...s.currentProject,
                constants: {
                  ...(s.currentProject.constants || {}),
                  pages: nextPages,
                },
              },
            };
          });

          const ecuPage = await readPageFromECU(pageId);
          const localBuffer = decodePageSnapshot(localSnapshot);
          const dirtyRegion = findDirtyRegion(ecuPage.buffer, localBuffer);

          if (dirtyRegion) {
            updateOperation({
              stage: "write",
              label: `Writing page ${pageId}`,
              current: index,
              total: targetPages.length,
            });
            await serialService.writePage(
              pageId,
              dirtyRegion.offset,
              dirtyRegion.length,
              Array.from(dirtyRegion.after),
            );
            await delay(options.writeSettleMs ?? 1200);
          }

          if (options.burn) {
            updateOperation({
              stage: "burn",
              label: `Burning page ${pageId}`,
              current: index,
              total: targetPages.length,
            });
            const burnResult = await burnPage(pageId);
            if (!burnResult.ok) {
              results.ok = false;
              results.errors.push({ pageId, error: burnResult.error || "Burn failed" });
              updateOperation({
                stage: "error",
                label: `Burn failed on page ${pageId}`,
                current: index + 1,
                total: targetPages.length,
              });
              continue;
            }
            results.pages[pageId] = { dirtyRegion, verified: true, burned: true };
          } else {
            updateOperation({
              stage: "verify",
              label: `Verifying page ${pageId}`,
              current: index,
              total: targetPages.length,
            });
            const verifyPage = await readPageFromECU(pageId);
            const verified =
              Buffer.compare(Buffer.from(verifyPage.buffer), Buffer.from(localBuffer)) === 0;

            const verifiedAt = nowIso();
            set((s) => {
              if (!s.currentProject) return {};
              const nextPages = updatePageSnapshotStates(s.currentProject, {
                [pageId]: {
                  syncState: verified ? "burn-pending" : "different",
                  crc32: verified ? localSnapshot.crc32 : s.currentProject.constants?.pages?.[pageId]?.crc32,
                  lastReadAt: verifiedAt,
                  lastVerifiedAt: verifiedAt,
                },
              });
              return {
                currentProject: {
                  ...s.currentProject,
                  ecu: {
                    ...s.currentProject.ecu,
                    sync: {
                      ...s.currentProject.ecu.sync,
                      state: deriveProjectSyncState(
                        { pages: nextPages },
                        s.currentProject.ecu.sync.activePages,
                      ),
                    },
                  },
                  constants: {
                    ...(s.currentProject.constants || {}),
                    pages: nextPages,
                    decodedPages: {
                      ...(s.currentProject.constants?.decodedPages || {}),
                      [pageId]: verifyPage.decoded,
                    },
                  },
                },
              };
            });

            if (!verified) {
              results.ok = false;
              results.errors.push({ pageId, error: "RAM verify mismatch" });
              updateOperation({
                stage: "error",
                label: `Verify mismatch on page ${pageId}`,
                current: index + 1,
                total: targetPages.length,
              });
            }
            results.pages[pageId] = { dirtyRegion, verified, burned: false, syncState: verified ? "burn-pending" : "different" };
          }
        } catch (error) {
          results.ok = false;
          results.errors.push({ pageId, error: error.message });
          updateOperation({
            stage: "error",
            label: `Failed on page ${pageId}`,
            current: index + 1,
            total: targetPages.length,
          });
        }

        updateOperation({
          current: index + 1,
          total: targetPages.length,
        });
      }
    } finally {
      serialService.resumeOutputChannelsPolling();
      clearOperation();
    }

    if (results.errors.length > 0) {
      notify(`ECU sync completed with ${results.errors.length} issue(s)`, "warning");
    }

    return results;
  },

  writePagesToRAM: async (pageIds = []) => {
    return get().syncPagesToECU(pageIds, { burn: false });
  },

  syncConstantToECU: async (name, value) => {
    const { parsedIni, connection } = get();
    if (connection.status !== "connected" || !parsedIni) return;

    const meta = getVarMetadata(parsedIni, name);
    if (!meta) return;

    try {
      await serialService.writePage(
        meta.page,
        meta.offset,
        meta.meta.length || 1,
        value,
        meta.meta.dataType,
      );
      set((s) => {
        if (!s.currentProject) return {};
        const nextPages = updatePageSnapshotStates(s.currentProject, {
          [meta.page]: {
            syncState: "write-pending",
          },
        });
        return {
          currentProject: {
            ...s.currentProject,
            ecu: {
              ...s.currentProject.ecu,
              sync: {
                ...s.currentProject.ecu.sync,
                state: deriveProjectSyncState(
                  { pages: nextPages },
                  s.currentProject.ecu.sync.activePages,
                ),
              },
            },
            constants: {
              ...(s.currentProject.constants || {}),
              pages: nextPages,
            },
          },
        };
      });
      console.log(`[ECU] Synced ${name} to Page ${meta.page}, Offset ${meta.offset}`);
    } catch (e) {
      console.error(`[ECU] Sync failed for ${name}:`, e);
    }
  },

  readRuntimeField: async (fieldName) => {
    const { parsedIni, connection, readPageFromECU } = get();
    if (connection.status !== "connected") {
      throw new Error("Not connected");
    }
    if (!parsedIni) {
      throw new Error("No INI loaded");
    }

    const field = resolveRuntimeField(parsedIni, fieldName);

    serialService.suspendOutputChannelsPolling();
    try {
      const page = await readPageFromECU(field.page);
      return {
        field,
        value: readRuntimeFieldFromBuffer(page.buffer, field),
        pageBuffer: page.buffer,
      };
    } finally {
      serialService.resumeOutputChannelsPolling();
    }
  },

  writeRuntimeField: async (fieldName, nextValue, options = {}) => {
    const { parsedIni, connection, readPageFromECU } = get();
    if (connection.status !== "connected") {
      throw new Error("Not connected");
    }
    if (!parsedIni) {
      throw new Error("No INI loaded");
    }

    const field = resolveRuntimeField(parsedIni, fieldName);

    serialService.suspendOutputChannelsPolling();
    try {
      const page = options.pageBuffer
        ? { buffer: Buffer.from(options.pageBuffer) }
        : await readPageFromECU(field.page);
      const currentValue = readRuntimeFieldFromBuffer(page.buffer, field);
      const write = buildRuntimeFieldWrite(page.buffer, field, nextValue);

      if (!write.changed) {
        return {
          field,
          changed: false,
          currentValue,
          writtenValue: nextValue,
        };
      }

      await serialService.writePage(
        field.page,
        write.offset,
        write.length,
        Array.from(write.after),
      );

      return {
        field,
        changed: true,
        currentValue,
        writtenValue: nextValue,
        write,
      };
    } finally {
      serialService.resumeOutputChannelsPolling();
    }
  },

  verifyRuntimeField: async (fieldName, expectedValue) => {
    const result = await get().readRuntimeField(fieldName);
    return {
      ...result,
      expectedValue,
      matches: runtimeFieldValuesEqual(result.value, expectedValue),
    };
  },

  readRuntimeTable: async (tableName, options = {}) => {
    const { parsedIni, connection, currentProject, readPageFromECU } = get();
    const source = options.source || "ecu";

    if (!parsedIni) {
      throw new Error("No INI loaded");
    }

    const tableDef = resolveRuntimeTable(parsedIni, tableName);

    if (source === "project") {
      const decodedPages = getDecodedPages(currentProject?.constants);
      const decodedPage =
        decodedPages?.[tableDef.page] || decodedPages?.[String(tableDef.page)];

      if (!decodedPage) {
        throw new Error(`Project page ${tableDef.page} is unavailable`);
      }

      return {
        table: tableDef,
        ...readRuntimeTableFromDecodedPage(decodedPage, tableDef),
      };
    }

    if (connection.status !== "connected") {
      throw new Error("Not connected");
    }

    serialService.suspendOutputChannelsPolling();
    try {
      const page = await readPageFromECU(tableDef.page);
      return {
        table: tableDef,
        ...readRuntimeTableFromDecodedPage(page.decoded, tableDef),
        pageBuffer: page.buffer,
      };
    } finally {
      serialService.resumeOutputChannelsPolling();
    }
  },

  writeRuntimeTable: async (tableName, nextTable, options = {}) => {
    const { parsedIni, connection, readPageFromECU } = get();
    if (connection.status !== "connected") {
      throw new Error("Not connected");
    }
    if (!parsedIni) {
      throw new Error("No INI loaded");
    }

    const tableDef = resolveRuntimeTable(parsedIni, tableName);
    if (!nextTable) {
      throw new Error(`No runtime table payload provided for '${tableName}'`);
    }

    serialService.suspendOutputChannelsPolling();
    try {
      const ecuPage = await readPageFromECU(tableDef.page);
      const nextBuffer = Buffer.from(ecuPage.buffer);
      const patchTargets = [
        {
          varName: tableDef.xBinsVar,
          values: Array.from(nextTable.rawRpmAxis || []),
        },
        {
          varName: tableDef.yBinsVar,
          values: Array.from(nextTable.rawLoadAxis || []),
        },
        {
          varName: tableDef.zBinsVar,
          values: Array.from(nextTable.rawValues || []),
        },
      ].filter((target) => target.varName);

      for (const target of patchTargets) {
        const meta = getVarMetadata(parsedIni, target.varName);
        if (!meta) {
          throw new Error(
            `Missing INI metadata for runtime table variable '${target.varName}'`,
          );
        }

        serializeValue(nextBuffer, meta.offset, target.values, meta);
      }

      const dirtyRegion = findDirtyRegion(ecuPage.buffer, nextBuffer);

      if (dirtyRegion) {
        const maxChunkLength = options.maxChunkLength ?? 32;
        for (
          let chunkOffset = 0;
          chunkOffset < dirtyRegion.length;
          chunkOffset += maxChunkLength
        ) {
          const chunkLength = Math.min(maxChunkLength, dirtyRegion.length - chunkOffset);
          const chunkData = dirtyRegion.after.slice(chunkOffset, chunkOffset + chunkLength);

          await serialService.writePage(
            tableDef.page,
            dirtyRegion.offset + chunkOffset,
            chunkLength,
            Array.from(chunkData),
          );
          await delay(options.chunkSettleMs ?? 8);
        }

        await delay(options.writeSettleMs ?? 40);
      }

      return {
        table: tableDef,
        dirtyRegion,
        buffer: nextBuffer,
      };
    } finally {
      serialService.resumeOutputChannelsPolling();
    }
  },

  verifyRuntimeTable: async (tableName, expectedTable) => {
    const result = await get().readRuntimeTable(tableName);
    return {
      ...result,
      expectedTable,
      matches: runtimeTablesEqual(result, expectedTable),
    };
  },

  clearRuntimeProfileSession: (overrides = {}) => {
    set({
      runtimeProfileSession: createEmptyRuntimeProfileSession(overrides),
    });
  },

  exportRuntimeProfileLog: () => {
    const { runtimeProfileSession } = get();
    const history = runtimeProfileSession?.history || [];

    return history
      .map((entry) => {
        const details = Object.entries(entry)
          .filter(([key]) => key !== "at")
          .map(([key, value]) => {
            if (value && typeof value === "object") {
              return `${key}=${JSON.stringify(value)}`;
            }
            return `${key}=${value}`;
          })
          .join(" ");

        return `[${entry.at}] ${details}`.trim();
      })
      .join("\n");
  },

  getRuntimeProfileGuardStatus: (requirements = {}) => {
    const { realtime, connection } = get();
    const mergedRequirements = {
      ...DEFAULT_RUNTIME_PROFILE_GUARDS,
      ...requirements,
    };

    return {
      connected: connection.status === "connected",
      ...evaluateRuntimeProfileGuards(realtime, mergedRequirements),
      requirements: mergedRequirements,
    };
  },

  captureRuntimeProfileTableBaseline: async (tableNames = []) => {
    const {
      parsedIni,
      readRuntimeTable,
      runtimeProfileSession,
      currentProject,
    } = get();

    if (!parsedIni) {
      throw new Error("No INI loaded");
    }
    if (!currentProject?.constants) {
      throw new Error("No project base is available");
    }

    const targetTables = Array.from(new Set((tableNames || []).filter(Boolean)));
    if (!targetTables.length) {
      throw new Error("No runtime profile tables selected");
    }

    const baselineTables = {};
    const currentTables = {};
    const missing = [];

    for (const tableName of targetTables) {
      try {
        const result = await readRuntimeTable(tableName, { source: "project" });
        baselineTables[tableName] = result;
        currentTables[tableName] = result;
      } catch (error) {
        missing.push({
          table: tableName,
          error: error.message,
        });
      }
    }

    if (missing.length > 0) {
      const failedAt = nowIso();
      const nextSession = mergeRuntimeProfileSession(runtimeProfileSession, {
        state: "Unknown",
        tables: targetTables,
        history: appendRuntimeProfileHistory(runtimeProfileSession, {
          type: "table-baseline-capture-failed",
          missing,
        }),
        lastResult: {
          ok: false,
          type: "table-baseline-capture",
          missing,
          capturedAt: failedAt,
        },
      });
      set({ runtimeProfileSession: nextSession });
      throw new Error(`Table baseline capture failed for ${missing.length} runtime table(s)`);
    }

    const capturedAt = nowIso();
    const nextSession = mergeRuntimeProfileSession(runtimeProfileSession, {
      state: "Base",
      activeProfile: null,
      baselineTables,
      currentTables,
      tables: targetTables,
      capturedAt,
      history: appendRuntimeProfileHistory(runtimeProfileSession, {
        type: "table-baseline-captured",
        tables: targetTables,
        source: "project",
      }),
      lastResult: {
        ok: true,
        type: "table-baseline-capture",
        tableCount: targetTables.length,
        capturedAt,
        source: "project",
      },
    });

    set({ runtimeProfileSession: nextSession });
    return nextSession;
  },

  captureRuntimeProfileBaseline: async (fields = DEFAULT_RUNTIME_PROFILE_FIELDS) => {
    const {
      parsedIni,
      runtimeProfileSession,
      currentProject,
    } = get();

    if (!parsedIni) {
      throw new Error("No INI loaded");
    }
    if (!currentProject?.constants) {
      throw new Error("No project base is available");
    }

    const targetFields = Array.from(new Set((fields || []).filter(Boolean)));
    if (!targetFields.length) {
      throw new Error("No runtime profile fields selected");
    }

    const baseline = {};
    const currentValues = {};
    const missing = [];

    for (const fieldName of targetFields) {
      try {
        const field = resolveRuntimeField(parsedIni, fieldName);
        const value = readRuntimeFieldFromProjectPages(currentProject, field);
        baseline[fieldName] = {
          page: field.page,
          offset: field.offset,
          length: field.length,
          value,
        };
        currentValues[fieldName] = value;
      } catch (error) {
        missing.push({
          field: fieldName,
          error: error.message,
        });
      }
    }

    if (missing.length > 0) {
      const nextSession = mergeRuntimeProfileSession(runtimeProfileSession, {
        state: "Unknown",
        fields: targetFields,
        history: appendRuntimeProfileHistory(runtimeProfileSession, {
          type: "baseline-capture-failed",
          missing,
        }),
        lastResult: {
          ok: false,
          type: "baseline-capture",
          missing,
          capturedAt: nowIso(),
        },
      });
      set({ runtimeProfileSession: nextSession });
      throw new Error(`Baseline capture failed for ${missing.length} runtime field(s)`);
    }

    const capturedAt = nowIso();
    const nextSession = mergeRuntimeProfileSession(runtimeProfileSession, {
      state: "Base",
      activeProfile: null,
      baseline,
      currentValues,
      history: appendRuntimeProfileHistory(runtimeProfileSession, {
        type: "baseline-captured",
        fields: targetFields,
        source: "project",
      }),
      fields: targetFields,
      capturedAt,
      lastResult: {
        ok: true,
        type: "baseline-capture",
        fieldCount: targetFields.length,
        capturedAt,
        source: "project",
      },
    });

    set({ runtimeProfileSession: nextSession });
    return nextSession;
  },

  applyRuntimeProfile: async (profile) => {
    const {
      connection,
      parsedIni,
      realtime,
      runtimeProfileSession,
      captureRuntimeProfileBaseline,
      captureRuntimeProfileTableBaseline,
      readRuntimeTable,
      writeRuntimeTable,
      verifyRuntimeTable,
      writeRuntimeField,
      verifyRuntimeField,
      rollbackRuntimeProfile,
      setOperation,
      updateOperation,
      clearOperation,
      notify,
    } = get();

    if (!profile?.name) {
      throw new Error("Runtime profile must have a name");
    }
    const scalarChanges = Array.isArray(profile.changes) ? profile.changes : [];
    const tableOverlays = Array.isArray(profile.table_overlays)
      ? profile.table_overlays
      : Array.isArray(profile.tableOverlays)
        ? profile.tableOverlays
        : [];

    if (scalarChanges.length === 0 && tableOverlays.length === 0) {
      throw new Error("Runtime profile has no changes");
    }
    if (connection.status !== "connected") {
      throw new Error("Not connected");
    }
    if (!parsedIni) {
      throw new Error("No INI loaded");
    }

    const requirements = {
      ...DEFAULT_RUNTIME_PROFILE_GUARDS,
      ...(profile.apply_requirements || {}),
    };
    const guard = evaluateRuntimeProfileGuards(realtime, requirements);
    if (!guard.ok) {
      const error = new Error(`Unsafe runtime state: ${guard.reasons.join(", ")}`);
      error.reasons = guard.reasons;
      throw error;
    }

    const requiredFields = Array.from(
      new Set(scalarChanges.map((change) => change?.key).filter(Boolean)),
    );
    const requiredTables = Array.from(
      new Set(tableOverlays.map((overlay) => overlay?.target).filter(Boolean)),
    );

    let session = runtimeProfileSession;

    const hasFieldBaseline = requiredFields.every(
      (fieldName) => runtimeProfileSession?.baseline?.[fieldName],
    );
    if (!hasFieldBaseline && requiredFields.length > 0) {
      session = await captureRuntimeProfileBaseline(requiredFields);
    }

    const hasTableBaseline = requiredTables.every(
      (tableName) => session?.baselineTables?.[tableName],
    );
    if (!hasTableBaseline && requiredTables.length > 0) {
      session = await captureRuntimeProfileTableBaseline(requiredTables);
    }

    set({
      runtimeProfileSession: {
        ...session,
        state: "Applying",
        activeProfile: null,
        history: appendRuntimeProfileHistory(session, {
          type: "apply-started",
          profile: profile.name,
          requirements,
          guard: guard.snapshot,
        }),
        lastResult: {
          ok: true,
          type: "apply-started",
          profileName: profile.name,
          startedAt: nowIso(),
        },
      },
    });

    const totalSteps = tableOverlays.length + scalarChanges.length;
    let completedSteps = 0;
    setOperation({
      type: "runtime-profile",
      stage: "apply",
      label: `Applying ${profile.name}`,
      current: 0,
      total: totalSteps > 0 ? totalSteps : null,
      scope: "runtime-profile",
    });

    const appliedTables = [];
    const appliedChanges = [];
    const changedTables = [];
    const noopTables = [];
    const changedFields = [];
    const noopFields = [];

    try {
      for (const overlay of tableOverlays) {
        if (!overlay?.target || !overlay?.source) continue;

        const previousTable =
          get().runtimeProfileSession?.currentTables?.[overlay.target] ||
          session?.baselineTables?.[overlay.target];
        const targetTable = resolveRuntimeTable(parsedIni, overlay.target);
        const sourceTable = overlay.table
          ? null
          : await readRuntimeTable(overlay.source, { source: "project" });
        const nextTable = overlay.table
          ? {
              ...overlay.table,
              key: targetTable.logicalName,
              label: targetTable.label,
              tableId: targetTable.tableId,
              page: targetTable.page,
              xBinsVar: targetTable.xBinsVar,
              yBinsVar: targetTable.yBinsVar,
              zBinsVar: targetTable.zBinsVar,
              rows: targetTable.rows,
              cols: targetTable.cols,
              operation: overlay.operation || overlay.table.operation || "preset",
              source: overlay.source || overlay.table.source || "preset",
              value: overlay.value ?? overlay.table.value ?? null,
              rawValues: Array.from(overlay.table.rawValues || []),
              rawRpmAxis: Array.from(
                overlay.table.rawRpmAxis || previousTable?.rawRpmAxis || [],
              ),
              rawLoadAxis: Array.from(
                overlay.table.rawLoadAxis || previousTable?.rawLoadAxis || [],
              ),
              displayValues: overlay.table.displayValues || previousTable?.displayValues || [],
              displayRpmAxis:
                overlay.table.displayRpmAxis || previousTable?.displayRpmAxis || [],
              displayLoadAxis:
                overlay.table.displayLoadAxis || previousTable?.displayLoadAxis || [],
            }
          : buildRuntimeTableOverlay(
              sourceTable,
              targetTable,
              overlay,
              previousTable,
            );
        const tableUnchanged = runtimeTablesEqual(previousTable, nextTable);

        if (tableUnchanged) {
          const diff = summarizeRuntimeTableDiff(previousTable, nextTable);
          appliedTables.push({
            ...nextTable,
            changedCells: diff.changedCells,
            axesChanged: diff.axesChanged,
          });

          set({
            runtimeProfileSession: {
              ...get().runtimeProfileSession,
              history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
                type: "table-noop",
                profile: profile.name,
                table: overlay.target,
                source: overlay.source,
                operation: overlay.operation || "copy",
                value: overlay.value ?? null,
                changedCells: diff.changedCells,
                axesChanged: diff.axesChanged,
              }),
            },
          });

          noopTables.push(overlay.target);
          completedSteps += 1;
          updateOperation({
            stage: `table-noop:${overlay.target}`,
            label: `${targetTable.label || overlay.target} already matches`,
            current: completedSteps,
            total: totalSteps > 0 ? totalSteps : null,
          });
          continue;
        }

        updateOperation({
          stage: `writing-table:${overlay.target}`,
          label: `Writing ${targetTable.label || overlay.target}`,
          current: completedSteps,
          total: totalSteps > 0 ? totalSteps : null,
        });
        await writeRuntimeTable(overlay.target, nextTable);
        updateOperation({
          stage: `verifying-table:${overlay.target}`,
          label: `Verifying ${targetTable.label || overlay.target}`,
          current: completedSteps,
          total: totalSteps > 0 ? totalSteps : null,
        });
        const verification = await verifyRuntimeTable(overlay.target, nextTable);
        if (!verification.matches) {
          const mismatch = summarizeExpectedActualTableDiff(nextTable, verification);
          set({
            runtimeProfileSession: {
              ...get().runtimeProfileSession,
              history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
                type: "table-mismatch",
                profile: profile.name,
                table: overlay.target,
                expectedSample: Array.from(nextTable.rawValues || []).slice(0, 8),
                actualSample: Array.from(verification.rawValues || []).slice(0, 8),
                expectedAxisSample: {
                  rpm: Array.from(nextTable.rawRpmAxis || []).slice(0, 4),
                  load: Array.from(nextTable.rawLoadAxis || []).slice(0, 4),
                },
                actualAxisSample: {
                  rpm: Array.from(verification.rawRpmAxis || []).slice(0, 4),
                  load: Array.from(verification.rawLoadAxis || []).slice(0, 4),
                },
                mismatch,
              }),
            },
          });
          throw new Error(`Readback mismatch for ${overlay.target}`);
        }

        const diff = summarizeRuntimeTableDiff(previousTable, nextTable);
        appliedTables.push({
          ...nextTable,
          changedCells: diff.changedCells,
          axesChanged: diff.axesChanged,
        });

        set({
          runtimeProfileSession: {
            ...get().runtimeProfileSession,
            history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
              type: diff.changed ? "table-changed" : "table-noop",
              profile: profile.name,
              table: overlay.target,
              source: overlay.source,
              operation: overlay.operation || "copy",
              changedCells: diff.changedCells,
              axesChanged: diff.axesChanged,
              summary:
                summarizeAppliedRuntimeTable({
                  ...nextTable,
                  changedCells: diff.changedCells,
                  axesChanged: diff.axesChanged,
                }).summary,
            }),
          },
        });

        if (diff.changed) {
          changedTables.push(overlay.target);
        } else {
          noopTables.push(overlay.target);
        }

        completedSteps += 1;
        updateOperation({
          stage: `table-complete:${overlay.target}`,
          label: `Applied ${targetTable.label || overlay.target}`,
          current: completedSteps,
          total: totalSteps > 0 ? totalSteps : null,
        });
      }

      for (const change of scalarChanges) {
        if (!change?.key) continue;

        const previousValue =
          get().runtimeProfileSession?.currentValues?.[change.key] ??
          get().runtimeProfileSession?.baseline?.[change.key]?.value;
        const changed = !runtimeFieldValuesEqual(previousValue, change.value);

        if (!changed) {
          set({
            runtimeProfileSession: {
              ...get().runtimeProfileSession,
              history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
                type: "field-noop",
                profile: profile.name,
                field: change.key,
                value: change.value,
                previous: previousValue,
              }),
            },
          });

          appliedChanges.push({
            key: change.key,
            value: change.value,
          });
          noopFields.push(change.key);
          completedSteps += 1;
          updateOperation({
            stage: `field-noop:${change.key}`,
            label: `${change.key} already matches`,
            current: completedSteps,
            total: totalSteps > 0 ? totalSteps : null,
          });
          continue;
        }

        updateOperation({
          stage: `writing-field:${change.key}`,
          label: `Applying ${change.key}`,
          current: completedSteps,
          total: totalSteps > 0 ? totalSteps : null,
        });
        await writeRuntimeField(change.key, change.value);
        updateOperation({
          stage: `verifying-field:${change.key}`,
          label: `Verifying ${change.key}`,
          current: completedSteps,
          total: totalSteps > 0 ? totalSteps : null,
        });
        const verification = await verifyRuntimeField(change.key, change.value);
        if (!verification.matches) {
          throw new Error(`Readback mismatch for ${change.key}`);
        }

        set({
          runtimeProfileSession: {
            ...get().runtimeProfileSession,
            history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
              type: changed ? "field-changed" : "field-noop",
              profile: profile.name,
              field: change.key,
              value: change.value,
              previous: previousValue,
            }),
          },
        });

        appliedChanges.push({
          key: change.key,
          value: change.value,
        });

        if (changed) {
          changedFields.push(change.key);
        } else {
          noopFields.push(change.key);
        }

        completedSteps += 1;
        updateOperation({
          stage: `field-complete:${change.key}`,
          label: `Applied ${change.key}`,
          current: completedSteps,
          total: totalSteps > 0 ? totalSteps : null,
        });
      }

      const completedAt = nowIso();
      const nextSession = {
        ...get().runtimeProfileSession,
        state: "ProfileActive",
        activeProfile: profile.name,
        currentTables: {
          ...(get().runtimeProfileSession?.currentTables || {}),
          ...Object.fromEntries(appliedTables.map((table) => [table.key, table])),
        },
        currentValues: {
          ...(get().runtimeProfileSession?.currentValues || {}),
          ...Object.fromEntries(appliedChanges.map((change) => [change.key, change.value])),
        },
        history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
          type: "apply-succeeded",
          profile: profile.name,
          tables: appliedTables.map((table) => summarizeAppliedRuntimeTable(table)),
          changes: appliedChanges,
          changedTables,
          noopTables,
          changedFields,
          noopFields,
        }),
        fields: Array.from(new Set([...(session.fields || []), ...requiredFields])),
        tables: Array.from(new Set([...(session.tables || []), ...requiredTables])),
        lastResult: {
          ok: true,
          type: "apply",
          profileName: profile.name,
          appliedTables: appliedTables.map((table) => summarizeAppliedRuntimeTable(table)),
          appliedChanges,
          changedTables,
          noopTables,
          changedFields,
          noopFields,
          completedAt,
        },
      };

      set({ runtimeProfileSession: nextSession });
      clearOperation();
      notify(`Runtime profile '${profile.name}' applied`, "success", 2500);
      return nextSession;
    } catch (error) {
      let rollbackResult = null;
      try {
        rollbackResult = await rollbackRuntimeProfile({
          tables: appliedTables.map((table) => table.key),
          fields: appliedChanges.map((change) => change.key),
          suppressNotify: true,
        });
      } catch (rollbackError) {
        rollbackResult = {
          ok: false,
          error: rollbackError.message,
        };
      }

      const failedAt = nowIso();
      set({
        runtimeProfileSession: {
          ...get().runtimeProfileSession,
          state: rollbackResult?.ok ? "Base" : "Unknown",
          activeProfile: null,
          history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
            type: "apply-failed",
            profile: profile.name,
            tables: appliedTables.map((table) => table.key),
            changes: appliedChanges,
            error: error.message,
            rollback: rollbackResult,
          }),
          lastResult: {
            ok: false,
            type: "apply",
            profileName: profile.name,
            appliedTables: appliedTables.map((table) => table.key),
            appliedChanges,
            failedAt,
            error: error.message,
            rollback: rollbackResult,
          },
        },
      });

      clearOperation();
      notify(`Runtime profile '${profile.name}' failed`, "error", 4000);
      throw error;
    }
  },

  rollbackRuntimeProfile: async (options = {}) => {
    const {
      connection,
      runtimeProfileSession,
      writeRuntimeTable,
      verifyRuntimeTable,
      writeRuntimeField,
      verifyRuntimeField,
      setOperation,
      updateOperation,
      clearOperation,
      notify,
    } = get();

    if (connection.status !== "connected") {
      throw new Error("Not connected");
    }

    const baseline = runtimeProfileSession?.baseline || {};
    const baselineTables = runtimeProfileSession?.baselineTables || {};
    const targetFields = Array.from(
      new Set(
        (options.fields?.length ? options.fields : runtimeProfileSession?.fields || [])
          .filter((fieldName) => baseline[fieldName]),
      ),
    );
    const targetTables = Array.from(
      new Set(
        (options.tables?.length ? options.tables : runtimeProfileSession?.tables || [])
          .filter((tableName) => baselineTables[tableName]),
      ),
    );

    if (!targetFields.length && !targetTables.length) {
      throw new Error("No runtime profile baseline is available");
    }

    set({
      runtimeProfileSession: {
        ...runtimeProfileSession,
        state: "RollingBack",
        activeProfile: null,
        history: appendRuntimeProfileHistory(runtimeProfileSession, {
          type: "rollback-started",
          fields: targetFields,
          tables: targetTables,
        }),
        lastResult: {
          ok: true,
          type: "rollback-started",
          startedAt: nowIso(),
          fieldCount: targetFields.length,
          tableCount: targetTables.length,
        },
      },
    });

    const totalSteps = targetTables.length + targetFields.length;
    let completedSteps = 0;
    setOperation({
      type: "runtime-profile",
      stage: "rollback",
      label: "Returning to base",
      current: 0,
      total: totalSteps > 0 ? totalSteps : null,
      scope: "runtime-profile",
    });

    const restoredTables = [];
    for (const tableName of targetTables) {
      const targetTable = baselineTables[tableName];
      updateOperation({
        stage: `restoring-table:${tableName}`,
        label: `Restoring ${tableName}`,
        current: completedSteps,
        total: totalSteps > 0 ? totalSteps : null,
      });
      await writeRuntimeTable(tableName, targetTable);
      updateOperation({
        stage: `verifying-table:${tableName}`,
        label: `Verifying ${tableName}`,
        current: completedSteps,
        total: totalSteps > 0 ? totalSteps : null,
      });
      const verification = await verifyRuntimeTable(tableName, targetTable);
      if (!verification.matches) {
        const failedAt = nowIso();
        set({
          runtimeProfileSession: {
            ...get().runtimeProfileSession,
            state: "Unknown",
            activeProfile: null,
            history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
              type: "rollback-failed",
              table: tableName,
              restoredTables,
            }),
            lastResult: {
              ok: false,
              type: "rollback",
              table: tableName,
              restoredTables,
              failedAt,
              error: `Readback mismatch for ${tableName}`,
            },
          },
        });
        clearOperation();
        throw new Error(`Rollback readback mismatch for ${tableName}`);
      }

      restoredTables.push({
        key: tableName,
        changedCells: summarizeRuntimeTableDiff(
          get().runtimeProfileSession?.currentTables?.[tableName],
          targetTable,
        ).changedCells,
      });

      set({
        runtimeProfileSession: {
          ...get().runtimeProfileSession,
          history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
            type: "table-restored",
            table: tableName,
          }),
        },
      });

      completedSteps += 1;
      updateOperation({
        stage: `table-restored:${tableName}`,
        label: `Restored ${tableName}`,
        current: completedSteps,
        total: totalSteps > 0 ? totalSteps : null,
      });
    }

    const restored = [];
    for (const fieldName of targetFields) {
      const targetValue = baseline[fieldName]?.value;
      updateOperation({
        stage: `restoring-field:${fieldName}`,
        label: `Restoring ${fieldName}`,
        current: completedSteps,
        total: totalSteps > 0 ? totalSteps : null,
      });
      await writeRuntimeField(fieldName, targetValue);
      updateOperation({
        stage: `verifying-field:${fieldName}`,
        label: `Verifying ${fieldName}`,
        current: completedSteps,
        total: totalSteps > 0 ? totalSteps : null,
      });
      const verification = await verifyRuntimeField(fieldName, targetValue);
      if (!verification.matches) {
        const failedAt = nowIso();
        set({
          runtimeProfileSession: {
            ...get().runtimeProfileSession,
            state: "Unknown",
            activeProfile: null,
            history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
              type: "rollback-failed",
              field: fieldName,
              restored,
            }),
            lastResult: {
              ok: false,
              type: "rollback",
              field: fieldName,
              restored,
              failedAt,
              error: `Readback mismatch for ${fieldName}`,
            },
          },
        });
        clearOperation();
        throw new Error(`Rollback readback mismatch for ${fieldName}`);
      }

      restored.push({
        key: fieldName,
        value: targetValue,
      });

      set({
        runtimeProfileSession: {
          ...get().runtimeProfileSession,
          history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
            type: "field-restored",
            field: fieldName,
            value: targetValue,
          }),
        },
      });

      completedSteps += 1;
      updateOperation({
        stage: `field-restored:${fieldName}`,
        label: `Restored ${fieldName}`,
        current: completedSteps,
        total: totalSteps > 0 ? totalSteps : null,
      });
    }

    const completedAt = nowIso();
    const nextSession = {
      ...get().runtimeProfileSession,
      state: "Base",
      activeProfile: null,
      currentTables: {
        ...(get().runtimeProfileSession?.currentTables || {}),
        ...Object.fromEntries(
          targetTables.map((tableName) => [tableName, baselineTables[tableName]]),
        ),
      },
      currentValues: Object.fromEntries(
        Object.entries(get().runtimeProfileSession?.baseline || {}).map(([fieldName, entry]) => [
          fieldName,
          entry?.value,
        ]),
      ),
      history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
        type: "rollback-succeeded",
        restoredTables,
        restored,
      }),
      lastResult: {
        ok: true,
        type: "rollback",
        restoredTables,
        restored,
        completedAt,
      },
    };
    set({ runtimeProfileSession: nextSession });
    clearOperation();

    if (!options.suppressNotify) {
      notify("Runtime profile rolled back to base", "success", 2500);
    }

    return {
      ok: true,
      restored,
      session: nextSession,
    };
  },

  burnPage: async (pageId) => {
    const { connection, notify, readPageFromECU } = get();
    if (connection.status !== "connected") {
      notify("Device not connected", "error");
      return { ok: false };
    }

    try {
      set((s) => {
        if (!s.currentProject) return {};
        const nextPages = updatePageSnapshotStates(s.currentProject, {
          [pageId]: {
            syncState: "write-pending",
          },
        });
        return {
          currentProject: {
            ...s.currentProject,
            constants: {
              ...(s.currentProject.constants || {}),
              pages: nextPages,
            },
          },
        };
      });

      await serialService.burnPage(pageId);
      await delay(2000);

      const currentState = get();
      const localSnapshot =
        currentState?.currentProject?.constants?.pages?.[pageId] ||
        currentState?.currentProject?.constants?.pages?.[String(pageId)];
      const ecuCRC = await serialService.readPageCRC(pageId);

      if (localSnapshot?.crc32 === ecuCRC) {
        set((s) => {
          if (!s.currentProject) return {};
          const nextPages = updatePageSnapshotStates(s.currentProject, {
            [pageId]: {
              crc32: ecuCRC,
              syncState: "verified",
              lastVerifiedAt: nowIso(),
            },
          });
          return {
            currentProject: {
              ...s.currentProject,
              ecu: {
                ...s.currentProject.ecu,
                sync: {
                  ...s.currentProject.ecu.sync,
                  state: deriveProjectSyncState(
                    { pages: nextPages },
                    s.currentProject.ecu.sync.activePages,
                  ),
                },
              },
              constants: {
                ...(s.currentProject.constants || {}),
                pages: nextPages,
              },
            },
          };
        });
        notify(`Page ${pageId} burned and verified`, "success");
        return { ok: true, verified: true };
      }

      const ecuPage = await readPageFromECU(pageId);
      const localBuffer = decodePageSnapshot(localSnapshot);
      const rawMatch =
        localBuffer.length === ecuPage.buffer.length &&
        Buffer.compare(Buffer.from(localBuffer), Buffer.from(ecuPage.buffer)) === 0;

      if (rawMatch) {
        set((s) => {
          if (!s.currentProject) return {};
          const nextPages = updatePageSnapshotStates(s.currentProject, {
            [pageId]: {
              crc32: ecuCRC,
              syncState: "verified",
              lastReadAt: nowIso(),
              lastVerifiedAt: nowIso(),
            },
          });
          return {
            currentProject: {
              ...s.currentProject,
              ecu: {
                ...s.currentProject.ecu,
                sync: {
                  ...s.currentProject.ecu.sync,
                  state: deriveProjectSyncState(
                    { pages: nextPages },
                    s.currentProject.ecu.sync.activePages,
                  ),
                },
              },
              constants: {
                ...(s.currentProject.constants || {}),
                pages: nextPages,
                decodedPages: {
                  ...(s.currentProject.constants?.decodedPages || {}),
                  [pageId]: ecuPage.decoded,
                },
              },
            },
          };
        });
        notify(`Page ${pageId} burned and verified`, "success");
        return { ok: true, verified: true, healed: true };
      }

      const rebuiltSnapshot = createPageSnapshot({
        pageId,
        size: ecuPage.buffer.length,
        buffer: ecuPage.buffer,
        source: "ecu-read",
        syncState: "different",
        lastReadAt: nowIso(),
        lastVerifiedAt: nowIso(),
      });

      set((s) => {
        if (!s.currentProject) return {};
        const nextPages = updatePageSnapshotStates(s.currentProject, {
          [pageId]: rebuiltSnapshot,
        });
        return {
          currentProject: {
            ...s.currentProject,
            ecu: {
              ...s.currentProject.ecu,
              sync: {
                ...s.currentProject.ecu.sync,
                state: deriveProjectSyncState(
                  { pages: nextPages },
                  s.currentProject.ecu.sync.activePages,
                ),
              },
            },
            constants: {
              pages: nextPages,
              decodedPages: {
                ...(s.currentProject.constants?.decodedPages || {}),
                [pageId]: ecuPage.decoded,
              },
            },
          },
        };
      });

      notify(`Page ${pageId} burn verify failed`, "warning");
      return { ok: false, verified: false, error: "CRC/readback mismatch" };
    } catch (e) {
      set((s) => {
        if (!s.currentProject) return {};
        const nextPages = updatePageSnapshotStates(s.currentProject, {
          [pageId]: {
            syncState: "verify-failed",
            lastVerifiedAt: nowIso(),
          },
        });
        return {
          currentProject: {
            ...s.currentProject,
            constants: {
              ...(s.currentProject.constants || {}),
              pages: nextPages,
            },
          },
        };
      });
      notify(`Burn failed for Page ${pageId}`, "error");
      return { ok: false, error: e.message };
    }
  },

  burnPendingPages: async (pageIds = null) => {
    const { currentProject, burnPage, notify, setOperation, updateOperation, clearOperation } = get();
    if (!currentProject?.constants) return;

    const pages = (pageIds?.length ? pageIds : getPendingBurnPages(currentProject))
      .map(Number)
      .filter((value) => !Number.isNaN(value));

    if (!pages.length) {
      notify("No pending RAM changes to burn", "info");
      return { ok: true, pages: [] };
    }

    const results = { ok: true, pages: [], errors: [] };
    setOperation({
      type: "burn",
      stage: "burn",
      label: "Burning ECU pages",
      current: 0,
      total: pages.length,
      scope: "sync",
    });

    serialService.suspendOutputChannelsPolling();
    try {
      for (let index = 0; index < pages.length; index += 1) {
        const pId = pages[index];
        updateOperation({
          stage: "burn",
          label: `Burning page ${pId}`,
          current: index,
          total: pages.length,
        });

        const result = await burnPage(pId);
        if (!result?.ok) {
          results.ok = false;
          results.errors.push({ pageId: pId, error: result?.error || "Burn failed" });
        } else {
          results.pages.push(pId);
        }

        updateOperation({
          stage: "verify",
          label: `Verified page ${pId}`,
          current: index + 1,
          total: pages.length,
        });
        await new Promise((r) => setTimeout(r, 200));
      }
      return results;
    } finally {
      serialService.resumeOutputChannelsPolling();
      clearOperation();
    }
  },

  burnActiveProjectPages: async () => {
    return get().burnPendingPages();
  },

  updateIni: async (newPath) => {
    try {
      const { currentProject } = get();
      if (!currentProject) return;

      const symbols = {
        CELSIUS: currentProject.units?.temperature === "celsius",
        FAHRENHEIT: currentProject.units?.temperature === "fahrenheit",
      };

      const iniContent = await window.projects.loadIni(newPath);
      if (typeof iniContent !== "string") {
        throw new Error("Failed to read INI file");
      }

      const parsedIni = parseIni(iniContent, symbols);

      const updatedProject = normalizeProjectV3(
        {
          ...currentProject,
          ini: {
            path: newPath,
            content: iniContent,
            signature: parsedIni.info.signature || "",
            version: parsedIni.info.mtVersion || "",
          },
        },
        parsedIni,
      );

      set({ currentProject: updatedProject, parsedIni });
      return { ok: true };
    } catch (e) {
      console.error("[project] updateIni failed:", e);
      return { ok: false, error: e.message };
    }
  },

  readPageFromECU: (pageId) => {
    const { parsedIni, currentProject } = get();
    if (!parsedIni) return Promise.reject("No INI loaded");

    const pageSize = parsedIni.constants.pageSizes[pageId] || 256;
    const pageMeta = parsedIni.constants.pages[pageId];
    const configuredBlockingFactor = Number.parseInt(
      currentProject?.ini?.blockingFactor,
      10,
    );
    const chunkSize =
      Number.isFinite(configuredBlockingFactor) && configuredBlockingFactor > 0
        ? configuredBlockingFactor
        : 121;

    return (async () => {
      const chunks = [];
      let offset = 0;

      while (offset < pageSize) {
        const length = Math.min(chunkSize, pageSize - offset);
        const cmd = formatReadCommand(pageId, offset, length);
        const chunk = await serialService.readPageBuffer(cmd, length);
        chunks.push(chunk);
        offset += length;
      }

      const pageData = Buffer.concat(chunks, pageSize);
      return {
        decoded: parsePage(pageData, pageMeta),
        buffer: pageData,
      };
    })();
  },

  compareWithECU: async () => {
    const {
      currentProject,
      parsedIni,
      connection,
      readPageFromECU,
      setOperation,
      updateOperation,
      clearOperation,
    } = get();
    if (connection.status !== "connected") return { error: "Not connected" };
    if (!currentProject?.constants || !parsedIni) return { error: "No project loaded" };

    const pagesToSync = currentProject.ecu?.sync?.activePages || DEFAULT_ACTIVE_PAGES;
    const localSnapshots = currentProject.constants.pages || {};
    const results = { matching: [], different: [], missing: [], errors: [], pageStates: {} };
    const pageStateUpdates = {};

    setOperation({
      type: "compare",
      stage: "compare",
      label: "Checking ECU",
      current: 0,
      total: pagesToSync.length,
      scope: "sync",
    });

    serialService.suspendOutputChannelsPolling();
    try {
      for (let index = 0; index < pagesToSync.length; index += 1) {
        const pId = pagesToSync[index];
        if (!parsedIni.constants.pages[pId]) continue;

        updateOperation({
          stage: "compare",
          label: `Checking page ${pId}`,
          current: index,
          total: pagesToSync.length,
        });

        try {
          const localSnapshot = localSnapshots[pId] || localSnapshots[String(pId)];
          if (!localSnapshot) {
            results.missing.push(pId);
            results.pageStates[pId] = "missing-local";
            pageStateUpdates[pId] = {
              syncState: "missing-local",
              lastVerifiedAt: nowIso(),
            };
            console.warn("[project] compareWithECU missing local snapshot", {
              pageId: pId,
              status: "missing-local",
            });
            continue;
          }

          const ecuCRC = await serialService.readPageCRC(pId);
          if (localSnapshot.crc32 === ecuCRC) {
            results.matching.push(pId);
            results.pageStates[pId] = "verified";
            pageStateUpdates[pId] = {
              crc32: ecuCRC,
              syncState: "verified",
              lastVerifiedAt: nowIso(),
            };
          } else {
            updateOperation({
              stage: "verify",
              label: `Verifying page ${pId}`,
              current: index,
              total: pagesToSync.length,
            });

            const localBuffer = decodePageSnapshot(localSnapshot);
            const ecuPage = await readPageFromECU(pId);
            const buffersMatch =
              localBuffer.length === ecuPage.buffer.length &&
              Buffer.compare(Buffer.from(localBuffer), Buffer.from(ecuPage.buffer)) === 0;

            if (buffersMatch) {
              results.matching.push(pId);
              results.pageStates[pId] = "verified";
              pageStateUpdates[pId] = {
                crc32: ecuCRC,
                syncState: "verified",
                lastReadAt: nowIso(),
                lastVerifiedAt: nowIso(),
              };
              console.warn("[project] compareWithECU healed CRC mismatch from raw page match", {
                pageId: pId,
                localCRC: localSnapshot.crc32,
                ecuCRC,
                status: "verified",
              });
            } else {
              results.different.push(pId);
              results.pageStates[pId] = "different";
              pageStateUpdates[pId] = {
                syncState: "different",
                lastVerifiedAt: nowIso(),
              };
              console.warn("[project] compareWithECU page differs", {
                pageId: pId,
                localCRC: localSnapshot.crc32,
                ecuCRC,
                status: "different",
              });
            }
          }
        } catch (e) {
          results.errors.push(pId);
          results.pageStates[pId] = "unknown";
          pageStateUpdates[pId] = {
            syncState: "unknown",
            lastVerifiedAt: nowIso(),
          };
          console.error("[project] compareWithECU page error", {
            pageId: pId,
            status: "unknown",
            error: e?.message || String(e),
          });
        }

        updateOperation({
          current: index + 1,
          total: pagesToSync.length,
        });
      }

      set((s) => {
        const nextPages = updatePageSnapshotStates(s.currentProject, pageStateUpdates);
        return {
          currentProject: {
            ...s.currentProject,
            ecu: {
              ...s.currentProject.ecu,
              sync: {
                ...s.currentProject.ecu.sync,
                state: deriveProjectSyncState(
                  { pages: nextPages },
                  s.currentProject.ecu.sync.activePages,
                ),
              },
            },
            constants: {
              ...(s.currentProject.constants || {}),
              pages: nextPages,
            },
          },
        };
      });

      console.log("[project] compareWithECU summary", {
        matching: results.matching,
        different: results.different,
        missing: results.missing,
        errors: results.errors,
        pageStates: results.pageStates,
      });

      return results;
    } finally {
      serialService.resumeOutputChannelsPolling();
      clearOperation();
    }
  },

  uploadToECU: async (pages = null) => {
    const { currentProject, connection, notify, syncPagesToECU } = get();
    if (connection.status !== "connected") {
      return { ok: false, error: "Not connected" };
    }

    const decodedPages = getDecodedPages(currentProject?.constants);
    const targetPages = pages || Object.keys(decodedPages).map(Number);

    try {
      notify(`Uploading ${targetPages.length} pages to ECU...`, "info");
      return await syncPagesToECU(targetPages, { burn: true });
    } catch (err) {
      console.error("[ECU Sync] Upload failed:", err);
      return { ok: false, error: err.message };
    }
  },

  syncAllFromECU: async () => {
    const {
      parsedIni,
      readPageFromECU,
      connection,
      notify,
      setOperation,
      updateOperation,
      clearOperation,
    } = get();
    if (connection.status !== "connected") {
      notify("Not connected to ECU", "error");
      return;
    }

    notify("Synchronizing with ECU...", "info");

    const pagesToSync = DEFAULT_ACTIVE_PAGES;
    const decodedPages = {};
    const pageSnapshots = {};

    serialService.suspendOutputChannelsPolling();
    try {
      setOperation({
        type: "pull",
        stage: "read",
        label: "Pulling from ECU",
        current: 0,
        total: pagesToSync.length,
        scope: "sync",
      });

      for (let index = 0; index < pagesToSync.length; index += 1) {
        const pId = pagesToSync[index];
        if (parsedIni.constants.pages[pId]) {
          updateOperation({
            stage: "read",
            label: `Reading page ${pId}`,
            current: index,
            total: pagesToSync.length,
          });
          const pageResult = await readPageFromECU(pId);

          updateOperation({
            stage: "verify",
            label: `Checking page ${pId}`,
            current: index,
            total: pagesToSync.length,
          });
          const ecuCRC = await serialService.readPageCRC(pId);
          decodedPages[pId] = pageResult.decoded;
          pageSnapshots[pId] = {
            ...createPageSnapshot({
              pageId: pId,
              size: pageResult.buffer.length,
              buffer: pageResult.buffer,
              source: "ecu-read",
              syncState: "verified",
              lastReadAt: nowIso(),
              lastVerifiedAt: nowIso(),
            }),
            crc32: ecuCRC,
          };
          updateOperation({
            current: index + 1,
            total: pagesToSync.length,
          });
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      const refreshedTables = buildDisplayTablesFromDecodedPages(
        parsedIni,
        {
          ...(get().currentProject?.constants?.decodedPages || {}),
          ...decodedPages,
        },
        get().tables,
      );

      try {
        const ve2Def = resolveRuntimeTable(parsedIni, "ve2");
        const ve2Page = decodedPages?.[ve2Def.page];
        const ve2Table = ve2Page
          ? readRuntimeTableFromDecodedPage(ve2Page, ve2Def)
          : null;
        if (ve2Table) {
          console.log("[ECU Sync] VE2 snapshot", {
            rawHead: ve2Table.rawValues.slice(0, 16),
            rawTail: ve2Table.rawValues.slice(-16),
            rpmAxis: ve2Table.rawRpmAxis,
            loadAxis: ve2Table.rawLoadAxis,
          });
        }
      } catch (error) {
        console.warn("[ECU Sync] Failed to inspect VE2 snapshot", error);
      }

      set((s) => ({
        currentProject: {
          ...s.currentProject,
          ecu: {
            ...s.currentProject.ecu,
            sync: {
              ...s.currentProject.ecu.sync,
              state: deriveProjectSyncState(
                { pages: { ...(s.currentProject.constants?.pages || {}), ...pageSnapshots } },
                s.currentProject.ecu.sync.activePages,
              ),
              lastSyncAt: nowIso(),
            },
          },
          constants: {
            pages: {
              ...(s.currentProject.constants?.pages || {}),
              ...pageSnapshots,
            },
            decodedPages: {
              ...(s.currentProject.constants?.decodedPages || {}),
              ...decodedPages,
            },
          },
          tables: refreshedTables,
        },
        tables: refreshedTables,
      }));

      notify("ECU Data Synchronized", "success");
      console.log("[ECU Sync] Synchronization complete", {
        pages: Object.keys(pageSnapshots).map(Number),
      });
    } catch (e) {
      console.error("[ECU Sync] Failed:", e);
      notify(`Sync Failed: ${e}`, "error");
    } finally {
      serialService.resumeOutputChannelsPolling();
      clearOperation();
    }
  },
});
