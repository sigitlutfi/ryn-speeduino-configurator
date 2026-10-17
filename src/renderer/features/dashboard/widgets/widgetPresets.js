export const DEFAULT_REALTIME_WIDGET_PRESETS = [
  {
    id: "tune",
    name: "Tune",
    widgets: [
      { id: "rpm", type: "gauge", channelKey: "rpm", color: "cyan", enabled: true },
      { id: "load", type: "gauge", channelKey: "map", color: "cyan", enabled: true },
      { id: "tps", type: "gauge", channelKey: "tps", color: "green", enabled: true },
      { id: "afr", type: "gauge", channelKey: "afr", color: "red", enabled: true },
      { id: "advance", type: "digital", channelKey: "advance", color: "purple", enabled: true },
      { id: "coolant", type: "digital", channelKey: "coolant", color: "orange", enabled: true },
      { id: "battery", type: "digital", channelKey: "battery", color: "green", enabled: true },
      { id: "pw1", type: "digital", channelKey: "pw1", color: "cyan", enabled: true },
      { id: "engine-state", type: "status", channelKey: "engineState", color: "green", enabled: true },
      { id: "rpm-trace", type: "trace", channelKey: "rpm", color: "cyan", enabled: true },
      { id: "afr-trace", type: "trace", channelKey: "afr", color: "red", enabled: true },
      { id: "map-trace", type: "trace", channelKey: "map", color: "purple", enabled: true },
      { id: "dwell", type: "digital", channelKey: "dwell", color: "purple", enabled: true },
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
      { id: "coolant-street", type: "digital", channelKey: "coolant", color: "orange", enabled: true },
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
    version: 2,
    activePresetId: "tune",
    presets: DEFAULT_REALTIME_WIDGET_PRESETS.map(p => ({ ...p, widgets: p.widgets.map(w => ({ ...w, span: ['trace', 'status'].includes(w.type) ? 2 : 1 })) })),
  };
}

const text = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim() : fallback

export function normalizeRealtimeDashboard(value) {
  const fallback = createDefaultRealtimeDashboard()
  if (!value || typeof value !== 'object') return fallback
  const presetIds = new Set()
  const unique = (id, used) => {
    const base = id
    let suffix = 2
    while (used.has(id)) id = `${base}-${suffix++}`
    used.add(id)
    return id
  }
  const presets = Array.isArray(value.presets) ? value.presets.filter(p => p && typeof p === 'object').map((preset, index) => {
    const id = unique(text(preset.id, `preset-${index + 1}`), presetIds), ids = new Set()
    return { id, name: text(preset.name, `Preset ${index + 1}`), widgets: Array.isArray(preset.widgets)
      ? preset.widgets.filter(w => w && typeof w === 'object').map((widget, wi) => ({
        id: unique(text(widget.id, `${id}-widget-${wi + 1}`), ids),
        type: ['digital', 'gauge', 'trace', 'status'].includes(widget.type) ? widget.type : 'digital',
        channelKey: text(widget.channelKey, 'rpm'),
        color: ['cyan', 'green', 'red', 'orange', 'purple'].includes(widget.color) ? widget.color : 'cyan',
        enabled: widget.enabled !== false, span: widget.span === 2 || (widget.span === undefined && widget.type === 'trace') ? 2 : 1,
      })) : [] }
  }) : []
  if (!presets.length) return fallback
  return { version: 2, presets, activePresetId: presets.some(p => p.id === value.activePresetId) ? value.activePresetId : presets[0].id }
}
