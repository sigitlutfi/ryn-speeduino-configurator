import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { assertStoppedForReset, validateConnectedECU, recoverECUConnection, createAutoReconnect, disconnectECU } from '../src/renderer/core/services/ecuRecovery.js'
import { createConnectionSlice } from '../src/renderer/core/store/connectionSlice.js'
import { createSerialQueue, closeSerialPort } from '../src/main/serial-lifecycle.js'
import { decodeOutputChannels } from '../src/shared/protocol/output-channels.js'
import { parseIni } from '../src/shared/ini-parser.js'

const stopped = () => ({ rpm: 0, engine: { running: false, cranking: false }, outputChannels: { burnPending: 0, testenabled: 0, testactive: 0 } })
function fixture() {
  let state = { projectEpoch: 1, currentProject: {}, settings: { autoReconnect: true, lastSerialPort: 'COM20' } }
  const set = patch => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) } }
  state = { ...state, ...createConnectionSlice(set) }
  return { get: () => state, set }
}

test('USB reset rejects unknown/running/cranking engine, pending burn and output tests', () => {
  assert.doesNotThrow(() => assertStoppedForReset(stopped()))
  for (const patch of [{ rpm: 1 }, { rpm: null }, { engine: { running: null, cranking: false } },
    { engine: { running: false, cranking: true } }, { outputChannels: { burnPending: 1 } },
    { outputChannels: { burnPending: 0, testenabled: 1, testactive: 0 } },
    { outputChannels: { burnPending: 0, testenabled: 0, testactive: 1 } }, { outputChannels: {} }]) {
    assert.throws(() => assertStoppedForReset({ ...stopped(), ...patch }))
  }
})

