import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Buffer } from 'buffer'
import { parseIni } from '../src/shared/ini-parser.js'
import { parsePage } from '../src/shared/protocol/binary-parser.js'
import { formatReadCommand, formatWriteCommand, formatBurnCommand, formatCRCCommand, expandCommandTemplate, wrapModernProtocol } from '../src/shared/protocol/ecu-commands.js'
import { createPageSnapshot, decodePageSnapshot, validatePageSnapshot } from '../src/shared/protocol/page-cache.js'
import { serialService } from '../src/renderer/core/services/serialService.js'
import { createECUSyncSlice } from '../src/renderer/core/store/slices/ecu.sync.js'
import { createECUCommunicationSlice } from '../src/renderer/core/store/slices/ecu.communication.js'
import { createProjectLifecycleSlice } from '../src/renderer/core/store/slices/project.lifecycle.js'
import { createTableSlice } from '../src/renderer/core/store/tableSlice.js'
import { deriveProjectSyncState } from '../src/renderer/core/store/utils/project.utils.js'
import { normalizeProjectV3, serializeProjectForSave } from '../src/renderer/core/store/utils/project.normalization.js'
import { applyTableDrafts, displayTablesFromPages } from '../src/renderer/core/store/utils/table.drafts.js'
import { encodeDriveConfig } from '../src/shared/protocol/drive-modes.js'

const iniContent = readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8')
const paired = parseIni(iniContent, { CELSIUS: true })
const snapshot = (page, buffer) => createPageSnapshot({ pageId: page, size: buffer.length, buffer, source: 'project', syncState: 'verified' })
const crc = buffer => snapshot(1, buffer).crc32
const actual = Buffer.from([1, 2, 3, 4]), desired = Buffer.from([9, 8, 7, 6])

function fixture(t, { ini = null, pages = [1], buffers = null } = {}) {
  ini ||= { info: { signature: 'sync-fixture' }, constants: { pages: { 1: {}, 2: {} }, pageSizes: { 1: 4, 2: 4 } }, outputChannels: { channels: { burnPending: {} } } }
  const ecu = Object.fromEntries(Object.keys(ini.constants.pages).map(page => [page,
    Buffer.from(buffers?.[page] || (pages.includes(Number(page)) ? actual : Buffer.alloc(ini.constants.pageSizes[page])))]))
  const local = Object.fromEntries(pages.map(page => [page, snapshot(page, buffers?.[page] || desired)]))
  const trace = [], notifications = []
  let state = {
    projectEpoch: 1, connection: { status: 'connected', sessionId: 1, firmwareSignature: ini.info.signature }, parsedIni: ini,
    currentProject: { projectName: 'A', filePath: 'A.rynproj', ecu: { signature: ini.info.signature, sync: { activePages: pages, state: 'fully-verified' } },
      constants: { pages: local, decodedPages: Object.fromEntries(pages.map(page => [page, parsePage(decodePageSnapshot(local[page]), ini.constants.pages[page])])) } },
    tables: {}, tableDrafts: {}, operation: null,
    notify: (...args) => notifications.push(args),
    setOperation: operation => { state.operation = operation },
    updateOperation: patch => { state.operation = { ...state.operation, ...patch } },
    clearOperation: () => { state.operation = null }
  }
  const get = () => state
  const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) } }
  state = { ...state, ...createECUSyncSlice(set, get), readPageFromECU: async page => {
    trace.push(`read:${page}`)
    return { buffer: Buffer.from(ecu[page]), decoded: parsePage(ecu[page], ini.constants.pages[page]) }
  } }
  t.mock.method(serialService, 'enterExclusiveMode', async () => { trace.push('exclusive') })
  t.mock.method(serialService, 'resumeOutputChannelsPolling', () => { trace.push('resume') })
  t.mock.method(serialService, 'readPageCRC', async page => { trace.push(`crc:${page}`); return crc(ecu[page]) })
  t.mock.method(serialService, 'writePage', async (page, offset, length, data) => { trace.push(`write:${page}`); Buffer.from(data).copy(ecu[page], offset) })
  t.mock.method(serialService, 'burnPage', async page => { trace.push(`burn:${page}`) })
  t.mock.method(serialService, 'readOutputChannels', async () => { trace.push('burn-status'); return { outputChannels: { burnPending: 0 }, driveMode: { version: 1, active: 0, state: 0, valid: true }, rpm: 0, engine: { running: false, cranking: false } } })
  return { get, set, trace, ecu, notifications }
}

