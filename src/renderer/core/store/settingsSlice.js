import {
  createDefaultRealtimeDashboard,
  normalizeRealtimeDashboard,
} from "../../features/dashboard/widgets/widgetPresets.js";

const DEFAULT_SETTINGS = {
  theme: "neon",
  backgroundImage: null,
  backgroundBlur: 15,
  backgroundOpacity: 40,
  autoReconnect: true,
  logDirectory: null,
  soundEnabled: true,
  accentColor: "cyan",
  realtimeDashboard: createDefaultRealtimeDashboard(),
};

export const createSettingsSlice = (set, get) => ({
  settings: DEFAULT_SETTINGS,
  recentProjects: [],

  init: async () => {
    try {
      const config = await window.config.get();
      const { units: _removed, ...cleanSettings } = config.settings ?? {};
      const realtimeDashboard = normalizeRealtimeDashboard(cleanSettings.realtimeDashboard);
      set({
        settings: { ...DEFAULT_SETTINGS, ...cleanSettings, realtimeDashboard },
        recentProjects: config.recentProjects ?? [],
      });
    } catch (err) {
      console.error('[settings] init failed:', err);
    }
  },

  updateSettings: async (newSettings) => {
    try {
      const settings = {
        ...get().settings,
        ...newSettings,
      };
      settings.realtimeDashboard = normalizeRealtimeDashboard(settings.realtimeDashboard);
      await window.config.saveSettings(settings);
      set({ settings });
    } catch (err) {
      console.error('[settings] updateSettings failed:', err);
    }
  },

  updateRealtimeDashboard: async (updater) => {
    try {
      const current = normalizeRealtimeDashboard(get().settings?.realtimeDashboard);
      const nextDashboard = normalizeRealtimeDashboard(
        typeof updater === "function" ? updater(current) : updater,
      );
      const settings = {
        ...get().settings,
        realtimeDashboard: nextDashboard,
      };
      await window.config.saveSettings(settings);
      set({ settings });
    } catch (err) {
      console.error("[settings] updateRealtimeDashboard failed:", err);
    }
  },
});
