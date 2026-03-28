import { Buffer } from "buffer";
import { parseIni, getVarMetadata } from "../../../shared/ini-parser.js";
import {
  formatReadCommand,
} from "../../../shared/protocol/ecu-commands.js";
import { parsePage } from "../../../shared/protocol/binary-parser.js";
import {
  createPageSnapshot,
  decodePageSnapshot,
  decodePageSnapshots,
  findDirtyRegion,
  isPageSnapshot,
  serializeDecodedPage,
} from "../../../shared/protocol/page-cache.js";
import { serialService } from "../services/serialService.js";
import { INITIAL_CONNECTION } from "./connectionSlice.js";
import { INITIAL_TABLES } from "./tableSlice.js";

export const SCHEMA_VERSION = 3;

export const DEFAULT_PROJECT_UNITS = {
  temperature: "celsius",
  pressure: "kpa",
  speed: "kmh",
};

const DEFAULT_ACTIVE_PAGES = [1, 7, 8, 9, 10, 11, 12, 13, 14, 15];

function nowIso() {
  return new Date().toISOString();
}

function createEmptyEcuState(raw = {}) {
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
      activePages: raw.sync?.activePages ?? DEFAULT_ACTIVE_PAGES,
      lastConnectedAt: raw.sync?.lastConnectedAt ?? null,
      lastSyncAt: raw.sync?.lastSyncAt ?? null,
    },
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
  return {
    ...project,
    constants: {
      pages: project.constants?.pages || {},
    },
    tables,
    updatedAt: nowIso(),
  };
}

function getDecodedPages(constants) {
  return constants?.decodedPages || {};
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

      if (project.tables) {
        set({ tables: { ...INITIAL_TABLES, ...project.tables } });
      }

      const recent = await window.projects.addRecent(project);
      set({ currentProject: project, parsedIni, recentProjects: recent });
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
      const recent = await window.projects.addRecent(projectData);
      set((s) => ({
        currentProject: {
          ...projectData,
          constants: {
            ...(projectData.constants || {}),
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

      const newProject = {
        ...(currentProject || {}),
        filePath,
        updatedAt: nowIso(),
      };

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
        currentProject: newProject,
        recentProjects: recent,
      });
      return { ok: true };
    } catch (err) {
      console.error("[project] saveProjectAs failed:", err);
      return { ok: false, error: err.message };
    }
  },

  closeProject: () =>
    set({
      currentProject: null,
      parsedIni: null,
      connection: { ...INITIAL_CONNECTION },
      tables: INITIAL_TABLES,
    }),

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
    const { connection, currentProject, notify, readPageFromECU, burnPage } = get();
    if (connection.status !== "connected") {
      return { ok: false, error: "Not connected" };
    }

    const targetPages = (pageIds?.length ? pageIds : getActiveProjectPages(currentProject))
      .map(Number)
      .filter((value) => !Number.isNaN(value));

    const results = { ok: true, pages: {}, errors: [] };

    serialService.suspendOutputChannelsPolling();
    try {
      for (const pageId of targetPages) {
        try {
          const localSnapshot =
            currentProject?.constants?.pages?.[pageId] ||
            currentProject?.constants?.pages?.[String(pageId)];
          if (!localSnapshot) {
            results.ok = false;
            results.errors.push({ pageId, error: "Missing local snapshot" });
            continue;
          }

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
            await serialService.writePage(
              pageId,
              dirtyRegion.offset,
              dirtyRegion.length,
              Array.from(dirtyRegion.after),
            );
            await delay(options.writeSettleMs ?? 1200);
          }

          if (options.burn) {
            const burnResult = await burnPage(pageId);
            if (!burnResult.ok) {
              results.ok = false;
              results.errors.push({ pageId, error: burnResult.error || "Burn failed" });
              continue;
            }
            results.pages[pageId] = { dirtyRegion, verified: true, burned: true };
          } else {
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
            }
            results.pages[pageId] = { dirtyRegion, verified, burned: false, syncState: verified ? "burn-pending" : "different" };
          }
        } catch (error) {
          results.ok = false;
          results.errors.push({ pageId, error: error.message });
        }
      }
    } finally {
      serialService.resumeOutputChannelsPolling();
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
        },
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
