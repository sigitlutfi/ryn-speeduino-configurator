import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseIni } from '../src/shared/ini-parser.js'
import { parseRealtime } from '../src/shared/protocol/realtime.js'
import { decodeOutputChannels } from '../src/shared/protocol/output-channels.js'
import { appendTelemetrySample, telemetryIssues, liveTpsADC } from '../src/shared/protocol/tuning-live.js'
import { createRealtimeSlice } from '../src/renderer/core/store/realtimeSlice.js'
import { createRealtimeChannelRegistry } from '../src/renderer/features/dashboard/widgets/channelRegistry.js'

const ini = parseIni(readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8'))

// Independent values at the offsets emitted by firmware getTSLogEntry().
function wirePacket() {
  const b = Buffer.alloc(167)
  b[1] = 0x30; b[2] = 0x09; b[3] = 7
  b.writeUInt16LE(163, 4); b[6] = 55; b[7] = 127
  b[9] = 142; b[10] = 147; b.writeUInt16LE(4321, 14)
  b.writeUInt16LE(123, 17); b[19] = 90; b.writeInt8(-12, 24); b[25] = 147
  b.writeUInt16LE(12345, 26); b.writeUInt16LE(1600, 28); b[32] = 0x80
  b[35] = 45; b[36] = 110; b[41] = 99; b[74] = 201
  b.writeUInt16LE(12345, 76); b[84] = 0x12; b[85] = 0x91
  b.writeInt16LE(-12, 86); b.writeInt16LE(-31, 88); b.writeUInt16LE(3150, 90)
  b[102] = 99; b.writeUInt16LE(123, 104); b[106] = 4; b[110] = 0x18
  b[116] = 30; b.writeUInt16LE(180, 121); b.writeUInt16LE(2750, 125)
  b[139] = 15; b[140] = 3; b.writeInt8(-30, 141); b[142] = 85
  b.writeUInt16LE(3210, 143); b[145] = 3; b.writeUInt16LE(5432, 146)
  b.writeUInt16LE(1001, 148); b.writeInt8(-20, 150); b[151] = 125
  b[152] = 1; b[163] = 100; b[165] = 7; b[166] = 1
  return b
}

for (const [name, decode] of [['INI', b => decodeOutputChannels(b, ini)], ['fixed wire', parseRealtime]]) {
  test(`${name} telemetry decoding matches firmware units, signed fields and status bits`, () => {
    const rt = decode(wirePacket())
    for (const [key, expected] of Object.entries({ rpm: 4321, map: 163, tps: 73.5,
      coolant: 87, clt: 87, iat: 15, battery: 14.2, vbatt: 14.2, afr: 14.7,
      ve: 99, ve1: 90, advance: -12, corrections: 123, pw1: 12.345,
      dwell: 3.15, dwellActual: 2.75, baro: 99, vss: 123, gear: 4,
      ethanolPct: 45, flexCorr: 110, fuelTemp: -10, tpsADC: 201,
      loopsPerSecond: 12345, freeRAM: 1600, syncLossCounter: 7,
      fuelLoadRaw: -12, ignLoadRaw: -31, emap: 180 })) assert.ok(Math.abs(rt[key] - expected) < 1e-9, `${key}: ${rt[key]} vs ${expected}`)
    for (const key of ['running', 'warmup', 'sync', 'dfco', 'boostCutFuel', 'nitrous',
      'halfSync', 'fanStatus', 'burnPending', 'protectActive', 'protectRPM', 'protectCLT', 'ioError']) {
      assert.equal(rt.engine[key], true, key)
    }
    assert.equal(rt.engine.cranking, false)
    assert.equal(rt.performance.alsTimingCorr, -30)
    assert.equal(rt.performance.alsFuelCorr, 85)
    assert.equal(rt.performance.alsActiveTime, 3210)
    assert.equal(rt.performance.rollingPopBangTimingCorr, -20)
    assert.equal(rt.performance.rollingPopBangFuelCorr, 125)
    assert.equal(rt.performance.rollingPopBangActiveTime, 5432)
    assert.equal(rt.performance.rollingPopBangCutCounter, 1001)
    assert.equal(rt.driveMode.valid, true)
  })
}

test('current INI decoding rejects truncated and oversized telemetry rather than filling absent bytes with zero', () => {
  for (const length of [0, 138, 144, 152, 166, 168]) {
    assert.throws(() => decodeOutputChannels(Buffer.alloc(length), ini), /telemetry size/)
  }
})

test('requested dwell and measured dwell remain distinct even if one is zero', () => {
  const b = wirePacket(); b.writeUInt16LE(0, 125)
  const rt = decodeOutputChannels(b, ini)
  assert.equal(rt.dwell, 3.15)
  assert.equal(rt.dwellActual, 0)
})

test('trace samples reflect packet timing, preserve zero, stop duplicating old values and insert a gap', () => {
  const h = { ts: [], vals: [], lastReceivedAt: null }
  assert.equal(appendTelemetrySample(h, null, null, 900), false)
  assert.equal(appendTelemetrySample(h, 0, 1000, 1001), true)
  assert.equal(appendTelemetrySample(h, 0, 1000, 1900), false)
  assert.equal(appendTelemetrySample(h, null, 1000, 3100), true)
  assert.equal(appendTelemetrySample(h, null, 1000, 4000), false)
  assert.equal(appendTelemetrySample(h, 12, 4200, 4201), true)
  assert.deepEqual(h.ts, [1, 3.1, 4.2])
  assert.deepEqual(h.vals, [0, null, 12])
  appendTelemetrySample(h, 13, 4300, 4301, 3)
  assert.deepEqual(h.vals, [null, 12, 13])
})

test('realtime store rejects offline, unprobed and old-INI updates and does not record them', () => {
  let state = { connection: { status: 'disconnected', handshakeStatus: 'idle' }, parsedIni: ini }
  const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) } }
  state = { ...state, ...createRealtimeSlice(set) }
  state.setLogRecording(true)
  assert.equal(state.logRecording, false)
  const data = decodeOutputChannels(wirePacket(), ini)
  state.setRealtime(data)
  assert.equal(state.realtimeReceivedAt, null)
  state.connection = { status: 'connected', handshakeStatus: 'probing' }
  state.setRealtime(data)
  assert.equal(state.realtimeReceivedAt, null)
  state.connection.handshakeStatus = 'ok'
  state.setRealtime(data, { ini: structuredClone(ini) })
  assert.equal(state.logEntries.length, 0)
  state.setRealtime(data, { ini })
  assert.equal(state.realtime.rpm, 4321)
  state.setLogRecording(true)
  state.setRealtime(data, { ini })
  assert.equal(state.logEntries.length, 1)
  state.clearRealtime('INI mismatch')
  assert.equal(state.realtimeReceivedAt, null)
  assert.equal(state.realtimeError, 'INI mismatch')
})

