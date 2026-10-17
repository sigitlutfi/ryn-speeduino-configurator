import { physicalPinForField } from '../../../../shared/protocol/board-pins.js'

export function pinMenuPosition(rect, viewport) {
  const margin = 12, gap = 8
  const width = Math.max(0, Math.min(Math.max(rect.width, 320), viewport.width - margin * 2))
  const below = Math.max(0, viewport.height - Math.max(margin, rect.bottom) - gap - margin)
  const above = Math.max(0, Math.min(viewport.height - margin, rect.top) - gap - margin)
  const opensUp = below < 280 && above > below
  // Short windows need the viewport's full height for search + scrollable list.
  if (Math.max(above, below) < 240) return {
    position: 'fixed', left: Math.max(margin, Math.min(rect.left, viewport.width - width - margin)),
    width, top: margin, maxHeight: Math.max(0, viewport.height - margin * 2),
  }
  return {
    position: 'fixed',
    left: Math.max(margin, Math.min(rect.left, viewport.width - width - margin)),
    width,
    maxHeight: Math.min(420, opensUp ? above : below),
    ...(opensUp ? { bottom: viewport.height - rect.top + gap } : { top: rect.bottom + gap }),
  }
}

export function pinChoicePresentation(option, fieldName, context) {
  const activeOwners = option.activeOwners || []
  const physicalPin = physicalPinForField(fieldName, option.index, option.label, context)
  const locked = option.disabled || activeOwners.length > 0
  let reason = ''
  if (option.assignmentState === 'unavailable') reason = 'This value is unavailable in the loaded INI. Choose another pin.'
  else if (activeOwners.length) reason = `Used by ${activeOwners.map(owner => owner.displayLabel).join(', ')}`
  else if (option.disabled && option.assignmentState === 'default') reason = 'This board has no default route. Choose an explicit pin.'
  else if (option.disabled) reason = 'Unavailable in the current feature mode.'
  else if (/pin required/i.test(option.label)) reason = 'Choose an explicit pin before enabling this feature.'
  else if (option.assignmentState === 'none') reason = 'No physical pin is assigned in this mode.'
  else if (option.owners?.length) reason = `Also configured for ${option.owners.map(owner => owner.displayLabel).join(', ')} while inactive`
  else reason = context.verified ? 'No other active owner in this preview' : 'Board mapping needs confirmation'
  const group = option.assignmentState === 'unavailable' ? 'unavailable' : locked ? 'reserved'
    : ['none', 'default'].includes(option.assignmentState) ? 'special' : 'available'
  return { ...option, locked, reason, group,
    physicalLabel: Number.isInteger(physicalPin) ? `MCU D${physicalPin}` : '' }
}

export function filterPinChoices(choices, query, filter = 'all') {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return choices.filter(choice => {
    if (filter === 'available' && choice.locked) return false
    if (filter === 'reserved' && !choice.locked) return false
    if (filter === 'special' && !['none', 'default'].includes(choice.assignmentState)) return false
    const text = [choice.label, choice.physicalLabel, /^\d+$/.test(choice.label) ? `D${choice.label}` : '',
      ...(choice.owners || []).map(owner => `${owner.displayLabel} ${owner.field}`)].join(' ').toLowerCase()
    return tokens.every(token => text.includes(token))
  })
}

export function pinSelectionStatus(choice, isActive, mapConfirmed) {
  if (!choice || choice.assignmentState === 'unavailable') return { key: 'invalid', label: 'Unavailable' }
  if (choice.activeOwners?.length) return isActive
    ? { key: 'conflict', label: 'Existing conflict' } : { key: 'warning', label: 'Pin reserved by another feature' }
  if (choice.locked) return { key: 'warning', label: choice.assignmentState === 'default' ? 'Default route unavailable' : 'Unavailable in this mode' }
  if (/pin required/i.test(choice.label)) return { key: 'warning', label: 'Pin required' }
  if (!mapConfirmed) return { key: 'warning', label: 'Mapping incomplete' }
  if (choice.assignmentState === 'none') return { key: 'neutral', label: 'Auto / no pin' }
  if (choice.assignmentState === 'default') return { key: 'default', label: 'Board Default' }
  return { key: 'valid', label: isActive ? 'Assigned' : 'Configured · feature inactive' }
}
