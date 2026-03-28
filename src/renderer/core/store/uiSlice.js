export const createUISlice = (set) => ({
  showIndicatorTray: false,
  sidebarCollapsed: false,
  toggleIndicatorTray: () => set((s) => ({ showIndicatorTray: !s.showIndicatorTray })),
  setIndicatorTray: (val) => set({ showIndicatorTray: val }),

  // Sidebar Global Control
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (val) => set({ sidebarCollapsed: val }),

  // Sync Dialog
  syncDialogOpen: false,
  syncDialogResults: null,
  openSyncDialog: (results) => set({ syncDialogOpen: true, syncDialogResults: results }),
  closeSyncDialog: () => set({ syncDialogOpen: false, syncDialogResults: null }),

  // Global ECU operation state
  operation: null,
  setOperation: (operation) =>
    set({
      operation: {
        type: operation?.type ?? "generic",
        stage: operation?.stage ?? "working",
        label: operation?.label ?? "Working",
        current: operation?.current ?? 0,
        total: operation?.total ?? null,
        scope: operation?.scope ?? "global",
        startedAt: Date.now(),
      },
    }),
  updateOperation: (patch) =>
    set((s) => ({
      operation: s.operation
        ? {
            ...s.operation,
            ...patch,
          }
        : null,
    })),
  clearOperation: () => set({ operation: null }),
});
