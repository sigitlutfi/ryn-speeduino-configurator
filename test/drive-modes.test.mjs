import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Buffer } from 'buffer'
import { parseIni } from '../src/shared/ini-parser.js'
import { parsePage } from '../src/shared/protocol/binary-parser.js'
import {
  driveCRC,
  encodeDriveConfig,
  decodeDriveConfig,
  parseDriveStatus,
  driveSelectCommand
} from '../src/shared/protocol/drive-modes.js'
import {
  canMigrateDriveModes,
  migrateDriveModeProject
} from '../src/shared/protocol/drive-mode-migration.js'
import { createPageSnapshot, decodePageSnapshot } from '../src/shared/protocol/page-cache.js'
import { parseRealtime } from '../src/shared/protocol/realtime.js'
import { decodeOutputChannels } from '../src/shared/protocol/output-channels.js'
import { buildProjectInitialization } from '../src/renderer/features/projects/projectInitialization.js'
import { createDriveModesSlice } from '../src/renderer/core/store/slices/drive.modes.js'
import { createConnectionSlice } from '../src/renderer/core/store/connectionSlice.js'
import { assertWritableContract } from '../src/shared/protocol/contract.js'
import { serialService } from '../src/renderer/core/services/serialService.js'
import { createMockSerial } from '../src/shared/protocol/mock-serial.js'
import { ModernProtocolParser } from '../src/shared/protocol/response-parser.js'
import { formatWriteCommand } from '../src/shared/protocol/ecu-commands.js'

const content = readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8')
const ini = parseIni(content, { CELSIUS: true })
const neutral = encodeDriveConfig()
const statusBytes = (changes = {}) => {
  const p = {
    active: 0,
    requested: 0,
    state: 0,
    reason: 0,
    token: 0,
    applied: 0,
    crc: neutral.readUInt16LE(16),
    ...changes
  }
  const b = Buffer.from([
    1,
    p.active,
    p.requested,
    p.state,
    p.reason,
    0,
    0,
    0,
    0,
    0,
    0,
    100,
    0,
    7,
    1
  ])
  b.writeUInt16LE(p.token, 5)
  b.writeUInt16LE(p.applied, 7)
  b.writeUInt16LE(p.crc, 9)
  return b
}
function fixture(t, options = {}) {
  const page = Buffer.alloc(256)
  neutral.copy(page, 106)
  const snapshot = createPageSnapshot({ pageId: 15, size: 256, buffer: page })
  let state = {
    projectEpoch: 1,
    parsedIni: ini,
    currentProject: {
      constants: {
        pages: { 15: snapshot },
        decodedPages: { 15: parsePage(page, ini.constants.pages[15]) }
      }
    },
    connection: {
      status: 'connected',
      handshakeStatus: 'ok',
      sessionId: 1,
      firmwareSignature: ini.info.signature
    },
    fieldDrafts: {},
    tableDrafts: {},
    runtimeProfileSession: { state: 'Base' },
    operation: null,
    setOperation: (operation) => {
      state.operation = operation
    },
    clearOperation: () => {
      state.operation = null
    }
  }
  const set = (update) => {
    state = { ...state, ...(typeof update === 'function' ? update(state) : update) }
  }
  const get = () => state
  state = { ...state, ...createDriveModesSlice(set, get) }
  let actual = statusBytes(),
    selections = 0,
    writes = 0
  t.mock.method(serialService, 'enterExclusiveMode', async () => {})
  t.mock.method(serialService, 'resumeOutputChannelsPolling', () => {})
  t.mock.method(serialService, 'sendCommand', async (command) => {
    const p = command.subarray(2, command.length - 4)
    if (p[1] === 1) {
      selections++
      actual = statusBytes({
        active: options.timeout ? 0 : p[2],
        requested: p[2],
        token: p.readUInt16LE(3),
        applied: options.timeout ? 0 : p.readUInt16LE(3),
        state: options.timeout ? 2 : 0,
        reason: options.timeout ? 7 : 0
      })
      if (options.lostAck) throw new Error('Command timeout')
    }
    options.onCommand?.(set, p)
    return { status: 0, data: Buffer.from(actual) }
  })
  t.mock.method(
    serialService,
    'readOutputChannels',
    async () => options.telemetry || { rpm: 0, tps: 0, engine: { running: false, cranking: false } }
  )
  t.mock.method(serialService, 'writePage', async (id, offset, length, bytes) => {
    writes++
    Buffer.from(bytes).copy(page, offset)
    options.onWrite?.(page)
  })
  state.readPageFromECU = async () => ({ buffer: Buffer.from(page) })
  return {
    get,
    set,
    page,
    selections: () => selections,
    writes: () => writes,
    status: (next) => {
      actual = next
    }
  }
}