function driveSyncFixture(t) {
  const buffers = Object.fromEntries(Object.keys(paired.constants.pages).map(id => [id, Buffer.alloc(paired.constants.pageSizes[id])]))
  encodeDriveConfig().copy(buffers[15], 106)
  buffers[2][0] = 5
  const f = fixture(t, { ini: paired, pages: [2, 15], buffers })
  f.ecu[2][0] = 0
  const other = { maxTPS: 5, presets: [{ fuel: 90, ignition: 0, features: 7 }, { fuel: 100, ignition: 0, features: 7 }, { fuel: 100, ignition: 0, features: 7 }] }
  encodeDriveConfig(other).copy(f.ecu[15], 106)
  return f
}

test('bulk tune upload rejects active Drive Mode before writing any page', async t => {
  const f = driveSyncFixture(t)
  t.mock.method(serialService, 'readOutputChannels', async () => ({ driveMode: { version: 1, valid: true, active: 2, state: 0 } }))
  const result = await f.get().syncPagesToECU([2, 15], { writeSettleMs: 0 })
  assert.equal(result.ok, false)
  assert.match(result.error, /Drive Mode DEFAULT/)
  assert.equal(f.trace.some(item => item.startsWith('write:')), false)
})
test('bulk tune upload rejects a protected preset range while running before other page writes', async t => {
  const f = driveSyncFixture(t)
  t.mock.method(serialService, 'readOutputChannels', async () => ({ driveMode: { version: 1, valid: true, active: 0, state: 0 }, rpm: 3000, engine: { running: true } }))
  const result = await f.get().syncPagesToECU([2, 15], { writeSettleMs: 0 })
  assert.equal(result.ok, false)
  assert.match(result.error, /Stop the engine/)
  assert.equal(f.trace.some(item => item.startsWith('write:')), false)
})
test('bulk tune upload remains available in DEFAULT with engine stopped', async t => {
  const f = driveSyncFixture(t)
  const result = await f.get().syncPagesToECU([2, 15], { writeSettleMs: 0 })
  assert.equal(result.ok, true, result.error || result.errors?.[0]?.error)
  assert.equal(f.ecu[2][0], 5)
  assert.deepEqual(f.ecu[15].subarray(106, 124), encodeDriveConfig())
})

test('compare recomputes local raw CRC instead of trusting a forged/stale cache', async t => {
  const f = fixture(t)
  f.get().currentProject.constants.pages[1].crc32 = crc(actual)
  const result = await f.get().compareWithECU()
  assert.deepEqual(result.different, [1])
  assert.equal(f.get().currentProject.constants.pages[1].crc32, crc(desired))
})

test('download rejects inconsistent raw/CRC and retains all local pages atomically', async t => {
  const f = fixture(t, { pages: [1, 2] })
  const before = f.get().currentProject.constants
  f.set({ readPageFromECU: async page => ({ buffer: page === 1 ? actual : desired, decoded: {} }) })
  const result = await f.get().syncAllFromECU()
  assert.equal(result.ok, false)
  assert.match(result.error, /CRC\/readback mismatch/)
  assert.equal(f.get().currentProject.constants, before)
  assert.equal(f.get().operation, null)
})

test('timeout returns explicit failure, never a success notification', async t => {
  const f = fixture(t)
  f.set({ readPageFromECU: async () => { throw new Error('timeout') } })
  const result = await f.get().syncAllFromECU()
  assert.equal(result.ok, false)
  assert.match(result.error, /timeout/)
  assert.equal(f.notifications.some(([, severity]) => severity === 'success'), false)
})

test('write ACK without applied bytes fails RAM verification before burn and preserves target', async t => {
  const f = fixture(t)
  t.mock.method(serialService, 'writePage', async () => f.trace.push('ack-only'))
  const before = f.get().currentProject.constants.decodedPages
  const result = await f.get().syncPagesToECU([1], { burn: true, writeSettleMs: 0 })
  assert.equal(result.ok, false)
  assert.equal(f.trace.includes('burn:1'), false)
  assert.deepEqual(decodePageSnapshot(f.get().currentProject.constants.pages[1]), desired)
  assert.equal(f.get().currentProject.constants.decodedPages, before)
  assert.equal(f.get().currentProject.constants.pages[1].syncState, 'verify-failed')
})

