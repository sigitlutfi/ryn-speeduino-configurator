import React, { useCallback } from "react";
import Gauge from "../../../ui/Gauge/Index.jsx";
import RealtimeChart from "../../../ui/Layout/RealtimeChart.jsx";

function toneClasses(tone) {
  switch (tone) {
    case "green":
      return "border-neon-green/30 bg-neon-green/10 text-neon-green";
    case "red":
      return "border-neon-red/30 bg-neon-red/10 text-neon-red";
    case "yellow":
      return "border-neon-yellow/30 bg-neon-yellow/10 text-neon-yellow";
    case "orange":
      return "border-neon-orange/30 bg-neon-orange/10 text-neon-orange";
    case "purple":
      return "border-neon-purple/30 bg-neon-purple/10 text-neon-purple";
    default:
      return "border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan";
  }
}

function TileShell({ title, subtitle, children }) {
  return (
    <div className="glass rounded-2xl border border-white/5 p-4 min-h-[240px] h-full flex flex-col overflow-hidden">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[10px] font-orbitron font-bold uppercase tracking-[0.24em] text-white/90">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-[10px] text-white/35 uppercase tracking-[0.18em] font-bold">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function DigitalWidget({ display, color }) {
  if (display.lines?.length) {
    return (
      <div className="grid h-full grid-rows-2 gap-3">
        {display.lines.map((line) => (
          <div
            key={line.label}
            className="relative overflow-hidden rounded-2xl border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-4 py-4"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="text-[9px] font-orbitron font-bold uppercase tracking-[0.22em] text-white/38">
                {line.label}
              </div>
              {line.unit ? (
                <div className="rounded-full border border-white/8 bg-black/30 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/34">
                  {line.unit}
                </div>
              ) : null}
            </div>
            <div className="mt-3 font-mono text-[30px] font-black leading-none tracking-tight text-white">
              {line.value}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="relative overflow-hidden rounded-[28px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_55%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-5 py-6">
        <div
          className="pointer-events-none absolute inset-x-4 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${color}88, transparent)` }}
        />
        <div
          className="pointer-events-none absolute -right-8 top-4 h-16 w-16 rounded-full blur-2xl"
          style={{ backgroundColor: `${color}22` }}
        />
        <div className="text-[9px] font-orbitron font-bold uppercase tracking-[0.24em] text-white/32">
          Live Value
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="min-w-0 font-mono text-[56px] font-black leading-none tracking-[-0.05em] text-white">
            {display.text ?? display.value}
          </div>
          {display.unit ? (
            <div className="mb-1 rounded-full border border-white/8 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/42">
              {display.unit}
            </div>
          ) : null}
        </div>
        <div
          className="mt-5 h-[2px] w-16 rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
        />
      </div>
    </div>
  );
}

function StatusWidget({ display }) {
  return (
    <div className="grid h-full grid-cols-2 gap-3 content-center">
      {display.groups?.map((group) => (
        <div
          key={group.label}
          className={`relative overflow-hidden rounded-2xl border px-3 py-3 text-left transition-all ${
            group.active
              ? `${toneClasses(group.tone)} shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`
              : "border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] text-white/25"
          }`}
        >
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-px ${
              group.active ? "" : "bg-white/5"
            }`}
            style={group.active ? { background: "linear-gradient(90deg, transparent, currentColor, transparent)" } : undefined}
          />
          <div className="flex items-start justify-between gap-2">
            <div className="text-[9px] font-orbitron font-bold uppercase tracking-[0.18em]">
              {group.label}
            </div>
            <div
              className={`mt-0.5 h-2.5 w-2.5 rounded-full ${
                group.active ? "" : "bg-white/12"
              }`}
              style={group.active ? { backgroundColor: "currentColor", boxShadow: "0 0 10px currentColor" } : undefined}
            />
          </div>
          <div className="mt-4 text-[10px] font-mono font-black tracking-[0.18em]">
            {group.active ? "ON" : "OFF"}
          </div>
        </div>
      ))}
    </div>
  );
}

function TraceWidget({ channelKey, display, getRealtimeValue, color }) {
  const getter = useCallback(
    () => getRealtimeValue(channelKey),
    [getRealtimeValue, channelKey],
  );

  return (
    <div className="h-full">
      <RealtimeChart
        getValue={getter}
        label={display.label}
        color={color}
        min={display.traceMin ?? display.min ?? 0}
        max={display.traceMax ?? display.max ?? 100}
        value={display.value ?? 0}
        unit={display.unit ?? ""}
        decimals={display.decimals ?? 0}
      />
    </div>
  );
}

export default function WidgetTile({
  widget,
  display,
  color,
  getRealtimeValue,
}) {
  const subtitle =
    widget.type === "trace"
      ? "Live trace"
      : widget.type === "status"
        ? "State indicators"
        : widget.type === "digital"
          ? "Precision view"
          : "Live gauge";

  return (
    <TileShell title={display.label} subtitle={subtitle}>
      {widget.type === "gauge" ? (
        <div className="h-full flex items-center justify-center">
          <Gauge
            label={display.label}
            value={display.value ?? 0}
            min={display.min ?? 0}
            max={display.max ?? 100}
            unit={display.unit ?? ""}
            decimals={display.decimals ?? 0}
            warning={display.warning}
            danger={display.danger}
            warningMode={display.warningMode ?? "high"}
            size={176}
          />
        </div>
      ) : null}

      {widget.type === "digital" ? (
        <DigitalWidget display={display} color={color} />
      ) : null}
      {widget.type === "status" ? <StatusWidget display={display} /> : null}
      {widget.type === "trace" ? (
        <TraceWidget
          channelKey={widget.channelKey}
          display={display}
          getRealtimeValue={getRealtimeValue}
          color={color}
        />
      ) : null}
    </TileShell>
  );
}
