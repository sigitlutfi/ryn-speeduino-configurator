import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseIni } from '../src/shared/ini-parser.js'
import { getSupportedBoardChoices, configurationWriteOptions } from '../src/shared/protocol/board-pins.js'
import { validateConfigurationChange } from '../src/shared/protocol/configuration-policy.js'
import { injectionSquirts } from '../src/shared/protocol/required-fuel.js'
import { buildProjectInitialization, getBoardLayoutChoices } from '../src/renderer/features/projects/projectInitialization.js'
import { createProjectDocument } from '../src/renderer/features/projects/projectCreation.js'
import { validatePageSnapshot, serializeDecodedPage, createPageSnapshot } from '../src/shared/protocol/page-cache.js'
import { calculatePageCRC } from '../src/shared/protocol/ecu-commands.js'
import { normalizeProjectV3, serializeProjectForSave } from '../src/renderer/core/store/utils/project.normalization.js'
import { createECUSyncSlice } from '../src/renderer/core/store/slices/ecu.sync.js'
import { createECURestartSlice } from '../src/renderer/core/store/slices/ecu.restart.js'
import { createProjectLifecycleSlice } from '../src/renderer/core/store/slices/project.lifecycle.js'
import { serialService } from '../src/renderer/core/services/serialService.js'

const content = readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8')
const ini = parseIni(content, { CELSIUS: true })
const engine = { cylinders: 4, displacement: 2000, injectorFlow: 440, injectorOpenTime: 1, stoich: 14.7 }
const makeProject = () => createProjectDocument({ projectName: 'Setup test', ini: { content }, parsedIni: ini, engine, boardLayout: 3 }).project
const crc = buffer => calculatePageCRC(buffer).toString(16).toUpperCase().padStart(8, '0')

function fixture(t) {
  const project = makeProject(), events = [], persisted = []
  const ecu = Object.fromEntries(Object.entries(project.constants.pages).map(([page, snapshot]) => [page, Buffer.from(validatePageSnapshot(snapshot, ini.constants.pageSizes[page]).buffer)]))
  const target = serializeDecodedPage(ini, 1, { pinLayout: 41 }, ecu[1])
  project.constants.pages[1] = createPageSnapshot({ pageId: 1, size: target.length, buffer: target, syncState: 'dirty-local' })
  let state = { currentProject: project, parsedIni: ini, projectEpoch: 1,
    connection: { status: 'connected', sessionId: 1, lastConnectedAt: 'connection-A', firmwareSignature: ini.info.signature },
    operation: null, fieldDrafts: {}, tableDrafts: {}, notify: () => {},
    setOperation: value => { state.operation = value }, clearOperation: () => { state.operation = null }, updateOperation: () => {},
    readPageFromECU: async page => ({ buffer: Buffer.from(ecu[page]) }),
    saveECURestartState: async () => { events.push('persist'); persisted.push(serializeProjectForSave(state.currentProject, {})); return { ok: true } } }
  const get = () => state, set = patch => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) } }
  state = { ...state, ...createECUSyncSlice(set, get), ...createECURestartSlice(set, get) }
  t.mock.method(serialService, 'enterExclusiveMode', async () => {})
  t.mock.method(serialService, 'resumeOutputChannelsPolling', () => {})
  t.mock.method(serialService, 'readPageCRC', async page => crc(ecu[page]))
  t.mock.method(serialService, 'writePage', async (page, offset, length, bytes) => { events.push('write'); Buffer.from(bytes).copy(ecu[page], offset) })
  t.mock.method(serialService, 'burnPage', async () => { events.push('burn') })
  t.mock.method(serialService, 'readOutputChannels', async () => ({ rpm: 0, engine: { running: false, cranking: false },
    outputChannels: { burnPending: 0 }, driveMode: { version: 1, valid: true, active: 0, state: 0 } }))
  return { get, set, ecu, events, persisted }
}

test('wizard, Master Setup and write boundary agree on the 14 compiled Mega boards', () => {
  const choices = getSupportedBoardChoices(ini)
  assert.equal(choices.length, 14)
  assert.deepEqual(getBoardLayoutChoices(ini), choices)
  assert.equal(choices.find(board => board.value === 41).label, 'UA4C')
  const p = makeProject(), before = p.constants.decodedPages
  for (const id of [14, 50, 51, 53, 55, 60, 61, 255]) {
    const after = structuredClone(before); after[1].pinLayout = id
    assert.ok(validateConfigurationChange(ini, before, after, configurationWriteOptions(p)), `reject ${id}`)
    for (const initBaseTune of [true, false]) assert.throws(() => buildProjectInitialization({ parsedIni: ini, selectedBoardLayout: id, engine, initBaseTune }), /valid board/)
  }
  const after = structuredClone(before); after[1].pinLayout = 41
  assert.equal(validateConfigurationChange(ini, before, after, configurationWriteOptions(p)), null)
  assert.match(validateConfigurationChange(ini, before, after, {}), /MCU/)
})

