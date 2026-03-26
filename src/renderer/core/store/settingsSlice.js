export const createSettingsSlice = (set, get) => ({
  settings: { 
    theme: 'neon', 
    backgroundImage: null, 
    backgroundBlur: 15,
    backgroundOpacity: 40
  },
  recentProjects: [],

  init: async () => {
    try {
      const config = await window.config.get();
      const { units: _removed, ...cleanSettings } = config.settings ?? {};
      set({
        settings: { theme: 'neon', ...cleanSettings },
        recentProjects: config.recentProjects ?? [],
      });
    } catch (err) {
      console.error('[settings] init failed:', err);
    }
  },

  updateSettings: async (newSettings) => {
    try {
      const settings = { ...get().settings, ...newSettings };
      await window.config.saveSettings(settings);
      set({ settings });
    } catch (err) {
      console.error('[settings] updateSettings failed:', err);
    }
  },
});
