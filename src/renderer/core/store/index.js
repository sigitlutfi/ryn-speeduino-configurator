import { create } from 'zustand';
import { createSettingsSlice } from './settingsSlice.js';
import { createProjectSlice } from './projectSlice.js';
import { createConnectionSlice } from './connectionSlice.js';
import { createTableSlice } from './tableSlice.js';
import { createRealtimeSlice } from './realtimeSlice.js';
import { createUnitsSlice } from './unitsSlice.js';
import { createNotificationSlice } from './notificationSlice.js';

export { DEFAULT_PROJECT_UNITS, SCHEMA_VERSION, migrateProject } from './projectSlice.js';

export const useStore = create((...a) => ({
  ...createSettingsSlice(...a),
  ...createProjectSlice(...a),
  ...createConnectionSlice(...a),
  ...createTableSlice(...a),
  ...createRealtimeSlice(...a),
  ...createUnitsSlice(...a),
  ...createNotificationSlice(...a),
}));
