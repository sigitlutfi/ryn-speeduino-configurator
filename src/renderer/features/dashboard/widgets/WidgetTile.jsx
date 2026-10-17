import React from 'react'
import Gauge from '../../../ui/Gauge/Index.jsx'
import RealtimeChart from '../../../ui/Layout/RealtimeChart.jsx'

const format = (value, digits = 0) => Number.isFinite(value) ? value.toFixed(digits) : '—'
const tones = { green: '#6ee7b7', red: '#fda4af', orange: '#fdba74', yellow: '#fde68a', cyan: '#67e8f9' }

function DigitalWidget({ display, color }) {
  if (display.lines) return <div className="grid flex-1 grid-cols-2 gap-4 items-center">
    {display.lines.map(line => <div key={line.label} className="min-w-0">
      <p className="text-xs text-slate-400">{line.label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-slate-100">{line.value}</p>
      <p className="mt-1 text-xs text-slate-400">{line.unit}</p>
    </div>)}
  </div>
  const numeric = Number.isFinite(display.value), span = display.max - display.min
  const percent = numeric && span > 0 ? Math.max(0, Math.min(100, (display.value - display.min) / span * 100)) : null
  return <div className="flex flex-1 flex-col justify-center gap-5 py-3">
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={`${numeric ? 'text-4xl' : 'text-2xl'} min-w-0 font-mono font-semibold tracking-tight tabular-nums text-slate-100`}>
        {display.text ?? format(display.value, display.decimals)}
      </span>
      <span className="text-sm text-slate-400">{display.unit}</span>
    </div>
    {percent !== null && <div className="h-1 rounded-full bg-white/10" aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
    </div>}
  </div>
}

function StatusWidget({ groups = [] }) {
  return <dl className="grid flex-1 grid-cols-2 content-center gap-x-4 gap-y-3 py-2">
    {groups.map(group => <div key={group.label} className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
      <dt className="text-xs text-slate-400">{group.label}</dt>
      <dd className="font-mono text-xs font-medium" style={{ color: group.active === null ? '#64748b' : group.active ? tones[group.tone] || tones.cyan : '#94a3b8' }}>
        {group.active === null ? '—' : group.active ? 'ON' : 'OFF'}
      </dd>
    </div>)}
  </dl>
}

export default function WidgetTile({ widget, display, color = '#67e8f9', telemetryStatus = 'offline', receivedAt, sourceKey }) {
  const live = telemetryStatus === 'live' && display.available !== false
  const quality = live ? display.quality || 'live' : telemetryStatus === 'live' ? 'unavailable' : telemetryStatus
  const statusText = ({ live: 'LIVE', check: 'CHECK', partial: 'PARTIAL', unavailable: 'NO DATA', offline: 'OFFLINE', stale: 'STALE', waiting: 'WAITING', blocked: 'BLOCKED' })[quality] || 'NO DATA'
  const statusColor = ['check', 'partial'].includes(quality) ? '#fcd34d' : live ? color : '#94a3b8'
  const range = Number.isFinite(display.min) && Number.isFinite(display.max)
    ? `${format(display.min, display.decimals > 0 ? Math.min(display.decimals, 1) : 0)} – ${format(display.max, display.decimals > 0 ? Math.min(display.decimals, 1) : 0)} ${display.unit}` : null
  return <section aria-label={`${display.label} widget`} data-channel={widget.channelKey} data-quality={quality}
    className={`relative flex h-full ${widget.type === 'gauge' ? 'min-h-[266px]' : 'min-h-[206px]'} flex-col overflow-hidden rounded-2xl border bg-slate-950/75 p-4 shadow-sm ${quality === 'check' ? 'border-amber-300/35' : 'border-white/10'}`}>
    <div className="absolute inset-x-4 top-0 h-px opacity-60" style={{ backgroundColor: live ? color : '#475569' }} />
    <header className="mb-3 flex items-start justify-between gap-3">
      <h3 className="text-xs font-semibold leading-5 text-slate-300">{display.label}</h3>
      <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] tracking-wide" style={{ color: statusColor }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor }} />{statusText}
      </span>
    </header>
    {widget.type === 'trace' ? <RealtimeChart label={display.label} color={color} compact
      min={display.traceMin ?? 0} max={display.traceMax ?? 100} value={live ? display.value : null}
      sampleTime={receivedAt} active={live} seriesKey={`${sourceKey}:${widget.channelKey}:${display.unit}`}
      unit={display.unit || ''} decimals={display.decimals ?? 0} />
      : !live ? <div className="flex flex-1 flex-col justify-center gap-3 py-5">
        <p className="font-mono text-4xl text-slate-500">—</p>
        <p className="text-xs leading-relaxed text-slate-400">{telemetryStatus === 'live' ? display.reason || 'Channel unavailable' : 'Waiting for fresh ECU data'}</p>
      </div>
      : widget.type === 'gauge' ? <Gauge label={display.label} value={display.value} min={display.min} max={display.max}
        unit={display.unit} decimals={display.decimals} warning={display.warning} danger={display.danger}
        warningMode={display.warningMode} color={color} size={178} />
      : widget.type === 'status' ? <StatusWidget groups={display.groups} /> : <DigitalWidget display={display} color={color} />}
    {widget.type === 'trace' && (display.note || (telemetryStatus === 'live' && display.reason)) && <p className={`mt-2 text-xs ${quality === 'check' ? 'text-amber-200' : 'text-slate-400'}`}>{display.reason || display.note}</p>}
    {widget.type !== 'trace' && <footer className="mt-2 min-h-4 text-[11px] leading-relaxed text-slate-500">
      {live && display.note ? <span className={quality === 'check' ? 'text-amber-200' : 'text-slate-400'}>{display.note}</span> : range ? `Display range ${range}` : 'ECU-reported status'}
    </footer>}
  </section>
}