test('successful upload verifies RAM before burn, waits pending EEPROM, then verifies again', async t => {
  const f = fixture(t)
  let statusReads = 0
  t.mock.method(serialService, 'readOutputChannels', async () => ({ outputChannels: { burnPending: statusReads++ === 0 ? 1 : 0 } }))
  const result = await f.get().syncPagesToECU([1], { burn: true, writeSettleMs: 0 })
  assert.equal(result.ok, true)
  const write = f.trace.indexOf('write:1'), burn = f.trace.indexOf('burn:1')
  assert.ok(f.trace.slice(write + 1, burn).includes('read:1'))
  assert.ok(f.trace.slice(burn + 1).includes('read:1'))
  assert.equal(statusReads, 2)
  assert.deepEqual(f.ecu[1], desired)
  assert.equal(f.get().currentProject.constants.pages[1].syncState, 'verified')
})

test('post-burn mismatch retains desired tune and reports failure', async t => {
  const f = fixture(t)
  t.mock.method(serialService, 'burnPage', async () => { f.ecu[1] = Buffer.from(actual) })
  const result = await f.get().syncPagesToECU([1], { burn: true, writeSettleMs: 0 })
  assert.equal(result.ok, false)
  assert.deepEqual(decodePageSnapshot(f.get().currentProject.constants.pages[1]), desired)
})

test('standalone burn refuses mismatching RAM without replacing local tune', async t => {
  const f = fixture(t)
  assert.equal((await f.get().burnPage(1)).ok, false)
  assert.equal(f.trace.includes('burn:1'), false)
  assert.deepEqual(decodePageSnapshot(f.get().currentProject.constants.pages[1]), desired)
})

test('RAM-only write leaves burn pending; missing active page prevents fully-verified', async t => {
  const f = fixture(t)
  assert.equal((await f.get().syncPagesToECU([1], { writeSettleMs: 0 })).ok, true)
  assert.equal(f.get().currentProject.constants.pages[1].syncState, 'burn-pending')
  assert.equal(f.trace.includes('burn:1'), false)
  assert.equal(deriveProjectSyncState({ pages: { 1: snapshot(1, actual) } }, [1, 2]), 'partially-synced')
})

test('invalid later page is rejected before any write; invalid base64 and size are rejected', async t => {
  const f = fixture(t, { pages: [1, 2] })
  f.get().currentProject.constants.pages[2].rawData = 'AA=='
  assert.equal((await f.get().uploadToECU()).ok, false)
  assert.equal(f.trace.some(step => step.startsWith('write:')), false)
  assert.throws(() => validatePageSnapshot({ ...snapshot(1, actual), rawData: '!!!!' }, 4), /base64/)
})

test('partial legacy pages cannot become whole-page writes', async t => {
  const f = fixture(t)
  f.get().currentProject.constants.pages[1].source = 'legacy-partial'
  assert.equal((await f.get().uploadToECU()).ok, false)
  assert.equal(f.trace.some(step => step.startsWith('write:')), false)
})

test('download rejects wrong signature and same-signature stale paired INI before page reads', async t => {
  const f = fixture(t)
  f.get().connection.firmwareSignature = 'another-ECU'
  assert.equal((await f.get().syncAllFromECU()).ok, false)
  assert.deepEqual(f.trace, [])
  f.set({ parsedIni: { ...paired, constants: { ...paired.constants, pageSizes: { ...paired.constants.pageSizes, 6: 142 } } } })
  f.get().connection.firmwareSignature = paired.info.signature
  assert.equal((await f.get().compareWithECU()).ok, false)
  assert.deepEqual(f.trace, [])
})

test('project switch during download prevents any commit into the new project', async t => {
  const f = fixture(t)
  f.set({ readPageFromECU: async () => {
    f.set({ projectEpoch: 2, currentProject: { ...f.get().currentProject, projectName: 'B' } })
    return { buffer: actual, decoded: {} }
  } })
  assert.equal((await f.get().syncAllFromECU()).ok, false)
  assert.equal(f.get().currentProject.projectName, 'B')
  assert.deepEqual(decodePageSnapshot(f.get().currentProject.constants.pages[1]), desired)
})

