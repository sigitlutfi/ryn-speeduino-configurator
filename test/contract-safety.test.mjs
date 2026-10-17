import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseIni, getVarMetadata, getTableMetadata } from '../src/shared/ini-parser.js'
import { assertWritableContract } from '../src/shared/protocol/contract.js'
import { wrapModernProtocol, calculatePageCRC } from '../src/shared/protocol/ecu-commands.js'
import { serializeValue } from '../src/shared/protocol/binary-serializer.js'
import { parsePage } from '../src/shared/protocol/binary-parser.js'
import { validateConfigurationValues } from '../src/shared/protocol/configuration-validation.js'
import { configurationPolicyPages, prepareConfigurationWrite, validateConfigurationChange } from '../src/shared/protocol/configuration-policy.js'
import { buildPinRegistry, getPinOptionsForField, isPinAssignmentField } from '../src/shared/protocol/pin-registry.js'
import { serialService } from '../src/renderer/core/services/serialService.js'
import { createRuntimeFieldsSlice } from '../src/renderer/core/store/slices/runtime.fields.js'
import { createRuntimeTablesSlice } from '../src/renderer/core/store/slices/runtime.tables.js'
import { normalizeProjectV3 } from '../src/renderer/core/store/utils/project.normalization.js'

const content = readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8')
const ini = parseIni(content, { CELSIUS: true })
const options = { platform: 'mega2560', injectorChannels: 4, ignitionChannels: 5 }
const connected = parsedIni => ({ parsedIni, connection: { status: 'connected', handshakeStatus: 'ok', firmwareSignature: ini.info.signature } })

test('numeric enums cannot become pin assignments or reserve physical pins', () => {
  for (const name of ['iacStepTime', 'iacCoolTime', 'rumbleIdlePatternLength', 'rumbleIdleMinVSS', 'canoutput_param_start_byte0', 'onboard_log_trigger_Epin']) {
    const meta = getVarMetadata(ini, name)
    assert.ok(meta, name)
    assert.equal(isPinAssignmentField(name, meta), false, name)
  }
  for (const name of ['Auxin0pina', 'Auxin0pinb', 'n2o_arming_pin', 'outputPin0', 'onboard_log_tr5_Epin_pin']) {
    assert.equal(isPinAssignmentField(name, getVarMetadata(ini, name)), true, name)
  }
  const rows = buildPinRegistry(ini, { 6: { rumbleIdleEnabled: 1, rumbleIdlePatternLength: 8, rumbleIdleMinVSS: 7 } }, options).rows
  assert.equal(rows.some(row => /^(iacStepTime|iacCoolTime|rumbleIdlePatternLength|rumbleIdleMinVSS|canoutput_param_start_byte)/.test(row.field)), false)
})

