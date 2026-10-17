import { canMigrateDriveModes, migrateDriveModeProject } from '../../../../shared/protocol/drive-mode-migration.js'
// Project lifecycle operations (load, save, close, update)

import { parseIni, getVarMetadata } from "../../../../shared/ini-parser.js";
import { parsePage } from '../../../../shared/protocol/binary-parser.js';
import {
  createPageSnapshot,
  decodePageSnapshot,
  isPageSnapshot,
  serializeDecodedPage,
} from "../../../../shared/protocol/page-cache.js";
import { INITIAL_TABLES } from "../tableSlice.js";
import { INITIAL_CONNECTION } from "../connectionSlice.js";
import { nowIso, deriveProjectSyncState } from "../utils/project.utils.js";
import { getDecodedPages, updatePageSnapshotStates } from "../utils/page.utils.js";
import { buildDisplayTablesFromDecodedPages } from "../utils/table.transforms.js";
import { applyTableDrafts } from '../utils/table.drafts.js';
import { createEmptyRuntimeProfileSession } from "../types/runtime.types.js";
import { buildProjectInitialization, getBoardLayoutChoices } from "../../../features/projects/projectInitialization.js";
import {
  normalizeProjectV3,
  serializeProjectForSave,
  ensureProjectRuntimeProfiles,
  createProjectRestorePoint,
  materializeProjectConstants,
  projectFingerprint,
} from "../utils/project.normalization.js";
import { assertProjectFormat } from '../../../../shared/project-format.js';
import { validateConfigurationValues } from '../../../../shared/protocol/configuration-validation.js';
import { validateConfigurationChange } from '../../../../shared/protocol/configuration-policy.js';
import { configurationWriteOptions } from '../../../../shared/protocol/board-pins.js';
import { metadataContract, sameMetadataContract } from '../../../../shared/protocol/metadata-contract.js';

