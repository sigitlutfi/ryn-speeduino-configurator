import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Buffer } from 'buffer'
import { parseIni } from '../src/shared/ini-parser.js'
import { parsePage } from '../src/shared/protocol/binary-parser.js'
import { serializeValue } from '../src/shared/protocol/binary-serializer.js'
import { createPageSnapshot } from '../src/shared/protocol/page-cache.js'
import { resolveRuntimeField, readRuntimeFieldFromBuffer } from '../src/shared/protocol/runtime-fields.js'
import { resolveRuntimeTable, readRuntimeTableFromDecodedPage } from '../src/shared/protocol/runtime-tables.js'
import { profileTableFromDisplay } from '../src/shared/protocol/runtime-profile-table.js'
import { evaluateRuntimeProfileGuards } from '../src/renderer/core/store/utils/runtime.guards.js'
import { DEFAULT_RUNTIME_PROFILE_GUARDS } from '../src/renderer/core/store/utils/project.constants.js'
import { createEmptyRuntimeProfileSession } from '../src/renderer/core/store/types/runtime.types.js'
import { createRuntimeProfileSlice } from '../src/renderer/core/store/slices/runtime.profile.js'
import { createECUSyncSlice } from '../src/renderer/core/store/slices/ecu.sync.js'
import { serialService } from '../src/renderer/core/services/serialService.js'

const ini = parseIni(readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8'), { CELSIUS: true })
const stopped = { rpm: 0, tps: 0, engine: { cranking: false, running: false } }
const snap = (page, buffer) => createPageSnapshot({ pageId: page, buffer, size: buffer.length, source: 'project', syncState: 'verified' })
const crc = buffer => snap(1, buffer).crc32

function fixture(t) {
  const base = Object.fromEntries(Object.entries(ini.constants.pageSizes).filter(([page]) => ini.constants.pages[page]).map(([page, size]) => [page, Buffer.alloc(size)]))
  for (const [name, value] of [['ve2', 100], ['spark2', 40], ['afr1', 147]]) {
    const def = resolveRuntimeTable(ini, name)
    serializeValue(base[def.page], def.zMeta.offset, Array(def.rows * def.cols).fill(value), def.zMeta)
    serializeValue(base[def.page], def.xMeta.offset, Array.from({ length: def.cols }, (_, i) => 5 + i * 5), def.xMeta)
    serializeValue(base[def.page], def.yMeta.offset, Array.from({ length: def.rows }, (_, i) => 20 + i * 5), def.yMeta)
  }
  const ecu = Object.fromEntries(Object.entries(base).map(([page, buffer]) => [page, Buffer.from(buffer)]))
  const trace = []
  let telemetry = stopped
  let state = { projectEpoch: 1, parsedIni: ini, connection: { status: 'connected', sessionId: 1, firmwareSignature: ini.info.signature },
    realtime: stopped, realtimeReceivedAt: Date.now(), tableDrafts: {}, tables: {}, operation: null,
    runtimeProfileSession: createEmptyRuntimeProfileSession({ state: 'Base' }),
    currentProject: { ecu: { signature: ini.info.signature, sync: { activePages: Object.keys(base).map(Number), state: 'fully-verified' } },
      constants: { pages: Object.fromEntries(Object.entries(base).map(([page, buffer]) => [page, snap(page, buffer)])),
        decodedPages: Object.fromEntries(Object.entries(base).map(([page, buffer]) => [page, parsePage(buffer, ini.constants.pages[page])])) } },
    setOperation: operation => { state.operation = operation }, updateOperation: patch => { state.operation = { ...state.operation, ...patch } },
    clearOperation: () => { state.operation = null }, notify: () => {}, setRealtime: realtime => { state.realtime = realtime; state.realtimeReceivedAt = Date.now() } }
  const get = () => state
  const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) } }
  state = { ...state, ...createRuntimeProfileSlice(set, get), ...createECUSyncSlice(set, get),
    readPageFromECU: async page => ({ buffer: Buffer.from(ecu[page]), decoded: parsePage(ecu[page], ini.constants.pages[page]) }) }
  t.mock.method(serialService, 'enterExclusiveMode', async () => {})
  t.mock.method(serialService, 'resumeOutputChannelsPolling', () => {})
  t.mock.method(serialService, 'readOutputChannels', async () => telemetry)
  t.mock.method(serialService, 'readPageCRC', async page => crc(ecu[page]))
  t.mock.method(serialService, 'writePage', async (page, offset, length, data) => { trace.push({ page, offset }); Buffer.from(data).copy(ecu[page], offset) })
  t.mock.method(serialService, 'burnPage', async () => { throw new Error('Runtime profile must never burn') })
  const table = name => { const def = resolveRuntimeTable(ini, name); return readRuntimeTableFromDecodedPage(parsePage(base[def.page], ini.constants.pages[def.page]), def) }
  const preset = (name, display) => profileTableFromDisplay(table(name), resolveRuntimeTable(ini, name), { values: Array.from({ length: 16 }, () => Array(16).fill(display)) })
  const profile = { name: 'ECO', table_overlays: [{ target: 've2', table: preset('ve2', 95) }, { target: 'spark2', table: preset('spark2', 2) }], changes: [] }
  return { get, set, base, ecu, trace, table, preset, profile, telemetry: value => { telemetry = value } }
}

