import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseIni } from '../src/shared/ini-parser.js'
import { parseRealtime } from '../src/shared/protocol/realtime.js'
import { decodeOutputChannels } from '../src/shared/protocol/output-channels.js'
import { ModernProtocolParser } from '../src/shared/protocol/response-parser.js'
import { wrapModernProtocol } from '../src/shared/protocol/ecu-commands.js'
import { formatOutputChannelsCommand } from '../src/shared/protocol/ecu-commands.js'
import { createMockSerial } from '../src/shared/protocol/mock-serial.js'

const ini = parseIni(readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8'))
function packet() {
  const bytes = Buffer.alloc(152)
  bytes[139] = 0x0f
  bytes[140] = 3
  bytes[142] = 110
  bytes.writeUInt16LE(4321, 143)
  bytes[145] = 3
  bytes.writeUInt16LE(1234, 146)
  bytes.writeUInt16LE(5678, 148)
  bytes.writeInt8(-12, 150)
  bytes[151] = 115
  return bytes
}

test('INI page sizes and fields match the performance v3 wire contract', () => {
  assert.equal(ini.constants.pageSizes[6], 143)
  assert.equal(ini.constants.pageSizes[10], 220)
  assert.equal(ini.outputChannels.ochBlockSize, 152)
  assert.equal(ini.outputChannels.channels.rollingPopBangFuelCorrection.offset, 151)
})

test('INI decoding and legacy decoding agree on performance telemetry', () => {
  const raw = packet()
  const legacy = parseRealtime(raw).performance
  const metadata = decodeOutputChannels(raw, ini).performance
  for (const key of Object.keys(legacy)) assert.equal(metadata[key], legacy[key], key)
  assert.equal(metadata.alsActiveTime, 4321)
  assert.equal(metadata.rollingPopBangActiveTime, 1234)
  assert.equal(metadata.rollingPopBangCutCounter, 5678)
  assert.equal(metadata.rollingPopBangTimingCorr, -12)
  assert.equal(metadata.rollingPopBangFuelCorr, 115)
  assert.equal(parseRealtime(Buffer.alloc(138)).performance.rollingPopBangActive, false)
})

test('a fragmented wrapped response of 145 bytes is not misclassified as realtime', () => {
  const parser = new ModernProtocolParser()
  const framed = wrapModernProtocol(Buffer.concat([Buffer.from([0]), Buffer.alloc(138, 42)]))
  assert.equal(framed.length, 145)
  const responses = []
  const realtime = []
  parser.on('response', data => responses.push(data))
  parser.on('realtime', data => realtime.push(data))
  parser.feed(framed.subarray(0, 50))
  parser.feed(framed.subarray(50))
  assert.equal(responses.length, 1)
  assert.equal(responses[0].data.length, 138)
  assert.equal(realtime.length, 0)
})

test('output channel read accepts a 145-byte fragment of a 152-byte raw response', async () => {
  const listeners = new Set()
  const raw = packet()
  globalThis.window = {
    serial: {
      onData(listener) { listeners.add(listener); return () => listeners.delete(listener) },
      async sendCommand() {
        queueMicrotask(() => {
          for (const listener of listeners) listener(raw.subarray(0, 145))
          for (const listener of listeners) listener(raw.subarray(145))
        })
        return { ok: true }
      },
    },
  }
  const { serialService } = await import('../src/renderer/core/services/serialService.js')
  const result = await serialService.readOutputChannels(ini, { settleMs: 1, timeout: 500 })
  assert.equal(result.performance.rollingPopBangCutCounter, 5678)
  assert.equal(result.performance.rollingPopBangTimingCorr, -12)
  delete globalThis.window
})

test('mock ECU advertises the same signature and returns a complete output block', async () => {
  let receive
  const port = createMockSerial(bytes => receive(bytes))
  const send = command => new Promise(resolve => { receive = resolve; port.write(command) })
  const signature = await send(Buffer.from('Q'))
  assert.equal(signature.toString('ascii'), 'speeduino 202504-ryn-perf-v3')
  const framed = await send(formatOutputChannelsCommand(ini.outputChannels.ochGetCommand, 0, 152))
  const parser = new ModernProtocolParser()
  let payload
  parser.on('response', response => { payload = response.data })
  parser.feed(framed)
  assert.equal(payload.length, 152)
  assert.equal(decodeOutputChannels(payload, ini).performance.rollingPopBangFuelCorr, 100)
  port.close()
})
