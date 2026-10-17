// Only protocol and configuration semantics belong in this comparison. Project
// names, dialog layout and help text may differ without changing ECU writes.
import { isPinAssignmentField } from './pin-registry.js'
const FIELD_KEYS = ['type', 'dataType', 'offset', 'bitRange', 'shape', 'length', 'encoding',
  'units', 'scale', 'translate', 'lo', 'hi', 'digits', 'options', 'defaultValue', 'requiresPowerCycle',
  'scaleExpression', 'translateExpression', 'loExpression', 'hiExpression', 'digitsExpression', 'raw']

function fieldsContract(fields) {
  return Object.keys(fields || {}).sort().map(name => [name,
    ...FIELD_KEYS.map(key => {
      const value = fields[name][key]
      return value == null || typeof value === 'number' && !Number.isFinite(value) ? null : value
    })])
}

export function sameMetadataContract(actual, expected) {
  if (actual === expected) return true
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') return false
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  const keys = Object.keys(actual)
  return keys.length === Object.keys(expected).length && keys.every(key =>
    Object.hasOwn(expected, key) && sameMetadataContract(actual[key], expected[key]))
}

export function metadataContract(ini) {
  return {
    signature: ini?.info?.signature?.trim(),
    endianness: ini?.constants?.endianness,
    nPages: ini?.constants?.nPages,
    pageSizes: ini?.constants?.pageSizes,
    pages: Object.keys(ini?.constants?.pages || {}).sort((a, b) => Number(a) - Number(b))
      .map(page => [Number(page), fieldsContract(ini.constants.pages[page])]),
    realtimeSize: ini?.outputChannels?.ochBlockSize,
    realtimeCommand: ini?.outputChannels?.ochGetCommand,
    channels: fieldsContract(ini?.outputChannels?.channels),
    tables: Object.keys(ini?.tables || {}).sort().map(id => {
      const table = ini.tables[id]
      return [id, table.page, table.xBins?.varName ?? '', table.yBins?.varName ?? '', table.zBins?.varName ?? '']
    }),
    curves: Object.keys(ini?.curves || {}).sort().map(id => {
      const curve = ini.curves[id]
      return [id, curve.xBins?.varName ?? '', curve.yBins?.varName ?? '']
    }),
    // Pin availability uses INI conditions; labels and dialog placement do not
    // affect ownership, but changing an activation expression does.
    pinConditions: Object.values(ini?.constants?.pages || {}).flatMap(fields =>
      Object.entries(fields).filter(([name, meta]) => isPinAssignmentField(name, meta))
        .map(([name]) => [name, [...new Set((ini.dialogFields?.[name] || [])
          .map(entry => (entry.conditions?.length ? entry.conditions : [entry.condition])
            .filter(Boolean).map(condition => condition.trim()).sort().join(' && ')))].sort()]))
      .sort(([a], [b]) => a.localeCompare(b)),
  }
}