for (const [name, display, raw] of [['spark2', 0, 40], ['afr1', 14.7, 147], ['ve2', 100, 100]]) {
  test(`editor ${name} converts display ${display} to INI raw ${raw}`, t => {
    const f = fixture(t)
    assert.ok(f.preset(name, display).rawValues.every(value => value === raw))
  })
}

test('profile editor converts axes with INI scale and preserves unaffected axes', t => {
  const f = fixture(t), def = resolveRuntimeTable(ini, 've2'), before = f.table('ve2')
  const next = profileTableFromDisplay(before, def, { rpmAxis: before.displayRpmAxis.map(x => x + 100) })
  assert.equal(next.rawRpmAxis[0], before.rawRpmAxis[0] + Math.round(100 / def.xMeta.scale))
  assert.deepEqual(next.rawLoadAxis, before.rawLoadAxis)
})

test('apply reads ECU modes instead of assuming project or session cache matches', async t => {
  const f = fixture(t), field = resolveRuntimeField(ini, 'fuel2Mode')
  serializeValue(f.base[field.page], field.offset, 1, field)
  f.get().currentProject.constants.pages[field.page] = snap(field.page, f.base[field.page])
  const rawBefore = f.get().currentProject.constants.pages[field.page].rawData
  await f.get().applyRuntimeProfile(f.profile)
  assert.equal(readRuntimeFieldFromBuffer(f.ecu[field.page], field), 1)
  assert.equal(f.get().runtimeProfileSession.state, 'ProfileActive')
  assert.equal(f.get().currentProject.constants.pages[field.page].rawData, rawBefore)
  assert.equal(f.get().currentProject.ecu.sync.state, 'runtime-overlay')
})

test('partial failure restores failed table and earlier tables to pre-transaction ECU bytes', async t => {
  const f = fixture(t), sparkPage = resolveRuntimeTable(ini, 'spark2').page
  let failed = false
  t.mock.method(serialService, 'writePage', async (page, offset, length, data) => {
    Buffer.from(data).copy(f.ecu[page], offset)
    if (page === sparkPage && !failed) { failed = true; throw new Error('partial packet timeout') }
  })
  await assert.rejects(f.get().applyRuntimeProfile(f.profile), /partial packet timeout/)
  for (const page of Object.keys(f.base)) assert.deepEqual(f.ecu[page], f.base[page])
  assert.equal(f.get().runtimeProfileSession.lastResult.rollbackOk, true)
  assert.equal(f.get().operation, null)
})

test('rollback failure is Unknown, releases operation, and prevents burn', async t => {
  const f = fixture(t)
  t.mock.method(serialService, 'writePage', async (page, offset, length, data) => { Buffer.from(data).copy(f.ecu[page], offset); throw new Error('link lost') })
  // Persistently broken readback prevents claiming successful recovery.
  let writeAttempted = false
  t.mock.method(serialService, 'writePage', async (page, offset, length, data) => { writeAttempted = true; Buffer.from(data).copy(f.ecu[page], offset); throw new Error('link lost') })
  const reader = f.get().readPageFromECU
  f.set({ readPageFromECU: async page => { if (writeAttempted) throw new Error('link lost'); return reader(page) } })
  await assert.rejects(f.get().applyRuntimeProfile(f.profile))
  assert.equal(f.get().runtimeProfileSession.state, 'Unknown')
  assert.equal(f.get().operation, null)
  assert.equal((await f.get().burnPendingPages()).ok, false)
})

