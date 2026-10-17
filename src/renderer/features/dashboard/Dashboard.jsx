import React, { useMemo, useState } from 'react'
import { Plus, Pencil, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useStore } from '../../core/store.js'
import { ACCENT_COLORS, getAccent } from '../../core/theme.js'
import { normalizeRealtimeDashboard } from './widgets/widgetPresets.js'
import { createRealtimeChannelRegistry, getChannelOptions, resolveWidget } from './widgets/channelRegistry.js'
import WidgetTile from './widgets/WidgetTile.jsx'
import { useLiveTelemetry } from '../shared/hooks/useLiveTelemetry.js'

const control = 'rounded-lg border border-white/15 bg-slate-900 px-2 py-2 text-xs text-slate-200 focus-visible:outline focus-visible:outline-cyan-300'

export default function Dashboard() {
  const project = useStore(s => s.currentProject), settings = useStore(s => s.settings)
  const updateDashboard = useStore(s => s.updateRealtimeDashboard)
  const { realtime, status, receivedAt, error, sourceKey, issues } = useLiveTelemetry()
  const rate = useStore(s => s.realtimeRateHz), packetSize = useStore(s => s.parsedIni?.outputChannels?.ochBlockSize)
  const convertTemp = useStore(s => s.convertTemp), convertPress = useStore(s => s.convertPress), convertSpeed = useStore(s => s.convertSpeed)
  const tempUnit = useStore(s => s.tempUnit), pressUnit = useStore(s => s.pressUnit), speedUnit = useStore(s => s.speedUnit)
  const [editing, setEditing] = useState(false)
  const config = useMemo(() => normalizeRealtimeDashboard(settings?.realtimeDashboard), [settings?.realtimeDashboard])
  const preset = config.presets.find(p => p.id === config.activePresetId) || config.presets[0]
  const pages = project?.constants?.decodedPages
  const configuration = useMemo(() => Object.assign({}, ...Object.values(pages || {})), [pages])
  const registry = useMemo(() => createRealtimeChannelRegistry({ convertTemp, convertPress, convertSpeed, tempUnit, pressUnit, speedUnit,
    configuration, mapMax: configuration.mapMax }), [convertTemp, convertPress, convertSpeed, tempUnit, pressUnit, speedUnit, configuration])
  const options = useMemo(() => getChannelOptions(registry), [registry])
  const changePreset = updater => updateDashboard(current => ({ ...current,
    presets: current.presets.map(p => p.id === preset.id ? updater(p) : p) }))
  const changeWidget = (id, patch) => changePreset(p => ({ ...p, widgets: p.widgets.map(w => w.id === id ? { ...w, ...patch } : w) }))
  const move = (id, direction) => changePreset(p => {
    const widgets = [...p.widgets], index = widgets.findIndex(w => w.id === id), next = index + direction
    if (index < 0 || next < 0 || next >= widgets.length) return p
    ;[widgets[index], widgets[next]] = [widgets[next], widgets[index]]
    return { ...p, widgets }
  })
  const add = () => changePreset(p => ({ ...p, widgets: [...p.widgets,
    { id: `widget-${Date.now()}-${p.widgets.length}`, channelKey: 'rpm', type: 'digital', color: 'cyan', enabled: true, span: 1 }] }))
  if (!project) return <div className="p-6 text-sm text-slate-400">Open a project to configure telemetry widgets.</div>
  const widgets = preset.widgets.filter(w => editing || w.enabled)
  const age = Number.isFinite(receivedAt) ? Math.max(0, Date.now() - receivedAt) : null
  const live = status === 'live'
  const statusColor = live ? 'text-emerald-300' : status === 'blocked' ? 'text-rose-300' : 'text-slate-300'
  const counts = widgets.reduce((result, w) => {
    const d = registry[w.channelKey]?.getDisplay(realtime)
    if (d?.quality === 'check') result.check++
    if (d?.available === false) result.unavailable++
    return result
  }, { check: 0, unavailable: 0 })

  return <div className="h-full overflow-y-auto bg-slate-950/45 p-4 sm:p-6 space-y-5 custom-scrollbar">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">{project.projectName || 'ECU workspace'}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-100">Realtime telemetry</h1>
        <p className="mt-1 text-xs text-slate-400">Engine data, sensor quality and operating state.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Dashboard presets" className="flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
          {config.presets.map(p => <button key={p.id} type="button" role="tab" aria-selected={p.id === preset.id}
            onClick={() => updateDashboard(current => ({ ...current, activePresetId: p.id }))}
            className={`rounded-lg px-3 py-2 text-xs font-medium ${p.id === preset.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>{p.name}</button>)}
        </div>
        <button type="button" aria-pressed={editing} onClick={() => setEditing(v => !v)} className={`${control} inline-flex items-center gap-2`}>
          <Pencil size={13} />{editing ? 'Done editing' : 'Edit layout'}
        </button>
      </div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/65 px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span role="status" className={`inline-flex items-center gap-2 font-medium ${statusColor}`}>
          <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-300' : status === 'blocked' ? 'bg-rose-300' : 'bg-slate-500'}`} />{status.toUpperCase()}
        </span>
        <span className="font-mono text-slate-400">{live && Number.isFinite(rate) ? `${rate.toFixed(1)} Hz` : '— Hz'}</span>
        <span className="font-mono text-slate-400">{age === null ? 'No packet yet' : status === 'offline' ? `Last packet ${new Date(receivedAt).toLocaleTimeString()}` : age < 1000 ? `Packet age ${age} ms` : `Packet age ${(age / 1000).toFixed(1)} s`}</span>
        {Number.isFinite(packetSize) && <span className="font-mono text-slate-500">{packetSize} B</span>}
      </div>
      <span className="text-slate-400">{live && (counts.check || counts.unavailable) ? `${counts.check} to check · ${counts.unavailable} unavailable` : `${preset.widgets.filter(w => w.enabled).length} widgets`}</span>
    </div>
    {!live && <div className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">
      {error || ({ offline: 'ECU offline. You can still edit the layout.', waiting: 'Connected. Waiting for the first telemetry packet.', stale: 'No fresh ECU packet. Values are hidden until telemetry resumes.', blocked: 'Telemetry is blocked. Check the firmware/INI connection.' })[status]}
    </div>}
    {issues.length > 0 && <details className="rounded-xl border border-amber-300/25 bg-amber-300/5 px-4 py-3" open>
      <summary className="cursor-pointer text-xs font-semibold text-amber-200">{issues.length} configuration or sensor checks</summary>
      <ul role="alert" className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-amber-100/80">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
    </details>}
    {editing && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4">
      <p className="text-xs text-slate-300">Change channels, size and color. Hidden widgets stay editable. Layout saves automatically.</p>
      <button type="button" onClick={add} className={`${control} inline-flex items-center gap-2`}><Plus size={14} />Add widget</button>
    </div>}
    {!widgets.length && <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center text-sm text-slate-400">
      No visible widgets in this preset. <button type="button" onClick={() => setEditing(true)} className="text-cyan-300 underline">Edit layout</button>
    </div>}
    <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 lg:grid-cols-3 min-[68.75rem]:grid-cols-4">
      {widgets.map(raw => {
        const widget = resolveWidget(raw, registry), channel = registry[widget.channelKey]
        const display = channel?.getDisplay(realtime) || { label: raw.channelKey, available: false, reason: 'Unsupported channel. Choose another channel in Edit layout.' }
        const index = preset.widgets.findIndex(w => w.id === raw.id)
        return <div key={raw.id} className={`flex min-w-0 flex-col gap-2 ${raw.span === 2 ? 'md:col-span-2 lg:col-span-3 min-[68.75rem]:col-span-2' : ''} ${raw.enabled ? '' : 'opacity-60'}`}>
          {editing && <div className="space-y-2 rounded-xl border border-white/15 bg-slate-950 p-3">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={raw.enabled} onChange={e => changeWidget(raw.id, { enabled: e.target.checked })} />Visible</label>
              <div className="flex gap-1">
                <button type="button" aria-label={`Move ${display.label} left`} disabled={index === 0} onClick={() => move(raw.id, -1)} className="rounded p-1 text-slate-400 hover:text-white disabled:opacity-25"><ChevronLeft size={15} /></button>
                <button type="button" aria-label={`Move ${display.label} right`} disabled={index === preset.widgets.length - 1} onClick={() => move(raw.id, 1)} className="rounded p-1 text-slate-400 hover:text-white disabled:opacity-25"><ChevronRight size={15} /></button>
                <button type="button" aria-label={`Remove ${display.label}`} onClick={() => changePreset(p => ({ ...p, widgets: p.widgets.filter(w => w.id !== raw.id) }))} className="rounded p-1 text-rose-300"><Trash2 size={14} /></button>
              </div>
            </div>
            <label className="block text-[10px] text-slate-400">Channel<select aria-label={`Channel for ${raw.id}`} value={raw.channelKey} className={`${control} mt-1 w-full`}
              onChange={e => { const next = registry[e.target.value]; changeWidget(raw.id, { channelKey: e.target.value, type: next.supportedWidgets.includes(raw.type) ? raw.type : next.defaultWidget }) }}>
              {!channel && <option value={raw.channelKey}>{raw.channelKey} (unavailable)</option>}
              {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] text-slate-400">Style<select aria-label={`Style for ${raw.id}`} value={widget.type} onChange={e => changeWidget(raw.id, { type: e.target.value })} className={`${control} mt-1 w-full`}>
                {(channel?.supportedWidgets || ['digital']).map(type => <option key={type} value={type}>{type}</option>)}</select></label>
              <label className="text-[10px] text-slate-400">Width<select aria-label={`Width for ${raw.id}`} value={raw.span} onChange={e => changeWidget(raw.id, { span: Number(e.target.value) })} className={`${control} mt-1 w-full`}><option value={1}>Standard</option><option value={2}>Wide</option></select></label>
            </div>
            <label className="block text-[10px] text-slate-400">Color<select aria-label={`Color for ${raw.id}`} value={raw.color} onChange={e => changeWidget(raw.id, { color: e.target.value })} className={`${control} mt-1 w-full`}>
              {Object.keys(ACCENT_COLORS).map(color => <option key={color}>{color}</option>)}</select></label>
          </div>}
          <WidgetTile widget={widget} display={display} color={getAccent(raw.color).main} telemetryStatus={status} receivedAt={receivedAt} sourceKey={sourceKey} />
        </div>
      })}
    </div>
  </div>
}
