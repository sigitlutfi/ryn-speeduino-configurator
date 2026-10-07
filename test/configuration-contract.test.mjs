import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { assertWritableContract } from '../src/shared/protocol/contract.js'
import { buildPinRegistry, getPinOptionsForField } from '../src/renderer/features/shared/utils/pinRegistry.js'
import { validateConfigurationValues } from '../src/shared/protocol/configuration-validation.js'
import { parseIni, getVarMetadata } from '../src/shared/ini-parser.js'
import { parsePage } from '../src/shared/protocol/binary-parser.js'
import { serializePage } from '../src/shared/protocol/binary-serializer.js'
import { serializeDecodedPage } from '../src/shared/protocol/page-cache.js'
import { resolveRuntimeField, readRuntimeFieldFromBuffer, buildRuntimeFieldWrite } from '../src/shared/protocol/runtime-fields.js'
import { toDisplay, toRaw } from '../src/renderer/features/shared/utils/normalization.js'
import { formatReadCommand, wrapModernProtocol } from '../src/shared/protocol/ecu-commands.js'
import { calculatePageCRC } from '../src/shared/protocol/ecu-commands.js'
import { createMockSerial } from '../src/shared/protocol/mock-serial.js'

const content = readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8')
const ini = parseIni(content, { CELSIUS: true })
const fahrenheit = parseIni(content, { FAHRENHEIT: true })

test('pin choices detect digital input/output collisions and release disabled custom inputs', () => {
  const fixture = parseIni('[Constants]\nnPages=1\npageSize=4\npage=1\npitLimiterEnabled=bits,U08,0,[0:0],"Disabled","Enabled"\npitLimiterPin=bits,U08,1,[0:2],"Pin Required","INVALID","INVALID","3"\nboostPin=bits,U08,2,[0:2],"Board Default","INVALID","INVALID","3"')
  const pages = { 1: { pitLimiterEnabled: 1, pitLimiterPin: 3, boostPin: 3 } }
  const registry = buildPinRegistry(fixture, pages)
  assert.equal(registry.rows.find(row => row.field === 'pitLimiterPin').status, 'conflict')
  assert.equal(getPinOptionsForField('boostPin', fixture, pages, registry, 0).find(option => option.index === 3).disabled, true)
  pages[1].pitLimiterEnabled = 0
  const disabledRegistry = buildPinRegistry(fixture, pages)
  assert.equal(getPinOptionsForField('boostPin', fixture, pages, disabledRegistry, 0).find(option => option.index === 3).disabled, false)
})

test('writes reject old or unknown firmware signatures', () => {
  const state = { parsedIni: ini, currentProject: { ecu: { signature: ini.info.signature } } }
  assert.doesNotThrow(() => assertWritableContract(state))
  state.currentProject.ecu.signature = 'speeduino 202504-dev'
  assert.throws(() => assertWritableContract(state), /INI matching/)
  state.currentProject.ecu.signature = ''
  assert.throws(() => assertWritableContract(state), /INI matching/)
})

test('custom saves reject unrepresentable values and duration above 30 seconds', () => {
  assert.equal(validateConfigurationValues(ini, { 10: { alsMaxDuration: 30, alsFuelModifier: -15 } }), null)
  assert.match(validateConfigurationValues(ini, { 10: { alsMaxDuration: 31 } }), /alsMaxDuration/)
  assert.match(validateConfigurationValues(ini, { 10: { rollingPopBangFuelModifier: -150 } }), /FuelModifier/)
  assert.match(validateConfigurationValues(ini, { 6: { pitLimiterPin: 64 } }), /pitLimiterPin/)
})

test('every binary INI field fits its declared page', () => {
  for (const [page, fields] of Object.entries(ini.constants.pages)) {
    for (const [name, meta] of Object.entries(fields)) {
      if (!Number.isFinite(meta.offset)) continue
      const size = Number(meta.dataType?.substring(1)) / 8
      const count = meta.shape?.reduce((a, b) => a * b, 1) ?? 1
      assert.ok(meta.offset >= 0 && meta.offset + size * count <= ini.constants.pageSizes[page], `${page}:${name}`)
    }
  }
})

test('board IDs are identical in INI, page and runtime writes', () => {
  for (const board of [1, 2, 3, 60, 61]) {
    const raw = Buffer.alloc(ini.constants.pageSizes[1])
    raw[15] = board
    assert.equal(parsePage(raw, ini.constants.pages[1]).pinLayout, board)
    assert.equal(serializePage({ pinLayout: board }, ini.constants.pages[1], raw.length)[15], board)
    const meta = resolveRuntimeField(ini, 'pinLayout')
    assert.equal(readRuntimeFieldFromBuffer(raw, meta), board)
    assert.equal(buildRuntimeFieldWrite(Buffer.alloc(raw.length), meta, board).after[0], board)
  }
})

