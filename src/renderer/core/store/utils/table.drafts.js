import { getTableMetadata, getVarMetadata } from '../../../../shared/ini-parser.js'
import { parsePage } from '../../../../shared/protocol/binary-parser.js'
import { createPageSnapshot, serializeDecodedPage, validatePageSnapshot } from '../../../../shared/protocol/page-cache.js'
import { deriveProjectSyncState } from './project.utils.js'
import { resolveNumericMetadata } from '../../../../shared/protocol/ini-numeric.js'

export const TABLE_IDS = { ve: 'veTable1Tbl', ve2: 'fuelTable2Tbl', ign: 'sparkTbl', ign2: 'spark2Tbl',
  afr: 'afrTable1Tbl', lambda: 'lambdaTable1Tbl', staging: 'stagingTbl', vvtTbl: 'vvtTbl',
  vvt2Tbl: 'vvt2Tbl', boostTbl: 'boostTbl', boostDCLupTbl: 'boostDCLupTbl' }

function stoich(decoded) {
  for (const page of Object.values(decoded || {})) if (Number.isFinite(page.stoich) && page.stoich > 0) return page.stoich / 10
  return 14.7
}

export function displayTablesFromPages(ini, decoded, base = {}) {
  const result = { ...base }
  for (const [key, id] of Object.entries(TABLE_IDS)) {
    const table = getTableMetadata(ini, id)
    const page = decoded?.[table?.page]
    if (!table || !page?.[table.zBinsVar]) continue
    const z = getVarMetadata(ini, table.zBinsVar)
    const [rows, cols] = z?.shape || [16, 16]
    const scaled = (value, meta) => Number(((value + (meta?.translate ?? 0)) * (meta?.scale ?? 1)).toFixed(meta?.digits ?? 0))
    const values = Array.from(page[table.zBinsVar], value => key === 'lambda'
      ? Number((value / (stoich(decoded) * 10)).toFixed(3)) : scaled(value, z))
    result[key] = { values: Array.from({ length: rows }, (_, row) => values.slice(row * cols, (row + 1) * cols)),
      rpmAxis: Array.from(page[table.xBinsVar] || [], value => scaled(value, resolveNumericMetadata(getVarMetadata(ini, table.xBinsVar), ini, decoded))),
      loadAxis: Array.from(page[table.yBinsVar] || [], value => scaled(value, resolveNumericMetadata(getVarMetadata(ini, table.yBinsVar), ini, decoded))) }
  }
  return result
}

export function applyTableDrafts(project, tables, ini, drafts = {}) {
  if (!Object.keys(drafts).length) return project
  const pages = { ...project.constants.pages }, decodedPages = { ...project.constants.decodedPages }
  if (drafts.afr && drafts.lambda) throw new Error('Discard one set of AFR/Lambda edits before Save; both edit the same ECU table')
  for (const key of Object.keys(drafts)) {
    const table = getTableMetadata(ini, TABLE_IDS[key])
    if (!table) throw new Error(`Missing INI metadata for table ${key}`)
    const display = tables[key]
    const baseline = validatePageSnapshot(pages[table.page], ini.constants.pageSizes[table.page]).buffer
    const z = getVarMetadata(ini, table.zBinsVar)
    const [rows, cols] = z?.shape || [16, 16]
    if (!display?.values || display.values.length !== rows || display.values.some(row => row.length !== cols)) throw new Error(`Wrong shape for table ${key}`)
    const raw = (value, meta) => {
      if (!Number.isFinite(value)) throw new Error(`Invalid numeric value in table ${key}`)
      const number = Math.round(value / (meta.scale ?? 1) - (meta.translate ?? 0))
      const type = meta.dataType?.toUpperCase() || 'U08'
      const bits = Number(type.slice(1))
      const low = type[0] === 'S' ? -(2 ** (bits - 1)) : 0
      const high = type[0] === 'S' ? 2 ** (bits - 1) - 1 : 2 ** bits - 1
      if (!Number.isFinite(number) || number < low || number > high) throw new Error(`Value outside ${type} range in table ${key}`)
      return number
    }
    // Only serialize edited fields. INI aliases (AFR/Lambda) share offsets;
    // serializing an unchanged alias afterward would overwrite the edit.
    const data = {}
    data[table.zBinsVar] = display.values.flat().map(value => key === 'lambda'
      ? raw(value * stoich(decodedPages) * 10, { ...z, scale: 1, translate: 0 }) : raw(value, z))
    for (const [field, values] of [[table.xBinsVar, display.rpmAxis], [table.yBinsVar, display.loadAxis]]) {
      const meta = resolveNumericMetadata(getVarMetadata(ini, field), ini, decodedPages)
      if (!meta || !Array.isArray(values) || values.length !== meta.shape?.reduce((a, b) => a * b, 1)) throw new Error(`Wrong axis shape for table ${key}`)
      data[field] = values.map(value => raw(value, meta))
    }
    const buffer = serializeDecodedPage(ini, table.page, data, baseline)
    pages[table.page] = createPageSnapshot({ pageId: table.page, size: buffer.length, buffer,
      source: pages[table.page].source, syncState: 'dirty-local' })
    decodedPages[table.page] = parsePage(buffer, ini.constants.pages[table.page])
  }
  return { ...project, constants: { pages, decodedPages }, ecu: { ...project.ecu,
    sync: { ...project.ecu.sync, state: deriveProjectSyncState({ pages }, project.ecu.sync.activePages) } } }
}
