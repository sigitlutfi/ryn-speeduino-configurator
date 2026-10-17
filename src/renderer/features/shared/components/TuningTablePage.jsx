import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Radio, BarChart3 } from 'lucide-react'
import { useStore } from '../../../core/store.js'
import TuningGrid from '../TuningGrid/TuningGrid.jsx'
import { useTableSync } from '../hooks/useTableSync.js'
import { useLiveTelemetry } from '../hooks/useLiveTelemetry.js'
import TuningHeader from './TuningHeader'
import { getDecodedPage } from '../utils/projectConstants.js'
import { interpolateTable, loadAxisLabel, operatingLoad } from '../../../../shared/protocol/tuning-live.js'

const STATUS = {
  blocked: { label: 'TELEMETRY BLOCKED', color: 'text-red-300', dot: 'bg-red-400' },
  live: { label: 'LIVE', color: 'text-emerald-300', dot: 'bg-emerald-400' },
  offline: { label: 'OFFLINE', color: 'text-slate-400', dot: 'bg-slate-500' },
  waiting: { label: 'WAITING FOR DATA', color: 'text-amber-300', dot: 'bg-amber-400' },
  stale: { label: 'TELEMETRY STALE', color: 'text-amber-300', dot: 'bg-amber-400' },
}

export const TuningTablePage = ({
  tableKey, iniTableId, title, description, icon, theme = 'cyan', headerTheme,
  unitLabel = 'VE', precision = 0, minVal, maxVal, defaultRange = { min: 0, max: 100 },
  secondaryTableKey = null, loadAlgorithmType = 'fuel1', transform,
  loadingText = 'Loading table metadata…', children,
}) => {
  const currentProject = useStore(s => s.currentProject)
  const projectEpoch = useStore(s => s.projectEpoch)
  const connection = useStore(s => s.connection)
  const secondaryValues = useStore(s => secondaryTableKey ? s.tables?.[secondaryTableKey]?.values : null)
  const { realtime, status } = useLiveTelemetry()
  const { values, rpmAxis, loadAxis, meta, scaling, update, handleSave, isDirty } =
    useTableSync(tableKey, iniTableId, transform ? { transform } : undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)
  const [liveTrace, setLiveTrace] = useState(true)
  const saveTimer = useRef(null)
  useEffect(() => () => clearTimeout(saveTimer.current), [])
  const isConnected = connection?.status === 'connected'
  const isIgnitionLoad = loadAlgorithmType.startsWith('ign')
  const algorithmId = useMemo(() => {
    const primary = getDecodedPage(currentProject?.constants, 1)
    const secondary = getDecodedPage(currentProject?.constants, 10)
    return ({ fuel1: primary?.algorithm, fuel2: secondary?.fuel2Algorithm,
      ign1: primary?.ignAlgorithm, ign2: secondary?.spark2Algorithm })[loadAlgorithmType] ?? 0
  }, [currentProject?.constants, loadAlgorithmType])
  const dynamicYLabel = loadAxisLabel(algorithmId, isIgnitionLoad)
  const primaryChannel = { fuel1: 'fuelLoadRaw', ign1: 'ignLoadRaw' }[loadAlgorithmType]
  const livePoint = useMemo(() => {
    const load = operatingLoad(realtime, algorithmId, primaryChannel)
    if (!Number.isFinite(realtime?.rpm) || !Number.isFinite(load)) return null
    const rpm = realtime.rpm
    return { rpm, load, interpolated: interpolateTable(values, rpmAxis, loadAxis, rpm, load),
      clamped: rpm < rpmAxis?.[0] || rpm > rpmAxis?.at(-1) || load < loadAxis?.[0] || load > loadAxis?.at(-1) }
  }, [realtime, algorithmId, primaryChannel, values, rpmAxis, loadAxis])
  const stats = useMemo(() => {
    const flat = values?.flat?.().filter(Number.isFinite) || []
    return flat.length ? { min: Math.min(...flat), max: Math.max(...flat),
      avg: flat.reduce((sum, value) => sum + value, 0) / flat.length } : null
  }, [values])
  const range = useMemo(() => {
    const min = stats?.min ?? defaultRange.min, max = stats?.max ?? defaultRange.max
    const padding = max - min < 40 ? (40 - (max - min)) / 2 : 0
    return { min: minVal ?? Math.floor(min - padding), max: maxVal ?? Math.ceil(max + padding) }
  }, [stats, minVal, maxVal, defaultRange.min, defaultRange.max])
  const onSaveAction = async burn => {
    setIsSaving(true)
    setSaveStatus(null)
    clearTimeout(saveTimer.current)
    try {
      const result = await handleSave(burn)
      setSaveStatus(result?.ok ? 'success' : 'error')
    } catch {
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
      saveTimer.current = setTimeout(() => setSaveStatus(null), 3000)
    }
  }
  if (!meta) return <div className="p-8 text-slate-400 text-center animate-pulse">{loadingText}</div>
  const resolvedTitle = typeof title === 'function' ? title({ meta, scaling }) : title || meta.title
  const resolvedDescription = typeof description === 'function'
    ? description({ meta, scaling, dynamicYLabel }) : description || `${meta.title} · ${dynamicYLabel}`
  const unit = unitLabel || meta.unitLabel || '%'
  const telemetry = STATUS[status] || STATUS.waiting
  const format = (value, digits = precision) => Number.isFinite(value) ? value.toFixed(digits) : '—'
  return (
    <div className="h-full flex flex-col overflow-hidden rounded-3xl">
      <TuningHeader title={resolvedTitle} icon={icon} description={resolvedDescription}
        isSaving={isSaving} saveStatus={saveStatus} isConnected={isConnected} isDirty={isDirty}
        onSave={() => onSaveAction(false)} onBurn={() => onSaveAction(true)} themeColor={headerTheme || theme} />
      <div className="flex-1 p-4 md:p-6 flex flex-col min-h-0 bg-[#0a0b10] overflow-y-auto custom-scrollbar">
        <section aria-label="Table operating point" className="mb-4 rounded-2xl border border-white/10 bg-slate-950/70 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <Radio size={14} className={telemetry.color} />
              <span role="status" className={`flex items-center gap-2 text-[10px] font-mono font-bold tracking-wider ${telemetry.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${telemetry.dot}`} />{telemetry.label}
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">{dynamicYLabel}</span>
            </div>
            <button type="button" aria-pressed={liveTrace} onClick={() => setLiveTrace(value => !value)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-colors focus-visible:outline focus-visible:outline-cyan-400 ${liveTrace ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200' : 'border-white/10 text-slate-400 hover:text-white'}`}>
              <Crosshair size={13} />{liveTrace ? 'Trace visible' : 'Trace hidden'}
            </button>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/5">
            {[
              ['ENGINE SPEED', format(livePoint?.rpm, 0), 'rpm'],
              ['LOAD', format(livePoint?.load, algorithmId === 1 ? 1 : 0), algorithmId === 0 ? 'kPa' : '%'],
              ['TABLE LOOKUP', format(livePoint?.interpolated), unit],
            ].map(([label, value, suffix]) => <div key={label} className="px-4 py-3 min-w-0">
              <div className="text-[9px] font-bold tracking-widest text-slate-500 mb-1">{label}</div>
              <div className="flex flex-wrap items-baseline gap-x-2 font-mono tabular-nums">
                <strong className="text-xl text-slate-100">{value}</strong><span className="text-[10px] text-slate-400">{suffix}</span>
              </div>
            </div>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-4 py-2 text-[10px] text-slate-400">
            <span>{livePoint?.clamped ? 'Outside table axes · lookup clamped to edge' : status === 'live' && !livePoint ? 'Load data unavailable for this source' : 'Table lookup before ECU corrections'}</span>
            <span className="inline-flex items-center gap-3 font-mono tabular-nums"><BarChart3 size={12} />
              MIN {format(stats?.min)} · AVG {format(stats?.avg)} · MAX {format(stats?.max)}
            </span>
          </div>
        </section>
        <div className="min-h-[500px] flex-shrink-0">
          <TuningGrid key={`${projectEpoch}:${tableKey}:${algorithmId}`} values={values} secondaryValues={secondaryValues} rpmAxis={rpmAxis} loadAxis={loadAxis}
            onUpdate={update} minVal={range.min} maxVal={range.max} theme={theme} xAxisLabel={meta.xLabel || 'RPM'}
            yAxisLabel={dynamicYLabel} unitLabel={unit} precision={precision}
            activePoint={liveTrace && livePoint ? { rpm: livePoint.rpm, load: livePoint.load } : null} />
        </div>
        {children}
      </div>
    </div>
  )
}

export default TuningTablePage
