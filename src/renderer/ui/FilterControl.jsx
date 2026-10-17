import React, { useEffect, useId, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { toDisplay, toRaw } from '../features/shared/utils/normalization.js'

// Keep the component outside its screen so edits do not remount the focused input.
export default function FilterControl({ label, detail, icon: Icon, value, meta, onChange }) {
  const id = useId()
  const display = toDisplay(value, meta)
  const [text, setText] = useState(String(display ?? ''))
  const [error, setError] = useState('')
  useEffect(() => { setText(String(display ?? '')); setError('') }, [display])
  const min = meta?.lo
  const max = meta?.hi
  const step = Math.abs(meta?.scale ?? 1)
  const available = !!meta && Number.isFinite(min) && Number.isFinite(max) && max > min && step > 0
  const defaultValue = toDisplay(meta?.defaultValue, meta)
  const hasDefault = available && Number.isFinite(defaultValue) && defaultValue >= min && defaultValue <= max
  const invalid = available && (!Number.isFinite(display) || display < min || display > max)
  const commit = () => {
    if (!available) return
    const number = text.trim() === '' ? NaN : Number(text)
    if (!Number.isFinite(number) || number < min || number > max) {
      setError(`Enter a value from ${min} to ${max}.`)
      return
    }
    const raw = toRaw(number, meta)
    const quantized = toDisplay(raw, meta)
    if (quantized < min || quantized > max) { setError('Value cannot be represented by this INI.'); return }
    setText(String(quantized))
    setError('')
    onChange(raw)
  }
  return <section className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="rounded-xl border border-neon-cyan/15 bg-neon-cyan/5 p-2.5 text-neon-cyan"><Icon size={18} /></div>
        <div><h4 id={`${id}-label`} className="text-sm font-semibold text-white">{label}</h4>
          <p id={`${id}-detail`} className="text-xs text-white/50 mt-1 leading-relaxed">{detail}</p></div>
      </div>
      <div className="shrink-0 w-24">
        <label htmlFor={`${id}-number`} className="block text-[10px] uppercase tracking-wider text-white/50 mb-1">Coefficient</label>
        <input id={`${id}-number`} aria-label={`${label} filter coefficient`} type="number" min={min} max={max} step={step}
          value={available ? text : ''} disabled={!available} aria-invalid={!!error || invalid}
          aria-describedby={`${id}-detail ${id}-message`}
          onChange={event => { setText(event.target.value); setError('') }} onBlur={commit}
          onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); commit() }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setText(String(display ?? '')); setError('') }
          }}
          className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 font-mono text-sm text-white outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 disabled:opacity-40" />
      </div>
    </div>
    <div>
      <input type="range" min={available ? min : 0} max={available ? max : 240} step={step} disabled={!available}
        value={available && Number.isFinite(display) ? Math.max(min, Math.min(max, display)) : 0}
        aria-labelledby={`${id}-label`} aria-describedby={`${id}-detail ${id}-message`}
        aria-valuetext={available ? `${display}, higher values mean more smoothing` : 'Unavailable'}
        onChange={event => { const next = Number(event.target.value); setText(String(next)); setError(''); onChange(toRaw(next, meta)) }}
        className="w-full h-6 cursor-pointer accent-neon-cyan focus-visible:outline-2 focus-visible:outline-neon-cyan rounded disabled:opacity-30 disabled:cursor-not-allowed" />
      <div className="flex justify-between gap-4 text-[11px] text-white/50"><span>Faster response {available ? `· ${min}` : ''}</span><span>More smoothing {available ? `· ${max}` : ''}</span></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
      <p id={`${id}-message`} role={error || invalid ? 'alert' : undefined} className={`text-xs ${error || invalid ? 'text-amber-300' : 'text-white/45'}`}>
        {!available ? 'Unavailable in this project INI.' : error || (invalid ? 'Current value is outside the INI range.' : hasDefault ? `INI default: ${defaultValue}` : 'No default defined in this INI.')}
      </p>
      {hasDefault && <button type="button" disabled={display === defaultValue && text === String(defaultValue)}
        aria-label={`Use INI default for ${label}`} onClick={() => { setText(String(defaultValue)); setError(''); onChange(meta.defaultValue) }}
        className="inline-flex items-center gap-1.5 text-xs text-neon-cyan rounded-md px-2 py-1.5 hover:bg-neon-cyan/10 focus-visible:outline-2 focus-visible:outline-neon-cyan disabled:text-white/25 disabled:hover:bg-transparent">
        <RotateCcw size={12} /> Use default
      </button>}
    </div>
  </section>
}
