const INITIAL_REALTIME = {
  rpm: 0, map: 0, tps: 0, coolant: 0, iat: 0,
  battery: 0, afr: 0, ve: 0, ve1: 0, advance: 0,
  corrections: 0, pw1: 0, dwell: 0, baro: 0,
  vss: 0, gear: 0, ethanolPct: 0,
  engine: {
    running: false, cranking: false, sync: false, halfSync: false,
    idleControl: false, dfco: false, warmup: false, ase: false,
    accelTPS: false, accelMAP: false, boostCutSpark: false,
    boostCutFuel: false, stagingActive: false, hardLimit: false,
    softLimit: false, launchHard: false, launchSoft: false,
    protectActive: false, protectRPM: false, protectMAP: false,
    protectCLT: false, burnPending: false, vvt1Error: false,
    wmiEmpty: false, ioError: false,
  },
  performance: {
    pitLimiterActive: false,
    rumbleIdleActive: false,
    alsActive: false,
  },
};

export const createRealtimeSlice = (set) => ({
  realtime: { ...INITIAL_REALTIME },
  logRecording: false,
  logEntries: [],

  setRealtime: (data) => set((s) => {
    const newState = { realtime: data };
    if (s.logRecording) {
      const entry = { ...data, timestamp: Date.now() };
      // Limit log entries to 10,000 pts (~15-20 mins)
      newState.logEntries = [...s.logEntries.slice(-9999), entry];
    }
    return newState;
  }),

  setLogRecording: (val) => set({ logRecording: val }),

  appendLogEntry: (entry) =>
    set((s) => ({ logEntries: [...s.logEntries.slice(-9999), entry] })),

  clearLog: () => set({ logEntries: [] }),
});
