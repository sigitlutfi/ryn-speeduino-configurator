// Only protocol and configuration semantics belong in this comparison. Project
// names, dialog layout and help text may differ without changing ECU writes.
const FIELD_KEYS = ['type', 'dataType', 'offset', 'bitRange', 'shape', 'length', 'encoding',
  'units', 'scale', 'translate', 'lo', 'hi', 'digits', 'options', 'defaultValue', 'requiresPowerCycle']

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
  }
}
