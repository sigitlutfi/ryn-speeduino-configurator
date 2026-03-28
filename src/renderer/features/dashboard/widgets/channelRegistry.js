function formatFixed(value, digits = 0) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(digits);
}

function createEngineStatusGroups(rt) {
  const engine = rt.engine || {};
  return [
    { label: "Running", active: !!engine.running, tone: "green" },
    { label: "Sync", active: !!engine.sync, tone: "cyan" },
    { label: "Warmup", active: !!engine.warmup, tone: "orange" },
    { label: "ASE", active: !!engine.ase, tone: "purple" },
    { label: "DFCO", active: !!engine.dfco, tone: "cyan" },
    { label: "Burn", active: !!engine.burnPending, tone: "yellow" },
  ];
}

function createProtectStatusGroups(rt) {
  const engine = rt.engine || {};
  return [
    { label: "Protect", active: !!engine.protectActive, tone: "red" },
    { label: "RPM", active: !!engine.protectRPM, tone: "red" },
    { label: "MAP", active: !!engine.protectMAP, tone: "red" },
    { label: "CLT", active: !!engine.protectCLT, tone: "red" },
    { label: "WMI", active: !!engine.wmiEmpty, tone: "yellow" },
    { label: "IO", active: !!engine.ioError, tone: "red" },
  ];
}

