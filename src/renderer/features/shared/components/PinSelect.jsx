import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, ChevronDown, Lock, Search } from 'lucide-react'
import { useStore } from '../../../core/store.js'
import { buildPinRegistry, getPinOptionsForField } from '../utils/pinRegistry'
import { getDecodedPages } from '../utils/projectConstants.js'
import { projectPinMapOptions } from '../../../../shared/protocol/board-pins.js'
import { filterPinChoices, pinChoicePresentation, pinMenuPosition, pinSelectionStatus } from '../utils/pinSelectModel.js'

const STATUS_TONES = {
  invalid: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
  conflict: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
  warning: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  neutral: 'border-white/15 bg-white/5 text-zinc-300',
  default: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
  valid: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
}
const GROUPS = [['special', 'Modes & board defaults'], ['available', 'Available pins'],
  ['reserved', 'Reserved / unavailable for this feature'], ['unavailable', 'Unsupported current value']]

export default function PinSelect({ label, fieldName, value, onChange, description, icon: Icon,
  disabled = false, decodedPages: draftPages, className = '' }) {
  const parsedIni = useStore(state => state.parsedIni)
  const currentProject = useStore(state => state.currentProject)
  const decodedPages = useMemo(() => draftPages ?? getDecodedPages(currentProject?.constants, parsedIni),
    [draftPages, currentProject?.constants, parsedIni])
  const registry = useMemo(() => buildPinRegistry(parsedIni, decodedPages, projectPinMapOptions(currentProject)),
    [parsedIni, decodedPages, currentProject?.hardware])
  const choices = useMemo(() => getPinOptionsForField(fieldName, parsedIni, decodedPages, registry, value)
    .map(option => pinChoicePresentation(option, fieldName, registry.context)),
  [fieldName, parsedIni, decodedPages, registry, value])
  const current = choices.find(choice => choice.index === Number(value))
  const isActive = registry.rows.find(row => row.field === fieldName)?.isActive
  const channelKnown = ['standard', '6-3', '8-1'].includes(currentProject?.hardware?.channelBuild)
  const restartPending = currentProject?.hardware?.restartRequired
  const mapConfirmed = registry.context.verified && channelKnown && !restartPending
  const status = pinSelectionStatus(current, isActive, mapConfirmed)
  const mapWarning = restartPending ? 'Mapping tujuan belum dikonfirmasi aktif. Selesaikan Burn, power cycle ECU, dan verifikasi sebelum mengubah pin terkait.' : registry.context.warning || (!channelKnown
    ? 'Firmware channel build is unknown. Reservations include all mapped channels; confirm the build in I/O Summary.' : '')
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [activeIndex, setActiveIndex] = useState(null)
  const [menuStyle, setMenuStyle] = useState(null)
  const triggerRef = useRef(null), menuRef = useRef(null), searchRef = useRef(null)
  const id = useId(), labelId = `${id}-label`, hintId = `${id}-hint`, menuId = `${id}-menu`, listId = `${id}-list`
  const visible = useMemo(() => filterPinChoices(choices, query, filter), [choices, query, filter])
  const grouped = GROUPS.map(([key, title]) => ({ key, title, choices: visible.filter(choice => choice.group === key) }))
  const navigable = grouped.flatMap(group => group.choices).filter(choice => !choice.locked)
  const activeChoice = navigable.find(choice => choice.index === activeIndex)

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }
  const openMenu = (initialQuery = '', edge = '') => {
    if (disabled) return
    setQuery(initialQuery)
    setFilter('all')
    const enabled = choices.filter(choice => !choice.locked)
    setActiveIndex((edge === 'last' ? enabled.at(-1) : edge === 'first' ? enabled[0]
      : enabled.find(choice => choice.index === Number(value)) || enabled[0])?.index ?? null)
    setIsOpen(true)
  }
  const selectChoice = choice => {
    if (disabled || !choice || choice.locked) return
    onChange(choice.index)
    closeMenu(true)
  }

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return
    const position = () => {
      const rect = triggerRef.current.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) { setIsOpen(false); return }
      setMenuStyle(pinMenuPosition(rect, { width: window.innerWidth, height: window.innerHeight }))
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [isOpen])
  useEffect(() => {
    if (isOpen) searchRef.current?.focus()
  }, [isOpen, Boolean(menuStyle)])
  useEffect(() => {
    if (disabled) setIsOpen(false)
  }, [disabled])
  useEffect(() => {
    if (!isOpen) return
    if (!navigable.some(choice => choice.index === activeIndex)) setActiveIndex(navigable[0]?.index ?? null)
  }, [isOpen, visible, activeIndex])
  useEffect(() => {
    if (isOpen && activeChoice) document.getElementById(`${id}-option-${activeChoice.index}`)?.scrollIntoView({ block: 'nearest' })
  }, [isOpen, activeChoice?.index])
  useEffect(() => {
    if (!isOpen) return
    const outside = event => {
      if (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const escape = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(true) }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [isOpen])

  const searchKeyDown = event => {
    if (event.key === 'Enter') { event.preventDefault(); selectChoice(activeChoice); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    if (['Home', 'End'].includes(event.key) && query) return
    event.preventDefault()
    if (!navigable.length) return
    const index = navigable.findIndex(choice => choice.index === activeIndex)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? navigable.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + navigable.length) % navigable.length
    setActiveIndex(navigable[next].index)
  }
  const menuKeyDown = event => {
    if (event.key !== 'Tab') return
    if (event.shiftKey && event.target === searchRef.current) {
      event.preventDefault(); closeMenu(true)
    } else if (!event.shiftKey && event.target !== searchRef.current) {
      event.preventDefault()
      const focusable = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
        .filter(node => node.tabIndex >= 0 && !node.disabled && node.getClientRects().length && !menuRef.current?.contains(node))
      const next = focusable[focusable.indexOf(triggerRef.current) + 1]
      closeMenu(true)
      next?.focus()
    }
  }

  return (
    <div className={`min-w-0 space-y-2 rounded-2xl border border-white/10 bg-zinc-950/60 p-3 ${disabled ? 'opacity-50' : ''} ${className}`} data-pin-status={status.key}>
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200" id={labelId}>
        {Icon && <Icon size={14} aria-hidden="true" />}{label}
      </div>
      {description && <p className="text-xs leading-relaxed text-zinc-400">{description}</p>}
      <button ref={triggerRef} type="button" disabled={disabled} aria-haspopup="dialog"
        aria-expanded={isOpen} aria-controls={isOpen ? menuId : undefined} aria-labelledby={`${labelId} ${id}-value`}
        aria-describedby={hintId} aria-invalid={['invalid', 'conflict'].includes(status.key) || undefined}
        onClick={() => isOpen ? closeMenu() : openMenu()}
        onKeyDown={event => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault(); openMenu('', ['ArrowUp', 'End'].includes(event.key) ? 'last' : 'first')
          } else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault(); openMenu(event.key)
          }
        }}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${STATUS_TONES[status.key]}`}>
        <span className="min-w-0">
          <span id={`${id}-value`} className="block break-words text-sm font-semibold text-zinc-100">{current?.label || 'Unavailable'}</span>
          <span className="mt-0.5 block text-xs">{status.label}{current?.physicalLabel && !current.label.includes('→') ? ` · ${current.physicalLabel}` : ''}</span>
        </span>
        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div id={hintId} className="space-y-1 text-xs leading-relaxed">
        <p className="text-zinc-400">{draftPages ? 'Project / local draft preview' : 'Project preview'} · Live ECU check when writing</p>
        {current && (current.locked || /pin required/i.test(current.label)) && <p className={STATUS_TONES[status.key].split(' ').at(-1)}>{current.reason}</p>}
        {mapWarning && <p className="flex items-start gap-1.5 text-amber-200"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{mapWarning}</p>}
      </div>
      {isOpen && createPortal(
        <div ref={menuRef} id={menuId} role="dialog" aria-modal="false" aria-labelledby={`${id}-menu-label`}
          onKeyDown={menuKeyDown} style={menuStyle || { visibility: 'hidden' }}
          className="z-[9999] flex flex-col overflow-hidden rounded-2xl border border-white/20 bg-zinc-950 shadow-2xl shadow-black/80">
          <div className="shrink-0 space-y-2 border-b border-white/10 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span id={`${id}-menu-label`} className="font-semibold text-zinc-200">{label}</span>
              <span className="text-zinc-400">{choices.filter(choice => !choice.locked).length} selectable</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-black/40 px-2.5 focus-within:border-cyan-300">
              <Search size={14} className="shrink-0 text-zinc-400" aria-hidden="true" />
              <input ref={searchRef} role="combobox" type="text" value={query} autoComplete="off"
                aria-label={`Search ${label}`} aria-autocomplete="list" aria-expanded="true" aria-controls={listId}
                aria-activedescendant={activeChoice ? `${id}-option-${activeChoice.index}` : undefined}
                onChange={event => setQuery(event.target.value)} onKeyDown={searchKeyDown}
                placeholder="Search pin or feature…" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500" />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
              <span role="status" aria-live="polite">{visible.length} results</span>
              <select aria-label="Filter pin options" value={filter} onChange={event => setFilter(event.target.value)}
                className="rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                <option value="all">All options</option><option value="available">Selectable</option>
                <option value="reserved">Reserved / unavailable</option><option value="special">Modes & defaults</option>
              </select>
            </div>
          </div>
          <div id={listId} role="listbox" aria-label={`${label} options`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
            {grouped.filter(group => group.choices.length).map(group => (
              <div key={group.key} role="group" aria-labelledby={`${id}-${group.key}`}>
                <div id={`${id}-${group.key}`} className="px-2.5 pb-1 pt-3 text-xs font-semibold text-zinc-400">{group.title}</div>
                {group.choices.map(choice => {
                  const selected = choice.index === Number(value), highlighted = choice.index === activeChoice?.index
                  return <div key={choice.index} id={`${id}-option-${choice.index}`} role="option"
                    aria-selected={selected} aria-disabled={choice.locked || undefined}
                    onPointerDown={event => event.preventDefault()} onPointerMove={() => !choice.locked && setActiveIndex(choice.index)}
                    onClick={() => selectChoice(choice)}
                    className={`my-0.5 rounded-lg border px-2.5 py-2 text-sm ${choice.locked ? 'cursor-not-allowed border-transparent text-zinc-400' : highlighted ? 'cursor-pointer border-cyan-400/40 bg-cyan-400/10 text-zinc-100' : 'cursor-pointer border-transparent text-zinc-200 hover:bg-white/5'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-words font-medium">{choice.label}</span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs">
                        {choice.locked && <Lock size={12} aria-label="Unavailable" />}
                        {selected && <><Check size={13} aria-hidden="true" /><span>Current</span></>}
                      </span>
                    </div>
                    {choice.physicalLabel && !choice.label.includes('→') && <div className="mt-0.5 text-xs text-cyan-200/80">{choice.physicalLabel}</div>}
                    <div className={`mt-0.5 text-xs leading-relaxed ${choice.activeOwners.length ? 'text-amber-200' : 'text-zinc-400'}`}>{choice.reason}</div>
                  </div>
                })}
              </div>
            ))}
            {!visible.length && <p role="status" className="px-3 py-6 text-center text-sm text-zinc-400">No matching pins. Try another pin number or feature name.</p>}
          </div>
          <div className="shrink-0 border-t border-white/10 px-3 py-2 text-xs leading-relaxed text-zinc-400">MCU pin numbers · ↑ ↓ to navigate · Enter to select · Esc to close</div>
        </div>, document.body,
      )}
    </div>
  )
}
