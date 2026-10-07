import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseIni, getVarMetadata } from '../src/shared/ini-parser.js'
import mapping from '../src/shared/protocol/avr-pin-mapping.js'
import { extractAvrPinMappings } from '../scripts/avr-pin-mapping.mjs'
import { boardPinContext, physicalPinForField, projectPinMapOptions } from '../src/shared/protocol/board-pins.js'
import { buildPinRegistry, getPinOptionsForField, validateCustomPinAssignments } from '../src/renderer/features/shared/utils/pinRegistry.js'
import { normalizeProjectV3, serializeProjectForSave } from '../src/renderer/core/store/utils/project.normalization.js'

const ini = parseIni(readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8'), { CELSIUS: true })
const options = { platform: 'mega2560', injectorChannels: 4, ignitionChannels: 5 }
const pages = layout => ({ 1: { pinLayout: layout }, 6: {}, 10: {} })
const choice = (field, values, index) => getPinOptionsForField(field, ini, values, buildPinRegistry(ini, values, options), 0).find(option => option.index === index)

test('AVR layouts use direct INI IDs and distinguish fixed board routes', () => {
  assert.deepEqual(Object.keys(mapping.layouts).map(Number), [1, 2, 3, 6, 8, 9, 10, 20, 30, 31, 40, 41, 42, 45])
  assert.equal(mapping.layouts[1].pinTrigger, 20)
  assert.equal(mapping.layouts[3].pinTrigger, 19)
  assert.equal(mapping.layouts[3].pinFuelPump, 45)
  assert.equal(mapping.layouts[41].pinFuelPump, 23)
  assert.equal(mapping.layouts[3].pinFan, 47)
  assert.equal(mapping.layouts[3].pinO2, 62)
  for (const id of Object.keys(mapping.layouts)) assert.notEqual(getVarMetadata(ini, 'pinLayout').options[id], 'INVALID')
})

test('physical reservations include injectors, ignition, triggers, fuel pump and default tacho', () => {
  const values = pages(3)
  for (const pin of [8, 40, 19, 18, 3, 45, 49]) assert.equal(choice('pitLimiterPin', values, pin).disabled, true, `D${pin}`)
  assert.equal(choice('pitLimiterPin', values, 46).disabled, false)
  const registry = buildPinRegistry(ini, values, options)
  assert.equal(registry.rows.find(row => row.field === 'fuelPumpPin').physicalPin, 45)
  assert.match(choice('fuelPumpPin', values, 0).label, /D45/)
})

test('default overrides release the old route and reserve the actual pin', () => {
  const values = pages(41)
  assert.equal(choice('pitLimiterPin', values, 23).disabled, true)
  values[4] = { fuelPumpPin: 46 }
  assert.equal(choice('pitLimiterPin', values, 23).disabled, false)
  assert.equal(choice('pitLimiterPin', values, 46).disabled, true)
  const oldBoard = pages(1)
  oldBoard[1].vssMode = 2
  assert.match(validateCustomPinAssignments(ini, oldBoard, options, ['vssPin']), /no default route/)
  assert.equal(choice('vssPin', oldBoard, 0).disabled, true)
  const miata = pages(6)
  miata[1].vssMode = 2
  const miataRegistry = buildPinRegistry(ini, miata, options)
  assert.equal(miataRegistry.rows.find(row => row.field === 'vssPin').status, 'board-default')
  assert.equal(choice('pitLimiterPin', miata, 2), undefined)
})

test('compiled channels, rather than engine cylinder count, determine fixed reservations', () => {
  const values = pages(3)
  values[1].nCylinders = 1
  const standard = buildPinRegistry(ini, values, options)
  const six = buildPinRegistry(ini, values, { ...options, injectorChannels: 6, ignitionChannels: 3 })
  assert.equal(standard.rows.some(row => row.field === '$injector6'), false)
  assert.equal(six.rows.some(row => row.field === '$injector6' && row.physicalPin === 50), true)
  assert.equal(six.rows.some(row => row.field === '$coil4'), false)
})

test('analog inputs and digital A8/A15 aliases share a physical resource', () => {
  const values = pages(3)
  // Fuel pump raw 55 is digital A8. O2 is fixed A8, so this is a conflict.
  values[4] = { fuelPumpPin: 55 }
  const registry = buildPinRegistry(ini, values, options)
  assert.equal(registry.rows.find(row => row.field === 'fuelPumpPin').status, 'conflict')
  assert.equal(registry.rows.find(row => row.field === 'fuelPumpPin').claimKey, 'mcu:62')
  values[6].useExtBaro = 1
  values[6].baroPin = 15
  assert.equal(choice('fanPin', values, 62).disabled, true)
  const context = boardPinContext(ini, values, options)
  assert.equal(physicalPinForField('baroPin', 15, 'A15', context), 69)
  values[10].knock_mode = 1
  const digitalKnock = boardPinContext(ini, values, options)
  assert.equal(physicalPinForField('knock_pin', 47, 'A0', digitalKnock), 47)
  assert.equal(choice('knock_pin', values, 47).disabled, true)
  values[10].knock_mode = 2
  assert.equal(physicalPinForField('knock_pin', 20, '20', boardPinContext(ini, values, options)), 69)
  assert.equal(choice('knock_pin', values, 20).disabled, true)
})

test('firmware gates use flat shift, external VSS and input-switch mode, not INI visibility', () => {
  const values = pages(3)
  values[6] = { launchPin: 46, launchEnable: 0, flatSEnable: 1 }
  assert.equal(choice('pitLimiterPin', values, 46).disabled, true)
  values[6].flatSEnable = 0
  assert.equal(choice('pitLimiterPin', values, 46).disabled, false)
  values[10] = { fuel2InputPin: 46, fuel2Mode: 1 }
  assert.equal(choice('pitLimiterPin', values, 46).disabled, false)
  values[10].fuel2Mode = 4
  assert.equal(choice('pitLimiterPin', values, 46).disabled, true)
  values[10].fuel2Mode = 0
  values[1].vssPin = 46
  values[1].vssMode = 1
  assert.equal(choice('pitLimiterPin', values, 46).disabled, false)
  values[1].vssMode = 2
  assert.equal(choice('pitLimiterPin', values, 46).disabled, true)
})

test('disabled custom input releases a visible INI field; enabling a conflict blocks Save', () => {
  const values = pages(3)
  values[6] = { pitLimiterPin: 19, pitLimiterEnabled: 1 }
  assert.match(validateCustomPinAssignments(ini, values, options, ['pitLimiterPin']), /Crank trigger/)
  values[6].pitLimiterEnabled = 0
  assert.equal(validateCustomPinAssignments(ini, values, options, ['pitLimiterPin']), null)
  assert.equal(choice('boostPin', values, 19).activeOwners.some(owner => owner.field === 'pitLimiterPin'), false)
  assert.equal(choice('boostPin', values, 1), undefined)
})

test('zero is required-pin sentinel, not board default, for unconditional idle/CTPS routes', () => {
  for (const field of ['idleUpPin', 'idleUpOutputPin', 'CTPSPin']) assert.equal(getVarMetadata(ini, field).options[0], 'Pin Required')
  const values = pages(3)
  values[1].idleUpEnabled = 1
  assert.match(validateCustomPinAssignments(ini, values, options, ['idleUpPin']), /requires an explicit pin/)
  values[1].idleUpEnabled = 0
  assert.equal(validateCustomPinAssignments(ini, values, options, ['idleUpPin']), null)
})

test('unknown MCU/layout stays explicitly unverified and project choices survive save/load', () => {
  assert.equal(boardPinContext(ini, pages(3)).verified, false)
  assert.match(boardPinContext(ini, pages(61), options).warning, /fall back/)
  const raw = { projectName: 'Pin test', hardware: { pinMapPlatform: 'mega2560', channelBuild: '6-3' } }
  const normalized = normalizeProjectV3(raw, ini)
  assert.deepEqual(projectPinMapOptions(normalized), { platform: 'mega2560', injectorChannels: 6, ignitionChannels: 3 })
  const saved = serializeProjectForSave(normalized, {})
  assert.deepEqual(normalizeProjectV3(saved, ini).hardware, raw.hardware)
})

test('mapping extraction honors conditional branches and assignment order', () => {
  const source = 'static pinNumbers_t getExampleMapping(void) {\n pinNumbers_t pins;\n pins.pinFan = 40;\n#if defined(CORE_TEENSY35)\n pins.pinFan = 20;\n#else\n pins.pinFan = A13;\n#endif\n return pins;\n}\ncase 3: return getExampleMapping();'
  assert.equal(extractAvrPinMappings(source).layouts[3].pinFan, 67)
  assert.throws(() => extractAvrPinMappings(source.replace('A13', 'unknownPin')), /Unsupported AVR pin/)
})
