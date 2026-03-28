import React, { useMemo, useState } from "react";
import { useStore } from "../../core/store.js";
import { getAccent } from "../../core/theme.js";
import {
  normalizeRealtimeDashboard,
} from "./widgets/widgetPresets.js";
import { createRealtimeChannelRegistry, getChannelOptions } from "./widgets/channelRegistry.js";
import WidgetTile from "./widgets/WidgetTile.jsx";
import { Plus, Pencil, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

const WIDGET_TYPES = ["gauge", "digital", "status", "trace"];

function DashboardToolbar({ activePreset, presets, onPresetChange, editing, onToggleEditing }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-sm font-orbitron font-bold uppercase tracking-[0.28em] text-white">
          Realtime Dashboard
        </h1>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
          Dynamic telemetry widgets
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-1">
        {presets.map((preset) => {
          const isActive = preset.id === activePreset?.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPresetChange(preset.id)}
              className={`rounded-xl px-3 py-2 text-[10px] font-orbitron font-bold uppercase tracking-[0.18em] transition-all ${
                isActive
                  ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30"
                  : "text-white/35 border border-transparent hover:text-white hover:bg-white/5"
              }`}
            >
              {preset.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onToggleEditing}
          className={`ml-2 rounded-xl px-3 py-2 text-[10px] font-orbitron font-bold uppercase tracking-[0.18em] transition-all ${
            editing
              ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30"
              : "text-white/40 hover:text-white hover:bg-white/5 border border-transparent"
          }`}
        >
          {editing ? "Done" : "Edit Layout"}
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const currentProject = useStore((s) => s.currentProject);
  const realtime = useStore((s) => s.realtime);
  const settings = useStore((s) => s.settings);
  const connectionStatus = useStore((s) => s.connection.status);
  const updateRealtimeDashboard = useStore((s) => s.updateRealtimeDashboard);
  const convertTemp = useStore((s) => s.convertTemp);
  const convertPress = useStore((s) => s.convertPress);
  const convertSpeed = useStore((s) => s.convertSpeed);
  const tempUnit = useStore((s) => s.tempUnit);
  const pressUnit = useStore((s) => s.pressUnit);
  const speedUnit = useStore((s) => s.speedUnit);
  const [editing, setEditing] = useState(false);

  const accent = getAccent(settings?.accentColor);
  const isConnected = connectionStatus === "connected";

  const dashboardConfig = useMemo(
    () => normalizeRealtimeDashboard(settings?.realtimeDashboard),
    [settings?.realtimeDashboard],
  );

  const activePreset = dashboardConfig.presets.find(
    (preset) => preset.id === dashboardConfig.activePresetId,
  ) || dashboardConfig.presets[0];

  const registry = useMemo(
    () =>
      createRealtimeChannelRegistry({
        convertTemp,
        convertPress,
        convertSpeed,
        tempUnit,
        pressUnit,
        speedUnit,
      }),
    [convertTemp, convertPress, convertSpeed, tempUnit, pressUnit, speedUnit],
  );

  const getRealtimeValue = (channelKey) => {
    const entry = registry[channelKey];
    return entry?.getDisplay(realtime)?.value ?? 0;
  };

  const handlePresetChange = (presetId) => {
    updateRealtimeDashboard((current) => ({
      ...current,
      activePresetId: presetId,
    }));
  };

  const channelOptions = useMemo(() => getChannelOptions(registry), [registry]);

  const updateActivePreset = (updater) => {
    if (!activePreset) return;
    updateRealtimeDashboard((current) => ({
      ...current,
      presets: current.presets.map((preset) => {
        if (preset.id !== activePreset.id) return preset;
        return updater(preset);
      }),
    }));
  };

  const moveWidget = (widgetId, direction) => {
    updateActivePreset((preset) => {
      const widgets = [...preset.widgets];
      const index = widgets.findIndex((widget) => widget.id === widgetId);
      if (index === -1) return preset;
      const nextIndex = direction === "left" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= widgets.length) return preset;
      [widgets[index], widgets[nextIndex]] = [widgets[nextIndex], widgets[index]];
      return { ...preset, widgets };
    });
  };

  const removeWidget = (widgetId) => {
    updateActivePreset((preset) => ({
      ...preset,
      widgets: preset.widgets.filter((widget) => widget.id !== widgetId),
    }));
  };

  const updateWidget = (widgetId, patch) => {
    updateActivePreset((preset) => ({
      ...preset,
      widgets: preset.widgets.map((widget) =>
        widget.id === widgetId ? { ...widget, ...patch } : widget,
      ),
    }));
  };

  const addWidget = () => {
    const defaultChannel = channelOptions[0];
    if (!defaultChannel) return;
    updateActivePreset((preset) => ({
      ...preset,
      widgets: [
        ...preset.widgets,
        {
          id: `${preset.id}-widget-${Date.now()}`,
          type: defaultChannel.defaultWidget,
          channelKey: defaultChannel.key,
          color: "cyan",
          enabled: true,
        },
      ],
    }));
  };

  if (!currentProject) return null;

  const widgets = (activePreset?.widgets || []).filter((widget) => widget.enabled !== false);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-6">
      <DashboardToolbar
        activePreset={activePreset}
        presets={dashboardConfig.presets}
        onPresetChange={handlePresetChange}
        editing={editing}
        onToggleEditing={() => setEditing((value) => !value)}
      />

      <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-orbitron font-bold uppercase tracking-[0.22em] text-white/35">
            {isConnected ? "Live" : "Offline"}
          </span>
          <span
            className={`h-2 w-2 rounded-full ${isConnected ? "animate-pulse" : ""}`}
            style={{ backgroundColor: isConnected ? accent.main : "rgba(255,255,255,0.22)" }}
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
            {widgets.length} widgets loaded
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
            preset: {activePreset?.name || "Tune"}
          </span>
          {editing ? (
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neon-cyan">
              edit mode
            </span>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[11px] font-orbitron font-bold uppercase tracking-[0.22em] text-white">
                Layout Editor
              </h2>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                Move, change, add, or remove dashboard widgets
              </p>
            </div>
            <button
              type="button"
              onClick={addWidget}
              className="inline-flex items-center gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-2 text-[10px] font-orbitron font-bold uppercase tracking-[0.18em] text-neon-cyan transition-all hover:bg-neon-cyan hover:text-black"
            >
              <Plus size={14} />
              Add Widget
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative">
        <div className={`${isConnected ? "" : "pointer-events-none opacity-45 saturate-0 brightness-[0.42] transition-all duration-500"}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-fr">
            {widgets.map((widget) => {
              const channel = registry[widget.channelKey];
              if (!channel) return null;
              const display = channel.getDisplay(realtime);
              return (
                <div key={widget.id} className="h-full flex flex-col gap-2">
                  {editing ? (
                    <div className="rounded-2xl border border-white/5 bg-black/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2 text-[10px] font-orbitron font-bold uppercase tracking-[0.18em] text-white/55">
                          <Pencil size={12} />
                          Widget Controls
                        </div>
                        <button
                          type="button"
                          onClick={() => removeWidget(widget.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-neon-red/25 bg-neon-red/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neon-red"
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
                            Channel
                          </span>
                          <select
                            value={widget.channelKey}
                            onChange={(e) => {
                              const nextChannel = channelOptions.find((option) => option.key === e.target.value);
                              updateWidget(widget.id, {
                                channelKey: e.target.value,
                                type: nextChannel?.supportedWidgets.includes(widget.type)
                                  ? widget.type
                                  : nextChannel?.defaultWidget || "digital",
                              });
                            }}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none"
                          >
                            {channelOptions.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-1">
                          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
                            Widget Type
                          </span>
                          <select
                            value={widget.type}
                            onChange={(e) => updateWidget(widget.id, { type: e.target.value })}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none"
                          >
                            {(channel.supportedWidgets || WIDGET_TYPES).map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveWidget(widget.id, "left")}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60 hover:text-white"
                        >
                          <ChevronLeft size={12} />
                          Left
                        </button>
                        <button
                          type="button"
                          onClick={() => moveWidget(widget.id, "right")}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60 hover:text-white"
                        >
                          Right
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex-1 min-h-0">
                    <WidgetTile
                      widget={widget}
                      display={display}
                      color={accent.main}
                      getRealtimeValue={getRealtimeValue}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {!isConnected ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border border-white/8 bg-black/35 px-4 py-2 text-[10px] font-orbitron font-bold uppercase tracking-[0.22em] text-white/45 backdrop-blur-sm">
              Cluster offline
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