export function createRealtimeChannelRegistry(unitsApi) {
  const { convertTemp, convertPress, convertSpeed, tempUnit, pressUnit, speedUnit } = unitsApi;

  return {
    rpm: {
      label: "RPM",
      category: "engine",
      defaultWidget: "gauge",
      supportedWidgets: ["gauge", "digital", "trace"],
      getDisplay: (rt) => ({
        label: "RPM",
        value: rt.rpm ?? 0,
        unit: "rpm",
        min: 0,
        max: 8000,
        decimals: 0,
        warning: 6000,
        danger: 7000,
        traceMin: 0,
        traceMax: 8000,
      }),
    },
    map: {
      label: "Load",
      category: "engine",
      defaultWidget: "gauge",
      supportedWidgets: ["gauge", "digital", "trace"],
      getDisplay: (rt) => {
        const value = convertPress(rt.map ?? 0);
        const unit = pressUnit();
        return {
          label: "Load",
          value,
          unit,
          min: convertPress(20),
          max: convertPress(110),
          decimals: unit === "kPa" ? 0 : 1,
          traceMin: convertPress(20),
          traceMax: convertPress(110),
        };
      },
    },
    tps: {
      label: "TPS",
      category: "engine",
      defaultWidget: "gauge",
      supportedWidgets: ["gauge", "digital", "trace"],
      getDisplay: (rt) => ({
        label: "TPS",
        value: rt.tps ?? 0,
        unit: "%",
        min: 0,
        max: 100,
        decimals: 0,
        warning: 85,
        danger: 95,
        traceMin: 0,
        traceMax: 100,
      }),
    },
    afr: {
      label: "AFR",
      category: "fuel",
      defaultWidget: "gauge",
      supportedWidgets: ["gauge", "digital", "trace"],
      getDisplay: (rt) => ({
        label: "AFR",
        value: rt.afr ?? 0,
        unit: "AFR",
        min: 9,
        max: 20,
        decimals: 1,
        warning: 16,
        danger: 17,
        traceMin: 9,
        traceMax: 20,
      }),
    },
    advance: {
      label: "Advance",
      category: "spark",
      defaultWidget: "gauge",
      supportedWidgets: ["gauge", "digital", "trace"],
      getDisplay: (rt) => ({
        label: "Advance",
        value: rt.advance ?? 0,
        unit: "deg",
        min: -10,
        max: 50,
        decimals: 0,
        traceMin: -10,
        traceMax: 50,
      }),
    },
    coolant: {
      label: "Coolant",
      category: "thermal",
      defaultWidget: "gauge",
      supportedWidgets: ["gauge", "digital", "trace"],
      getDisplay: (rt) => ({
        label: "Coolant",
        value: convertTemp(rt.coolant ?? 0),
        unit: tempUnit(),
        min: convertTemp(-20),
        max: convertTemp(120),
        decimals: 0,
        warning: convertTemp(100),
        danger: convertTemp(110),
        traceMin: convertTemp(-20),
        traceMax: convertTemp(120),
      }),
    },
    iat: {
      label: "IAT",
      category: "thermal",
      defaultWidget: "gauge",
      supportedWidgets: ["gauge", "digital", "trace"],
      getDisplay: (rt) => ({
        label: "IAT",
        value: convertTemp(rt.iat ?? 0),
        unit: tempUnit(),
        min: convertTemp(-20),
        max: convertTemp(100),
        decimals: 0,
        warning: convertTemp(50),
        danger: convertTemp(65),
        traceMin: convertTemp(-20),
        traceMax: convertTemp(100),
      }),
    },
    battery: {
      label: "Battery",
      category: "electrical",
      defaultWidget: "gauge",
      supportedWidgets: ["gauge", "digital", "trace"],
      getDisplay: (rt) => ({
        label: "Battery",
        value: rt.battery ?? 0,
        unit: "V",
        min: 8,
        max: 16,
        decimals: 1,
        warning: 11,
        danger: 10,
        warningMode: "low",
        traceMin: 8,
        traceMax: 16,
      }),
    },
    pw1: {
      label: "PW1",
      category: "fuel",
      defaultWidget: "digital",
      supportedWidgets: ["digital", "trace"],
      getDisplay: (rt) => ({
        label: "PW1",
        value: rt.pw1 ?? 0,
        unit: "ms",
        text: formatFixed(rt.pw1 ?? 0, 2),
        traceMin: 0,
        traceMax: 20,
      }),
    },
    vss: {
      label: "Speed",
      category: "vehicle",
      defaultWidget: "digital",
      supportedWidgets: ["digital", "gauge", "trace"],
      getDisplay: (rt) => ({
        label: "Speed",
        value: convertSpeed(rt.vss ?? 0),
        unit: speedUnit(),
        text: formatFixed(convertSpeed(rt.vss ?? 0), 0),
        min: 0,
        max: convertSpeed(240),
        decimals: 0,
        traceMin: 0,
        traceMax: convertSpeed(240),
      }),
    },
    gear: {
      label: "Gear",
      category: "vehicle",
      defaultWidget: "digital",
      supportedWidgets: ["digital"],
      getDisplay: (rt) => ({
        label: "Gear",
        value: rt.gear ?? 0,
        unit: "",
        text: `${rt.gear ?? 0}`,
      }),
    },
    freeRAM: {
      label: "Free RAM",
      category: "diagnostics",
      defaultWidget: "digital",
      supportedWidgets: ["digital"],
      getDisplay: (rt) => ({
        label: "Free RAM",
        value: rt.freeRAM ?? 0,
        unit: "bytes",
        text: formatFixed(rt.freeRAM ?? 0, 0),
      }),
    },
    loopsPerSecond: {
      label: "Loop Rate",
      category: "diagnostics",
      defaultWidget: "digital",
      supportedWidgets: ["digital"],
      getDisplay: (rt) => ({
        label: "Loop Rate",
        value: rt.loopsPerSecond ?? 0,
        unit: "lps",
        text: formatFixed(rt.loopsPerSecond ?? 0, 0),
      }),
    },
    syncLossCounter: {
      label: "Sync Loss",
      category: "diagnostics",
      defaultWidget: "digital",
      supportedWidgets: ["digital"],
      getDisplay: (rt) => ({
        label: "Sync Loss",
        value: rt.syncLossCounter ?? 0,
        unit: "",
        text: formatFixed(rt.syncLossCounter ?? 0, 0),
      }),
    },
    thermalPair: {
      label: "Thermal",
      category: "thermal",
      defaultWidget: "digital",
      supportedWidgets: ["digital"],
      getDisplay: (rt) => ({
        label: "Thermal",
        value: 0,
        unit: "",
        lines: [
          { label: "CLT", value: formatFixed(convertTemp(rt.coolant ?? 0), 0), unit: tempUnit() },
          { label: "IAT", value: formatFixed(convertTemp(rt.iat ?? 0), 0), unit: tempUnit() },
        ],
      }),
    },
    engineState: {
      label: "Engine State",
      category: "status",
      defaultWidget: "status",
      supportedWidgets: ["status"],
      getDisplay: (rt) => ({
        label: "Engine State",
        groups: createEngineStatusGroups(rt),
      }),
    },
    protectState: {
      label: "Protect State",
      category: "status",
      defaultWidget: "status",
      supportedWidgets: ["status"],
      getDisplay: (rt) => ({
        label: "Protection",
        groups: createProtectStatusGroups(rt),
      }),
    },
  };
}

export function getChannelOptions(registry) {
  return Object.entries(registry).map(([key, entry]) => ({
    key,
    label: entry.label,
    supportedWidgets: entry.supportedWidgets || [],
    defaultWidget: entry.defaultWidget || "digital",
    category: entry.category || "general",
  }));
}