function transport(t, deliver) {
  const previous = globalThis.window
  const listeners = new Set(), timers = []
  globalThis.window = { serial: {
    onData(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    async sendCommand() { deliver(bytes => { for (const listener of listeners) listener(bytes) }, (fn, ms) => timers.push(setTimeout(fn, ms))); return { ok: true } },
  } }
  t.after(() => { timers.forEach(clearTimeout); if (previous === undefined) delete globalThis.window; else globalThis.window = previous })
  return listeners
}

for (const [name, send, status, length] of [
  ['write', () => serialService.writePage(10, 197, 1, [0], '', { timeout: 500 }), 0, 1],
  ['burn', () => serialService.burnPage(10, { timeout: 500 }), 4, 1],
  ['CRC', () => serialService.readPageCRC(10, { timeout: 500 }), 0, 5],
]) {
  test(`${name} rejects CRC-corrupted response frames`, async t => {
    const frame = wrapModernProtocol(Buffer.concat([Buffer.from([status]), Buffer.alloc(length - 1)]))
    frame[frame.length - 1] ^= 1
    const listeners = transport(t, emit => queueMicrotask(() => emit(frame)))
    await assert.rejects(send(), /CRC validation/)
    assert.equal(listeners.size, 0)
  })
  test(`${name} waits for delayed framed error status instead of accepting the length header`, async t => {
    const frame = wrapModernProtocol(Buffer.from([0x84]))
    transport(t, (emit, later) => { queueMicrotask(() => emit(frame.subarray(0, 2))); later(() => emit(frame.subarray(2)), 100) })
    await assert.rejects(send(), /0x84/)
  })
}

test('a delayed valid write ACK and its delayed CRC are fully consumed', async t => {
  const frame = wrapModernProtocol(Buffer.from([0]))
  let completed = false
  transport(t, (emit, later) => {
    queueMicrotask(() => emit(frame.subarray(0, 2)))
    later(() => emit(frame.subarray(2, 3)), 80)
    later(() => { completed = true; emit(frame.subarray(3)) }, 150)
  })
  assert.equal((await serialService.writePage(10, 197, 1, [0], '', { timeout: 500 })).status, 0)
  assert.equal(completed, true)
})

test('raw legacy responses require an explicit mode', async t => {
  transport(t, emit => queueMicrotask(() => emit(Buffer.from([0]))))
  await assert.rejects(serialService.sendHybridCommand(Buffer.from('M'), { timeout: 25 }), /timeout/)
  assert.equal((await serialService.sendHybridCommand(Buffer.from('M'), { responseMode: 'raw' })).status, 0)
})

test('same-signature editor routing changes are rejected, including curve bindings', () => {
  for (const symbols of [{ CELSIUS: true }, { FAHRENHEIT: true }]) {
    const parsed = parseIni(content, symbols)
    parsed.tables.sparkTbl = { ...parsed.tables.veTable1Tbl }
    assert.throws(() => assertWritableContract(connected(parsed)), /stale or incompatible/)
    const curve = parseIni(content, symbols)
    Object.values(curve.curves)[0].yBins.varName += '-wrong'
    assert.throws(() => assertWritableContract(connected(curve)), /stale or incompatible/)
  }
})

test('every paired table points to the pages of its actual field definitions', () => {
  for (const id of Object.keys(ini.tables)) assert.doesNotThrow(() => getTableMetadata(ini, id))
  assert.equal(getTableMetadata(ini, 'boostDCLupTbl').page, 15)
  const altered = structuredClone(ini)
  altered.tables.sparkTbl.page = 2
  assert.equal(getTableMetadata(altered, 'sparkTbl'), null)
  assert.throws(() => getTableMetadata(altered, 'sparkTbl', { strict: true }), /incompatible page binding/)
})

test('empty INI enum entries and INVALID holes never change encoded pin indices', () => {
  const parsed = parseIni('[Constants]\nnPages=1\npageSize=1\npage=1\ncustomPin=bits,U08,0,[0:2],"Auto Mode","","INVALID","7"')
  assert.deepEqual(parsed.constants.pages[1].customPin.options, ['Auto Mode', '', 'INVALID', '7'])
  const choices = getPinOptionsForField('customPin', parsed, { 1: { customPin: 0 } }, undefined, 0)
  assert.equal(choices.find(choice => choice.label === '7').index, 3)
  assert.equal(choices.some(choice => choice.index === 1), false)
  assert.equal(choices.some(choice => choice.index === 2), false)
  const stale = getPinOptionsForField('customPin', parsed, { 1: { customPin: 99 } }, undefined, 99)
  assert.equal(stale.find(choice => choice.index === 99).disabled, true)
  assert.match(stale.find(choice => choice.index === 99).label, /99/)
  const assigned = getPinOptionsForField('customPin', parsed, { 1: { customPin: 3 } }, undefined, 3)
  assert.equal(assigned.find(choice => choice.index === 0).label, 'Auto Mode')
  assert.equal(assigned.find(choice => choice.index === 0).disabled, false)
})

test('all pin selector choices come from the loaded INI without a separate pin list', () => {
  for (const symbols of [{ CELSIUS: true }, { FAHRENHEIT: true }]) {
    const parsed = parseIni(content, symbols)
    for (const fields of Object.values(parsed.constants.pages)) {
      for (const [name, meta] of Object.entries(fields)) {
        if (!isPinAssignmentField(name, meta)) continue
        const choices = getPinOptionsForField(name, parsed, {}, undefined, 42)
        for (const [index, label] of meta.options.entries()) {
          if (!label.trim() || label.toUpperCase() === 'INVALID') continue
          assert.ok(choices.some(choice => choice.index === index && choice.label.startsWith(label.trim())), `${name}:${index} omitted`)
        }
        for (const choice of choices) {
          if (choice.disabled) continue
          assert.ok(meta.options[choice.index], `${name}:${choice.index}`)
          assert.notEqual(meta.options[choice.index].toUpperCase(), 'INVALID')
          assert.ok(choice.label.startsWith(meta.options[choice.index].trim()), `${name}:${choice.label}`)
        }
      }
    }
  }
})

function configuration() {
  const buffers = Object.fromEntries(Object.entries(ini.constants.pageSizes).filter(([page]) => ini.constants.pages[page]).map(([page, size]) => [page, Buffer.alloc(size)]))
  const put = (name, value, target = buffers) => {
    const meta = getVarMetadata(ini, name)
    serializeValue(target[meta.page], meta.offset, value, meta)
  }
  put('pinLayout', 3)
  const decoded = () => Object.fromEntries(Object.entries(buffers).map(([page, buffer]) => [page,
    // Use the production parser as page operations do.
    parsePage(buffer, ini.constants.pages[page])]))
  return { buffers, put, decoded }
}

test('unsaved draft pin assignments reserve their encoded physical pin immediately', () => {
  const f = configuration(), pages = f.decoded()
  pages[10].alsEnabled = 1
  pages[10].alsSwitchPin = 47
  const registry = buildPinRegistry(ini, pages, options)
  const candidate = getPinOptionsForField('fanPin', ini, pages, registry, 0).find(choice => choice.index === 47)
  assert.equal(candidate.disabled, true)
  assert.ok(candidate.activeOwners.some(owner => owner.field === 'alsSwitchPin'))
  pages[10].alsEnabled = 0
  assert.equal(getPinOptionsForField('fanPin', ini, pages, buildPinRegistry(ini, pages, options), 0).find(choice => choice.index === 47).disabled, false)
})

test('upload preflight reads live ownership on other pages before allowing a fan activation', async () => {
  const f = configuration()
  f.put('alsEnabled', 1); f.put('alsSwitchPin', 47); f.put('alsMaxTPS', 10); f.put('alsMaxCLT', 100)
  const targets = { 1: Buffer.from(f.buffers[1]) }
  f.put('fanEnable', 1, targets)
  const reads = []
  await assert.rejects(prepareConfigurationWrite(ini, targets, async page => {
    reads.push(page); return { buffer: f.buffers[page] }
  }, options), /conflicts/)
  assert.ok(reads.includes(10))
  assert.ok(configurationPolicyPages(ini).includes(13))
})

test('pit dependency rules apply to page upload, with disabling a malformed feature still possible', async () => {
  const f = configuration(), target = { 6: Buffer.from(f.buffers[6]) }
  for (const [name, value] of [['pitLimiterEnabled', 1], ['pitLimiterPin', 30], ['pitLimiterRPM', 40], ['pitLimiterCutType', 1]]) f.put(name, value, target)
  await assert.rejects(prepareConfigurationWrite(ini, target, async page => ({ buffer: f.buffers[page] }), options), /include ignition/)
  f.put('alsEnabled', 1); f.put('alsTimingRetard', 255); f.put('alsMaxTPS', 0)
  const before = f.decoded(), after = structuredClone(before)
  after[10].alsEnabled = 0
  assert.equal(validateConfigurationChange(ini, before, after, options), null)
})

test('manual runtime fields reject truncating pin values and invalid custom bounds before any write', async t => {
  const f = configuration()
  let state = { ...connected(ini), projectEpoch: 1, operation: null, currentProject: { hardware: { pinMapPlatform: 'mega2560', channelBuild: 'standard' } },
    readPageFromECU: async page => ({ buffer: f.buffers[page] }),
    setOperation: operation => { state.operation = operation }, clearOperation: () => { state.operation = null } }
  const get = () => state, set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) } }
  state = { ...state, ...createRuntimeFieldsSlice(set, get), ...createRuntimeTablesSlice(set, get) }
  let writes = 0
  t.mock.method(serialService, 'writePage', async () => { writes++ })
  t.mock.method(serialService, 'readPageCRC', async page => calculatePageCRC(f.buffers[page]).toString(16).toUpperCase().padStart(8, '0'))
  await assert.rejects(state.writeRuntimeField('pitLimiterPin', 69), /range/)
  await assert.rejects(state.writeRuntimeField('alsFuelModifier', 51), /range/)
  assert.equal(writes, 0)
  assert.equal(state.operation, null)
})