test('reset safety uses real INI output test and EEPROM bit decoding', () => {
  const ini = parseIni(readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8'))
  const packet = Buffer.alloc(ini.outputChannels.ochBlockSize)
  packet[152] = 1; packet[163] = 100; packet[165] = 7; packet[166] = 1
  assert.doesNotThrow(() => assertStoppedForReset(decodeOutputChannels(packet, ini)))
  for (const bit of [1, 2]) {
    packet[39] = bit
    assert.throws(() => assertStoppedForReset(decodeOutputChannels(packet, ini)), /output test/)
  }
})

test('recovery readiness requires successful CRC comparison and a fresh telemetry response', async () => {
  const events = []
  const options = { check() {}, compare: async () => { events.push('crc'); return { ok: true, matching: [1] } },
    readTelemetry: async () => { events.push('telemetry'); return stopped() } }
  assert.equal((await validateConnectedECU(options)).status, 'ready')
  assert.deepEqual(events, ['crc', 'telemetry'])
  assert.equal((await validateConnectedECU({ ...options, compare: async () => ({ ok: true, different: [1] }) })).status, 'review')
  for (const comparison of [{ ok: false }, { ok: true, errors: [14] }]) {
    await assert.rejects(validateConnectedECU({ ...options, compare: async () => comparison, readTelemetry: () => assert.fail('must not publish telemetry') }), /comparison failed/)
  }
  await assert.rejects(validateConnectedECU({ ...options, readTelemetry: async () => ({ rpm: 0 }) }), /incomplete telemetry/)
  let current = true
  await assert.rejects(validateConnectedECU({ ...options, check: () => { if (!current) throw new Error('context changed') },
    compare: async () => { current = false; return { ok: true } } }), /context changed/)
})

test('reconnect waits for port reappearance, retries open failure and waits beyond handshake', async () => {
  const f = fixture(), events = []; let clock = 0, lists = 0, opens = 0, samples = 0
  const serial = {
    listPorts: async () => ++lists === 1 ? [] : [{ path: 'COM20' }],
    disconnect: async () => { f.get().setConnectionStatus('disconnected'); events.push('close') },
    connect: async () => {
      events.push('open'); opens++
      if (opens === 1) return { ok: false, error: 'COM not ready' }
      f.get().setConnectionStatus('connected'); f.get().setConnectionHandshakeStatus('ok')
      f.get().setConnectionValidation('checking')
      return { ok: true }
    },
  }
  const result = await recoverECUConnection({ serial, getState: f.get, port: 'COM20', now: () => clock,
    wait: async ms => { clock += ms; if (f.get().connection.validationStatus === 'checking' && ++samples === 3) f.get().setConnectionValidation('review') } })
  assert.equal(result.ok, true); assert.equal(result.review, true)
  assert.equal(lists, 3); assert.equal(opens, 2); assert.equal(samples, 3)
  assert.deepEqual(events, ['close', 'open', 'close', 'close', 'open'])
})

test('validation failure does not reopen the ECU or report success; recovery has a deadline', async () => {
  for (const fail of [true, false]) {
    const f = fixture(); let clock = 0, opens = 0
    const serial = { listPorts: async () => [{ path: 'COM20' }], disconnect: async () => f.get().setConnectionStatus('disconnected'),
      connect: async () => { opens++; if (fail) { f.get().setConnectionStatus('connected'); f.get().setConnectionValidation('failed', 'CRC failed') }; return { ok: true } } }
    const result = await recoverECUConnection({ serial, getState: f.get, port: 'COM20', attempts: 2,
      now: () => clock, timeout: 200, wait: async ms => { clock += ms } })
    assert.equal(result.ok, false)
    assert.equal(opens, fail ? 1 : 2)
    assert.match(result.error, fail ? /CRC failed/ : /timed out/)
  }
})

test('recovery cancels when project changes during port enumeration', async () => {
  const f = fixture()
  await assert.rejects(recoverECUConnection({ getState: f.get, port: 'COM20',
    check: () => { if (f.get().projectEpoch !== 1) throw new Error('project changed') },
    serial: { listPorts: async () => { f.set({ projectEpoch: 2 }); return [{ path: 'COM20' }] }, connect: () => assert.fail('stale connect') } }), /project changed/)
})

test('auto recovery backs off, respects manual Disconnect/operations, retries missing ports and rearms after a session', async () => {
  const f = fixture(); let clock = 0, calls = 0
  const warnings = []
  const tick = createAutoReconnect({ getState: f.get, now: () => clock, connect: async () => { calls++ }, onError: error => warnings.push(error.message) })
  await tick(); await tick(); assert.equal(calls, 1)
  clock += 1000; await tick(); assert.equal(calls, 2)
  f.get().setAutoReconnectPaused(true); clock += 10000; await tick(); assert.equal(calls, 2)
  f.get().setAutoReconnectPaused(false); f.set({ operation: {} }); await tick(); assert.equal(calls, 2)
  f.set({ operation: null }); await tick(); assert.equal(calls, 3)
  for (let i = 0; i < 20; i++) { clock += 10000; await tick() }
  assert.equal(calls, 10); assert.equal(warnings.length, 1)
  f.get().setConnectionStatus('connected'); await tick()
  f.get().setConnectionStatus('disconnected'); await tick(); assert.equal(calls, 11)
})

test('duplicate connected status cannot fabricate a fresh reconnect timestamp/session', () => {
  const f = fixture()
  f.get().setConnectionStatus('connected')
  const before = f.get().connection
  f.get().setConnectionValidation('ready')
  f.get().setConnectionStatus('connected')
  assert.equal(f.get().connection.lastConnectedAt, before.lastConnectedAt)
  assert.equal(f.get().connection.sessionId, before.sessionId)
  assert.equal(f.get().connection.validationStatus, 'ready')
})

function mainResetFixture(port) {
  const handlers = {}, events = []
  const context = vm.createContext({ activePort: port, activeFirmwareFlash: null, activeECUReset: false, firmwareOperationReserved: false,
    fs: { existsSync: () => true }, path: { basename: value => value },
    resolveAvrdudeTooling: () => ({ source: 'fixture' }), runAvrdudeJob: async () => ({ ok: true }),
    serialConnectGeneration: 1, serialQueue: createSerialQueue(), closeSerialPort,
    mainWindow: { webContents: { send: (...args) => events.push(args) } },
    pulsePortResetLines: async instance => { events.push(['pulse', instance.path]); if (instance.failPulse) throw new Error('DTR failed') },
    delay: async () => {}, emitFirmwareStatus: event => events.push(event),
    ipcMain: { handle: (name, fn) => { handlers[name] = fn } } })
  const source = readFileSync(new URL('../src/main/index.js', import.meta.url), 'utf8')
  const start = source.indexOf('ipcMain.handle("firmware:reboot"'), end = source.indexOf('\nipcMain.handle("project:pick-directory"', start)
  vm.runInContext(source.slice(start, end), context)
  for (const channel of ['serial:connect', 'serial:disconnect', 'firmware:flash', 'firmware:reset-eeprom']) {
    const a = source.search(new RegExp(`ipcMain\\.handle\\(["']${channel}["']`)), b = source.indexOf('\n});', a) + 4
    vm.runInContext(source.slice(a, b), context)
  }
  context.closeActivePortForFlash = async () => {
    context.serialConnectGeneration++
    await context.serialQueue(async () => { await closeSerialPort(context.activePort); context.activePort = null })
  }
  return { context, events, handlers, reboot: payload => handlers['firmware:reboot'](null, payload) }
}

test('main reset drains the serial queue, reserves firmware access, closes handle and invalidates session', async () => {
  const port = { path: 'COM20', isOpen: true, close(cb) { this.isOpen = false; cb() } }
  const f = mainResetFixture(port); let finish
  const write = f.context.serialQueue(() => new Promise(resolve => { finish = resolve }))
  await Promise.resolve()
  const reset = f.reboot({ port: 'COM20' })
  assert.equal(f.context.activeECUReset, true)
  assert.equal((await f.reboot({ port: 'COM20' })).ok, false)
  assert.equal((await f.handlers['serial:connect'](null, 'COM21', 115200)).ok, false)
  await assert.rejects(f.handlers['serial:disconnect'](), /owns the serial port/)
  assert.equal(f.context.serialConnectGeneration, 1)
  assert.equal(f.events.length, 0)
  finish(); await write
  assert.equal((await reset).ok, true)
  assert.ok(f.events.some(event => event[0] === 'pulse'))
  assert.equal(port.isOpen, false); assert.equal(f.context.activePort, null)
  assert.equal(f.context.serialConnectGeneration, 2)
  assert.equal(f.context.activeECUReset, false); assert.equal(f.context.activeFirmwareFlash, null)
})

test('main reset rejects a wrong port and closes/releases the transport after pulse failure', async () => {
  const port = { path: 'COM20', isOpen: true, close(cb) { this.isOpen = false; cb() } }
  const wrong = mainResetFixture(port)
  assert.equal((await wrong.reboot({ port: 'COM21' })).ok, false)
  assert.equal(wrong.events.some(event => event[0] === 'pulse'), false)
  assert.equal(port.isOpen, true)
  port.failPulse = true
  const failed = mainResetFixture(port)
  assert.equal((await failed.reboot({ port: 'COM20' })).ok, false)
  assert.equal(port.isOpen, false); assert.equal(failed.context.activeECUReset, false)
})


test('manual cancellation token prevents recovery from reopening a closed connection', async () => {
  const f = fixture(), generation = f.get().connection.recoveryGeneration
  await assert.rejects(recoverECUConnection({ getState: f.get, port: 'COM20',
    check: () => { if (f.get().connection.recoveryGeneration !== generation) throw new Error('manual disconnect') },
    serial: { listPorts: async () => { f.get().cancelConnectionRecovery(); return [{ path: 'COM20' }] }, connect: () => assert.fail('manual disconnect ignored') } }), /manual disconnect/)
  assert.equal(f.get().connection.autoReconnectPaused, true)
})


test('native firmware preflight reserves the port before asynchronous close or avrdude startup', async () => {
  const port = { path: 'COM20', close(cb) { cb() } }
  const f = mainResetFixture(port); let finish
  const write = f.context.serialQueue(() => new Promise(resolve => { finish = resolve }))
  await Promise.resolve()
  const flash = f.handlers['firmware:flash'](null, { port: 'COM20', hexPath: 'fixture.hex' })
  assert.equal(f.context.firmwareOperationReserved, true)
  assert.equal((await f.reboot({ port: 'COM20' })).ok, false)
  assert.equal((await f.handlers['firmware:reset-eeprom'](null, { port: 'COM20' })).ok, false)
  assert.equal((await f.handlers['serial:connect'](null, 'COM21')).ok, false)
  finish(); await write
  assert.equal((await flash).ok, true)
  assert.equal(f.context.firmwareOperationReserved, false)
})

test('failed firmware preflight releases its reservation without starting avrdude', async () => {
  const f = mainResetFixture({ path: 'COM20', close(cb) { cb(new Error('COM handle locked')) } })
  f.context.runAvrdudeJob = () => assert.fail('avrdude cannot start after close failure')
  assert.match((await f.handlers['firmware:flash'](null, { port: 'COM20', hexPath: 'fixture.hex' })).error, /locked/)
  assert.equal(f.context.firmwareOperationReserved, false)
})


test('late auto enumeration cannot close or replace a manual connection attempt', async () => {
  const f = fixture(); let finishEnumeration, closes = 0
  const auto = recoverECUConnection({ getState: f.get, owner: 'auto', port: 'COM20',
    serial: { listPorts: () => new Promise(resolve => { finishEnumeration = resolve }), disconnect: async () => { closes++ } } })
  const autoCheck = assert.rejects(auto, /superseded|cancelled/)
  assert.equal(f.get().connection.connectionAttempt.owner, 'auto')
  f.get().cancelConnectionRecovery(); f.get().setAutoReconnectPaused(false)
  const manual = f.get().beginConnectionAttempt('manual')
  f.get().setConnectionStatus('connecting')
  finishEnumeration([{ path: 'COM20' }])
  await autoCheck
  assert.equal(closes, 0)
  assert.equal(f.get().connection.connectionAttempt, manual, 'old finally must not release the new owner')
  assert.equal(f.get().connection.status, 'connecting')
})

test('only one recovery may enumerate/open; the lease is released after enumeration failure', async () => {
  const f = fixture(); let fail
  const first = recoverECUConnection({ getState: f.get, port: 'COM20', serial: { listPorts: () => new Promise((resolve, reject) => { fail = reject }) } })
  const checked = assert.rejects(first, /enumeration failed/)
  await assert.rejects(recoverECUConnection({ getState: f.get, port: 'COM21', serial: { listPorts: () => assert.fail('competing enumeration') } }), /attempt is running/)
  fail(new Error('enumeration failed')); await checked
  assert.equal(f.get().connection.connectionAttempt, null)
})

test('a delayed manual Disconnect completion cannot overwrite the next Connect state', async () => {
  const f = fixture(); f.get().setConnectionStatus('connected')
  let finish
  const closing = disconnectECU({ getState: f.get, serial: { disconnect: () => new Promise(resolve => { finish = resolve }) } })
  assert.equal(f.get().connection.status, 'disconnecting')
  f.get().cancelConnectionRecovery(); f.get().setAutoReconnectPaused(false)
  const attempt = f.get().beginConnectionAttempt('manual')
  f.get().setConnectionStatus('connecting')
  finish(); await closing
  assert.equal(f.get().connection.status, 'connecting')
  assert.equal(f.get().connection.connectionAttempt, attempt)
})


test('actual App status handler ignores duplicate connect and a handshake completed after manual cancellation', async () => {
  const f = fixture(); let status, finish, handshakes = 0
  const handlers = { setConnectionStatus: f.get().setConnectionStatus,
    setConnectionTransportStatus: f.get().setConnectionTransportStatus,
    setConnectionHandshakeStatus: f.get().setConnectionHandshakeStatus,
    notify() {}, addConnectionEvent() {}, openIniMismatchDialog() {}, closeIniMismatchDialog() {}, clearRuntimeProfileSession() {} }
  const context = vm.createContext({ ...handlers, console: { log() {}, warn() {}, error() {} },
    useStore: { getState: f.get }, window: { serial: { onStatus: fn => { status = fn } } },
    serialService: { reset() {}, handshake() { handshakes++; return new Promise(resolve => { finish = resolve }) } } })
  f.set({ updateECUConnectionInfo() {} })
  const source = readFileSync(new URL('../src/renderer/App.jsx', import.meta.url), 'utf8')
  const a = source.indexOf('    let transportGeneration ='), b = source.indexOf('\n    return () => {', a)
  vm.runInContext(source.slice(a, b), context)
  await status('connecting')
  const first = status('connected')
  await status('connected')
  assert.equal(handshakes, 1)
  finish({ signature: 'fixture' }); await first
  assert.equal(f.get().connection.status, 'connected')
  await status('connecting')
  const second = status('connected')
  f.get().cancelConnectionRecovery(); f.get().setConnectionStatus('disconnecting')
  finish({ signature: 'fixture' }); await second
  assert.equal(f.get().connection.status, 'disconnecting')
  assert.equal(handshakes, 2)
})
