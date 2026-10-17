import React, { useEffect, useMemo, useState } from 'react'
import { Play, Square, Download, Trash2 } from 'lucide-react'
import { useStore } from '../../core/store.js'
import RealtimeChart from '../../ui/Layout/RealtimeChart.jsx'
import { useLiveTelemetry } from '../shared/hooks/useLiveTelemetry.js'
import { createRealtimeChannelRegistry } from './widgets/channelRegistry.js'
import { telemetryCSV, recordingDuration } from '../../../shared/protocol/telemetry-log.js'

const GROUPS = [
  { name: 'Engine dynamics', channels: ['rpm', 'tps', 'map', 'fuelLoad'] },
  { name: 'Fuel & ignition', channels: ['afr', 'advance', 'pw1', 'dwell', 'dwellActual', 've'] },
  { name: 'Temperatures & electrical', channels: ['coolant', 'iat', 'battery'] },
]
const COLORS = { rpm: '#6ee7b7', tps: '#67e8f9', map: '#c4b5fd', fuelLoad: '#a5b4fc', afr: '#fda4af',
  advance: '#d8b4fe', pw1: '#fde68a', dwell: '#93c5fd', dwellActual: '#38bdf8', ve: '#86efac', coolant: '#fdba74', iat: '#7dd3fc', battery: '#6ee7b7' }

export default function Analysis() {
  const entries = useStore(s => s.logEntries), recording = useStore(s => s.logRecording)
  const started = useStore(s => s.logStartedAt), stopped = useStore(s => s.logStoppedAt)
  const setRecording = useStore(s => s.setLogRecording), clearLog = useStore(s => s.clearLog)
  const { realtime, status, receivedAt, sourceKey, issues, error } = useLiveTelemetry()
  const project = useStore(s => s.currentProject)
  const convertTemp = useStore(s => s.convertTemp), convertPress = useStore(s => s.convertPress), convertSpeed = useStore(s => s.convertSpeed)
  const tempUnit = useStore(s => s.tempUnit), pressUnit = useStore(s => s.pressUnit), speedUnit = useStore(s => s.speedUnit)
  const [now, setNow] = useState(Date.now), [exportError, setExportError] = useState(null)
  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [recording])
  const configuration = useMemo(() => Object.assign({}, ...Object.values(project?.constants?.decodedPages || {})), [project?.constants?.decodedPages])
  const registry = createRealtimeChannelRegistry({ convertTemp, convertPress, convertSpeed, tempUnit, pressUnit, speedUnit, configuration, mapMax: configuration.mapMax })
  const exportLog = () => {
    setExportError(null)
    try {
      const csv = telemetryCSV(useStore.getState().logEntries || [])
      const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url; link.download = `ryn-telemetry-${new Date().toISOString().replaceAll(':', '-')}.csv`
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { setExportError(error.message) }
  }
  return <div className="h-full overflow-y-auto bg-slate-950/45 p-4 sm:p-6 space-y-6 custom-scrollbar">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Telemetry workspace</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-100">Live analysis</h1>
        <p className="mt-1 text-xs text-slate-400">30-second traces · received packets only · recording appends to a 10,000-sample buffer.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={status !== 'live' && !recording} onClick={() => setRecording(!recording)}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium disabled:opacity-40 ${recording ? 'border-rose-300/40 bg-rose-300/10 text-rose-200' : 'border-white/15 text-slate-200 hover:bg-white/5'}`}>
          {recording ? <Square size={13} /> : <Play size={13} />}{recording ? 'Stop recording' : 'Start recording'}
        </button>
        <button type="button" onClick={exportLog} disabled={!entries.length} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs text-slate-200 disabled:opacity-35"><Download size={14} />Export CSV</button>
        <button type="button" onClick={clearLog} disabled={!entries.length} aria-label="Clear telemetry buffer" className="rounded-xl border border-white/15 p-2 text-slate-400 disabled:opacity-35"><Trash2 size={15} /></button>
      </div>
    </header>
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 font-mono text-xs text-slate-300">
      <span role="status" className={status === 'live' ? 'text-emerald-300' : 'text-amber-200'}>{status.toUpperCase()}</span>
      <span>{recording ? 'REC' : 'Stopped'} {recordingDuration(started, recording ? Math.max(now, Date.now()) : stopped ?? now)}</span>
      <span>{entries.length.toLocaleString()} / 10,000 samples</span>
      <span className="text-slate-500">CSV: °C · kPa · km/h · ms</span>
    </div>
    {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
    {exportError && <p role="alert" className="text-sm text-rose-200">CSV export failed: {exportError}</p>}
    {issues.length > 0 && <div role="alert" className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-xs leading-relaxed text-amber-200">{issues.join(' ')}</div>}
    {GROUPS.map(group => <section key={group.name} className="space-y-3">
      <h2 className="text-sm font-medium text-slate-300">{group.name}</h2>
      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        {group.channels.map(channel => {
          const display = registry[channel].getDisplay(realtime), live = status === 'live' && display.available
          return <div key={channel} className="min-w-0">
            <RealtimeChart label={display.label} color={COLORS[channel]} value={live ? display.value : null}
              sampleTime={receivedAt} active={live} min={display.traceMin} max={display.traceMax}
              decimals={display.decimals} unit={display.unit} seriesKey={`${sourceKey}:${channel}:${display.unit}`} />
            {status === 'live' && (display.reason || display.note) && <p className={`mt-1 px-1 text-xs ${display.quality === 'check' ? 'text-amber-200' : 'text-slate-400'}`}>{display.reason || display.note}</p>}
          </div>
        })}
      </div>
    </section>)}
  </div>
}