test('DEFAULT restores project targets while failure restores actual prior ECU state', async t => {
  const f = fixture(t), vePage = resolveRuntimeTable(ini, 've2').page
  f.ecu[vePage][0] = 103
  await f.get().applyRuntimeProfile(f.profile)
  assert.equal((await f.get().rollbackRuntimeProfile()).ok, true)
  assert.deepEqual(f.ecu[vePage], f.base[vePage])
  assert.equal(f.get().runtimeProfileSession.state, 'Base')
})

test('failed profile switch retains the previous verified profile and restores its bytes', async t => {
  const f = fixture(t)
  await f.get().applyRuntimeProfile(f.profile)
  const previous = Object.fromEntries(Object.entries(f.ecu).map(([page, buffer]) => [page, Buffer.from(buffer)]))
  let once = false
  t.mock.method(serialService, 'writePage', async (page, offset, length, data) => { Buffer.from(data).copy(f.ecu[page], offset); if (!once) { once = true; throw new Error('fault') } })
  await assert.rejects(f.get().applyRuntimeProfile({ ...f.profile, name: 'RACING', table_overlays: [{ target: 've2', table: f.preset('ve2', 110) }] }))
  for (const page of Object.keys(previous)) assert.deepEqual(f.ecu[page], previous[page])
  assert.equal(f.get().runtimeProfileSession.activeProfile, 'ECO')
})

test('active profile blocks upload and burn; explicit download adopts ECU as project base', async t => {
  const f = fixture(t)
  await f.get().applyRuntimeProfile(f.profile)
  assert.equal((await f.get().writePagesToRAM()).ok, false)
  assert.equal((await f.get().burnPendingPages()).ok, false)
  assert.equal((await f.get().syncAllFromECU()).ok, true)
  assert.equal(f.get().runtimeProfileSession.activeProfile, null)
  assert.equal(f.get().runtimeProfileSession.state, 'Base')
})

for (const telemetry of [null, { ...stopped, rpm: NaN }, { ...stopped, rpm: 800, engine: { cranking: false, running: true } }]) {
  test(`invalid or running telemetry blocks all profile writes: ${JSON.stringify(telemetry)}`, async t => {
    const f = fixture(t); f.telemetry(telemetry)
    await assert.rejects(f.get().applyRuntimeProfile(f.profile))
    assert.equal(f.trace.length, 0)
    assert.equal(f.get().operation, null)
  })
}

test('guards reject initial missing and stale telemetry', t => {
  const f = fixture(t)
  assert.equal(evaluateRuntimeProfileGuards({}, DEFAULT_RUNTIME_PROFILE_GUARDS).ok, false)
  f.set({ realtimeReceivedAt: Date.now() - 10000 })
  assert.equal(f.get().getRuntimeProfileGuardStatus().ok, false)
})

test('engine starting during reads aborts before the first write', async t => {
  const f = fixture(t), reader = f.get().readPageFromECU
  f.set({ readPageFromECU: async page => { const result = await reader(page); f.telemetry({ ...stopped, rpm: 9000 }); return result } })
  await assert.rejects(f.get().applyRuntimeProfile(f.profile), /RPM/)
  assert.equal(f.trace.length, 0)
})

test('another operation cannot be overwritten by profile apply', async t => {
  const f = fixture(t), operation = { type: 'download' }
  f.set({ operation })
  await assert.rejects(f.get().applyRuntimeProfile(f.profile), /Another ECU operation/)
  assert.equal(f.get().operation, operation)
  assert.equal(f.trace.length, 0)
})

test('unknown scalar, incompatible mode and malformed table fail preflight before any write', async t => {
  const f = fixture(t)
  for (const profile of [
    { ...f.profile, changes: [{ key: 'pinMapping', value: 1 }] },
    { ...f.profile, changes: [{ key: 'spark2Mode', value: 1 }] },
    { ...f.profile, table_overlays: [{ target: 've2', table: { ...f.preset('ve2', 95), rawValues: [95] } }] }
  ]) await assert.rejects(f.get().applyRuntimeProfile(profile))
  assert.equal(f.trace.length, 0)
})

test('CRC mismatch and changed connection never lead to profile writes', async t => {
  const f = fixture(t)
  t.mock.method(serialService, 'readPageCRC', async () => 'FFFFFFFF')
  await assert.rejects(f.get().applyRuntimeProfile(f.profile), /CRC/)
  assert.equal(f.trace.length, 0)
  t.mock.method(serialService, 'readPageCRC', async page => { f.get().connection.sessionId++; return crc(f.ecu[page]) })
  await assert.rejects(f.get().applyRuntimeProfile(f.profile), /connection changed/)
  assert.equal(f.trace.length, 0)
})