test('local edit during download cancels replacement, and concurrent sync is refused', async t => {
  const f = fixture(t)
  let release
  f.set({ readPageFromECU: async () => { await new Promise(resolve => { release = resolve }); return { buffer: actual, decoded: {} } } })
  const pending = f.get().syncAllFromECU()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal((await f.get().uploadToECU()).ok, false)
  const constants = { ...f.get().currentProject.constants }
  f.set({ currentProject: { ...f.get().currentProject, constants } })
  release()
  assert.equal((await pending).ok, false)
  assert.equal(f.get().currentProject.constants, constants)
})

test('download honors active pages and exposes that disk Save is still needed', async t => {
  const f = fixture(t, { pages: [2] })
  const result = await f.get().syncAllFromECU()
  assert.equal(result.ok, true)
  assert.deepEqual(result.pages, [2])
  assert.equal(result.saved, false)
  assert.equal(f.trace.includes('read:1'), false)
})

test('INI read primitive rejects short chunks instead of padding zeros', async t => {
  const f = fixture(t)
  f.set(createECUCommunicationSlice(f.set, f.get))
  t.mock.method(serialService, 'readPageBuffer', async () => Buffer.from([1]))
  await assert.rejects(() => f.get().readPageFromECU(1), /Short read/)
})

test('paired custom pages download/save/reload/upload preserve every byte, including reserved pad', async t => {
  const buffers = { 6: Buffer.alloc(paired.constants.pageSizes[6]), 10: Buffer.alloc(paired.constants.pageSizes[10]) }
  buffers[6][142] = 0x55
  buffers[10][219] = 0xa5
  const f = fixture(t, { ini: paired, pages: [6, 10], buffers })
  assert.equal((await f.get().syncAllFromECU()).ok, true)
  const file = JSON.parse(JSON.stringify(serializeProjectForSave(f.get().currentProject, f.get().tables)))
  const reloaded = normalizeProjectV3(file, paired)
  assert.deepEqual(decodePageSnapshot(reloaded.constants.pages[10]), buffers[10])
  assert.equal(reloaded.constants.pages[10].syncState, 'unknown')
  f.set({ currentProject: reloaded })
  // Write back across another valid RAM baseline, just like a TS page transfer.
  f.ecu[6] = Buffer.alloc(buffers[6].length)
  f.ecu[10] = Buffer.alloc(buffers[10].length)
  const result = await f.get().syncPagesToECU([6, 10], { burn: true, writeSettleMs: 0 })
  assert.equal(result.ok, true, result.error || result.errors?.[0]?.error)
  assert.deepEqual(f.ecu[6], buffers[6])
  assert.deepEqual(f.ecu[10], buffers[10])
})

test('Save project applies table drafts into raw bytes; reload ignores stale display cache', async t => {
  const buffers = Object.fromEntries(Object.keys(paired.constants.pages).map(id => [id, Buffer.alloc(paired.constants.pageSizes[id])]))
  const f = fixture(t, { ini: paired, pages: Object.keys(buffers).map(Number), buffers })
  f.set({ ...createTableSlice(f.set), ...createProjectLifecycleSlice(f.set, f.get) })
  const tables = displayTablesFromPages(paired, f.get().currentProject.constants.decodedPages)
  f.set({ tables })
  const ve = paired.tables.veTable1Tbl
  f.get().setTableCell('ve', 0, 0, 123)
  let saved
  const oldWindow = globalThis.window
  globalThis.window = { projects: { saveFile: async (_path, data) => { saved = data; return { ok: true } }, addRecent: async () => [] },
    serial: { disconnect: async () => {} } }
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow })
  assert.equal((await f.get().saveProject()).ok, true)
  assert.equal(parsePage(decodePageSnapshot(saved.constants.pages[ve.page]), paired.constants.pages[ve.page])[ve.zBins.varName][0], 123)
  assert.deepEqual(f.get().tableDrafts, {})
  assert.equal(saved.tables, undefined, 'schema 5 rebuilds display tables from raw pages')
  saved.tables = { ve: { ...tables.ve, values: tables.ve.values.map(row => row.map(() => 999)) } }
  assert.equal((await f.get().setProject({ ...saved, ini: { content: iniContent, signature: paired.info.signature } })).ok, true)
  assert.equal(f.get().tables.ve.values[0][0], 123)
  f.set({ connection: { status: 'connected', sessionId: 2, firmwareSignature: paired.info.signature } })
  assert.equal((await f.get().compareWithECU()).different.includes(ve.page), true)
})

