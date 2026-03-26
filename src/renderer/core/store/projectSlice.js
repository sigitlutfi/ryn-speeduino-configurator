import { parseIni } from '../../../shared/ini-parser.js';
import { INITIAL_CONNECTION } from './connectionSlice.js';
import { INITIAL_TABLES } from './tableSlice.js';

export const SCHEMA_VERSION = 2; // Incremented schema version for Embedded INI support

export const DEFAULT_PROJECT_UNITS = {
  temperature: 'celsius',   // 'celsius' | 'fahrenheit'
  pressure: 'kpa',          // 'kpa' | 'psi' | 'bar'
  speed: 'kmh',             // 'kmh' | 'mph'
};

export function migrateProject(raw) {
  if (!raw) return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    projectName: raw.projectName || raw.name || 'Unnamed Project',
    description: raw.description ?? '',
    engine: {
      displacement: null,
      cylinders: null,
      type: null,
      ...(raw.engine ?? {}),
    },
    ini: {
      path: raw.ini?.path ?? raw.iniPath ?? '',
      signature: raw.ini?.signature ?? '',
      version: raw.ini?.version ?? '',
      content: raw.ini?.content ?? null, // The embedded raw text
    },
    units: { ...DEFAULT_PROJECT_UNITS, ...(raw.units ?? {}) },
    constants: raw.constants ?? {},
    tables: raw.tables ?? null,
    created: raw.created ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    filePath: raw.filePath ?? '',
  };
}

export const createProjectSlice = (set, get) => ({
  currentProject: null,
  parsedIni: null,

  setProject: async (raw) => {
    try {
      const project = migrateProject(raw);
      if (!project) return;

      const symbols = {
        CELSIUS: project.units?.temperature === 'celsius',
        FAHRENHEIT: project.units?.temperature === 'fahrenheit',
      };

      let parsedIni = null;
      let iniContent = project.ini.content;

      // 1. Try to use embedded content first
      if (iniContent) {
        console.log('[project] Loading from embedded INI content');
        try {
          parsedIni = parseIni(iniContent, symbols);
        } catch (e) {
          console.warn('[project] Failed to parse embedded INI, falling back to path.', e);
          iniContent = null;
        }
      }

      // 2. Fallback to path if no embedded content or parsing failed
      if (!parsedIni && project.ini.path) {
        console.log('[project] Fetching INI from disk:', project.ini.path);
        try {
          const diskContent = await window.projects.loadIni(project.ini.path);
          if (typeof diskContent === 'string') {
            iniContent = diskContent;
            parsedIni = parseIni(iniContent, symbols);
            // Update the object in store to include this content for future saves
            project.ini.content = iniContent; 
          }
        } catch (e) {
          console.error('[project] INI on disk unavailable:', e);
        }
      }

      // Update project metadata from parsed INI
      if (parsedIni) {
        if (parsedIni.info.signature) project.ini.signature = parsedIni.info.signature;
        if (parsedIni.info.mtVersion) project.ini.version = parsedIni.info.mtVersion;
      }

      if (project.tables) {
        set({ tables: { ...INITIAL_TABLES, ...project.tables } });
      }

      const recent = await window.projects.addRecent(project);
      set({ currentProject: project, parsedIni, recentProjects: recent });

    } catch (err) {
      console.error('[project] setProject failed:', err);
    }
  },

  saveProject: async () => {
    try {
      const { currentProject, tables } = get();
      console.log('[project] Attempting to save:', currentProject?.filePath);
      
      if (!currentProject) {
        console.error('[project] Save failed: No active project');
        return { ok: false, error: 'No active project' };
      }
      
      if (!currentProject.filePath) return await get().saveProjectAs();

      const projectData = {
        ...currentProject,
        constants: currentProject.constants || {},
        tables,
        updatedAt: new Date().toISOString(),
      };
      
      console.log('[project] Data prepared, sending to main process...');
      const result = await window.projects.saveFile(currentProject.filePath, projectData);
      
      if (result?.error) {
        console.error('[project] Main process returned error:', result.error);
        throw new Error(result.error);
      }
      
      console.log('[project] Save successful!');
      const recent = await window.projects.addRecent(projectData);
      set({ currentProject: projectData, recentProjects: recent });
      
      return { ok: true };
    } catch (err) {
      console.error('[project] saveProject failed:', err);
      return { ok: false, error: err.message };
    }
  },

  saveProjectAs: async () => {
    try {
      const { currentProject, tables } = get();
      const name = currentProject?.projectName || 'New Project';
      console.log('[project] Opening pickSave dialog for:', name);
      
      const filePath = await window.projects.pickSave(name);
      if (!filePath) {
        console.log('[project] Save As cancelled by user');
        return { ok: false, error: 'Save cancelled' };
      }

      const newProject = {
        ...(currentProject || {}),
        filePath,
        updatedAt: new Date().toISOString(),
      };

      console.log('[project] Saving new file to:', filePath);
      const result = await window.projects.saveFile(filePath, { ...newProject, tables });
      
      if (result?.error) {
        console.error('[project] saveFile as returned error:', result.error);
        throw new Error(result.error);
      }

      console.log('[project] Save As successful!');
      const recent = await window.projects.addRecent(newProject);
      set({ currentProject: newProject, recentProjects: recent });
      return { ok: true };
    } catch (err) {
      console.error('[project] saveProjectAs failed:', err);
      return { ok: false, error: err.message };
    }
  },

  closeProject: () => set({
    currentProject: null,
    parsedIni: null,
    connection: { ...INITIAL_CONNECTION },
    tables: INITIAL_TABLES,
  }),

  updateProjectField: (path, value) => {
    set((s) => {
      if (!s.currentProject) return {};
      const proj = { ...s.currentProject };
      const parts = path.split('.');
      if (parts.length === 1) {
        proj[parts[0]] = value;
      } else {
        proj[parts[0]] = { ...(proj[parts[0]] ?? {}), [parts[1]]: value };
      }
      return { currentProject: proj };
    });
  },

  updateConstants: (newConstants) => {
    set((s) => {
      if (!s.currentProject) return {};
      return {
        currentProject: {
          ...s.currentProject,
          constants: {
            ...(s.currentProject.constants || {}),
            ...newConstants
          }
        }
      };
    });
  },

  // Feature: Change INI / Update Firmware Definition
  updateIni: async (newPath) => {
    try {
      const { currentProject } = get();
      if (!currentProject) return;

      const symbols = {
        CELSIUS: currentProject.units?.temperature === 'celsius',
        FAHRENHEIT: currentProject.units?.temperature === 'fahrenheit',
      };

      const iniContent = await window.projects.loadIni(newPath);
      if (typeof iniContent !== 'string') throw new Error('Failed to read INI file');

      const parsedIni = parseIni(iniContent, symbols);
      
      const updatedProject = {
        ...currentProject,
        ini: {
          path: newPath,
          content: iniContent,
          signature: parsedIni.info.signature || '',
          version: parsedIni.info.mtVersion || '',
        },
        updatedAt: new Date().toISOString(),
      };

      set({ currentProject: updatedProject, parsedIni });
      return { ok: true };
    } catch (e) {
      console.error('[project] updateIni failed:', e);
      return { ok: false, error: e.message };
    }

  }
});