test('four-cylinder divider validation matches effective firmware squirts and rejects truncation', () => {
  const p = makeProject(), before = p.constants.decodedPages
  for (const divider of [0, 3, 5, -1]) {
    const after = structuredClone(before); after[1].divider = divider
    assert.ok(validateConfigurationChange(ini, before, after, configurationWriteOptions(p)))
  }
  for (const [divider, expected] of [[1, 4], [2, 2], [4, 1]]) assert.equal(injectionSquirts(4, divider), expected)
  assert.equal(injectionSquirts(4, 2, 3, 0), 1)
})

test('board upload persists the restart requirement before any bytes and keeps it after Burn/reconnect', async t => {
  const f = fixture(t)
  const result = await f.get().syncPagesToECU([1], { burn: true, writeSettleMs: 0 })
  assert.equal(result.ok, true, result.error || result.errors?.[0]?.error)
  assert.equal(f.events[0], 'persist')
  assert.ok(f.events.includes('write'))
  assert.ok(f.events.includes('burn'))
  const pending = f.get().currentProject.hardware.restartRequired
  assert.deepEqual(pending.fields.map(field => field.name), ['pinLayout'])
  assert.deepEqual(pending.burnedPages, [1])
  const loaded = normalizeProjectV3(JSON.parse(JSON.stringify(f.persisted.at(-1))), ini)
  assert.deepEqual(loaded.hardware.restartRequired, pending)
  f.set({ connection: { ...f.get().connection, sessionId: 2, lastConnectedAt: 'connection-B' } })
  assert.equal(f.get().currentProject.hardware.restartRequired, pending, 'reconnect is not automatic proof')
  const verified = await f.get().verifyECUPowerCycle()
  assert.equal(verified.ok, true, verified.error)
  assert.equal(f.get().currentProject.hardware.restartRequired, null)
  assert.equal(f.persisted.at(-1).hardware.restartRequired, null)
})

test('an already-saved restart state does not allow new dependent pin writes; retrying its target is allowed', async t => {
  const f = fixture(t)
  assert.equal((await f.get().writePagesToRAM([1])).ok, true)
  const p = f.get().currentProject, before = p.constants.decodedPages, after = structuredClone(before)
  after[4].fuelPumpPin = 46
  assert.match(validateConfigurationChange(ini, before, after, configurationWriteOptions(p)), /power cycle/)
  const retryBefore = structuredClone(before); retryBefore[1].pinLayout = 3
  const retryAfter = structuredClone(before); retryAfter[1].pinLayout = 41
  assert.equal(validateConfigurationChange(ini, retryBefore, retryAfter, configurationWriteOptions(p)), null)
})

test('failed persistence prevents the first hardware write', async t => {
  const f = fixture(t)
  f.set({ saveECURestartState: async () => ({ ok: false, error: 'disk full' }) })
  const result = await f.get().writePagesToRAM([1])
  assert.equal(result.ok, false)
  assert.match(result.error, /disk full/)
  assert.equal(f.events.includes('write'), false)
})

test('lost write ACK retains the restart requirement and never marks it burned', async t => {
  const f = fixture(t)
  t.mock.method(serialService, 'writePage', async () => { throw new Error('lost ACK') })
  const result = await f.get().writePagesToRAM([1])
  assert.equal(result.ok, false)
  assert.ok(f.get().currentProject.hardware.restartRequired)
  assert.deepEqual(f.get().currentProject.hardware.restartRequired.burnedPages, [])
})

for (const [name, telemetry] of [['running', { rpm: 2000, engine: { running: true } }], ['unknown', {}]]) {
  test(`hardware writes reject ${name} engine status`, async t => {
    const f = fixture(t)
    // Keep the initial DEFAULT guard valid; the hardware preflight checks RPM.
    t.mock.method(serialService, 'readOutputChannels', async () => ({ ...telemetry, driveMode: { version: 1, valid: true, active: 0, state: 0 } }))
    assert.equal((await f.get().writePagesToRAM([1])).ok, false)
    assert.equal(f.events.includes('write'), false)
  })
}

test('verification requires Burn, a new connection and matching CRC/values', async t => {
  const f = fixture(t)
  await f.get().writePagesToRAM([1])
  assert.equal((await f.get().verifyECUPowerCycle()).ok, false)
  f.set({ connection: { ...f.get().connection, lastConnectedAt: 'connection-B' } })
  assert.equal((await f.get().verifyECUPowerCycle()).ok, false, 'Burn not completed')
  await f.get().burnPendingPages([1])
  f.ecu[1][15] = 3
  const result = await f.get().verifyECUPowerCycle()
  assert.equal(result.ok, false)
  assert.match(result.error, /pinLayout/)
  assert.ok(f.get().currentProject.hardware.restartRequired)
})

