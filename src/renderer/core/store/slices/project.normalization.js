// Backward-compatible re-exports for code that still imports this path

export {
  parseIniFromProject,
  ensureProjectRuntimeProfiles,
  normalizeProjectV3,
  serializeProjectForSave,
  migrateProject,
} from "../utils/project.normalization.js";