test('Drive Mode CRC and neutral configuration match the AVR golden vector', () => {
  assert.equal(driveCRC(Buffer.from('123456789')), 0x29b1)
  assert.equal(neutral.toString('hex'), '444d0105640007006400070064000700b387')
  assert.deepEqual(encodeDriveConfig(decodeDriveConfig(neutral)), neutral)
  const corrupted = Buffer.from(neutral)
  corrupted[4] ^= 1
  assert.throws(() => decodeDriveConfig(corrupted), /checksum/)
  assert.throws(
    () =>
      encodeDriveConfig({
        maxTPS: 5,
        presets: [
          { fuel: 70, ignition: 0, features: 7 },
          ...decodeDriveConfig(neutral).presets.slice(1)
        ]
      }),
    /80..120/
  )
})
test('mode status has identical INI and fallback decoding, including signed ignition', () => {
  const bytes = Buffer.alloc(167)
  statusBytes({ active: 2, requested: 2, token: 65535, applied: 65535 }).copy(bytes, 152)
  bytes.writeInt8(-7, 164)
  const legacy = parseRealtime(bytes).driveMode
  assert.deepEqual(decodeOutputChannels(bytes, ini).driveMode, legacy)
  assert.equal(legacy.ignition, -7)
  assert.equal(legacy.requestToken, 65535)
  assert.equal(parseRealtime(Buffer.alloc(152)).driveMode, null)
  assert.throws(() => parseDriveStatus(Buffer.alloc(15)), /Invalid/)
})
test('new blank and base tune projects initialize neutral ECU presets', () => {
  for (const initBaseTune of [false, true]) {
    const result = buildProjectInitialization({
      parsedIni: ini,
      selectedBoardLayout: 3,
      engine: { cylinders: 4, displacement: 1600, injectorFlow: 250, injectorOpenTime: 1 },
      initBaseTune
    })
    assert.deepEqual(decodePageSnapshot(result.constants.pages[15]).subarray(106, 124), neutral)
  }
})
test('v4 migration changes only reserved bytes in tune and both restore points', () => {
  const oldContent = content
    .replace('ryn-perf-v5', 'ryn-perf-v4')
    .replace('ochBlockSize     =  167', 'ochBlockSize     =  152')
    .replace(/^\s+drive\w+\s*=\s*scalar[^\n]*\n/gm, '\n')
    .replace(
      /Unused15_124_255\s*= array[^\n]*/,
      'Unused15_106_255 = array, U08, 106, [150], "%", 1, 0, 0, 255, 0'
    )
  const oldIni = parseIni(oldContent, { CELSIUS: true })
  assert.equal(canMigrateDriveModes(oldIni, ini), true)
  const raw = Buffer.from(Array.from({ length: 256 }, (_, i) => i))
  const constants = { pages: { 15: createPageSnapshot({ pageId: 15, size: 256, buffer: raw }) } }
  const oldProject = {
    constants,
    runtimeProfiles: { eco: { old: 'retained' } },
    initialization: { restorePoints: { blankCanvas: { constants }, baseTune: { constants } } }
  }
  const migrated = migrateDriveModeProject(oldProject, oldIni, ini)
  for (const value of [
    migrated.constants,
    ...Object.values(migrated.initialization.restorePoints).map((point) => point.constants)
  ]) {
    const after = decodePageSnapshot(value.pages[15])
    assert.deepEqual(after.subarray(0, 106), raw.subarray(0, 106))
    assert.deepEqual(after.subarray(124), raw.subarray(124))
    assert.deepEqual(after.subarray(106, 124), neutral)
  }
  assert.deepEqual(migrated.runtimeProfiles, oldProject.runtimeProfiles)
  assert.deepEqual(decodePageSnapshot(oldProject.constants.pages[15]), raw)
  const changed = parseIni(
    content.replace('driveEcoFuel = scalar, U08, 110', 'driveEcoFuel = scalar, U08, 111'),
    { CELSIUS: true }
  )
  assert.equal(canMigrateDriveModes(oldIni, changed), false)
})
test('selection while engine runs only sends D; it never writes or burns tables', async (t) => {
  const f = fixture(t, { telemetry: { rpm: 3000, tps: 40, engine: { running: true } } })
  const result = await f.get().selectDriveMode(2)
  assert.equal(result.active, 2)
  assert.equal(f.get().driveModeStatus.active, 2)
  assert.equal(f.selections(), 1)
  assert.equal(f.writes(), 0)
  assert.equal(f.get().operation, null)
})
test('a lost selection ACK is reconciled using ECU status without replay', async (t) => {
  const f = fixture(t, { lostAck: true })
  assert.equal((await f.get().selectDriveMode(1)).active, 1)
  assert.equal(f.selections(), 1)
})
test('ECU switch timeout preserves the confirmed previous mode and reason', async (t) => {
  const f = fixture(t, { timeout: true })
  await assert.rejects(f.get().selectDriveMode(1), /kedaluwarsa/)
  assert.equal(f.get().driveModeStatus.active, 0)
  assert.equal(f.get().driveModeStatus.state, 2)
})
test('switch refuses mismatched preset CRC and pending tune drafts before selection', async (t) => {
  const f = fixture(t)
  f.status(statusBytes({ crc: 123 }))
  await assert.rejects(f.get().selectDriveMode(1), /Upload and verify/)
  f.set({ fieldDrafts: { 15: { driveEcoFuel: 95 } } })
  await assert.rejects(f.get().selectDriveMode(1), /pending tune edits/)
  assert.equal(f.selections(), 0)
})
test('DEFAULT remains reachable after project presets change or drafts are staged', async (t) => {
  const f = fixture(t)
  f.status(statusBytes({ active: 1, requested: 1, token: 2, applied: 2, crc: 123 }))
  f.set({ fieldDrafts: { 15: { driveEcoFuel: 95 } } })
  assert.equal((await f.get().selectDriveMode(0)).active, 0)
  assert.equal(f.selections(), 1)
})
test('session changes during the transaction cannot update active mode', async (t) => {
  const f = fixture(t, {
    onCommand(set) {
      set({ connection: { status: 'disconnected', sessionId: 2 } })
    }
  })
  await assert.rejects(f.get().selectDriveMode(1), /connection changed/)
  assert.equal(f.get().driveModeStatus, null)
  assert.equal(f.selections(), 0)
})
test('token wrap reads ECU token then starts the next request at one', async (t) => {
  const f = fixture(t)
  f.status(statusBytes({ token: 65535, applied: 65535 }))
  const result = await f.get().selectDriveMode(3)
  assert.equal(result.requestToken, 1)
})
test('upload is engine-stopped only and verifies exactly the reserved region', async (t) => {
  const f = fixture(t)
  f.page[105] = 47
  f.page[124] = 53
  f.set({
    currentProject: {
      ...f.get().currentProject,
      constants: {
        ...f.get().currentProject.constants,
        pages: { 15: createPageSnapshot({ pageId: 15, size: 256, buffer: f.page }) }
      }
    }
  })
  await f.get().uploadDriveModeConfig()
  assert.equal(f.writes(), 1)
  assert.equal(f.page[105], 47)
  assert.equal(f.page[124], 53)
  assert.equal(f.get().currentProject.constants.pages[15].syncState, 'burn-pending')
})
test('preset upload refuses unrelated page differences before writing or marking burn pending', async (t) => {
  const f = fixture(t)
  f.page[105] = 1
  await assert.rejects(f.get().uploadDriveModeConfig(), /differs outside Drive Mode/)
  assert.equal(f.writes(), 0)
  assert.notEqual(f.get().currentProject.constants.pages[15].syncState, 'burn-pending')
})
test('upload refuses a running engine before any page write', async (t) => {
  const f = fixture(t, { telemetry: { rpm: 900, engine: { running: true, cranking: false } } })
  await assert.rejects(f.get().uploadDriveModeConfig(), /Stop the engine/)
  assert.equal(f.writes(), 0)
})
test('readback corruption prevents reporting a successful upload', async (t) => {
  const f = fixture(t, {
    onWrite(page) {
      page[110] ^= 1
    }
  })
  await assert.rejects(f.get().uploadDriveModeConfig(), /readback failed/)
})
test('known active drive mode blocks legacy/base tune write guards', (t) => {
  const f = fixture(t)
  f.set({ driveModeStatus: { active: 1, state: 0, session: 1, epoch: 1 } })
  assert.throws(() => assertWritableContract(f.get()), /DEFAULT/)
})
test('disconnect invalidates status without pretending ECU returned to DEFAULT', () => {
  let state = { connection: { status: 'connected', sessionId: 1 }, driveModeStatus: { active: 3 } }
  const slice = createConnectionSlice((update) => {
    state = { ...state, ...update(state) }
  })
  slice.setConnectionStatus('disconnected')
  assert.equal(state.driveModeStatus, null)
})
test('reconnect reads the actual ECU mode and never sends a DEFAULT selection', async (t) => {
  const f = fixture(t)
  f.set({ connection: { ...f.get().connection, sessionId: 2 } })
  f.status(statusBytes({ active: 3, requested: 3, token: 10, applied: 10 }))
  assert.equal((await f.get().readDriveModeStatus()).active, 3)
  assert.equal(f.get().driveModeStatus.session, 2)
  assert.equal(f.selections(), 0)
})
test('unavailable status invalidates mode without replaying a selection', async (t) => {
  const f = fixture(t)
  t.mock.method(serialService, 'sendCommand', async () => {
    throw new Error('Command timeout')
  })
  await assert.rejects(f.get().selectDriveMode(1), /timeout/)
  assert.equal(f.get().driveModeStatus, null)
  assert.equal(f.selections(), 0)
})
test('upload rejects unsaved preset drafts and active legacy presets', async (t) => {
  const f = fixture(t)
  f.set({ fieldDrafts: { 15: { driveEcoFuel: 95 } } })
  await assert.rejects(f.get().uploadDriveModeConfig(), /pending tune edits/)
  f.set({ fieldDrafts: {}, runtimeProfileSession: { state: 'ProfileActive' } })
  await assert.rejects(f.get().uploadDriveModeConfig(), /legacy tune preset/)
  assert.equal(f.writes(), 0)
})
test('mock ECU selects a live mode and rejects stale tokens and drive config writes while running', async () => {
  let resolveResponse
  const port = createMockSerial((bytes) => resolveResponse(bytes), {
    telemetry: () => ({ rpm: 3000, tps: 0, running: true, sync: true })
  })
  const send = (command) =>
    new Promise((resolve) => {
      resolveResponse = (bytes) => {
        const parser = new ModernProtocolParser()
        parser.on('response', resolve)
        parser.on('error', (error) => resolve({ status: error.code, data: error.data }))
        parser.feed(bytes)
      }
      port.write(command)
    })
  const selected = await send(driveSelectCommand(2, 2, neutral.readUInt16LE(16)))
  assert.equal(parseDriveStatus(selected.data).active, 2)
  assert.equal((await send(driveSelectCommand(1, 1, neutral.readUInt16LE(16)))).status, 0x84)
  assert.equal((await send(formatWriteCommand(15, 106, 18, [...neutral]))).status, 0x84)
  port.close()
})


test('an old Drive Mode status failure cannot erase telemetry or the operation of a newer session', async t => {
  const f = fixture(t), status = { active: 2, session: 2, epoch: 1 }, operation = { type: 'replacement', owner: {} }
  t.mock.method(serialService, 'sendCommand', async () => {
    f.set({ connection: { ...f.get().connection, sessionId: 2 }, driveModeStatus: status, operation })
    throw new Error('old session closed')
  })
  await assert.rejects(f.get().readDriveModeStatus(), /old session closed/)
  assert.equal(f.get().driveModeStatus, status)
  assert.equal(f.get().operation, operation)
})