test('serial transaction queue serializes commands and survives a rejected command', async () => {
  const order = []
  const first = serialService._runCommandTransaction(async () => { order.push('A'); await new Promise(resolve => setTimeout(resolve, 10)); throw new Error('A failed') })
  const second = serialService._runCommandTransaction(async () => { order.push('B'); return 'done' })
  const result = await Promise.allSettled([first, second])
  assert.deepEqual(order, ['A', 'B'])
  assert.equal(result[0].status, 'rejected')
  assert.equal(result[1].value, 'done')
  assert.equal(serialService.commandInFlightCount, 0)
})

test('all 15 page command payloads match TunerStudio INI identifiers and templates exactly', () => {
  const templates = (name, prefix = '') => {
    const rows = [...iniContent.matchAll(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, 'gm'))]
    const row = rows.find(row => !prefix || row[1].startsWith(`"${prefix}`))
    return [...row[1].matchAll(/"([^"]*)"/g)].map(match => match[1])
  }
  const ids = templates('pageIdentifier'), read = templates('pageReadCommand'), write = templates('pageChunkWrite')
  const burn = templates('burnCommand', 'b'), check = templates('crc32CheckCommand')
  for (let page = 1; page <= 15; page++) {
    const offset = paired.constants.pageSizes[page] - 1, data = [0xa5]
    const command = source => wrapModernProtocol(expandCommandTemplate(source.replace('%2i', ids[page - 1]).replace('%v', '\\xA5'), { tsCanId: 0, offset, count: 1 }))
    assert.deepEqual(formatReadCommand(page, offset, 1), command(read[page - 1]))
    assert.deepEqual(formatWriteCommand(page, offset, 1, data), command(write[page - 1]))
    assert.deepEqual(formatBurnCommand(page), command(burn[page - 1]))
    assert.deepEqual(formatCRCCommand(page), command(check[page - 1]))
  }
})

test('burn status timeout never claims persisted success', async t => {
  const f = fixture(t, { buffers: { 1: desired } })
  t.mock.method(serialService, 'readOutputChannels', async () => ({ outputChannels: { burnPending: 1 } }))
  let time = 0
  t.mock.method(Date, 'now', () => { time += 20000; return time })
  const result = await f.get().burnPage(1)
  assert.equal(result.ok, false)
  assert.match(result.error, /timeout/)
  assert.equal(f.get().currentProject.constants.pages[1].syncState, 'verify-failed')
  assert.deepEqual(decodePageSnapshot(f.get().currentProject.constants.pages[1]), desired)
})

test('reconnect on the same port during a write cancels before burn', async t => {
  const f = fixture(t)
  t.mock.method(serialService, 'writePage', async () => {
    f.set({ connection: { ...f.get().connection, sessionId: 2 } })
  })
  const result = await f.get().syncPagesToECU([1], { burn: true, writeSettleMs: 0 })
  assert.equal(result.ok, false)
  assert.equal(f.trace.includes('burn:1'), false)
  assert.deepEqual(decodePageSnapshot(f.get().currentProject.constants.pages[1]), desired)
})

test('Save As also commits drafts; file save failure leaves draft and target available for retry', async t => {
  const buffers = Object.fromEntries(Object.keys(paired.constants.pages).map(id => [id, Buffer.alloc(paired.constants.pageSizes[id])]))
  const f = fixture(t, { ini: paired, pages: Object.keys(buffers).map(Number), buffers })
  f.set({ ...createTableSlice(f.set), ...createProjectLifecycleSlice(f.set, f.get), tables: displayTablesFromPages(paired, f.get().currentProject.constants.decodedPages) })
  f.get().setTableCell('ve', 0, 0, 42)
  const original = f.get().currentProject.constants
  const oldWindow = globalThis.window
  let saved
  globalThis.window = { projects: { pickSave: async () => 'B.rynproj', saveFile: async () => ({ error: 'disk failure' }), addRecent: async () => [] } }
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow })
  assert.equal((await f.get().saveProjectAs()).ok, false)
  assert.equal(f.get().tableDrafts.ve, true)
  assert.equal(f.get().currentProject.constants, original)
  globalThis.window.projects.saveFile = async (_path, data) => { saved = data; return { ok: true } }
  assert.equal((await f.get().saveProjectAs()).ok, true)
  const table = paired.tables.veTable1Tbl
  assert.equal(parsePage(decodePageSnapshot(saved.constants.pages[table.page]), paired.constants.pages[table.page])[table.zBins.varName][0], 42)
  assert.equal(f.get().currentProject.filePath, 'B.rynproj')
  assert.deepEqual(f.get().tableDrafts, {})
})

