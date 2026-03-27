export const createUISlice = (set) => ({
  showIndicatorTray: false,
  toggleIndicatorTray: () => set((s) => ({ showIndicatorTray: !s.showIndicatorTray })),
  setIndicatorTray: (val) => set({ showIndicatorTray: val }),
});
