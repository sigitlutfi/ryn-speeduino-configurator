// Project normalization, migration, and serialization helpers

import { parseIni } from "../../../../shared/ini-parser.js";
import {
  createPageSnapshot,
  decodePageSnapshots,
  serializeDecodedPage,
} from "../../../../shared/protocol/page-cache.js";
import {
  readRuntimeTableFromDecodedPage,
  resolveRuntimeTable,
  buildRuntimeTableOverlay,
} from "../../../../shared/protocol/runtime-tables.js";
import {
  SCHEMA_VERSION,
  DEFAULT_PROJECT_UNITS,
} from "./project.constants.js";
import { createNeutralRuntimeTablePreset } from "./table.transforms.js";
import {
  splitLegacyConstants,
  deriveProjectSyncState,
  nowIso,
} from "./project.utils.js";
import { createEmptyEcuState } from "../types/project.types.js";

export function parseIniFromProject(project) {
  const iniContent = project?.ini?.content;
  if (!iniContent) return null;

  try {
    const symbols = {
      CELSIUS: project?.units?.temperature === "celsius",
      FAHRENHEIT: project?.units?.temperature === "fahrenheit",
    };
    return parseIni(iniContent, symbols);
  } catch (error) {
    console.warn(
      "[project] Failed to parse embedded INI for runtime profile defaults:",
      error,
    );
    return null;
  }
}

function cloneJsonSafe(value, fallback) {
  if (value === undefined) return fallback;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    console.warn("[project] Failed to clone snapshot payload:", error);
    return fallback;
  }
}

export function createProjectRestorePoint({
  constants = {},
  tables = {},
  runtimeProfiles = {},
} = {}) {
  return {
    constants: cloneJsonSafe(constants, { pages: {}, decodedPages: {} }),
    tables: cloneJsonSafe(tables, {}),
    runtimeProfiles: cloneJsonSafe(runtimeProfiles, {}),
    capturedAt: nowIso(),
  };
}

export function materializeProjectConstants(parsedIni, constants = {}) {
  const decodedPages = cloneJsonSafe(constants?.decodedPages, {}) || {};
  const pageSnapshots = cloneJsonSafe(constants?.pages, {}) || {};

  if (!parsedIni?.constants?.pages) {
    return {
      pages: pageSnapshots,
      decodedPages,
    };
  }

  for (const pageId of Object.keys(parsedIni.constants.pages)) {
    if (pageSnapshots[pageId]) continue;

    const pageBuffer = serializeDecodedPage(
      parsedIni,
      Number(pageId),
      decodedPages[pageId] || {},
    );

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

  return {
    pages: pageSnapshots,
    decodedPages,
  };
}

function createDefaultRuntimeProfilePreset(
  parsedIni,
  decodedPages,
  name,
  fillValue = 100,
) {
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
    console.warn(
      `[project] Failed to seed runtime profile preset '${name}':`,
      error,
    );
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

function normalizeRuntimeProfiles(
  rawRuntimeProfiles = {},
  parsedIni = null,
  decodedPages = {},
) {
  const defaults = {
    eco: createDefaultRuntimeProfilePreset(parsedIni, decodedPages, "ECO", 100),
    racing: createDefaultRuntimeProfilePreset(
      parsedIni,
      decodedPages,
      "RACING",
      100,
    ),
    extreme: createDefaultRuntimeProfilePreset(
      parsedIni,
      decodedPages,
      "EXTREME",
      100,
    ),
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

export function ensureProjectRuntimeProfiles(
  project,
  parsedIniOverride = null,
) {
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

export function normalizeProjectV3(raw, parsedIni = null) {
  if (!raw) return null;

  const migratedAt = nowIso();
  const { decodedPages: legacyDecodedPages, pageSnapshots } =
    splitLegacyConstants(raw.constants || {});

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
      const pageBuffer = serializeDecodedPage(
        parsedIni,
        Number(pageId),
        decodedPage,
      );
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
    hardware: {
      pinMapPlatform: raw.hardware?.pinMapPlatform === 'mega2560' ? 'mega2560' : '',
      channelBuild: ['standard', '6-3', '8-1'].includes(raw.hardware?.channelBuild) ? raw.hardware.channelBuild : '',
    },
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
    initialization: {
      boardLayout: raw.initialization?.boardLayout ?? null,
      iniSignature:
        raw.initialization?.iniSignature ??
        raw.ini?.signature ??
        raw.iniSignature ??
        "",
      baseTune: {
        requested: raw.initialization?.baseTune?.requested ?? false,
        applied: raw.initialization?.baseTune?.applied ?? false,
        providerId: raw.initialization?.baseTune?.providerId ?? null,
        providerOwner: raw.initialization?.baseTune?.providerOwner ?? null,
        appliedFields: raw.initialization?.baseTune?.appliedFields ?? [],
        warningCount: raw.initialization?.baseTune?.warningCount ?? 0,
      },
      restorePoints: {
        blankCanvas:
          cloneJsonSafe(raw.initialization?.restorePoints?.blankCanvas, null) ??
          null,
        baseTune:
          cloneJsonSafe(raw.initialization?.restorePoints?.baseTune, null) ?? null,
      },
    },
    createdAt: raw.createdAt ?? raw.created ?? migratedAt,
    updatedAt: raw.updatedAt ?? migratedAt,
    filePath: raw.filePath ?? "",
  };
}

export function serializeProjectForSave(project, tables) {
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

export function migrateProject(raw) {
  return normalizeProjectV3(raw);
}
