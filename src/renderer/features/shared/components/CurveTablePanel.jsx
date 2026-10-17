import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Plus, Minus, TrendingUp, Waves, Undo2, Redo2 } from 'lucide-react'
import CurveEditor from '../../../ui/CurveEditor.jsx'
import CurveNumberInput from '../../../ui/CurveNumberInput.jsx'
import { moveCurvePoint, roundAxis, interpolateCurve, evenlySpaceCurveAxis } from '../../../ui/curve-math.js'
import { useStore } from '../../../core/store.js'

const ACCENTS = { cyan: '#67e8f9', yellow: '#fde047', orange: '#fb923c',
  red: '#f87171', green: '#86efac', purple: '#c084fc', blue: '#93c5fd', magenta: '#f0abfc' }
const signature = (x, y) => JSON.stringify([x, y])
const copy = (x, y) => ({ x: [...x], y: [...y] })
const toolClass = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-cyan-400'

export const CurveTablePanel = ({
  title, description, icon: Icon, theme = 'cyan', xValues = [], yValues = [],
  xLabel = 'X axis', yLabel = 'Y axis', xUnit = '', yUnit = '',
  xRange = { min: -40, max: 120 }, yRange = { min: 0, max: 255 },
  xBounds = xRange, yBounds = yRange, xStep: requestedXStep = null,
  precision = 0, xPrecision = 0, step = null, xFixed = false, disabled = false,
  layout = 'split', liveXValue = null, error = null, activeIdx: controlledActiveIdx,
  onHoverPoint, onChange, footerNote = null, preset = null, curveIssues = [], normalize = null, valueStatus = null,
}) => {
  const projectEpoch = useStore(s => s.projectEpoch)
  const [hovered, setHovered] = useState(null)
  const [preview, setPreview] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [, refreshHistory] = useState(0)
  const history = useRef({ past: [], future: [] })
  const dragStart = useRef(null)
  const safeX = useMemo(() => Array.from(xValues || [], value => Number.isFinite(Number(value)) ? Number(value) : 0), [xValues])
  const safeY = useMemo(() => Array.from(yValues || [], value => Number.isFinite(Number(value)) ? Number(value) : 0), [yValues])
  const currentSignature = signature(safeX, safeY)
  const expected = useRef(currentSignature)
  const activeIdx = controlledActiveIdx !== undefined ? controlledActiveIdx : hovered
  const effectiveStep = step ?? 10 ** -precision
  const xStep = requestedXStep ?? 10 ** -xPrecision
  const options = { xRange: xBounds, yRange: yBounds, precision, xPrecision, step: effectiveStep, xStep, xFixed }
  const ordered = safeX.every((value, index) => !index || value > safeX[index - 1])
  useEffect(() => {
    if (expected.current !== currentSignature) {
      history.current = { past: [], future: [] }
      dragStart.current = null
      expected.current = currentSignature
      refreshHistory(value => value + 1)
    }
  }, [currentSignature])
  useEffect(() => {
    setPreview(false)
    setShowTools(false)
    history.current = { past: [], future: [] }
    dragStart.current = null
    refreshHistory(value => value + 1)
  }, [projectEpoch])
  const setActive = index => { setHovered(index); onHoverPoint?.(index) }
  const record = snapshot => {
    history.current.past = [...history.current.past.slice(-31), snapshot]
    history.current.future = []
    refreshHistory(value => value + 1)
  }
  const emit = (x, y, canonicalize = true) => {
    const next = normalize && canonicalize ? normalize(x, y) : { x, y }
    expected.current = signature(next.x, next.y)
    onChange?.(next.x, next.y)
  }
  const commit = (x, y) => {
    if (disabled || !onChange || signature(x, y) === currentSignature) return
    record(copy(safeX, safeY))
    emit(x, y)
  }
  const travel = redo => {
    if (disabled || !onChange) return
    const from = redo ? history.current.future : history.current.past
    const to = redo ? history.current.past : history.current.future
    const snapshot = from.pop()
    if (!snapshot) return
    to.push(copy(safeX, safeY))
    emit(snapshot.x, snapshot.y, false)
    refreshHistory(value => value + 1)
  }
  const editPoint = (index, axis, value) => {
    const next = moveCurvePoint(safeX, safeY, index, { [axis]: value }, options)
    commit(next.x, next.y)
  }
  const roundY = value => Math.max(yBounds.min, Math.min(yBounds.max, roundAxis(value, precision, effectiveStep)))
  const axisStart = ordered && safeX.length > 1 ? safeX[0] : xRange.min
  const axisEnd = ordered && safeX.length > 1 ? safeX.at(-1) : xRange.max
  const spaceX = () => commit(evenlySpaceCurveAxis(safeX, xRange, xPrecision, xStep), safeY)
  const nudge = delta => commit(safeX, safeY.map(value => roundY(value + delta)))
  const linearize = () => commit(safeX, safeY.map((_, index) => roundY(safeY[0] +
    (safeY.at(-1) - safeY[0]) * index / (safeY.length - 1))))
  const smooth = () => commit(safeX, safeY.map((value, index) => index === 0 || index === safeY.length - 1
    ? value : roundY((safeY[index - 1] + value * 2 + safeY[index + 1]) / 4)))
  const liveIndex = Number.isFinite(liveXValue) && safeX.length ? safeX.reduce((best, value, index) =>
    Math.abs(value - liveXValue) < Math.abs(safeX[best] - liveXValue) ? index : best, 0) : null
  const interpolated = interpolateCurve(safeX, safeY, liveXValue)
  const stacked = layout === 'stacked'
  const inputClass = 'w-full min-w-0 rounded-lg border border-white/10 bg-slate-950/70 px-2 py-1.5 text-right text-xs font-mono tabular-nums text-slate-100 outline-none focus:border-cyan-300/60 focus:ring-1 focus:ring-cyan-300/30 disabled:opacity-40'
  return (
    <section key={projectEpoch} aria-label={title} style={{ '--curve-accent': ACCENTS[theme] || ACCENTS.cyan }}
      onKeyDown={event => {
        if ((!event.ctrlKey && !event.metaKey) || event.target.closest('input')) return
        const key = event.key.toLowerCase()
        if (key === 'z' || key === 'y') { event.preventDefault(); travel(key === 'y' || event.shiftKey) }
      }}
      className={`rounded-2xl border bg-[#0c111c]/90 overflow-hidden ${error ? 'border-red-400/50' : 'border-white/10'}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && <Icon size={18} style={{ color: 'var(--curve-accent)' }} className="shrink-0" />}
          <div><h3 className="text-xs font-bold text-slate-100 tracking-wide">{title}</h3>
            {description && <p className="text-[10px] text-slate-400 mt-1">{description}</p>}</div>
        </div>
        <div role="toolbar" aria-label={`${title} curve tools`} className="flex flex-wrap items-center gap-0.5 rounded-xl border border-white/10 bg-black/25 p-1">
          <button type="button" className={toolClass} aria-label="Undo curve edit" title="Undo (Ctrl+Z)" disabled={disabled || !history.current.past.length} onClick={() => travel(false)}><Undo2 size={13} /></button>
          <button type="button" className={toolClass} aria-label="Redo curve edit" title="Redo (Ctrl+Shift+Z)" disabled={disabled || !history.current.future.length} onClick={() => travel(true)}><Redo2 size={13} /></button>
          <span className="mx-1 h-4 w-px bg-white/10" />
          <button type="button" className={toolClass} disabled={disabled || !safeY.length} title={`Decrease all values by ${effectiveStep}`} onClick={() => nudge(-effectiveStep)}><Minus size={12} />{effectiveStep}</button>
          <button type="button" className={toolClass} disabled={disabled || !safeY.length} title={`Increase all values by ${effectiveStep}`} onClick={() => nudge(effectiveStep)}><Plus size={12} />{effectiveStep}</button>
          <button type="button" className={toolClass} aria-expanded={showTools} onClick={() => { setShowTools(value => !value); setPreview(false) }}>Alat kurva</button>
        </div>
      </header>
      {valueStatus && <div className="border-b border-white/5 bg-cyan-300/[0.025] px-5 py-3 text-xs text-slate-400 space-y-1">
        <p><span className="font-semibold text-cyan-200">{valueStatus.label}</span><span className="ml-3 text-slate-500">Kalibrasi belum diverifikasi</span></p>
        <p>{valueStatus.note}</p>
        {valueStatus.flat && <p>Garis datar: setiap titik memiliki nilai Y yang sama. Kurva sudah terbentuk; geser titik atau edit angka untuk menyesuaikannya.</p>}
      </div>}
      {showTools && <div role="toolbar" aria-label="Alat kurva tambahan" className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-white/5 bg-black/15">
        <button type="button" className={toolClass} disabled={disabled || safeY.length < 3} title="Luruskan nilai di antara titik pertama dan terakhir" onClick={linearize}><TrendingUp size={12} />Luruskan</button>
        <button type="button" className={toolClass} disabled={disabled || safeY.length < 3} title="Haluskan titik tengah; titik ujung tetap" onClick={smooth}><Waves size={12} />Haluskan</button>
        {!xFixed && <button type="button" className={toolClass} disabled={disabled || safeX.length < 2 || (safeX.length - 1) * xStep > axisEnd - axisStart}
          title={`Ratakan jarak titik X dari ${axisStart} sampai ${axisEnd} ${xUnit}. Nilai Y tetap.`} onClick={spaceX}>Ratakan Jarak X</button>}
        {preset && <button type="button" className={toolClass} disabled={disabled} onClick={() => setPreview(value => !value)}>Kembalikan nilai awal…</button>}
        <p className="w-full text-[10px] text-slate-500">Alat tambahan bersifat opsional. Kurva proyek baru sudah memiliki sumbu terurut. Perubahan dapat dibatalkan dengan Undo.</p>
      </div>}
      {error && <div role="alert" className="flex items-center gap-2 border-b border-red-400/20 px-5 py-3 text-xs text-red-300"><AlertTriangle size={14} />{error}</div>}
      {!!curveIssues.length && <div role="status" className="border-b border-amber-300/20 px-5 py-3 text-xs text-amber-200">{curveIssues.join(' ')} Periksa data kurva sebelum tuning.</div>}
      {preset && preview && <div className="space-y-3 border-b border-cyan-300/20 bg-cyan-300/5 px-5 py-4 text-xs text-slate-300">
        <p className="font-semibold text-cyan-200">Preview nilai awal — {preset.kind === 'neutral' ? 'netral' : 'referensi, perlu kalibrasi'}</p>
        <p>{preset.note}</p>
        <p className="font-mono break-words">X: {preset.x.join(', ')} {xUnit}<br />Y: {preset.y.join(', ')} {yUnit}</p>
        <p>Mengganti nilai Y kurva ini. Sumbu X yang valid dipertahankan. Perubahan sumbu bersama juga memengaruhi kurva terkait. Nilai masuk ke draft; gunakan Save untuk menyimpan.</p>
        <div className="flex gap-2"><button type="button" className={toolClass} disabled={disabled} onClick={() => { commit(preset.x, preset.y); setPreview(false) }}>Terapkan ke draft</button>
          <button type="button" className={toolClass} onClick={() => setPreview(false)}>Batal</button></div>
      </div>}
      {!ordered && !curveIssues.length && !disabled && <div role="status" className="flex items-center gap-2 border-b border-amber-300/20 px-5 py-3 text-xs text-amber-200">
        <AlertTriangle size={14} className="shrink-0" />Titik X bertumpuk atau belum terurut. Periksa angka pada sumbu X sebelum mengedit kurva.
      </div>}
      <div className={stacked ? '' : 'grid lg:grid-cols-[minmax(0,1fr)_300px]'}>
        <div className="p-3 sm:p-5 min-w-0">
          <CurveEditor xValues={safeX} yValues={safeY} xRange={xRange} yRange={yRange}
            xBounds={xBounds} yBounds={yBounds}
            xLabel={xLabel} yLabel={yLabel} xFixed={xFixed} precision={precision} xPrecision={xPrecision}
            step={effectiveStep} xStep={xStep} theme={theme} disabled={disabled} activeIdx={activeIdx}
            liveXValue={disabled ? null : liveXValue} onHoverPoint={setActive}
            onInteractionStart={() => { dragStart.current = copy(safeX, safeY) }}
            onChange={(x, y) => { if (!disabled) emit(x, y) }}
            onCommit={() => {
              if (dragStart.current && signature(dragStart.current.x, dragStart.current.y) !== expected.current) record(dragStart.current)
              dragStart.current = null
            }} />
        </div>
        <div className={`min-w-0 border-white/5 bg-black/15 p-4 ${stacked ? 'border-t' : 'border-t lg:border-t-0 lg:border-l'}`}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[10px] font-bold text-slate-400 tracking-widest">NUMERICAL BINS</span>
            <span className="text-[10px] font-mono text-slate-500">{safeX.length} points</span>
          </div>
          <div className={stacked ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2' : 'space-y-1.5 max-h-[410px] overflow-y-auto custom-scrollbar pr-1'}>
            {safeX.map((value, index) => <div key={index} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}
              className={`grid grid-cols-[20px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-lg border px-2 py-2 ${activeIdx === index ? 'bg-cyan-400/5 border-cyan-300/30' : liveIndex === index && !disabled ? 'bg-emerald-400/5 border-emerald-400/30' : 'border-white/5'}`}>
              <span className="text-[9px] font-mono text-slate-500">{String(index + 1).padStart(2, '0')}</span>
              <label className="min-w-0"><span className="block text-[8px] text-slate-500 mb-1 truncate" title={xLabel}>{xUnit || xLabel}</span>
                <CurveNumberInput aria-label={`${title} bin ${index + 1} ${xLabel}`} className={inputClass}
                  value={value} step={xStep} disabled={disabled || xFixed} onCommit={next => editPoint(index, 'x', next)} /></label>
              <label className="min-w-0"><span className="block text-[8px] text-slate-500 mb-1 truncate" title={yLabel}>{yUnit || yLabel}</span>
                <CurveNumberInput aria-label={`${title} bin ${index + 1} ${yLabel}`} className={inputClass}
                  value={safeY[index] ?? 0} step={effectiveStep} disabled={disabled} onCommit={next => editPoint(index, 'y', next)} /></label>
            </div>)}
          </div>
        </div>
      </div>
      <footer className="flex flex-wrap justify-between items-center gap-2 px-5 py-3 border-t border-white/5 text-[10px] text-slate-500">
        <span>{disabled ? 'Editing disabled' : `X ${xFixed ? 'locked' : `step ${xStep}`} · Y step ${effectiveStep} · Enter apply · Esc cancel`}</span>
        {!disabled && Number.isFinite(interpolated) ? <span className="font-mono text-emerald-300">LIVE {liveXValue.toFixed(xPrecision)} → {interpolated.toFixed(precision)} {yUnit}</span> : footerNote && <span>{footerNote}</span>}
      </footer>
    </section>
  )
}

export default CurveTablePanel
