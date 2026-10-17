import { Buffer } from 'buffer'
import { serializeValue } from './binary-serializer.js'
import { parsePage } from './binary-parser.js'
import { createPageSnapshot } from './page-cache.js'

// Write only declared defaults/overrides: decoding aliases and reserializing all
// of them would overwrite overlapping AFR/lambda and other INI views.
export function createInitializationPages(ini, overrides = {}) {
  const pages = {}, decodedPages = {}
  let defaultCount = 0
  for (const [page, fields] of Object.entries(ini.constants.pages)) {
    const size = ini.constants.pageSizes[page]
    if (!Number.isInteger(size) || size <= 0) throw new Error(`Invalid initialization page ${page}`)
    const buffer = Buffer.alloc(size)
    for (const [name, meta] of Object.entries(fields)) {
      if (meta.defaultValue === undefined) continue
      serializeValue(buffer, meta.offset, meta.defaultValue, meta)
      defaultCount++
    }
    for (const [name, value] of Object.entries(overrides[page] || {})) {
      const meta = fields[name]
      if (!meta) throw new Error(`Unknown initialization field '${name}'`)
      serializeValue(buffer, meta.offset, value, meta)
    }
    decodedPages[page] = parsePage(buffer, fields)
    pages[page] = createPageSnapshot({ pageId: page, size, buffer, source: 'ryn-initialization', syncState: 'dirty-local' })
  }
  return { constants: { pages, decodedPages }, defaultCount }
}
