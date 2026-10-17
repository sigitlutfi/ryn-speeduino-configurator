import { telemetryState } from '../../../shared/protocol/tuning-live.js'

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
    pitLimiterSwitch: false,
    rumbleIdleActive: false,
    rumbleIdleBeat: true,
    alsActive: false,
    alsSwitch: false,
    alsTimingCorr: 0,
    alsFuelCorr: 100,
    alsActiveTime: 0,
    rollingPopBangActive: false,
    rollingPopBangSwitch: false,
    rollingPopBangActiveTime: 0,
    rollingPopBangCutCounter: 0,
    rollingPopBangTimingCorr: 0,
    rollingPopBangFuelCorr: 100,
  },
};

export const createRealtimeSlice = (set) => ({
  realtime: structuredClone(INITIAL_REALTIME),
  realtimeReceivedAt: null,
  realtimeError: null,
  logRecording: false,
  logEntries: [],
  logStartedAt: null,
  logStoppedAt: null,
  logSourceKey: null,
  realtimePacketTimes: [],
  realtimeRateHz: null,
  realtimeSourceKey: null,

  clearRealtime: (error = null) => set(s => ({ realtime: structuredClone(INITIAL_REALTIME), realtimeReceivedAt: null,
    realtimeError: error, driveModeStatus: null, realtimePacketTimes: [], realtimeRateHz: null, realtimeSourceKey: null,
    logRecording: false, logStoppedAt: s.logRecording ? Date.now() : s.logStoppedAt })),

  setRealtime: (data, source = {}) => set((s) => {
    if (!data || s.connection?.status !== 'connected' ||
      (s.connection.handshakeStatus && s.connection.handshakeStatus !== 'ok') ||
      (s.connection.validationStatus && !['ready', 'review'].includes(s.connection.validationStatus)) ||
      (source.ini && source.ini !== s.parsedIni)) return {};
    const now = Date.now(), key = `${s.connection?.sessionId}:${s.projectEpoch}`;
    const times = [...(s.realtimeSourceKey === key ? s.realtimePacketTimes || [] : []).filter(t => now - t < 2000 && t < now).slice(-19), now];
    const newState = { realtime: data, realtimeError: null, realtimeReceivedAt: now,
      realtimePacketTimes: times, realtimeSourceKey: key, realtimeRateHz: times.length > 1 ? (times.length - 1) * 1000 / (now - times[0]) : null,
      driveModeStatus: data.driveMode ? { ...data.driveMode, receivedAt: now, session: s.connection?.sessionId, epoch: s.projectEpoch } : null };
    if (s.logRecording && (!s.logSourceKey || s.logSourceKey === key)) {
      const entry = { ...data, timestamp: now, source: { sessionId: s.connection?.sessionId,
        projectEpoch: s.projectEpoch, projectName: s.currentProject?.projectName,
        signature: s.connection?.firmwareSignature,
        o2Enabled: Number.isFinite(s.currentProject?.constants?.decodedPages?.[6]?.egoType)
          ? s.currentProject.constants.decodedPages[6].egoType !== 0 : null,
        tpsEndpointsDistinct: Number.isFinite(s.currentProject?.constants?.decodedPages?.[1]?.tpsMin) && Number.isFinite(s.currentProject?.constants?.decodedPages?.[1]?.tpsMax)
          ? s.currentProject.constants.decodedPages[1].tpsMin !== s.currentProject.constants.decodedPages[1].tpsMax : null } };
      // Limit log entries to 10,000 pts (~15-20 mins)
      newState.logEntries = [...s.logEntries.slice(-9999), entry];
    } else if (s.logRecording) {
      newState.logRecording = false; newState.logStoppedAt = now;
    }
    return newState;
  }),

  setLogRecording: (val) => set(s => {
    const now = Date.now();
    if (!val) return { logRecording: false, logStoppedAt: now };
    if (s.realtimeError || s.connection?.handshakeStatus !== 'ok' ||
        telemetryState(s.connection?.status === 'connected', s.realtimeReceivedAt, now) !== 'live') return {};
    return { logRecording: true, logStartedAt: now, logStoppedAt: null,
      logSourceKey: `${s.connection?.sessionId}:${s.projectEpoch}` };
  }),

  appendLogEntry: (entry) =>
    set((s) => ({ logEntries: [...s.logEntries.slice(-9999), entry] })),

  clearLog: () => set(s => ({ logEntries: [], logStartedAt: s.logRecording ? Date.now() : null, logStoppedAt: null })),
});
