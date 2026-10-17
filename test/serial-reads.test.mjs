import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseIni } from '../src/shared/ini-parser.js'
import { ModernProtocolParser } from '../src/shared/protocol/response-parser.js'
import { formatReadCommand, wrapModernProtocol } from '../src/shared/protocol/ecu-commands.js'
import { serialService, SerialService } from '../src/renderer/core/services/serialService.js'

const ini = parseIni(readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8'))
const size = ini.outputChannels.ochBlockSize

function payload(length) {
  const data = Buffer.alloc(length)
  if (length === size) {
    data[152] = 1
    data[163] = 100
    data[165] = 7
    data[166] = 1
  }
  return data
}

function transport(t, deliver) {
  const previous = globalThis.window
  const listeners = new Set(), timers = []
  globalThis.window = { serial: {
    onData(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    async sendCommand() {
      deliver(bytes => { for (const fn of listeners) fn(bytes) }, (fn, ms) => timers.push(setTimeout(fn, ms)))
      return { ok: true }
    },
  } }
  t.after(() => {
    timers.forEach(clearTimeout)
    serialService.reset()
    if (previous === undefined) delete globalThis.window
    else globalThis.window = previous
  })
  return listeners
}

for (const [name, length, read] of [
  ['page', 64, () => serialService.readPageBuffer(formatReadCommand(1, 0, 64), 64, 500)],
  ['telemetry', size, () => serialService.readOutputChannels(ini, { timeout: 500 })],
]) {
  test(`${name} rejects corrupt frames instead of decoding their header as raw data`, async t => {
    const frame = wrapModernProtocol(Buffer.concat([Buffer.from([0]), payload(length)]))
    frame[frame.length - 1] ^= 1
    const listeners = transport(t, emit => queueMicrotask(() => emit(frame)))
    await assert.rejects(read(), /CRC validation/)
    assert.equal(listeners.size, 0)
  })

  test(`${name} reports ECU errors immediately, including fragmented errors`, async t => {
    const frame = wrapModernProtocol(Buffer.from([0x84]))
    const listeners = transport(t, (emit, later) => {
      queueMicrotask(() => emit(frame.subarray(0, 2)))
      later(() => emit(frame.subarray(2)), 5)
    })
    await assert.rejects(read(), /0x84/)
    assert.equal(listeners.size, 0)
  })

  test(`${name} rejects an unexpected successful payload size`, async t => {
    const frame = wrapModernProtocol(Buffer.concat([Buffer.from([0]), Buffer.alloc(length + 1)]))
    transport(t, emit => queueMicrotask(() => emit(frame)))
    await assert.rejects(read(), /payload length/)
  })

  test(`${name} waits for a delayed CRC even after enough bytes for raw fallback`, async t => {
    const frame = wrapModernProtocol(Buffer.concat([Buffer.from([0]), payload(length)]))
    let crcArrived = false
    transport(t, (emit, later) => {
      queueMicrotask(() => emit(frame.subarray(0, -4)))
      later(() => { crcArrived = true; emit(frame.subarray(-4)) }, 90)
    })
    await read()
    assert.equal(crcArrived, true)
  })

  test(`${name} consumes a complete response delivered in three-byte chunks without logging`, async t => {
    t.mock.method(console, 'log')
    const frame = wrapModernProtocol(Buffer.concat([Buffer.from([0]), payload(length)]))
    const listeners = transport(t, emit => queueMicrotask(() => {
      for (let i = 0; i < frame.length; i += 3) emit(frame.subarray(i, i + 3))
    }))
    await read()
    assert.equal(listeners.size, 0)
    assert.equal(console.log.mock.callCount(), 0)
  })
}

test('open-ended raw passthrough neither logs nor retains duplicate incoming bytes', t => {
  t.mock.method(console, 'log')
  const parser = new ModernProtocolParser()
  let received = 0
  parser.on('rawData', chunk => { received += chunk.length })
  parser.enableRawMode(0)
  for (let i = 0; i < 1000; i++) parser.feed(Buffer.alloc(3))
  assert.equal(received, 3000)
  assert.equal(parser.buffer.length, 0)
  assert.equal(console.log.mock.callCount(), 0)
  parser.disableRawMode()
})

test('failed bridge send cleans up and allows the next page transaction', async t => {
  const listeners = transport(t, emit => queueMicrotask(() => emit(wrapModernProtocol(Buffer.from([0, 42])))))
  const send = window.serial.sendCommand
  window.serial.sendCommand = () => { throw new Error('Port disconnected') }
  await assert.rejects(serialService.readPageBuffer(formatReadCommand(1, 0, 1), 1), /Port disconnected/)
  assert.equal(listeners.size, 0)
  window.serial.sendCommand = send
  assert.deepEqual(await serialService.readPageBuffer(formatReadCommand(1, 0, 1), 1), Buffer.from([42]))
})

test('reset cancels an active read and prevents queued old-session commands from reaching USB', async t => {
  let sent = 0
  const listeners = transport(t, () => { sent++ })
  const active = serialService.readPageBuffer(formatReadCommand(14, 0, 64), 64)
  const queued = serialService.writePage(14, 0, 1, [42])
  const activeCheck = assert.rejects(active, /session changed/)
  const queuedCheck = assert.rejects(queued, /session changed/)
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(sent, 1)
  serialService.reset()
  await Promise.all([activeCheck, queuedCheck])
  assert.equal(sent, 1)
  assert.equal(listeners.size, 0)
  assert.equal(serialService.cancelTransactions.size, 0)
  assert.equal(serialService.commandInFlightCount, 0)
})

test('destroy retires the old poller and its listeners before a replacement service starts', async t => {
  let sent = 0
  const listeners = transport(t, () => { sent++ })
  const previous = new SerialService()
  previous.startOutputChannelsPolling(ini, { intervalMs: 5 })
  await new Promise(resolve => setTimeout(resolve, 15))
  assert.equal(sent, 1)
  previous.destroy()
  assert.equal(listeners.size, 0)
  await new Promise(resolve => setTimeout(resolve, 15))
  assert.equal(sent, 1)
  const replacement = new SerialService()
  t.after(() => replacement.destroy())
  const read = replacement.readPageBuffer(formatReadCommand(14, 0, 1), 1)
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(sent, 2)
  for (const fn of listeners) fn(wrapModernProtocol(Buffer.from([0, 42])))
  assert.deepEqual(await read, Buffer.from([42]))
})

test('legacy handshake listeners and timers are retired on reset too', async t => {
  const listeners = transport(t, emit => queueMicrotask(() => emit(Buffer.from('speeduino 202504-ryn-perf-v5'))))
  const read = serialService.sendLegacyCommand('Q', { settleMs: 100 })
  const check = assert.rejects(read, /session changed/)
  await new Promise(resolve => setTimeout(resolve, 5))
  serialService.reset()
  await check
  assert.equal(listeners.size, 0)
  assert.equal(serialService.cancelTransactions.size, 0)
})

test('generic Drive Mode responses use the same cancellable receive path', async t => {
  transport(t, emit => queueMicrotask(() => emit(wrapModernProtocol(Buffer.from([0, 1, 0, 0])))))
  const reply = await serialService.sendCommand(wrapModernProtocol(Buffer.from([68, 0])))
  assert.deepEqual(reply.data, Buffer.from([1, 0, 0]))
  assert.equal(serialService.cancelTransactions.size, 0)
})

test('changing the polling INI discards an old in-flight sample and labels new samples with their source', async t => {
  let sent = 0
  const frame = wrapModernProtocol(Buffer.concat([Buffer.from([0]), payload(size)]))
  transport(t, (emit, later) => {
    sent++
    if (sent === 1) later(() => emit(frame), 25)
    else queueMicrotask(() => emit(frame))
  })
  const service = new SerialService(), sources = []
  t.after(() => service.destroy())
  const replacement = structuredClone(ini)
  service.onRealtime((_rt, source) => sources.push(source.ini))
  service.startOutputChannelsPolling(ini, { intervalMs: 10 })
  await new Promise(resolve => setTimeout(resolve, 5))
  service.startOutputChannelsPolling(replacement, { intervalMs: 10 })
  await new Promise(resolve => setTimeout(resolve, 65))
  assert.ok(sources.length > 0)
  assert.ok(sources.every(source => source === replacement))
})

test('configuring telemetry during an exclusive operation waits until resume before sending', async t => {
  let sent = 0
  const frame = wrapModernProtocol(Buffer.concat([Buffer.from([0]), payload(size)]))
  transport(t, emit => { sent++; queueMicrotask(() => emit(frame)) })
  const service = new SerialService()
  t.after(() => service.destroy())
  service.suspendOutputChannelsPolling()
  service.startOutputChannelsPolling(ini)
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(sent, 0)
  service.resumeOutputChannelsPolling()
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(sent, 1)
})


test('suspend/resume during an in-flight telemetry read cannot leave the replacement poller stuck', async t => {
  const service = new SerialService(); t.after(() => service.destroy())
  let finish, sent = 0
  service.readOutputChannels = async () => {
    sent++
    if (sent === 1) return new Promise(resolve => { finish = resolve })
    return { rpm: 0 }
  }
  service.startOutputChannelsPolling(ini, { intervalMs: 5 })
  service.suspendOutputChannelsPolling()
  service.resumeOutputChannelsPolling()
  assert.equal(sent, 1)
  finish({ rpm: 0 })
  await new Promise(resolve => setTimeout(resolve, 25))
  assert.ok(sent > 1, 'the previous poll must release its busy flags even after pollGeneration changes')
})

test('stopping a poller does not claim its wire transaction has drained', async t => {
  const service = new SerialService(); t.after(() => service.destroy())
  let finish; const emitted = []
  service.readOutputChannels = () => new Promise(resolve => { finish = resolve })
  service.onRealtime(value => emitted.push(value))
  service.startOutputChannelsPolling(ini)
  service.stopOutputChannelsPolling()
  assert.equal(service.realtimeReadInFlight, true)
  assert.equal(service.outputChannelsPollRunning, true)
  finish({ rpm: 999 })
  await Promise.resolve(); await Promise.resolve()
  assert.equal(service.realtimeReadInFlight, false)
  assert.equal(service.outputChannelsPollRunning, false)
  assert.deepEqual(emitted, [])
})

test('cleanup from an older serial session cannot resume a new exclusive operation', t => {
  const service = new SerialService(); t.after(() => service.destroy())
  const oldSession = service.sessionGeneration
  service.suspendOutputChannelsPolling()
  service.reset()
  service.suspendOutputChannelsPolling()
  service.resumeOutputChannelsPolling(oldSession)
  assert.equal(service.outputChannelsSuspendCount, 1)
  service.resumeOutputChannelsPolling(service.sessionGeneration)
  assert.equal(service.outputChannelsSuspendCount, 0)
})

test('a handshake waiting for boot cannot send commands into a newer session or clear its readiness', async t => {
  const service = new SerialService(); t.after(() => service.destroy())
  let finishBoot
  service._bootDelay = () => new Promise(resolve => { finishBoot = resolve })
  service.flush = () => assert.fail('old handshake flushed a new session')
  const handshake = service.handshake(), checked = assert.rejects(handshake, /session changed/)
  service.reset(); service.isReady = true
  finishBoot(); await checked
  assert.equal(service.isReady, true)
})


test('completion from a reset poller cannot clear the busy flags or emit into the replacement session', async t => {
  const service = new SerialService(); t.after(() => service.destroy())
  const finishes = [], emitted = []
  service.readOutputChannels = () => new Promise(resolve => finishes.push(resolve))
  service.onRealtime(value => emitted.push(value.rpm))
  service.startOutputChannelsPolling(ini, { intervalMs: 10000 })
  service.reset()
  service.startOutputChannelsPolling(ini, { intervalMs: 10000 })
  finishes[0]({ rpm: 111 })
  await Promise.resolve(); await Promise.resolve()
  assert.equal(service.realtimeReadInFlight, true)
  assert.deepEqual(emitted, [])
  finishes[1]({ rpm: 222 })
  await Promise.resolve(); await Promise.resolve()
  assert.equal(service.realtimeReadInFlight, false)
  assert.deepEqual(emitted, [222])
})
