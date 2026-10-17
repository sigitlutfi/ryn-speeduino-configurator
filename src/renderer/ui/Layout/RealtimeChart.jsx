import React, { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { appendPlotSample, telemetryPlotRange } from '../../../shared/protocol/telemetry-plot.js'

const format = (value, digits = 0) => Number.isFinite(value) ? value.toFixed(digits) : '—'

export default function RealtimeChart({ label, color = '#67e8f9', min = 0, max = 100,
  value = null, sampleTime = null, active = false, seriesKey = '', unit = '', decimals = 0, compact = false }) {
  const container = useRef(null), plot = useRef(null)
  const history = useRef({ ts: [], vals: [], lastReceivedAt: null })
  useEffect(() => {
    if (!container.current) return
    history.current = { ts: [], vals: [], lastReceivedAt: null }
    const now = Date.now() / 1000
    const chart = new uPlot({
      width: Math.max(120, container.current.clientWidth), height: 154,
      legend: { show: false }, cursor: { show: true, drag: { x: false, y: false, setScale: false } },
      padding: [8, 8, 4, 0],
      axes: [
        { stroke: '#64748b', font: '10px ui-monospace, monospace', size: 25, ticks: { show: false },
          grid: { show: false }, values: (_u, ticks) => ticks.map(t => {
            const end = history.current.ts.at(-1) ?? now
            return `${Math.min(0, Math.round(t - end))}s`
          }) },
        { stroke: '#94a3b8', font: '10px ui-monospace, monospace', size: 44, ticks: { show: false },
          grid: { stroke: 'rgba(148,163,184,0.08)', width: 1 },
          values: (_u, ticks) => ticks.map(t => format(t, Math.min(decimals, 2))) },
      ],
      scales: { x: { time: false, range: () => { const end = history.current.ts.at(-1) ?? now; return [end - 30, end] } },
        y: { range: (_u, lo, hi) => telemetryPlotRange(min, max, lo, hi) } },
      series: [{}, { label, stroke: color, width: 1.8, spanGaps: false, points: { show: false } }],
    }, [[now], [null]], container.current)
    plot.current = chart
    const resize = () => {
      if (!container.current) return
      const width = Math.max(120, Math.floor(container.current.clientWidth))
      if (width !== chart.width) chart.setSize({ width, height: 154 })
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    observer?.observe(container.current)
    window.addEventListener('resize', resize)
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); chart.destroy(); plot.current = null }
  }, [label, color, min, max, decimals, unit, seriesKey])

  useEffect(() => {
    if (!plot.current) return
    if (appendPlotSample(history.current, active ? value : null, sampleTime)) {
      plot.current.setData([history.current.ts, history.current.vals])
    }
  }, [value, sampleTime, active, label, color, min, max, decimals, unit, seriesKey])

  return <div className={`flex min-w-0 flex-1 flex-col ${compact ? '' : 'rounded-2xl border border-white/10 bg-slate-950/75 p-4'}`}>
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold tabular-nums text-slate-100">{active ? format(value, decimals) : '—'}</span>
        <span className="text-xs text-slate-400">{unit}</span>
      </div>
      {!compact && <span className="text-xs text-slate-300">{label}</span>}
    </div>
    <div ref={container} role="img" aria-label={`${label} trace, last 30 seconds${active ? '' : ', no live data'}`} className="min-h-[154px] min-w-0 w-full" />
    <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[10px] text-slate-500">
      <span>30 s window · {active ? 'live' : 'paused'}</span><span>Auto range</span>
    </div>
  </div>
}