test('restart verification refuses CRC drift and lost persistence without clearing the requirement', async t => {
  const f = fixture(t)
  assert.equal((await f.get().syncPagesToECU([1], { burn: true, writeSettleMs: 0 })).ok, true)
  f.set({ connection: { ...f.get().connection, sessionId: 2, lastConnectedAt: 'connection-B' } })
  const originalCRC = serialService.readPageCRC
  t.mock.method(serialService, 'readPageCRC', async () => '00000000')
  assert.match((await f.get().verifyECUPowerCycle()).error, /CRC/)
  assert.ok(f.get().currentProject.hardware.restartRequired)
  t.mock.method(serialService, 'readPageCRC', originalCRC)
  f.set({ saveECURestartState: async () => ({ ok: false, error: 'disk full' }) })
  assert.match((await f.get().verifyECUPowerCycle()).error, /disk full/)
  assert.ok(f.get().currentProject.hardware.restartRequired)
})

test('project-wide Save validates board and divider drafts, and Required Fuel does not rewrite VE', () => {
  let state = { currentProject: makeProject(), parsedIni: ini, operation: null, fieldDrafts: {}, tableDrafts: {}, connection: { status: 'disconnected' } }
  const get = () => state, set = patch => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) } }
  state = { ...state, ...createProjectLifecycleSlice(set, get) }
  state.updateProjectFieldDrafts({ 1: { pinLayout: 60 } })
  assert.match(state.applyProjectFieldDrafts().error, /not supported/)
  state.fieldDrafts = {}
  state.updateProjectFieldDrafts({ 1: { divider: 3 } })
  assert.match(state.applyProjectFieldDrafts().error, /divider/i)
  state.fieldDrafts = {}
  const before = JSON.stringify(state.currentProject.constants.decodedPages[2])
  state.updateProjectFieldDrafts({ 1: { reqFuel: 90 } })
  assert.equal(state.applyProjectFieldDrafts().ok, true)
  assert.equal(state.currentProject.constants.decodedPages[1].reqFuel, 90)
  assert.equal(JSON.stringify(state.currentProject.constants.decodedPages[2]), before)
})

test('restart verification detects drift in other structural settings, even when the board matches', async t => {
  const f = fixture(t)
  assert.equal((await f.get().syncPagesToECU([1], { burn: true, writeSettleMs: 0 })).ok, true)
  f.set({ connection: { ...f.get().connection, sessionId: 2, lastConnectedAt: 'connection-B' } })
  f.ecu[1][36] = (f.ecu[1][36] & 0x0f) | (6 << 4)
  const result = await f.get().verifyECUPowerCycle()
  assert.equal(result.ok, false)
  assert.match(result.error, /nCylinders/)
  assert.ok(f.get().currentProject.hardware.restartRequired)
})


test('restart verification rejects unknown stopped flags and incomplete persisted targets', async t => {
  const f = fixture(t)
  assert.equal((await f.get().syncPagesToECU([1], { burn: true, writeSettleMs: 0 })).ok, true)
  f.set({ connection: { ...f.get().connection, sessionId: 2, lastConnectedAt: 'connection-B' } })
  t.mock.method(serialService, 'readOutputChannels', async () => ({ rpm: 0, engine: { running: null, cranking: false } }))
  assert.equal((await f.get().verifyECUPowerCycle()).ok, false)
  t.mock.method(serialService, 'readOutputChannels', async () => ({ rpm: 0, engine: { running: false, cranking: false } }))
  const pending = f.get().currentProject.hardware.restartRequired
  pending.targetConfig = {}
  assert.match((await f.get().verifyECUPowerCycle()).error, /tracking does not match/)
  assert.ok(f.get().currentProject.hardware.restartRequired)
})

test('restart verification persistence failure cannot replace a newly opened project or clear its operation', async t => {
  const f = fixture(t)
  assert.equal((await f.get().syncPagesToECU([1], { burn: true, writeSettleMs: 0 })).ok, true)
  f.set({ connection: { ...f.get().connection, sessionId: 2, lastConnectedAt: 'connection-B' } })
  const replacement = makeProject(), operation = { type: 'new-project-operation' }
  f.set({ saveECURestartState: async () => {
    f.set({ currentProject: replacement, projectEpoch: 2, operation })
    return { ok: false, error: 'old save failed' }
  } })
  assert.equal((await f.get().verifyECUPowerCycle()).ok, false)
  assert.equal(f.get().currentProject, replacement)
  assert.equal(f.get().operation, operation)
})