test('ACK without applied bytes fails verification and cannot become ProfileActive', async t => {
  const f = fixture(t)
  t.mock.method(serialService, 'writePage', async () => {})
  await assert.rejects(f.get().applyRuntimeProfile(f.profile), /verification failed/)
  assert.notEqual(f.get().runtimeProfileSession.state, 'ProfileActive')
  assert.equal(f.get().operation, null)
})

test('legacy editor bytes inconsistent with displayed degrees are rejected before writes', async t => {
  const f = fixture(t), broken = f.preset('spark2', 0)
  broken.rawValues.fill(0)
  await assert.rejects(f.get().applyRuntimeProfile({ ...f.profile, table_overlays: [{ target: 'spark2', table: broken }] }), /display and raw bytes disagree/)
  assert.equal(f.trace.length, 0)
})

test('INI power-cycle enable fields cannot be changed through a RAM profile', async t => {
  const f = fixture(t)
  for (const key of ['rumbleIdleEnabled', 'alsEnabled']) {
    await assert.rejects(f.get().applyRuntimeProfile({ name: 'ECO', changes: [{ key, value: 1 }] }), /requires a power cycle/)
  }
  assert.equal(f.trace.length, 0)
})

test('INI scalar bounds and invalid enum labels are rejected before writes', async t => {
  const f = fixture(t)
  for (const [key, value] of [['alsMaxDuration', 31], ['fuel2Mode', 7], ['spark2Mode', -1]]) {
    await assert.rejects(f.get().applyRuntimeProfile({ name: 'ECO', changes: [{ key, value }] }), /range/)
  }
  assert.equal(f.trace.length, 0)
})

test('profile cannot reuse a session baseline from a reconnected ECU', async t => {
  const f = fixture(t)
  await f.get().applyRuntimeProfile(f.profile)
  const writes = f.trace.length
  f.get().connection.sessionId++
  await assert.rejects(f.get().rollbackRuntimeProfile(), /earlier project or connection/)
  assert.equal(f.trace.length, writes)
})

test('no-op table still reads ECU and repairs drift instead of trusting the active cache', async t => {
  const f = fixture(t), page = resolveRuntimeTable(ini, 've2').page
  await f.get().applyRuntimeProfile(f.profile)
  f.ecu[page][0] = 1
  await f.get().applyRuntimeProfile(f.profile)
  assert.equal(f.ecu[page][0], 95)
})

test('a failed DEFAULT restore releases operation and retains the previous active profile after recovery', async t => {
  const f = fixture(t)
  await f.get().applyRuntimeProfile(f.profile)
  const previous = Object.fromEntries(Object.entries(f.ecu).map(([page, buffer]) => [page, Buffer.from(buffer)]))
  let failed = false
  t.mock.method(serialService, 'writePage', async (page, offset, length, data) => {
    Buffer.from(data).copy(f.ecu[page], offset)
    if (!failed) { failed = true; throw new Error('DEFAULT timeout') }
  })
  await assert.rejects(f.get().rollbackRuntimeProfile(), /DEFAULT timeout/)
  assert.equal(f.get().operation, null)
  assert.equal(f.get().runtimeProfileSession.state, 'ProfileActive')
  for (const page of Object.keys(previous)) assert.deepEqual(f.ecu[page], previous[page])
})

test('initial sync and unsaved table drafts must be resolved before profile apply', async t => {
  const f = fixture(t)
  f.get().currentProject.constants.pages[1].syncState = 'unknown'
  await assert.rejects(f.get().applyRuntimeProfile(f.profile), /initial ECU sync/)
  f.get().currentProject.constants.pages[1].syncState = 'verified'
  f.set({ tableDrafts: { ve: true } })
  await assert.rejects(f.get().applyRuntimeProfile(f.profile), /table drafts/)
  assert.equal(f.trace.length, 0)
})

test('Spark2 added degrees reject percent-sized values outside the mode-dependent INI bounds', async t => {
  const f = fixture(t)
  await assert.rejects(f.get().applyRuntimeProfile({ name: 'ECO', table_overlays: [{ target: 'spark2', table: f.preset('spark2', 100) }] }), /-40 to 70 degrees/)
  assert.equal(f.trace.length, 0)
})