test('dashboard units convert once and MAP range follows sensor calibration', () => {
  const registry = createRealtimeChannelRegistry({ convertTemp: x => x * 1.8 + 32,
    convertPress: x => x / 100, convertSpeed: x => x * 0.621371,
    tempUnit: () => '°F', pressUnit: () => 'bar', speedUnit: () => 'mph', mapMax: 400 })
  const rt = decodeOutputChannels(wirePacket(), ini)
  assert.equal(registry.coolant.getDisplay(rt).value, 188.6)
  assert.equal(registry.map.getDisplay(rt).value, 1.63)
  assert.equal(registry.map.getDisplay(rt).max, 4)
  assert.equal(registry.vss.getDisplay(rt).value, 123 * 0.621371)
  assert.equal(registry.rpm.getDisplay({ rpm: 0 }).available, true)
  assert.equal(registry.rpm.getDisplay({}).available, false)
  assert.equal(registry.thermalPair.getDisplay({ coolant: 0 }).available, true)
  assert.equal(registry.thermalPair.getDisplay({ coolant: 0 }).lines[1].value, '—')
})

test('valid serial data does not hide missing sensor calibration or saturated temperatures', () => {
  const rt = { tps: 127.5, coolant: 215, iat: 215 }
  const issues = telemetryIssues(rt, { tpsMin: 0, tpsMax: 0 })
  assert.match(issues[0], /identical minimum and maximum/)
  assert.match(issues[1], /CLT\/IAT/)
  assert.equal(rt.tps, 127.5)
  assert.match(telemetryIssues(rt)[0], /outside 0–100/)
  assert.deepEqual(telemetryIssues({ tps: 50, coolant: 80, iat: 20 }, { tpsMin: 10, tpsMax: 200 }), [])
})

test('TPS capture rechecks freshness at click time and accepts the ECU eight-bit ADC range', () => {
  const state = { connection: { status: 'connected', handshakeStatus: 'ok' }, realtimeReceivedAt: 1000, realtime: { tpsADC: 0 } }
  assert.equal(liveTpsADC(state, 2000), 0)
  state.realtime.tpsADC = 255
  assert.equal(liveTpsADC(state, 2000), 255)
  assert.equal(liveTpsADC(state, 3001), null)
  state.realtime.tpsADC = 256
  assert.equal(liveTpsADC(state, 2000), null)
  state.realtime.tpsADC = 10
  state.realtimeError = 'INI mismatch'
  assert.equal(liveTpsADC(state, 2000), null)
})


test('telemetry from another operation cannot bypass a pending or failed recovery validation', () => {
  let state = { connection: { status: 'connected', handshakeStatus: 'ok', sessionId: 1, validationStatus: 'checking' }, projectEpoch: 1 }
  const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) } }
  state = { ...state, ...createRealtimeSlice(set) }
  for (const status of ['idle', 'checking', 'failed']) {
    state.connection.validationStatus = status
    state.clearRealtime('CRC validation pending or failed')
    state.setRealtime({ rpm: 1234 })
    assert.equal(state.realtimeReceivedAt, null)
    assert.equal(state.realtimeError, 'CRC validation pending or failed')
  }
  state.connection.validationStatus = 'ready'
  state.setRealtime({ rpm: 0 })
  assert.ok(state.realtimeReceivedAt)
})
