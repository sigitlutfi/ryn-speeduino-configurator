// Project slice - Main orchestrator for project-related state and operations
// This file composes multiple specialized slices for maintainability

import {
  SCHEMA_VERSION,
  DEFAULT_PROJECT_UNITS,
} from "./utils/project.constants.js";
import { createEmptyRuntimeProfileSession } from "./types/runtime.types.js";
import { createProjectLifecycleSlice } from "./slices/project.lifecycle.js";
import { createECUCommunicationSlice } from "./slices/ecu.communication.js";
import { createECUSyncSlice } from "./slices/ecu.sync.js";
import { createRuntimeFieldsSlice } from "./slices/runtime.fields.js";
import { createRuntimeTablesSlice } from "./slices/runtime.tables.js";
import { createRuntimeProfileSlice } from "./slices/runtime.profile.js";

// Re-export constants for backward compatibility
export {
  SCHEMA_VERSION,
  DEFAULT_PROJECT_UNITS,
  DEFAULT_RUNTIME_PROFILE_FIELDS,
  DEFAULT_RUNTIME_PROFILE_GUARDS,
  DEFAULT_ACTIVE_PAGES,
} from "./utils/project.constants.js";

// Re-export migration function for backward compatibility
export { migrateProject } from "./utils/project.normalization.js";

/**
 * Creates the project slice with all composed sub-slices
 *
 * Architecture:
 * - utils/: Pure utility functions (constants, transforms, guards)
 * - types/: State shape factories (createEmpty*, merge*, append*)
 * - slices/: Zustand slice factories with set/get access
 *
 * This orchestrator pattern keeps the main slice small (~100 lines)
 * while maintaining backward compatibility with existing code.
 */
export const createProjectSlice = (set, get) => ({
  // === Core State ===
  currentProject: null,
  parsedIni: null,
  recentProjects: [],
  runtimeProfileSession: createEmptyRuntimeProfileSession(),

  // === Composed Slices ===
  // Each slice is self-contained and can be tested independently

  // Project lifecycle (load, save, close, update)
  ...createProjectLifecycleSlice(set, get),

  // ECU communication primitives
  ...createECUCommunicationSlice(set, get),

  // ECU sync operations (burn, compare, upload)
  ...createECUSyncSlice(set, get),

  // Runtime field read/write/verify
  ...createRuntimeFieldsSlice(set, get),

  // Runtime table read/write/verify
  ...createRuntimeTablesSlice(set, get),

  // Runtime profile apply/rollback
  ...createRuntimeProfileSlice(set, get),
});
