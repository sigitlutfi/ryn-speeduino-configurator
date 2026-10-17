import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseIni } from '../src/shared/ini-parser.js'
import { thermistorCalibration, oxygenCalibration, calibrationChunks } from '../src/shared/protocol/sensor-calibration.js'
import { calculatePageCRC } from '../src/shared/protocol/ecu-commands.js'
import { sensorCalibrationOperation } from '../src/renderer/core/services/sensorCalibration.js'
import { SerialService } from '../src/renderer/core/services/serialService.js'
import { createMockSerial } from '../src/shared/protocol/mock-serial.js'

const ntc = { bias: 2490, t1: -40, r1: 100700, t2: 30, r2: 2238, t3: 99, r3: 177 }
const oxygen = { vMin: 0, vMax: 5, afrMin: 10, afrMax: 20 }
const ini = parseIni(readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8'), { CELSIUS: true })

test('thermistor fit matches physical resistance points and the firmware wire decoder', () => {
  const t = thermistorCalibration(ntc)
  assert.equal(t.bytes.length, 64)
  for (const i of [1, 2, 3]) assert.ok(Math.abs(t.temperatureAtResistance(ntc[`r${i}`]) - ntc[`t${i}`]) < 1e-6)
  for (let i = 0; i < 32; i++) {
    const fahrenheit = Math.trunc(t.bytes.readInt16LE(i * 2) / 10)
    const celsius = Math.trunc((fahrenheit - 32) * 5 / 9)
    assert.equal(celsius, t.samples[i].value)
    assert.equal(t.samples[i].adc, i * 33)
  }
  assert.throws(() => thermistorCalibration({ ...ntc, r2: ntc.r1 }), /decreasing/)
  assert.throws(() => thermistorCalibration({ ...ntc, bias: 0 }), /positive/)
})

test('O2 transfer uses aligned payloads within the Mega receive buffer, with full-stream CRC', () => {
  assert.equal(calculatePageCRC(Buffer.from('123456789')), 0xcbf43926)
  const t = oxygenCalibration(oxygen), commands = calibrationChunks('o2', t.bytes), collected = []
  assert.equal(t.bytes[0], 100); assert.equal(t.bytes[1023], 200)
  for (const [i, frame] of commands.entries()) {
    const size = frame.readUInt16BE(0), payload = frame.subarray(2, 2 + size)
    assert.ok(size <= 121)
    assert.equal(payload[0], 0x74); assert.equal(payload[2], 2)
    assert.equal(payload.readUInt16BE(3), i * 96)
    assert.equal(payload.readUInt16BE(5), payload.length - 7)
    assert.equal(frame.readUInt32BE(frame.length - 4), calculatePageCRC(payload))
    collected.push(payload.subarray(7))
  }
  assert.deepEqual(Buffer.concat(collected), t.bytes)
  assert.equal(t.samples.at(-1).adc, 992)
  assert.throws(() => oxygenCalibration({ ...oxygen, vMin: 5 }), /increasing/)
  assert.throws(() => calibrationChunks('clt', t.bytes), /size/)
})

function fixture(options = {}) {
  const state = { parsedIni: ini, projectEpoch: 1, operation: null, currentProject: {},
    connection: { status: 'connected', handshakeStatus: 'ok', firmwareSignature: ini.info.signature, sessionId: 1 },
    setOperation(op) { state.operation = op }, clearOperation() { state.operation = null } }
  let count = 0, table = Buffer.alloc(0), resumes = 0
  const service = {
    async enterExclusiveMode() {}, resumeOutputChannelsPolling() { resumes++ },
    async readOutputChannels() { return { rpm: options.running ? 1000 : 0, engine: { running: !!options.running, cranking: false },
      outputChannels: { testenabled: options.outputTest ? 1 : 0 }, driveMode: { valid: true, active: options.mode || 0, state: 0 } } },
    async sendCommand(frame) {
      const p = frame.subarray(2, 2 + frame.readUInt16BE(0))
      if (p[0] === 0x74) {
        count++; if (options.timeout && count === 2) throw new Error('Response timeout')
        if (options.disconnect) state.connection.sessionId++
        table = Buffer.concat([table, p.subarray(7)])
        return { status: 0, data: Buffer.alloc(0) }
      }
      const crc = Buffer.alloc(4); crc.writeUInt32BE(options.badCRC ? 123 : calculatePageCRC(table))
      return { status: 0, data: crc }
    }
  }
  return { state, service, get count() { return count }, get resumes() { return resumes } }
}

test('calibration transfer verifies persisted CRC, releases polling and never retries continuation chunks', async () => {
  const f = fixture(), table = oxygenCalibration(oxygen)
  const result = await sensorCalibrationOperation(() => f.state, 'o2', table.bytes, () => {}, f.service)
  assert.equal(result.crc, table.crc); assert.equal(result.verified, true)
  assert.equal(f.count, 11); assert.equal(f.resumes, 1); assert.equal(f.state.operation, null)
  const timed = fixture({ timeout: true })
  await assert.rejects(sensorCalibrationOperation(() => timed.state, 'o2', table.bytes, () => {}, timed.service), /partially written/)
  assert.equal(timed.count, 2); assert.equal(timed.resumes, 1); assert.equal(timed.state.operation, null)
})

test('calibration refuses running engines, output tests, non-default modes, stale sessions and bad CRC', async () => {
  for (const option of [{ running: true }, { outputTest: true }, { mode: 1 }, { disconnect: true }, { badCRC: true }]) {
    const f = fixture(option)
    await assert.rejects(sensorCalibrationOperation(() => f.state, 'clt', thermistorCalibration(ntc).bytes, () => {}, f.service))
    if (option.running || option.outputTest || option.mode) assert.equal(f.count, 0)
    assert.equal(f.state.operation, null); assert.equal(f.resumes, 1)
  }
})

test('real serial framing transfers CLT/IAT/O2 and reads their stored CRC through the mock ECU', async t => {
  const previous = globalThis.window, listeners = new Set()
  const port = createMockSerial(data => { for (const fn of [...listeners]) fn(data) }, { telemetry: () => ({ rpm: 0, tps: 0, running: false, cranking: false }) })
  globalThis.window = { serial: {
    onData(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    async sendCommand(bytes) { port.write(Buffer.from(bytes)); return { ok: true } },
    async flush() { return { ok: true } }
  } }
  const service = new SerialService(), f = fixture()
  t.after(() => { service.destroy(); globalThis.window = previous })
  for (const sensor of ['clt', 'iat', 'o2']) {
    assert.equal((await sensorCalibrationOperation(() => f.state, sensor, null, () => {}, service)).empty, true)
    const table = sensor === 'o2' ? oxygenCalibration(oxygen) : thermistorCalibration(ntc)
    const result = await sensorCalibrationOperation(() => f.state, sensor, table.bytes, () => {}, service)
    assert.equal(result.crc, table.crc)
    assert.equal((await sensorCalibrationOperation(() => f.state, sensor, null, () => {}, service)).crc, table.crc)
  }
})