export function createProjectLifecycleSlice(set, get) {
  let transitionInFlight = false;
  let saveInFlight = false;
  let openRequest = 0;
  const assertCanLeave = () => {
    const state = get();
    if (state.operation) throw new Error('Wait for the current operation to finish.');
    const session = state.runtimeProfileSession;
    if (['ProfileActive', 'Applying', 'RollingBack', 'Unknown'].includes(session?.state) ||
      (session?.activeProfile && session.state !== 'Base')) {
      throw new Error('Return the runtime profile to DEFAULT before changing or closing the project. If its state is unknown, download ECU RAM first.');
    }
  };
  const prepareToLeave = async () => {
    assertCanLeave();
    if (get().projectSettingsDirty) throw new Error('Save or cancel Project Settings before changing or closing the project.');
    if (!get().currentProject || !get().hasUnsavedProjectChanges()) return;
    const project = get().currentProject;
    const choice = await window.projects.confirmTransition?.(project.projectName) || 'cancel';
    if (get().currentProject !== project) throw new Error('Project changed while the confirmation was open. Try again.');
    if (choice === 'save') {
      const result = await get().saveProject();
      if (!result.ok) throw new Error(result.error);
      if (get().hasUnsavedProjectChanges()) throw new Error('New edits were made while saving. Save them before continuing.');
    } else if (choice !== 'discard') {
      const error = new Error('Project change cancelled');
      error.cancelled = true;
      throw error;
    }
    assertCanLeave();
  };
  const addRecent = async project => {
    if (!project.filePath) return get().recentProjects || [];
    try { return await window.projects.addRecent(project); }
    catch (error) { get().notify?.(`Project ready, but Recent could not be updated: ${error.message}`, 'warning'); return get().recentProjects || []; }
  };
  const save = async (saveAs = false) => {
    if (saveInFlight) return { ok: false, error: 'A project save is already in progress' };
    saveInFlight = true;
    try {
      if (get().operation) throw new Error('Wait for the current operation before saving');
      if (get().projectSettingsDirty) throw new Error('Save or cancel the open Project Settings form first');
      if (!get().currentProject) throw new Error('No active project');
      const epoch = get().projectEpoch;
      let filePath = get().currentProject.filePath;
      if (saveAs || !filePath) filePath = await window.projects.pickSave(get().currentProject.projectName);
      if (!filePath) return { ok: false, error: 'Save cancelled', cancelled: true };
      if (get().projectEpoch !== epoch) throw new Error('Project changed while choosing a file');
      // Capture after the dialog so edits made while choosing a path are included.
      const captured = get();
      const { currentProject, tables, parsedIni, tableDrafts } = captured;
      const withFields = get().applyProjectFieldDrafts?.() || { ok: true };
      if (!withFields.ok) throw new Error(withFields.error);
      const source = get().currentProject;
      const prepared = applyTableDrafts(source, tables, parsedIni, tableDrafts);
      const canonicalTables = buildDisplayTablesFromDecodedPages(parsedIni, prepared.constants.decodedPages, tables);
      const payload = serializeProjectForSave({ ...prepared, filePath }, canonicalTables);
      const expectedRevision = filePath === currentProject.filePath ? currentProject.fileRevision : undefined;
      const result = await window.projects.saveFile(filePath, payload, { expectedRevision });
      if (!result?.ok) throw new Error(result?.error || 'Project save was not confirmed');
      if (get().projectEpoch !== epoch) return { ok: false, error: 'Project changed while saving' };
      // Never replace metadata, fields, or table edits made after the snapshot.
      const unchanged = get().currentProject === source && get().tables === tables && get().tableDrafts === tableDrafts;
      set(state => ({
        savedProjectFingerprint: projectFingerprint(prepared),
        currentProject: unchanged
          ? { ...prepared, filePath, fileRevision: result?.fileRevision, updatedAt: payload.updatedAt, tables: canonicalTables }
          : { ...state.currentProject, filePath, fileRevision: result?.fileRevision },
        ...(unchanged ? { tables: canonicalTables, tableDrafts: {} } : {}),
      }));
      const recent = await addRecent({ ...payload, filePath });
      if (get().projectEpoch === epoch) set({ recentProjects: recent });
      return { ok: true };
    } catch (error) { return { ok: false, error: error.message }; }
    finally { saveInFlight = false; }
  };
  const buildGeneratedRestorePoint = ({
    project,
    parsedIni,
    initBaseTune = false,
  }) => {
    if (!parsedIni) return null;

    let initializationPlan;
    const boardField = getVarMetadata(parsedIni, 'pinLayout');
    const boardLayout = project.initialization?.boardLayout?.value ?? project.constants?.decodedPages?.[boardField?.page]?.[boardField?.name || 'pinLayout'];
    if (boardField && !getBoardLayoutChoices(parsedIni).some(choice => choice.value === boardLayout)) return null;
    try { initializationPlan = buildProjectInitialization({
      parsedIni,
      selectedBoardLayout: boardLayout,
      engine: project.engine || {},
      initBaseTune,
    }); } catch (error) {
      console.warn("[project] Cannot regenerate historical restore point:", error.message);
      return null;
    }

    const decodedPages = initializationPlan.pages || {};
    const materializedConstants = initializationPlan.constants;

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

    const baseTune = existingRestorePoints.baseTune || {
      ...createProjectRestorePoint({ constants: project.constants, tables, runtimeProfiles: project.runtimeProfiles }),
      origin: 'recovered-current-tune',
    };

    return {
      ...project,
      initialization: {
        ...(project.initialization || {}),
        restorePoints: {
          ...existingRestorePoints,
          blankCanvas,
          baseTune,
        },
      },
    };
  };

  const applyRestorePoint = async (restoreKey) => {
    try { assertCanLeave(); } catch (error) { return { ok: false, error: error.message }; }
    if (get().operation) return { ok: false, error: "Wait for the current operation before restoring a project" };
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

    const recovered = restorePoint.origin === 'recovered-current-tune';
    const restoreLabel = restoreKey === 'baseTune' ? (recovered ? 'recovered tune' : 'base tune') : 'blank canvas';

    setOperation({
      type: "project-restore",
      stage: "restoring",
      label: `Restoring ${restoreLabel}`,
      current: 0,
      total: 1,
      scope: "project",
    });

      try {
        const restoredConstants = materializeProjectConstants(parsedIni, {
          pages: restorePoint.constants?.pages || {},
          decodedPages: restorePoint.constants?.decodedPages || {},
        });
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

      const nextTables = buildDisplayTablesFromDecodedPages(
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
        tableDrafts: {},
        fieldDrafts: {},
      });

      notify(
        restoreKey === "baseTune"
          ? `Project restored to ${restoreLabel}`
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
    // Persist hardware lifecycle state inside an exclusive ECU operation without
    // committing unrelated drafts or bypassing the file revision check.
    saveECURestartState: async () => {
      if (saveInFlight) return { ok: false, error: 'A project save is already in progress' };
      const source = get().currentProject, epoch = get().projectEpoch;
      if (!source?.filePath) return { ok: false, error: 'Save the project to a file before changing ECU hardware setup' };
      saveInFlight = true;
      try {
        const payload = serializeProjectForSave(source, get().tables);
        const result = await window.projects.saveFile(source.filePath, payload, { expectedRevision: source.fileRevision });
        if (!result?.ok) throw new Error(result?.error || 'Project save failed');
        if (get().projectEpoch !== epoch) throw new Error('Project changed while saving restart state');
        set(s => ({ currentProject: { ...s.currentProject, fileRevision: result.fileRevision }, savedProjectFingerprint: projectFingerprint(source) }));
        return { ok: true };
      } catch (error) { return { ok: false, error: error.message }; }
      finally { saveInFlight = false; }
    },
    savedProjectFingerprint: '',
    fieldDrafts: {},
    projectSettingsDirty: false,
    setProjectSettingsDirty: dirty => set({ projectSettingsDirty: dirty }),
    updateProjectFieldDrafts: pages => set(state => {
      const drafts = { ...(state.fieldDrafts || {}) };
      const stored = state.currentProject?.constants?.decodedPages || {};
      for (const [page, fields] of Object.entries(pages)) {
        drafts[page] = { ...drafts[page] };
        for (const [name, value] of Object.entries(fields)) {
          if (JSON.stringify(value) === JSON.stringify(stored[page]?.[name])) delete drafts[page][name];
          else drafts[page][name] = value;
        }
        if (!Object.keys(drafts[page]).length) delete drafts[page];
      }
      return { fieldDrafts: drafts };
    }),
    discardProjectFieldDrafts: scope => set(state => {
      const drafts = { ...(state.fieldDrafts || {}) };
      for (const [page, names] of Object.entries(scope || drafts)) {
        if (!Array.isArray(names)) { delete drafts[page]; continue; }
        drafts[page] = { ...drafts[page] };
        for (const name of names) delete drafts[page][name];
        if (!Object.keys(drafts[page]).length) delete drafts[page];
      }
      return { fieldDrafts: drafts };
    }),
    applyProjectFieldDrafts: () => {
      try {
        const { currentProject, parsedIni, fieldDrafts = {}, operation } = get();
        if (operation) throw new Error('Wait for the current operation before applying field edits');
        if (!Object.keys(fieldDrafts).length) return { ok: true };
        const stored = currentProject.constants.decodedPages;
        const candidate = { ...stored };
        for (const [page, values] of Object.entries(fieldDrafts)) candidate[page] = { ...stored[page], ...values };
        const error = validateConfigurationValues(parsedIni, fieldDrafts, stored, stored) ||
          validateConfigurationChange(parsedIni, stored, candidate, configurationWriteOptions(currentProject));
        if (error) throw new Error(error);
        get().updateConstants(fieldDrafts);
        set({ fieldDrafts: {} });
        return { ok: true };
      } catch (error) { return { ok: false, error: error.message }; }
    },
    hasUnsavedProjectChanges: () => {
      const state = get();
      return !!state.currentProject && (Object.keys(state.tableDrafts || {}).length > 0 ||
        Object.keys(state.fieldDrafts || {}).length > 0 || projectFingerprint(state.currentProject) !== state.savedProjectFingerprint);
    },
    applyProjectTableDrafts: () => {
      try {
        const state = get();
        if (state.operation) throw new Error('Wait for the ECU operation before applying table edits');
        const project = applyTableDrafts(state.currentProject, state.tables, state.parsedIni, state.tableDrafts);
        if (project !== state.currentProject) set({ currentProject: project, tableDrafts: {},
          tables: buildDisplayTablesFromDecodedPages(state.parsedIni, project.constants.decodedPages, state.tables) });
        return { ok: true };
      } catch (error) { return { ok: false, error: error.message }; }
    },
    openProject: async filePath => {
      const request = ++openRequest;
      const epoch = get().projectEpoch;
      try {
        const raw = await window.projects.loadFile(filePath);
        if (request !== openRequest || get().projectEpoch !== epoch) return { ok: false, error: 'A newer project action replaced this open request' };
        if (!raw || raw.error) throw new Error(raw?.error || 'Project file is empty');
        return await get().setProject({ ...raw, filePath: raw.filePath ?? filePath });
      } catch (error) {
        get().notify?.(error.message, 'error');
        return { ok: false, error: error.message };
      }
    },

    setProject: async (raw, options = {}) => {
      if (transitionInFlight || saveInFlight) return { ok: false, error: 'A project operation is already in progress' };
      transitionInFlight = true;
      let ownsOperation = false;
      try {
        assertProjectFormat(raw);
        await prepareToLeave();
        const previous = get().currentProject;
        const previousFingerprint = projectFingerprint(previous);
        const previousFields = get().fieldDrafts, previousDrafts = get().tableDrafts, previousTables = get().tables;
        const unchanged = () => projectFingerprint(get().currentProject) === previousFingerprint &&
          get().fieldDrafts === previousFields && get().tableDrafts === previousDrafts && get().tables === previousTables;
        get().setOperation?.({ type: 'project-load', label: 'Opening project', scope: 'project' });
        ownsOperation = true;
        let project = normalizeProjectV3(raw);
        let content = project.ini.content;
        if (!content && project.ini.path) {
          content = await window.projects.loadIni(project.ini.path);
          if (typeof content !== 'string') throw new Error(content?.error || 'Cannot read the project INI');
        }
        if (!content) throw new Error('This project has no embedded INI. Locate its matching INI before opening it.');
        const parsedIni = parseIni(content, {
          CELSIUS: project.units.temperature === 'celsius',
          FAHRENHEIT: project.units.temperature === 'fahrenheit',
        });
        if (!Object.keys(parsedIni.constants?.pages || {}).length) throw new Error('The INI contains no ECU configuration pages');
        project = ensureProjectRuntimeProfiles(normalizeProjectV3({ ...project, ini: {
          ...project.ini, content, signature: parsedIni.info.signature || '', version: parsedIni.info.mtVersion || '',
        } }, parsedIni), parsedIni);
        const tables = buildDisplayTablesFromDecodedPages(parsedIni, project.constants.decodedPages, INITIAL_TABLES);
        project = ensureRestorePoints({ project, parsedIni, tables });
        // Validate historical snapshots too; a bad restore must never become a valid tune.
        for (const point of Object.values(project.initialization.restorePoints || {})) {
          if (point) point.constants = materializeProjectConstants(parsedIni, point.constants);
        }
        if (!unchanged()) throw new Error('New edits were made while opening the project. Try again.');
        if (options.persistNew) {
          const result = await window.projects.saveFile(project.filePath, serializeProjectForSave(project, tables));
          if (!result?.ok) throw new Error(result?.error || 'Project creation was not saved');
          project.fileRevision = result?.fileRevision;
        }
        // Stop polling and clear the old handshake before changing INI/context.
        if (get().connection?.status && get().connection.status !== 'disconnected') await window.serial.disconnect();
        if (!unchanged()) throw new Error('Project changed while disconnecting. Try again.');
        const epoch = (get().projectEpoch || 0) + 1;
        set({ projectEpoch: epoch, currentProject: { ...project, tables }, parsedIni, tables,
          tableDrafts: {}, fieldDrafts: {}, connection: { ...INITIAL_CONNECTION },
          savedProjectFingerprint: projectFingerprint(project),
          runtimeProfileSession: createEmptyRuntimeProfileSession() });
        const recent = await addRecent(project);
        if (get().projectEpoch === epoch) set({ recentProjects: recent });
        return { ok: true };
      } catch (error) {
        if (!error.cancelled) get().notify?.('Project load failed: ' + error.message, 'error');
        return { ok: false, error: error.message, cancelled: !!error.cancelled };
      } finally {
        if (ownsOperation) get().clearOperation?.();
        transitionInFlight = false;
      }
    },

    saveProject: () => save(false),
    saveProjectAs: () => save(true),

    closeProject: async () => {
      if (transitionInFlight || saveInFlight) return { ok: false, error: 'Wait for the project operation to finish' };
      transitionInFlight = true;
      let ownsOperation = false;
      try {
        await prepareToLeave();
        const project = get().currentProject;
        const fingerprint = projectFingerprint(project);
        const fields = get().fieldDrafts, drafts = get().tableDrafts, tables = get().tables;
        get().setOperation?.({ type: 'project-close', label: 'Closing project', scope: 'project' });
        ownsOperation = true;
        if (get().connection?.status && get().connection.status !== 'disconnected') await window.serial.disconnect();
        if (projectFingerprint(get().currentProject) !== fingerprint || get().fieldDrafts !== fields ||
          get().tableDrafts !== drafts || get().tables !== tables) throw new Error('New edits were made while closing. Try again.');
        set({ projectEpoch: (get().projectEpoch || 0) + 1, currentProject: null, parsedIni: null,
          connection: { ...INITIAL_CONNECTION }, tables: INITIAL_TABLES, tableDrafts: {}, fieldDrafts: {},
          savedProjectFingerprint: '', runtimeProfileSession: createEmptyRuntimeProfileSession() });
        return { ok: true };
      } catch (error) {
        if (!error.cancelled) get().notify?.(error.message, 'warning');
        return { ok: false, error: error.message, cancelled: !!error.cancelled };
      } finally {
        if (ownsOperation) get().clearOperation?.();
        transitionInFlight = false;
      }
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
      if (path === 'color') path = 'ui.accentColor';
      if (path.split('.').some(part => ['__proto__', 'constructor', 'prototype'].includes(part))) return;
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

    updateProjectSettings: patch => {
      try {
        assertCanLeave();
        const state = get();
        if (!state.currentProject) throw new Error('No active project');
        let project = { ...state.currentProject, ...patch,
          engine: { ...state.currentProject.engine, ...patch.engine },
          ui: { ...state.currentProject.ui, ...patch.ui },
          units: { ...state.currentProject.units, ...patch.units } };
        let parsedIni = state.parsedIni;
        if (project.units.temperature !== state.currentProject.units.temperature) {
          if (Object.keys(state.fieldDrafts || {}).length || Object.keys(state.tableDrafts || {}).length) throw new Error('Save or discard tuning edits before changing temperature units');
          parsedIni = parseIni(project.ini.content, {
            CELSIUS: project.units.temperature === 'celsius', FAHRENHEIT: project.units.temperature === 'fahrenheit',
          });
          const decodedPages = Object.fromEntries(Object.entries(project.constants.pages).map(([id, snapshot]) =>
            [id, parsePage(decodePageSnapshot(snapshot), parsedIni.constants.pages[id])]));
          project = { ...project, constants: { ...project.constants, decodedPages } };
        }
        const tables = buildDisplayTablesFromDecodedPages(parsedIni, project.constants.decodedPages, state.tables);
        set({ currentProject: { ...project, tables }, parsedIni, tables });
        return { ok: true };
      } catch (error) { return { ok: false, error: error.message }; }
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

    updateConstants: (newConstants) => {
      assertCanLeave();
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
            const previous = currentRawPages[pageId];
            const edits = newConstants.pages?.[pageId] || newConstants[pageId] || {};
            const changed = Object.fromEntries(Object.entries(edits).filter(([name, value]) =>
              JSON.stringify(value) !== JSON.stringify(currentDecodedPages[pageId]?.[name])));
            const pageBuffer = serializeDecodedPage(parsedIni, Number(pageId), changed,
              previous ? decodePageSnapshot(previous) : undefined);
            if (pageBuffer.length > 0) {
              nextDecodedPages[pageId] = parsePage(pageBuffer, parsedIni.constants.pages[pageId]);
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
        if (parsedIni) for (const [id, snapshot] of Object.entries(rawUpdates)) {
          nextConstants.decodedPages[id] = parsePage(decodePageSnapshot(snapshot), parsedIni.constants.pages[id]);
        }
        const fieldDrafts = {};
        for (const [page, values] of Object.entries(s.fieldDrafts || {})) {
          const remaining = Object.fromEntries(Object.entries(values).filter(([name, value]) =>
            JSON.stringify(value) !== JSON.stringify(nextConstants.decodedPages[page]?.[name])));
          if (Object.keys(remaining).length) fieldDrafts[page] = remaining;
        }

        return {
          fieldDrafts,
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
        assertCanLeave();
        if (transitionInFlight || saveInFlight) throw new Error('Wait for the project operation to finish');
        const { currentProject, projectEpoch } = get();
        if (!currentProject) throw new Error('No active project');
        if (Object.keys(get().fieldDrafts || {}).length || Object.keys(get().tableDrafts || {}).length) throw new Error('Save or discard field and table edits before replacing the INI');

        const symbols = {
          CELSIUS: currentProject.units?.temperature === "celsius",
          FAHRENHEIT: currentProject.units?.temperature === "fahrenheit",
        };

        const iniContent = await window.projects.loadIni(newPath);
        if (get().projectEpoch !== projectEpoch || get().currentProject !== currentProject) throw new Error('Project changed while reading the INI. Try again.');
        assertCanLeave();
        if (typeof iniContent !== "string") {
          throw new Error("Failed to read INI file");
        }

        const parsedIni = parseIni(iniContent, symbols);
        // Firmware layout migration needs an explicit field mapping. A matching
        // byte count alone does not prove signedness, offsets or enum meaning.
        const layoutContract = ini => {
          const { signature, tables, curves, pinConditions, ...wire } = metadataContract(ini);
          return wire;
        };
        const oldContract = layoutContract(get().parsedIni);
        const newContract = layoutContract(parsedIni);
        const driveMigration = canMigrateDriveModes(get().parsedIni, parsedIni);
        const migratedProject = driveMigration ? migrateDriveModeProject(currentProject, get().parsedIni, parsedIni) : currentProject;
        if (!driveMigration && !sameMetadataContract(oldContract, newContract)) throw new Error('This INI changes the ECU contract or field meanings. Create a project with the matching base tune; the existing project has been preserved.');

        const updatedProject = normalizeProjectV3(
          {
            ...migratedProject,
            ini: {
              path: newPath,
              content: iniContent,
              signature: parsedIni.info.signature || "",
              version: parsedIni.info.mtVersion || "",
            },
          },
          parsedIni,
        );

        const tables = buildDisplayTablesFromDecodedPages(parsedIni, updatedProject.constants.decodedPages, INITIAL_TABLES);
        set({ currentProject: { ...updatedProject, tables }, parsedIni, tables });
        return { ok: true };
      } catch (e) {
        console.error("[project] updateIni failed:", e);
        return { ok: false, error: e.message };
      }
    },
  };
}
