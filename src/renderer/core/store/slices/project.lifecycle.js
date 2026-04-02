// Project lifecycle operations (load, save, close, update)

import { parseIni } from "../../../../shared/ini-parser.js";
import {
  createPageSnapshot,
  isPageSnapshot,
  serializeDecodedPage,
} from "../../../../shared/protocol/page-cache.js";
import { INITIAL_TABLES } from "../tableSlice.js";
import { INITIAL_CONNECTION } from "../connectionSlice.js";
import { nowIso, deriveProjectSyncState } from "../utils/project.utils.js";
import { getDecodedPages, updatePageSnapshotStates } from "../utils/page.utils.js";
import { buildDisplayTablesFromDecodedPages } from "../utils/table.transforms.js";
import { createEmptyRuntimeProfileSession } from "../types/runtime.types.js";
import { buildProjectInitialization } from "../../../features/projects/projectInitialization.js";
import {
  normalizeProjectV3,
  serializeProjectForSave,
  ensureProjectRuntimeProfiles,
  createProjectRestorePoint,
  materializeProjectConstants,
} from "../utils/project.normalization.js";

export function createProjectLifecycleSlice(set, get) {
  const buildGeneratedRestorePoint = ({
    project,
    parsedIni,
    initBaseTune = false,
  }) => {
    if (!parsedIni) return null;

    const initializationPlan = buildProjectInitialization({
      parsedIni,
      selectedBoardLayout: project.initialization?.boardLayout?.value ?? null,
      engine: project.engine || {},
      initBaseTune,
    });

    const decodedPages = initializationPlan.pages || {};
    const materializedConstants = materializeProjectConstants(parsedIni, {
      pages: decodedPages,
      decodedPages,
    });

    return createProjectRestorePoint({
      constants: materializedConstants,
      tables: buildDisplayTablesFromDecodedPages(
        parsedIni,
        decodedPages,
        INITIAL_TABLES,
      ),
      runtimeProfiles: project.runtimeProfiles || {},
    });
  };

  const ensureRestorePoints = ({ project, parsedIni, tables }) => {
    const existingRestorePoints = project.initialization?.restorePoints || {};

    const blankCanvas =
      existingRestorePoints.blankCanvas ||
      buildGeneratedRestorePoint({
        project,
        parsedIni,
        initBaseTune: false,
      });

    const baseTune =
      existingRestorePoints.baseTune ||
      (project.initialization?.baseTune?.requested ||
      project.initialization?.baseTune?.applied
        ? buildGeneratedRestorePoint({
            project,
            parsedIni,
            initBaseTune: true,
          })
        : createProjectRestorePoint({
            constants: project.constants,
            tables,
            runtimeProfiles: project.runtimeProfiles,
          }));

    return {
      ...project,
      initialization: {
        ...(project.initialization || {}),
        restorePoints: {
          blankCanvas,
          baseTune,
        },
      },
    };
  };

  const applyRestorePoint = async (restoreKey) => {
    const {
      currentProject,
      parsedIni,
      notify,
      setOperation,
      clearOperation,
    } = get();

    if (!currentProject) {
      return { ok: false, error: "No active project" };
    }

    const restorePoint =
      currentProject.initialization?.restorePoints?.[restoreKey] || null;

    if (!restorePoint) {
      const error =
        restoreKey === "baseTune"
          ? "Base tune snapshot is not available for this project"
          : "Blank canvas snapshot is not available for this project";
      notify(error, "warning", 3500);
      return { ok: false, error };
    }

      const restoreLabel =
      restoreKey === "baseTune" ? "base tune" : "blank canvas";

    setOperation({
      type: "project-restore",
      stage: "restoring",
      label: `Restoring ${restoreLabel}`,
      current: 0,
      total: 1,
      scope: "project",
    });

      const restoredConstants = materializeProjectConstants(parsedIni, {
        pages: restorePoint.constants?.pages || {},
        decodedPages: restorePoint.constants?.decodedPages || {},
      });

      try {
        const nextProject = ensureProjectRuntimeProfiles(
          normalizeProjectV3(
            {
              ...currentProject,
              constants: restoredConstants,
              tables: restorePoint.tables || INITIAL_TABLES,
              runtimeProfiles:
                restorePoint.runtimeProfiles || currentProject.runtimeProfiles || {},
          },
          parsedIni,
        ),
        parsedIni,
      );

      const nextTables =
        restorePoint.tables && Object.keys(restorePoint.tables).length > 0
          ? { ...INITIAL_TABLES, ...restorePoint.tables }
          : buildDisplayTablesFromDecodedPages(
              parsedIni,
              nextProject.constants?.decodedPages,
              INITIAL_TABLES,
            );

      set({
        currentProject: {
          ...nextProject,
          tables: nextTables,
        },
        tables: nextTables,
      });

      notify(
        restoreKey === "baseTune"
          ? "Project restored to base tune"
          : "Project restored to blank canvas",
        "success",
        3000,
      );

      return { ok: true };
    } catch (error) {
      console.error(`[project] restore ${restoreKey} failed:`, error);
      notify(
        error.message || `Failed to restore ${restoreLabel}`,
        "error",
        4000,
      );
      return { ok: false, error: error.message };
    } finally {
      clearOperation();
    }
  };

  return {
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

        project = ensureRestorePoints({
          project,
          parsedIni,
          tables: hydratedTables,
        });

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
          if (parts.length === 2) {
            proj[parts[0]] = { ...(proj[parts[0]] ?? {}), [parts[1]]: value };
          } else {
            let target = proj;
            for (let i = 0; i < parts.length - 1; i += 1) {
              const part = parts[i];
              target[part] = { ...(target[part] ?? {}) };
              target = target[part];
            }
            target[parts[parts.length - 1]] = value;
          }
        }
        return { currentProject: proj };
      });
    },

    captureProjectRestorePoint: (restoreKey, overrides = {}) => {
      set((s) => {
        if (!s.currentProject) return {};

        const overrideConstants = overrides.constants;
        const normalizedOverrideConstants =
          overrideConstants && s.parsedIni
            ? materializeProjectConstants(s.parsedIni, overrideConstants)
            : overrideConstants;
        const derivedDecodedPages =
          normalizedOverrideConstants?.decodedPages ||
          getDecodedPages(normalizedOverrideConstants) ||
          null;
        const resolvedTables =
          overrides.tables ??
          (normalizedOverrideConstants && s.parsedIni
            ? buildDisplayTablesFromDecodedPages(
                s.parsedIni,
                derivedDecodedPages,
                INITIAL_TABLES,
              )
            : s.tables);

        const restorePoint = createProjectRestorePoint({
          constants: normalizedOverrideConstants ?? s.currentProject.constants,
          tables: resolvedTables,
          runtimeProfiles:
            overrides.runtimeProfiles ?? s.currentProject.runtimeProfiles,
        });

        return {
          currentProject: {
            ...s.currentProject,
            initialization: {
              ...(s.currentProject.initialization || {}),
              restorePoints: {
                ...(s.currentProject.initialization?.restorePoints || {}),
                [restoreKey]: restorePoint,
              },
            },
          },
        };
      });
    },

    restoreProjectToBaseTune: async () => applyRestorePoint("baseTune"),

    resetProjectToBlankCanvas: async () => applyRestorePoint("blankCanvas"),

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
  };
}