test('Lambda bounds use the effective INI stoichiometric scale and unchanged bad cells remain editable', () => {
  const pages = { 1: { stoich: 98 }, 5: { lambdaTable: Array(256).fill(147) } }
  assert.equal(validateConfigurationValues(ini, { 5: pages[5] }, pages), null)
  pages[5].lambdaTable[0] = 250
  assert.match(validateConfigurationValues(ini, { 5: pages[5] }, pages), /lambdaTable/)
  const prior = { 5: { afrTable: Array(256).fill(0) } }, after = { 5: { afrTable: [...prior[5].afrTable] } }
  after[5].afrTable[0] = 147
  assert.equal(validateConfigurationValues(ini, after, after, prior), null)
})

test('a legacy project stays openable for an explicit INI update while stale editor bindings block ECU writes', () => {
  const oldContent = content.replace('"Base duty for closed loop", 15', '"Base duty for closed loop", 7')
  assert.notEqual(oldContent, content)
  const legacy = parseIni(oldContent, { CELSIUS: true })
  const project = normalizeProjectV3({ projectName: 'Legacy tune', ini: { content: oldContent, signature: legacy.info.signature } }, legacy)
  assert.equal(project.projectName, 'Legacy tune')
  assert.equal(getTableMetadata(legacy, 'boostDCLupTbl'), null)
  assert.throws(() => assertWritableContract({ ...connected(legacy), currentProject: project }), /stale or incompatible/)
})

