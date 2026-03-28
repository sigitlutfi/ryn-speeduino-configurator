export const DEFAULT_REALTIME_WIDGET_PRESETS = [
  {
    id: "tune",
    name: "Tune",
    widgets: [
      { id: "rpm", type: "gauge", channelKey: "rpm", color: "cyan", enabled: true },
      { id: "load", type: "gauge", channelKey: "map", color: "cyan", enabled: true },
      { id: "tps", type: "gauge", channelKey: "tps", color: "green", enabled: true },
      { id: "afr", type: "gauge", channelKey: "afr", color: "red", enabled: true },
      { id: "advance", type: "gauge", channelKey: "advance", color: "purple", enabled: true },
      { id: "coolant", type: "gauge", channelKey: "coolant", color: "orange", enabled: true },
      { id: "battery", type: "gauge", channelKey: "battery", color: "green", enabled: true },
      { id: "pw1", type: "digital", channelKey: "pw1", color: "cyan", enabled: true },
      { id: "engine-state", type: "status", channelKey: "engineState", color: "green", enabled: true },
      { id: "rpm-trace", type: "trace", channelKey: "rpm", color: "cyan", enabled: true },
      { id: "afr-trace", type: "trace", channelKey: "afr", color: "red", enabled: true },
      { id: "map-trace", type: "trace", channelKey: "map", color: "purple", enabled: true },
      { id: "temps", type: "digital", channelKey: "thermalPair", color: "orange", enabled: true },
    ],
  },
  {
    id: "street",
    name: "Street",
    widgets: [
      { id: "rpm-street", type: "gauge", channelKey: "rpm", color: "cyan", enabled: true },
      { id: "map-street", type: "gauge", channelKey: "map", color: "cyan", enabled: true },
      { id: "tps-street", type: "gauge", channelKey: "tps", color: "green", enabled: true },
      { id: "afr-street", type: "gauge", channelKey: "afr", color: "red", enabled: true },
      { id: "coolant-street", type: "gauge", channelKey: "coolant", color: "orange", enabled: true },
      { id: "speed-street", type: "digital", channelKey: "vss", color: "green", enabled: true },
      { id: "gear-street", type: "digital", channelKey: "gear", color: "purple", enabled: true },
      { id: "status-street", type: "status", channelKey: "engineState", color: "green", enabled: true },
      { id: "battery-street", type: "digital", channelKey: "battery", color: "green", enabled: true },
    ],
  },
  {
    id: "diag",
    name: "Diag",
    widgets: [
      { id: "rpm-diag", type: "trace", channelKey: "rpm", color: "cyan", enabled: true },
      { id: "map-diag", type: "trace", channelKey: "map", color: "purple", enabled: true },
      { id: "battery-diag", type: "trace", channelKey: "battery", color: "green", enabled: true },
      { id: "freeram-diag", type: "digital", channelKey: "freeRAM", color: "cyan", enabled: true },
      { id: "loops-diag", type: "digital", channelKey: "loopsPerSecond", color: "green", enabled: true },
      { id: "sync-loss-diag", type: "digital", channelKey: "syncLossCounter", color: "red", enabled: true },
      { id: "protect-diag", type: "status", channelKey: "protectState", color: "red", enabled: true },
      { id: "engine-diag", type: "status", channelKey: "engineState", color: "green", enabled: true },
    ],
  },
];

export function createDefaultRealtimeDashboard() {
  return {
    version: 1,
    activePresetId: "tune",
    presets: DEFAULT_REALTIME_WIDGET_PRESETS,
  };
}

export function normalizeRealtimeDashboard(value) {
  const fallback = createDefaultRealtimeDashboard();
  if (!value || typeof value !== "object") return fallback;

  const presets = Array.isArray(value.presets) && value.presets.length > 0
    ? value.presets.map((preset, presetIndex) => ({
        id: preset.id || `preset-${presetIndex + 1}`,
        name: preset.name || `Preset ${presetIndex + 1}`,
        widgets: Array.isArray(preset.widgets)
          ? preset.widgets
              .filter(Boolean)
              .map((widget, widgetIndex) => ({
                id: widget.id || `${preset.id || `preset-${presetIndex + 1}`}-widget-${widgetIndex + 1}`,
                type: widget.type || "digital",
                channelKey: widget.channelKey || "rpm",
                color: widget.color || "cyan",
                enabled: widget.enabled !== false,
              }))
          : [],
      }))
    : fallback.presets;

  const activePresetId = presets.some((preset) => preset.id === value.activePresetId)
    ? value.activePresetId
    : presets[0]?.id || fallback.activePresetId;

  return {
    version: 1,
    activePresetId,
    presets,
  };
}