test('custom fields roundtrip, including signed temperatures, fuel and shared bitfields', () => {
  for (const page of [6, 10]) {
    const meta = ini.constants.pages[page]
    const custom = Object.fromEntries(Object.entries(meta).filter(([name]) => /^(pitLimiter|rumbleIdle|als|rollingPopBang)/.test(name)))
    const values = Object.fromEntries(Object.entries(custom).map(([name, field]) => [name,
      field.type === 'bits' ? (1 << (field.bitRange[1] - field.bitRange[0] + 1)) - 1
        : field.dataType === 'S08' ? -12 : 37]))
    const raw = serializePage(values, custom, ini.constants.pageSizes[page])
    assert.deepEqual(parsePage(raw, custom), values)
  }
  for (const value of [-40, 0, 70, 120]) {
    const meta = getVarMetadata(ini, 'rumbleIdleMinCLT')
    assert.equal(meta.dataType, 'S08')
    assert.equal(toDisplay(value, meta), value)
    assert.equal(toDisplay(value, getVarMetadata(fahrenheit, 'rumbleIdleMinCLT')), Math.round(value * 1.8 + 32))
  }
})

test('INI scaling applies translate before scale and reverses correctly', () => {
  const meta = { scale: 1.8, translate: -22.222222, digits: 1 }
  assert.equal(toDisplay(110, meta), 158)
  assert.equal(toRaw(158, meta), 110)
  for (const name of ['alsMinCLT', 'alsMaxCLT', 'rollingPopBangMinCLT']) {
    assert.equal(toDisplay(70, getVarMetadata(fahrenheit, name)), 158)
    assert.equal(toRaw(158, getVarMetadata(fahrenheit, name)), 70)
  }
})

test('custom raw defaults remain unscaled and scalar defaults are normalized', () => {
  assert.equal(getVarMetadata(ini, 'pitLimiterRPM').defaultValue, 60)
  assert.equal(getVarMetadata(ini, 'rumbleIdleMinCLT').defaultValue, 40)
  assert.equal(getVarMetadata(ini, 'rumbleIdlePinMode').requiresPowerCycle, true)
  const fixture = parseIni('[Constants]\nnPages=1\npageSize=4\npage=1\na=scalar,U08,0,"rpm",100,0,0,25500,0\nb=scalar,S08,1,"C",1,0,-40,120,0\n[ConstantsExtensions]\ndefaultValue=a,6000\nrawValue=b,-12')
  assert.equal(fixture.constants.pages[1].a.defaultValue, 60)
  assert.equal(fixture.constants.pages[1].b.defaultValue, -12)
})

test('mock ECU supports custom page write/read/burn/CRC at the extension offsets', async () => {
  const { serialService } = await import('../src/renderer/core/services/serialService.js')
  const listeners = new Set()
  const port = createMockSerial(bytes => { for (const fn of listeners) fn(bytes) })
  globalThis.window = { serial: {
    onData(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    async sendCommand(bytes) { port.write(Buffer.from(bytes)); return { ok: true } },
  } }
  try {
    for (const [page, offset, bytes] of [[6, 128, [0x87, 60, 80, 1, 5]], [10, 208, [0x87, 25, 50, 20, 20, 70, 15, 0xf1, 2, 3, 0x55, 0]]]) {
      await serialService.writePage(page, offset, bytes.length, bytes)
      const size = ini.constants.pageSizes[page]
      const raw = await serialService.readPageBuffer(formatReadCommand(page, 0, size), size, 1000)
      assert.deepEqual([...raw.subarray(offset, offset + bytes.length)], bytes)
      await serialService.burnPage(page)
      assert.equal(await serialService.readPageCRC(page), calculatePageCRC(raw).toString(16).toUpperCase().padStart(8, '0'))
    }
  } finally { port.close(); delete globalThis.window }
})

test('editing ALS preserves unrelated and padding bytes in the page snapshot', () => {
  const base = Buffer.alloc(220, 0xa5)
  const result = serializeDecodedPage(ini, 10, { alsFuelModifier: -15 }, base)
  assert.equal(result.readInt8(197), -15)
  for (let i = 0; i < base.length; i++) if (i !== 197) assert.equal(result[i], base[i], `offset ${i}`)
})

test('all four custom UI modules reference fields present in this INI', () => {
  for (const file of ['PitLimiter.jsx', 'RumbleIdle.jsx', 'AntiLag.jsx', 'PopAndBang.jsx']) {
    const source = readFileSync(new URL(`../src/renderer/features/racing/${file}`, import.meta.url), 'utf8')
    const targets = source.match(/const \w+_FIELDS = \[([\s\S]*?)\];/)[1]
    for (const match of targets.matchAll(/"([^"]+)"/g)) assert.ok(getVarMetadata(ini, match[1]), `${file}: ${match[1]}`)
  }
})

test('page reads accept 145-byte fragments and wait for a delayed frame CRC', async () => {
  const { serialService } = await import('../src/renderer/core/services/serialService.js')
  for (const [size, split, delay] of [[220, 145, 1], [64, 65, 90]]) {
    const listeners = new Set()
    const raw = Buffer.from(Array.from({ length: size }, (_, i) => (i * 3) & 255))
    const framed = wrapModernProtocol(Buffer.concat([Buffer.from([0]), raw]))
    globalThis.window = { serial: {
      onData(fn) { listeners.add(fn); return () => listeners.delete(fn) },
      async sendCommand() {
        queueMicrotask(() => { for (const fn of listeners) fn(framed.subarray(0, split)) })
        setTimeout(() => { for (const fn of listeners) fn(framed.subarray(split)) }, delay)
        return { ok: true }
      },
    } }
    try { assert.deepEqual(await serialService.readPageBuffer(formatReadCommand(10, 0, size), size, 500), raw) }
    finally { delete globalThis.window }
  }
})
