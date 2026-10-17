import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Buffer } from 'buffer'
import { parseIni, getVarMetadata } from '../src/shared/ini-parser.js'
import { buildProjectInitialization } from '../src/renderer/features/projects/projectInitialization.js'
import { calculateRequiredFuel, injectionDivider } from '../src/shared/protocol/required-fuel.js'
import { validatePageSnapshot, createPageSnapshot } from '../src/shared/protocol/page-cache.js'
import { resolveRuntimeTable } from '../src/shared/protocol/runtime-tables.js'
import { normalizeProjectV3, serializeProjectForSave, materializeProjectConstants } from '../src/renderer/core/store/utils/project.normalization.js'
import { createProjectLifecycleSlice } from '../src/renderer/core/store/slices/project.lifecycle.js'
import { createECUSyncSlice } from '../src/renderer/core/store/slices/ecu.sync.js'
import { parsePage } from '../src/shared/protocol/binary-parser.js'
import { serialService } from '../src/renderer/core/services/serialService.js'

const content = readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8')
const ini = parseIni(content, { CELSIUS: true })
const inputs = { cylinders: 4, displacement: 2000, injectorFlow: 440, injectorOpenTime: 1, stoich: 14.7 }
const plan = (engine = inputs, extras = {}) => buildProjectInitialization({ parsedIni: ini, selectedBoardLayout: 3, engine, initBaseTune: true, ...extras })
const field = (p, name) => { const meta = getVarMetadata(ini, name); return p.constants.decodedPages[meta.page][name] }
const rawProject = p => ({ projectName: 'RYN Test', hardware: { pinMapPlatform: 'mega2560', channelBuild: 'standard' }, ini: { content, signature: ini.info.signature }, constants: p.constants, engine: inputs,
  initialization: { boardLayout: p.metadata.boardLayout, baseTune: { requested: true, applied: true, template: p.metadata } } })

test('RYN base has complete raw snapshots for all 15 pages with recalculated CRC', () => {
  const p = plan()
  assert.ok(p.metadata.defaultFieldCount > 0)
  assert.equal(field(p, 'mapMax'), 260)
  assert.equal(Object.keys(p.constants.pages).length, 15)
  for (let page = 1; page <= 15; page++) {
    const value = validatePageSnapshot(p.constants.pages[page], ini.constants.pageSizes[page])
    assert.equal(value.crc32, p.constants.pages[page].crc32)
    assert.equal(p.constants.pages[page].syncState, 'dirty-local')
  }
  assert.equal(p.warnings.length, 0)
})

test('fixed trigger, ignition polarity, board and batch settings match INI enums', () => {
  const p = plan()
  for (const [name, label] of [['TrigPattern', 'Missing Tooth'], ['sparkMode', 'Wasted Spark'], ['IgInv', 'Going Low'], ['twoStroke', 'Four-stroke']]) {
    const meta = getVarMetadata(ini, name)
    assert.equal(meta.options[field(p, name)], label)
  }
  assert.equal(field(p, 'numTeeth'), 12)
  assert.equal(field(p, 'missingTeeth'), 1)
  assert.equal(field(p, 'pinLayout'), 3)
  assert.equal(field(p, 'divider'), 2)
  assert.equal(field(p, 'nCylinders'), 4)
  assert.equal(field(p, 'nInjectors'), 4)
})

test('required fuel uses full-cycle reference, rounds to INI 0.1ms and keeps deadtime separate', () => {
  // Manufacturer manual example: 1998cc / four 850cc/min injectors = 3.8ms.
  assert.equal(Number(calculateRequiredFuel({ displacement: 1998, cylinders: 4, injectorFlow: 850 }).toFixed(1)), 3.8)
  assert.equal(plan().metadata.requiredFuelMs, 7.4)
  assert.equal(field(plan(), 'reqFuel'), 74)
  assert.equal(field(plan(), 'injOpen'), 10)
  assert.equal(injectionDivider(6, 2), 3)
  assert.throws(() => injectionDivider(4, 3))
})

test('neutral secondary tables share useful base axes and are disabled at initialization', () => {
  const p = plan()
  for (const [name, value] of [['ve2', 100], ['spark2', 40]]) {
    const def = resolveRuntimeTable(ini, name), page = p.pages[def.page]
    assert.equal(page[def.zBinsVar].length, 256)
    assert.ok(page[def.zBinsVar].every(v => v === value))
    assert.ok(page[def.xBinsVar].every(v => v > 0))
  }
  for (const key of ['fuel2Mode', 'spark2Mode', 'rumbleIdleEnabled', 'alsEnabled', 'rollingPopBangEnabled', 'pitLimiterEnabled']) assert.equal(field(p, key), 0)
})

test('AFR and lambda alias retain canonical AFR bytes after save/load; profile AFR preserves base', () => {
  const p = plan(), project = normalizeProjectV3(rawProject(p), ini)
  const saved = serializeProjectForSave(project, {})
  const loaded = normalizeProjectV3(JSON.parse(JSON.stringify(saved)), ini)
  const def = resolveRuntimeTable(ini, 'afr1')
  assert.deepEqual(loaded.constants.decodedPages[def.page][def.zBinsVar], p.pages[def.page][def.zBinsVar])
  assert.deepEqual(loaded.runtimeProfiles.eco.tablePresets.afr1.rawValues, p.pages[def.page][def.zBinsVar])
  assert.equal(loaded.initialization.baseTune.template.templateVersion, 5)
  assert.equal(loaded.initialization.baseTune.template.contract.signature, ini.info.signature)
  for (const page of Object.keys(p.constants.pages)) assert.equal(loaded.constants.pages[page].rawData, p.constants.pages[page].rawData)
})

