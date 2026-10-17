import {
  createDefaultRealtimeDashboard,
  normalizeRealtimeDashboard,
} from "../../features/dashboard/widgets/widgetPresets.js";

const DEFAULT_SETTINGS = {
  theme: "neon",
  backgroundImage: null,
  backgroundBlur: 15,
  backgroundOpacity: 40,
  lastSerialPort: null,
  lastSerialBaud: 115200,
  autoReconnect: true,
  logDirectory: null,
  soundEnabled: true,
  accentColor: "cyan",
  realtimeDashboard: createDefaultRealtimeDashboard(),
};

export const createSettingsSlice = (set, get) => {
  let persistence = Promise.resolve(), confirmed
  const persist = (settings, previous) => {
    confirmed ??= previous
    const saved = persistence.catch(() => {}).then(async () => {
      const result = await window.config.saveSettings(settings)
      if (result?.ok === false) throw new Error(result.error || 'Settings save failed')
      confirmed = settings
      return result
    })
    persistence = saved
    return saved
  }
  return ({
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
      const previous = get().settings;
      set({ settings });
      try { await persist(settings, previous); }
      catch (error) {
        if (get().settings === settings) set({ settings: confirmed });
        throw error;
      }
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
      const previous = get().settings;
      set({ settings });
      try { await persist(settings, previous); }
      catch (error) {
        if (get().settings === settings) set({ settings: confirmed });
        throw error;
      }
    } catch (err) {
      console.error("[settings] updateRealtimeDashboard failed:", err);
      get().notify?.('Dashboard layout could not be saved. Check the settings folder and retry.', 'error');
    }
  },
});
}
