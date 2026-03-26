import React, { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

const MAX_POINTS = 300; // ~30 seconds at 10 Hz

export default function RealtimeChart({ getValue, label, color = '#39d353', min = 0, max = 8000 }) {
  const containerRef = useRef(null);
  const plotRef = useRef(null);
  const dataRef = useRef({ ts: [], vals: [] });

  useEffect(() => {
    if (!containerRef.current) return;

    const opts = {
      width: containerRef.current.clientWidth || 600,
      height: 160,
      cursor: { show: false },
      legend: { show: false },
      axes: [
        {
          show: true,
          stroke: '#8b949e',
          grid: { stroke: '#21262d', width: 1 },
          ticks: { show: false },
          label: '',
          values: (u, vals) => vals.map(() => ''),
        },
        {
          show: true,
          stroke: '#8b949e',
          grid: { stroke: '#21262d', width: 1 },
          ticks: { show: false },
          label: '',
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
          width: 2,
          fill: color + '22',
        },
      ],
    };

    const now = Date.now() / 1000;
    const emptyData = [[now], [0]];
    plotRef.current = new uPlot(opts, emptyData, containerRef.current);

    const handleResize = () => {
      if (plotRef.current && containerRef.current) {
        plotRef.current.setSize({ width: containerRef.current.clientWidth, height: 160 });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, []);

  // Push new data point from parent
  useEffect(() => {
    let rafId;
    const tick = () => {
      if (plotRef.current && getValue) {
        const val = getValue();
        const now = Date.now() / 1000;
        const d = dataRef.current;
        d.ts.push(now);
        d.vals.push(val);
        if (d.ts.length > MAX_POINTS) {
          d.ts.shift();
          d.vals.shift();
        }
        plotRef.current.setData([d.ts, d.vals]);
      }
      rafId = requestAnimationFrame(tick);
    };
    // throttle to ~10 fps to match ECU data rate
    let last = 0;
    const throttled = (ts) => {
      if (ts - last > 100) { last = ts; tick(); return; }
      rafId = requestAnimationFrame(throttled);
    };
    rafId = requestAnimationFrame(throttled);
    return () => cancelAnimationFrame(rafId);
  }, [getValue]);

  return (
    <div className="glass rounded-xl p-4 relative overflow-hidden h-[200px]">
      <div className="text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest mb-3 flex justify-between items-center">
        {label}
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
      </div>
      <div ref={containerRef} className="w-full h-[140px]" />
    </div>
  );
}