test('full restore points preserve snapshots and unknown/reserved bytes', () => {
  const p = plan()
  const buffer = validatePageSnapshot(p.constants.pages[10], ini.constants.pageSizes[10]).buffer
  buffer[219] = 0xA5
  p.constants.pages[10] = createPageSnapshot({ pageId: 10, size: buffer.length, buffer })
  const restored = materializeProjectConstants(ini, p.constants)
  assert.equal(validatePageSnapshot(restored.pages[10], 220).buffer[219], 0xA5)
  assert.equal(restored.pages[1].rawData, p.constants.pages[1].rawData)
})

for (const [key, value] of [['injectorFlow', 0], ['injectorOpenTime', NaN], ['cylinders', 3], ['displacement', -1], ['stoich', 0], ['stoich', 26], ['injectorOpenTime', 26]]) {
  test(`invalid ${key} blocks initialization`, () => assert.throws(() => plan({ ...inputs, [key]: value })))
}

test('out-of-range reqFuel and invalid board are rejected rather than clipped', () => {
  assert.throws(() => plan({ ...inputs, injectorFlow: 1 }), /INI range/)
  assert.throws(() => plan(inputs, { selectedBoardLayout: 0 }), /valid board/)
})

test('manual setup produces complete INI baseline without forcing RYN assumptions or injector inputs', () => {
  const p = plan({}, { initBaseTune: false })
  assert.equal(Object.keys(p.constants.pages).length, 15)
  assert.equal(p.metadata.assumptions, null)
  assert.equal(field(p, 'stoich'), 147)
  assert.equal(field(p, 'pinLayout'), 3)
})

test('four-cylinder base uses neutral injector correction and INI-scaled MAP axes', () => {
  const p = plan()
  assert.deepEqual(field(p, 'brvBins'), [60, 96, 132, 168, 204, 240])
  assert.deepEqual(field(p, 'injBatRates'), Array(6).fill(100))
  // INI fuelLoadRes=2 for MAP: the 20..100 kPa seed is encoded as 10..50.
  assert.equal(field(p, 'fuelLoadBins')[0], 10)
  assert.equal(field(p, 'fuelLoadBins').at(-1), 50)
  assert.match(p.metadata.injectorVoltageCorrection, /Neutral 100%/)
  const blank = plan({}, { initBaseTune: false })
  assert.deepEqual(field(blank, 'injBatRates'), Array(6).fill(100))
})

test('initialized project uploads all pages through ordinary RAM sync without burning', async t => {
  const p = plan(), ecu = Object.fromEntries(Object.keys(p.constants.pages).map(page => [page, Buffer.alloc(ini.constants.pageSizes[page])]))
  let state = { parsedIni: ini, connection: { status: 'connected', sessionId: 1, firmwareSignature: ini.info.signature }, projectEpoch: 1,
    currentProject: normalizeProjectV3(rawProject(p), ini), tableDrafts: {}, tables: {}, operation: null,
    setOperation: value => { state.operation = value }, updateOperation: value => { state.operation = { ...state.operation, ...value } },
    clearOperation: () => { state.operation = null }, notify: () => {},
    readPageFromECU: async page => ({ buffer: Buffer.from(ecu[page]), decoded: parsePage(ecu[page], ini.constants.pages[page]) }) }
  const get = () => state, set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) } }
  state = { ...state, ...createECUSyncSlice(set, get) }
  t.mock.method(serialService, 'enterExclusiveMode', async () => {})
  t.mock.method(serialService, 'resumeOutputChannelsPolling', () => {})
  t.mock.method(serialService, 'readOutputChannels', async () => ({ rpm: 0, engine: { running: false, cranking: false }, driveMode: { version: 1, valid: true, active: 0, state: 0 } }))
  t.mock.method(serialService, 'readPageCRC', async page => createPageSnapshot({ pageId: page, buffer: ecu[page] }).crc32)
  t.mock.method(serialService, 'writePage', async (page, offset, length, data) => Buffer.from(data).copy(ecu[page], offset))
  t.mock.method(serialService, 'burnPage', async () => assert.fail('Initialization must not automatically burn'))
  const result = await state.writePagesToRAM()
  assert.equal(result.ok, true, result.error)
  assert.equal(Object.keys(result.pages).length, 15)
  for (const page of Object.keys(p.constants.pages)) assert.deepEqual(ecu[page], validatePageSnapshot(p.constants.pages[page], ini.constants.pageSizes[page]).buffer)
})


test('invalid base restore releases its operation and cannot overwrite a running sync', async () => {
  const p = plan()
  let state = { parsedIni: ini, currentProject: normalizeProjectV3(rawProject(p), ini), tables: {}, operation: null,
    notify: () => {}, setOperation: value => { state.operation = value }, clearOperation: () => { state.operation = null } }
  const get = () => state, set = value => { state = { ...state, ...(typeof value === 'function' ? value(state) : value) } }
  state = { ...state, ...createProjectLifecycleSlice(set, get) }
  const before = state.currentProject.constants
  state.currentProject.initialization.restorePoints.baseTune = { constants: { pages: { 1: { ...p.constants.pages[1], size: 1 } } } }
  state.operation = { type: 'download' }
  const busy = state.operation
  assert.equal((await state.restoreProjectToBaseTune()).ok, false)
  assert.equal(state.operation, busy)
  state.operation = null
  assert.equal((await state.restoreProjectToBaseTune()).ok, false)
  assert.equal(state.operation, null)
  assert.equal(state.currentProject.constants, before)
})