function manualFixture(t, applyWrite = true) {
  t.mock.method(serialService, 'readOutputChannels', async () => ({ rpm: 0, engine: { running: false, cranking: false } }))
  const f = configuration()
  let state = { ...connected(ini), projectEpoch: 1, operation: null, currentProject: { hardware: { pinMapPlatform: 'mega2560', channelBuild: 'standard' } },
    readPageFromECU: async page => ({ buffer: Buffer.from(f.buffers[page]) }),
    setOperation: operation => { state.operation = operation }, clearOperation: () => { state.operation = null } }
  const get = () => state, set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) } }
  state = { ...state, ...createRuntimeFieldsSlice(set, get), ...createRuntimeTablesSlice(set, get) }
  t.mock.method(serialService, 'writePage', async (page, offset, length, bytes) => { if (applyWrite) Buffer.from(bytes).copy(f.buffers[page], offset) })
  t.mock.method(serialService, 'readPageCRC', async page => calculatePageCRC(f.buffers[page]).toString(16).toUpperCase().padStart(8, '0'))
  return { ...f, get }
}

test('manual field write verifies applied signed bytes and preserves reserved data', async t => {
  const f = manualFixture(t)
  f.buffers[10][219] = 0xa5
  const result = await f.get().writeRuntimeField('alsFuelModifier', -15)
  assert.equal(result.changed, true)
  assert.equal(f.buffers[10].readInt8(197), -15)
  assert.equal(f.buffers[10][219], 0xa5)
  assert.equal(f.get().operation, null)
})

test('a write ACK without applied field bytes is rejected by manual RAM verification', async t => {
  const f = manualFixture(t, false)
  await assert.rejects(f.get().writeRuntimeField('alsFuelModifier', -15), /RAM verification failed/)
  assert.equal(f.get().operation, null)
})

test('stale caller-supplied buffers cannot overwrite neighboring pin polarity bits', async t => {
  const f = manualFixture(t)
  f.put('pitLimiterPinMode', 1)
  await f.get().writeRuntimeField('pitLimiterPin', 30, { pageBuffer: Buffer.alloc(f.buffers[6].length) })
  assert.equal(f.buffers[6][128] & 0x80, 0x80)
  assert.equal((f.buffers[6][128] >> 1) & 63, 30)
})

const afrPayload = () => ({ rawValues: Array(256).fill(147),
  rawRpmAxis: Array.from({ length: 16 }, (_, i) => 10 + i * 5),
  rawLoadAxis: Array.from({ length: 16 }, (_, i) => 10 + i * 5) })

test('manual table writes verify actual bytes and reject silently clamped raw values', async t => {
  const f = manualFixture(t)
  const bad = afrPayload(); bad.rawValues[0] = 300
  await assert.rejects(f.get().writeRuntimeTable('afr1', bad), /range/)
  assert.equal(f.buffers[5][0], 0)
  await f.get().writeRuntimeTable('afr1', afrPayload(), { chunkSettleMs: 0, writeSettleMs: 0 })
  assert.equal(f.buffers[5][0], 147)
  assert.equal(f.get().operation, null)
})

test('a manual table ACK without applied bytes fails RAM verification', async t => {
  const f = manualFixture(t, false)
  await assert.rejects(f.get().writeRuntimeTable('afr1', afrPayload(), { chunkSettleMs: 0, writeSettleMs: 0 }), /RAM verification failed/)
  assert.equal(f.get().operation, null)
})