test('table draft serialization preserves reserved bytes and uses INI scale/translate', () => {
  const page = 5
  const buffer = Buffer.alloc(paired.constants.pageSizes[page], 0x93)
  const project = { ecu: { sync: { activePages: [page] } }, constants: { pages: { [page]: snapshot(page, buffer) }, decodedPages: { [page]: parsePage(buffer, paired.constants.pages[page]) } } }
  const tables = displayTablesFromPages(paired, project.constants.decodedPages)
  tables.afr.values[0][0] = 14.7
  const prepared = applyTableDrafts(project, tables, paired, { afr: true })
  const output = decodePageSnapshot(prepared.constants.pages[page])
  assert.equal(output[0], 147)
  assert.equal(output.subarray(1).equals(buffer.subarray(1)), true)
  assert.equal(displayTablesFromPages(paired, prepared.constants.decodedPages).afr.values[0][0], 14.7)
})

test('table-screen Save can apply drafts before RAM sync; AFR/Lambda remain one coherent table', async t => {
  const buffers = Object.fromEntries(Object.keys(paired.constants.pages).map(id => [id, Buffer.alloc(paired.constants.pageSizes[id])]))
  const f = fixture(t, { ini: paired, pages: Object.keys(buffers).map(Number), buffers })
  f.set({ ...createTableSlice(f.set), ...createProjectLifecycleSlice(f.set, f.get), tables: displayTablesFromPages(paired, f.get().currentProject.constants.decodedPages) })
  f.get().setTableCell('afr', 0, 0, 14.7)
  assert.equal(f.get().tables.lambda.values[0][0], 1)
  f.get().setTableCell('lambda', 0, 0, 0.9)
  assert.equal(f.get().tableDrafts.afr, undefined)
  assert.equal(f.get().tableDrafts.lambda, true)
  assert.equal(f.get().tables.afr.values[0][0], 13.2)
  assert.equal(f.get().applyProjectTableDrafts().ok, true)
  assert.deepEqual(f.get().tableDrafts, {})
  const result = await f.get().writePagesToRAM([5])
  assert.equal(result.ok, true, result.error || result.errors?.[0]?.error)
  assert.equal(f.ecu[5][0], 132)
})

test('handshake in progress and missing/invalid EEPROM indicators prevent success', async t => {
  const f = fixture(t, { buffers: { 1: desired } })
  f.get().connection.handshakeStatus = 'probing'
  assert.equal((await f.get().syncAllFromECU()).ok, false)
  assert.deepEqual(f.trace, [])
  f.get().connection.handshakeStatus = 'ok'
  t.mock.method(serialService, 'readOutputChannels', async () => ({ outputChannels: {} }))
  assert.equal((await f.get().burnPage(1)).ok, false)
  assert.equal(f.get().currentProject.constants.pages[1].syncState, 'verify-failed')
})

test('restoring a tune clears pending display drafts and ignores stale restore-point cache', async t => {
  const f = fixture(t)
  f.set(createProjectLifecycleSlice(f.set, f.get))
  f.get().currentProject.initialization = { restorePoints: { baseTune: {
    constants: { pages: { 1: snapshot(1, actual) }, decodedPages: { 1: {} } },
    tables: { ve: { values: [[999]], rpmAxis: [], loadAxis: [] } }, runtimeProfiles: {}
  } } }
  f.set({ tableDrafts: { ve: true } })
  assert.equal((await f.get().restoreProjectToBaseTune()).ok, true)
  assert.deepEqual(f.get().tableDrafts, {})
  assert.deepEqual(decodePageSnapshot(f.get().currentProject.constants.pages[1]), actual)
  assert.notEqual(f.get().tables.ve.values[0][0], 999)
  assert.equal(f.get().currentProject.tableDrafts, undefined)
})


test('cancelled old sync cleanup cannot release a replacement operation', async t => {
  const f = fixture(t), replacement = { type: 'replacement', owner: {} }
  f.set({ readPageFromECU: async () => {
    f.set({ projectEpoch: 2, operation: replacement })
    throw new Error('old read cancelled')
  } })
  const result = await f.get().syncAllFromECU()
  assert.equal(result.ok, false)
  assert.equal(f.get().operation, replacement)
})
