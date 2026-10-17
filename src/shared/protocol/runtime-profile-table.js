import { readRuntimeTableFromDecodedPage } from './runtime-tables.js'

function convert(values, meta, count, display = false) {
  if (!Array.isArray(values) || values.length !== count) throw new Error('Invalid profile table dimensions')
  const bits = Number(meta.dataType?.slice(1)) || 8
  const signed = meta.dataType?.startsWith('S')
  const low = signed ? -(2 ** (bits - 1)) : 0
  const high = signed ? 2 ** (bits - 1) - 1 : 2 ** bits - 1
  return values.map(value => {
    if (!Number.isFinite(value)) throw new Error('Profile table contains a non-finite value')
    const raw = display ? Math.round(value / (meta.scale ?? 1) - (meta.translate ?? 0)) : value
    if (!Number.isInteger(raw) || raw < low || raw > high) throw new Error('Profile table value is outside the INI storage range')
    return raw
  })
}

export function validateRuntimeProfileTable(table, def) {
  const valid = { ...table,
    rawValues: convert(table.rawValues, def.zMeta, def.rows * def.cols),
    rawRpmAxis: convert(table.rawRpmAxis, def.xMeta, def.cols),
    rawLoadAxis: convert(table.rawLoadAxis, def.yMeta, def.rows) }
  if (table.displayValues) {
    const canonical = profileTableFromDisplay(table, def)
    if (['rawValues', 'rawRpmAxis', 'rawLoadAxis'].some(key => JSON.stringify(canonical[key]) !== JSON.stringify(valid[key]))) {
      throw new Error('Profile display and raw bytes disagree; review and re-save this preset in the editor')
    }
  }
  return valid
}

export function profileTableFromDisplay(template, def, partial = {}) {
  const values = partial.values ?? template.displayValues
  if (!Array.isArray(values) || values.length !== def.rows || values.some(row => !Array.isArray(row) || row.length !== def.cols)) {
    throw new Error('Invalid profile table dimensions')
  }
  const decoded = {
    [def.zBinsVar]: convert(values.flat(), def.zMeta, def.rows * def.cols, true),
    [def.xBinsVar]: convert(partial.rpmAxis ?? template.displayRpmAxis, def.xMeta, def.cols, true),
    [def.yBinsVar]: convert(partial.loadAxis ?? template.displayLoadAxis, def.yMeta, def.rows, true) }
  return { ...template, ...readRuntimeTableFromDecodedPage(decoded, def), operation: 'preset' }
}
