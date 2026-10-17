import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseIni, getVarMetadata } from '../src/shared/ini-parser.js'
import { evaluateIniNumber, resolveNumericMetadata } from '../src/shared/protocol/ini-numeric.js'
import { operatingLoad, interpolateTable, telemetryState } from '../src/shared/protocol/tuning-live.js'
import { parseRealtime } from '../src/shared/protocol/realtime.js'
import { decodeOutputChannels } from '../src/shared/protocol/output-channels.js'
import { moveCurvePoint } from '../src/renderer/ui/curve-math.js'
import { displayTablesFromPages, applyTableDrafts } from '../src/renderer/core/store/utils/table.drafts.js'
import { createProjectDocument } from '../src/renderer/features/projects/projectCreation.js'

const content = fs.readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8')
const ini = parseIni(content, { CELSIUS: true })

test('INI numeric expressions resolve scales without executing JavaScript', () => {
  assert.equal(evaluateIniNumber('{ (algorithm == 0 || algorithm == 2) ? 2 : 0.5 }', { algorithm: 1 }), 0.5)
  assert.equal(evaluateIniNumber('{ 2 * (3 + 4) }'), 14)
  for (const expression of ['globalThis.process.exit()', 'x = 1', 'constructor.constructor("return 1")()', 'missing + 1', '1 / 0']) {
    assert.equal(evaluateIniNumber(expression), undefined)
  }
  assert.equal(evaluateIniNumber('{ cycle }', {}, { cycle: { raw: ['{ cycle }'] } }), undefined)
})

test('primary and secondary axes use the selected algorithm and actual INI formulas', () => {
  for (const [field, selector] of [['fuelLoadBins', 'algorithm'], ['mapBins1', 'ignAlgorithm'],
    ['fuelLoad2Bins', 'fuel2Algorithm'], ['mapBins2', 'spark2Algorithm']]) {
    for (const algorithm of [0, 1, 2]) {
      const meta = resolveNumericMetadata(getVarMetadata(ini, field), ini, { 1: { [selector]: algorithm } })
      assert.equal(meta.scale, algorithm === 1 ? 0.5 : 2, `${field} algorithm ${algorithm}`)
      assert.equal(meta.digits, algorithm === 1 ? 1 : 0)
    }
  }
  const changed = structuredClone(ini)
  changed.outputChannels.channels.fuelLoadRes.raw = ['{ algorithm == 1 ? 0.25 : 3 }']
  assert.equal(resolveNumericMetadata(getVarMetadata(changed, 'fuelLoadBins'), changed, { 1: { algorithm: 1 } }).scale, 0.25)
})

test('both realtime decoders preserve firmware load and exhaust pressure wire values', () => {
  const bytes = Buffer.alloc(167)
  bytes[152] = 1
  bytes[163] = 100
  bytes[25] = 10
  bytes.writeUInt16LE(100, 4)
  bytes.writeUInt16LE(50, 86)
  bytes.writeUInt16LE(80, 88)
  bytes.writeUInt16LE(200, 121)
  for (const decoded of [parseRealtime(bytes), decodeOutputChannels(bytes, ini)]) {
    assert.equal(decoded.emap, 200)
    assert.equal(decoded.tps, 5)
    assert.equal(decoded.fuelLoadRaw, 50)
    assert.equal(decoded.ignLoadRaw, 80)
    assert.equal(operatingLoad(decoded, 2, 'fuelLoadRaw'), 50)
    assert.equal(operatingLoad(decoded, 2), 50)
  }
})

test('load calculation follows MAP, TPS and IMAP/EMAP for each map', () => {
  const data = { map: 100, baro: 90, emap: 200, tps: 5, fuelLoadRaw: 20, ignLoadRaw: 36 }
  assert.equal(operatingLoad(data, 0), 100)
  assert.equal(operatingLoad(data, 1), 5)
  assert.equal(operatingLoad(data, 1, 'fuelLoadRaw'), 5)
  assert.equal(operatingLoad(data, 1, 'ignLoadRaw'), 9)
  assert.equal(operatingLoad(data, 2), 50)
  assert.equal(operatingLoad({ ...data, emap: 0 }, 2), null)
  assert.equal(operatingLoad(data, 3), null)
})

test('trace interpolation clamps edges and refuses invalid table geometry', () => {
  const values = [[40, 60], [80, 100]], x = [1000, 3000], y = [50, 100]
  assert.equal(interpolateTable(values, x, y, 2000, 75), 70)
  assert.equal(interpolateTable(values, x, y, 100, 150), 80)
  assert.equal(interpolateTable(values, x, [100, 50], 2000, 75), null)
  assert.equal(interpolateTable([[40]], x, y, 2000, 75), null)
})

test('telemetry never treats disconnected, missing or expired packets as live', () => {
  assert.equal(telemetryState(false, 1000, 1000), 'offline')
  assert.equal(telemetryState(true, null, 1000), 'waiting')
  assert.equal(telemetryState(true, 1000, 2000), 'live')
  assert.equal(telemetryState(true, 1000, 3100), 'stale')
})

test('curve movement retains 0.1V X precision independently from integer Y', () => {
  const options = { xRange: { min: 6, max: 20 }, yRange: { min: 0, max: 255 }, xPrecision: 1, precision: 0 }
  assert.deepEqual(moveCurvePoint([8, 9, 10], [120, 110, 100], 1, { x: 9.4, y: 109.6 }, options),
    { x: [8, 9.4, 10], y: [120, 110, 100] })
  assert.equal(moveCurvePoint([8, 9, 10], [120, 110, 100], 1, { x: 12 }, options).x[1], 9.9)
  assert.equal(moveCurvePoint([8, 9, 10], [120, 110, 100], 1, { y: -20 }, options).y[1], 0)
  assert.equal(moveCurvePoint([8, 9, 10], [120, 110, 100], 1, { x: 9.4 }, { ...options, xFixed: true }).x[1], 9)
})

test('project display and Save round-trip MAP/TPS axes without altering encoded bytes', () => {
  for (const algorithm of [0, 1, 2]) {
    const project = createProjectDocument({ projectName: 'Axis roundtrip', ini: { content }, parsedIni: ini,
      engine: { cylinders: 4, type: 'inline', displacement: 2000, injectorFlow: 440, injectorOpenTime: 1, stoich: 14.7 }, boardLayout: 3 }).project
    project.constants.decodedPages[1].algorithm = algorithm
    const tables = displayTablesFromPages(ini, project.constants.decodedPages)
    const expected = project.constants.decodedPages[2].fuelLoadBins.map(value => value * (algorithm === 1 ? 0.5 : 2))
    assert.deepEqual(tables.ve.loadAxis, expected)
    const next = applyTableDrafts(project, tables, ini, { ve: true })
    assert.deepEqual(next.constants.decodedPages[2].fuelLoadBins, project.constants.decodedPages[2].fuelLoadBins)
  }
})
