import React, { useEffect, useMemo, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

const MAX_POINTS = 300;

function formatValue(value, decimals) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(decimals);
}

export default function RealtimeChart({
  getValue,
  label,
  color = "#39d353",
  min = 0,
  max = 8000,
  value = 0,
  unit = "",
  decimals = 0,
}) {
  const containerRef = useRef(null);
  const plotRef = useRef(null);
  const dataRef = useRef({ ts: [], vals: [] });

  const currentValue = useMemo(() => formatValue(value, decimals), [value, decimals]);
  const minValue = useMemo(() => formatValue(min, decimals > 0 ? Math.min(decimals, 1) : 0), [min, decimals]);
  const maxValue = useMemo(() => formatValue(max, decimals > 0 ? Math.min(decimals, 1) : 0), [max, decimals]);

  useEffect(() => {
    if (!containerRef.current) return;

    const opts = {
      width: containerRef.current.clientWidth || 600,
      height: 168,
      cursor: { show: false },
      legend: { show: false },
      padding: [10, 10, 14, 10],
      axes: [
        {
          show: true,
          stroke: "rgba(255,255,255,0.12)",
          grid: { stroke: "rgba(255,255,255,0.05)", width: 1 },
          ticks: { show: false },
          values: () => [],
          border: { show: false },
        },
        {
          show: true,
          stroke: "rgba(255,255,255,0.12)",
          grid: { stroke: "rgba(255,255,255,0.05)", width: 1 },
          ticks: { show: false },
          size: 42,
          values: (u, vals) => vals.map((tick) => formatValue(tick, decimals > 0 ? Math.min(decimals, 1) : 0)),
          border: { show: false },
        },
      ],
      scales: {
        x: { time: true },
        y: { range: [min, max] },
      },
      series: [
        {},
        {
          label,
          stroke: color,
          width: 2.2,
          fill: `${color}18`,
        },
      ],
    };

    const now = Date.now() / 1000;
    const emptyData = [[now], [0]];
    plotRef.current = new uPlot(opts, emptyData, containerRef.current);

    const handleResize = () => {
      if (plotRef.current && containerRef.current) {
        plotRef.current.setSize({ width: containerRef.current.clientWidth, height: 168 });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, []);

  useEffect(() => {
    let rafId;
    const tick = () => {
      if (plotRef.current && getValue) {
        const nextValue = getValue();
        const now = Date.now() / 1000;
        const d = dataRef.current;
        d.ts.push(now);
        d.vals.push(nextValue);
        if (d.ts.length > MAX_POINTS) {
          d.ts.shift();
          d.vals.shift();
        }
        plotRef.current.setData([d.ts, d.vals]);
      }
      rafId = requestAnimationFrame(tick);
    };

    let last = 0;
    const throttled = (ts) => {
      if (ts - last > 100) {
        last = ts;
        tick();
        return;
      }
      rafId = requestAnimationFrame(throttled);
    };

    rafId = requestAnimationFrame(throttled);
    return () => cancelAnimationFrame(rafId);
  }, [getValue]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),rgba(255,255,255,0.02)_55%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4">
      <div
        className="pointer-events-none absolute inset-x-5 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}88, transparent)` }}
      />
      <div
        className="pointer-events-none absolute -right-10 top-2 h-20 w-20 rounded-full blur-3xl"
        style={{ backgroundColor: `${color}20` }}
      />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-orbitron font-bold uppercase tracking-[0.24em] text-white/34">
            Live trace
          </div>
          <div className="mt-2 font-mono text-[28px] font-black leading-none tracking-tight text-white">
            {currentValue}
            {unit ? <span className="ml-2 text-[11px] text-white/36">{unit}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/8 bg-black/25 px-3 py-1">
          <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          <span className="text-[9px] font-orbitron font-bold uppercase tracking-[0.2em] text-white/40">
            {label}
          </span>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
        <span>Min {minValue}</span>
        <span>Max {maxValue}</span>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 rounded-2xl bg-black/20 p-2" />
    </div>
  );
}
