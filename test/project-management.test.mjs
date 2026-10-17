import { createSerialQueue, closeSerialPort } from '../src/main/serial-lifecycle.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { parseIni, getVarMetadata } from '../src/shared/ini-parser.js'
import { normalizeRecentProjects } from '../src/shared/project-format.js'
import { atomicWriteFile, loadProjectFile, saveProjectFile } from '../src/main/project-files.js'
import { createProjectDocument } from '../src/renderer/features/projects/projectCreation.js'
import { normalizeProjectV3, serializeProjectForSave, projectFingerprint } from '../src/renderer/core/store/utils/project.normalization.js'
import { createProjectLifecycleSlice } from '../src/renderer/core/store/slices/project.lifecycle.js'
import { buildDisplayTablesFromDecodedPages } from '../src/renderer/core/store/utils/table.transforms.js'

const content = fs.readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8')
const ini = parseIni(content, { CELSIUS: true })
const engine = { displacement: 2000, cylinders: 4, type: 'inline', injectorFlow: 440, injectorOpenTime: 1, stoich: 14.7 }
const document = (overrides = {}) => createProjectDocument({ projectName: 'Four cylinder', color: 'orange',
  ini: { content, signature: ini.info.signature }, parsedIni: ini, boardLayout: 3, engine,
  filePath: 'four.rynproj', ...overrides }).project
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

function fixture(t) {
  const originalWindow = globalThis.window, saved = [], notifications = []
  let state = { currentProject: document(), parsedIni: ini, projectEpoch: 1, operation: null,
    connection: { status: 'disconnected' }, tables: {}, tableDrafts: {},
    runtimeProfileSession: { state: 'Base' }, recentProjects: [],
    notify: (...args) => notifications.push(args),
    setOperation: operation => { state.operation = operation }, clearOperation: () => { state.operation = null } }
  const get = () => state, set = patch => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) } }
  state = { ...state, ...createProjectLifecycleSlice(set, get) }
  state.tables = buildDisplayTablesFromDecodedPages(ini, state.currentProject.constants.decodedPages, {})
  state.savedProjectFingerprint = projectFingerprint(state.currentProject)
  globalThis.window = { projects: {
    loadIni: async () => content, loadFile: async () => document(), addRecent: async project => normalizeRecentProjects([project]),
    pickSave: async () => 'new.rynproj', confirmTransition: async () => 'cancel',
    saveFile: async (filePath, data) => { saved.push({ filePath, data }); return { ok: true, fileRevision: 'saved-revision' } },
  }, serial: { disconnect: async () => {} } }
  t.after(() => { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow })
  return { get, set, saved, notifications }
}

function temporaryFile(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ryn-project-test-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  return path.join(directory, 'project.rynproj')
}

test('new base and blank projects both retain two usable restore points, without ECU I/O', async t => {
  const f = fixture(t)
  for (const initBaseTune of [true, false]) {
    const project = document({ initBaseTune })
    assert.equal((await f.get().setProject(project, { persistNew: true })).ok, true)
    assert.equal(f.get().hasUnsavedProjectChanges(), false)
    for (const key of ['blankCanvas', 'baseTune']) assert.equal(Object.keys(f.saved.at(-1).data.initialization.restorePoints[key].constants.pages).length, 15)
    assert.equal((await f.get().resetProjectToBlankCanvas()).ok, true)
    assert.equal((await f.get().restoreProjectToBaseTune()).ok, true)
  }
})

test('schema 5 saves raw bytes once per snapshot and roundtrips all tune and restore bytes', () => {
  const project = document(), payload = serializeProjectForSave(project)
  assert.equal(payload.schemaVersion, 5)
  assert.equal(payload.tables, undefined)
  assert.equal(payload.constants.decodedPages, undefined)
  assert.ok(JSON.stringify(payload).length < 650000)
  const loaded = normalizeProjectV3(JSON.parse(JSON.stringify(payload)), ini)
  for (const [page, snapshot] of Object.entries(project.constants.pages)) assert.equal(loaded.constants.pages[page].rawData, snapshot.rawData)
  for (const key of ['blankCanvas', 'baseTune']) {
    assert.equal(payload.initialization.restorePoints[key].tables, undefined)
    assert.equal(payload.initialization.restorePoints[key].constants.decodedPages, undefined)
    assert.deepEqual(loaded.initialization.restorePoints[key].constants.pages, project.initialization.restorePoints[key].constants.pages)
  }
})

test('legacy schema and unknown extension data survive migration; future and malformed formats are rejected', () => {
  const old = { ...document(), schemaVersion: 4, pluginData: { calibrationNotes: ['keep me'] } }
  old.initialization.baseTune.template.contract.largeLegacyMetadata = Array(10000).fill('derived')
  const migrated = normalizeProjectV3(old, ini)
  assert.deepEqual(serializeProjectForSave(migrated).pluginData, old.pluginData)
  assert.equal(migrated.initialization.baseTune.template.contract.largeLegacyMetadata, undefined)
  assert.throws(() => normalizeProjectV3({ ...old, schemaVersion: 99 }), /Unsupported project schema/)
  for (const value of [[], 'bad', { schemaVersion: -1 }, { constants: [] }]) assert.throws(() => normalizeProjectV3(value))
})

test('Recent contains descriptors only and opening reads the latest disk project', async t => {
  const f = fixture(t), cached = document(), disk = document({ projectName: 'Changed on disk' })
  const recent = normalizeRecentProjects([{ ...cached, constants: { pages: { stale: true } } }])
  assert.equal(recent[0].constants, undefined)
  assert.equal(recent[0].ini, undefined)
  let reads = 0
  window.projects.loadFile = async () => { reads++; return disk }
  assert.equal((await f.get().openProject(recent[0].filePath)).ok, true)
  assert.equal(reads, 1)
  assert.equal(f.get().currentProject.projectName, disk.projectName)
  assert.equal(normalizeRecentProjects([recent[0], { ...recent[0], filePath: 'FOUR.RYNPROJ' }]).length, 1)
})

test('Save never reverts newer metadata and reports those edits as unsaved', async t => {
  const f = fixture(t), pending = defer(), entered = defer()
  window.projects.saveFile = async () => { entered.resolve(); await pending.promise; return { ok: true } }
  const saving = f.get().saveProject()
  await entered.promise
  f.get().updateProjectField('projectName', 'Edited during save')
  pending.resolve()
  assert.equal((await saving).ok, true)
  assert.equal(f.get().currentProject.projectName, 'Edited during save')
  assert.equal(f.get().hasUnsavedProjectChanges(), true)
})

test('Save As captures edits made while its dialog is open and a cancelled dialog changes nothing', async t => {
  const f = fixture(t), pending = defer()
  window.projects.pickSave = () => pending.promise
  const saving = f.get().saveProjectAs()
  f.get().updateProjectField('description', 'Typed while choosing the path')
  pending.resolve('copy.rynproj')
  assert.equal((await saving).ok, true)
  assert.equal(f.saved[0].data.description, 'Typed while choosing the path')
  assert.equal(f.get().hasUnsavedProjectChanges(), false)
  const before = f.get().currentProject
  window.projects.pickSave = async () => null
  assert.equal((await f.get().saveProjectAs()).ok, false)
  assert.equal(f.get().currentProject, before)
})

test('parallel saves and project switches during save are rejected without losing edits', async t => {
  const f = fixture(t), pending = defer(), entered = defer()
  window.projects.saveFile = async () => { entered.resolve(); await pending.promise; return { ok: true } }
  const saving = f.get().saveProject()
  await entered.promise
  assert.equal((await f.get().saveProject()).ok, false)
  assert.equal((await f.get().setProject(document({ projectName: 'B' }))).ok, false)
  pending.resolve()
  assert.equal((await saving).ok, true)
})

test('late INI read cannot reactivate an older project', async t => {
  const f = fixture(t), pending = defer()
  window.projects.loadIni = () => pending.promise
  const changing = f.get().updateIni('new.ini')
  assert.equal((await f.get().setProject(document({ projectName: 'B' }))).ok, true)
  pending.resolve(content)
  assert.equal((await changing).ok, false)
  assert.equal(f.get().currentProject.projectName, 'B')
})

test('a newer open request wins over an earlier slow disk read', async t => {
  const f = fixture(t), pending = defer()
  window.projects.loadFile = file => file === 'slow' ? pending.promise : Promise.resolve(document({ projectName: 'B' }))
  const slow = f.get().openProject('slow')
  assert.equal((await f.get().openProject('fast')).ok, true)
  pending.resolve(document({ projectName: 'A' }))
  assert.equal((await slow).ok, false)
  assert.equal(f.get().currentProject.projectName, 'B')
})

test('close blocks active operations and runtime profiles, retaining recovery baselines', async t => {
  const f = fixture(t), before = f.get().currentProject
  for (const session of ['ProfileActive', 'Unknown', 'Applying', 'RollingBack']) {
    const baseline = { alsEnabled: 0 }
    f.set({ runtimeProfileSession: { state: session, baseline } })
    assert.equal((await f.get().closeProject()).ok, false)
    assert.equal(f.get().currentProject, before)
    assert.equal(f.get().runtimeProfileSession.baseline, baseline)
  }
  f.set({ runtimeProfileSession: { state: 'Base' }, operation: { type: 'upload' } })
  assert.equal((await f.get().closeProject()).ok, false)
})

test('Save / Discard / Cancel and failed save protect unsaved project transitions', async t => {
  const f = fixture(t)
  f.get().updateProjectField('description', 'unsaved')
  assert.equal((await f.get().closeProject()).ok, false)
  assert.equal(f.get().currentProject.description, 'unsaved')
  window.projects.confirmTransition = async () => 'save'
  window.projects.saveFile = async () => ({ error: 'Disk full' })
  assert.equal((await f.get().closeProject()).ok, false)
  assert.ok(f.get().currentProject)
  window.projects.saveFile = async () => ({ ok: true })
  assert.equal((await f.get().closeProject()).ok, true)
  assert.equal(f.get().currentProject, null)
  assert.equal((await f.get().setProject(document())).ok, true)
  f.get().updateProjectField('description', 'discard this')
  window.projects.confirmTransition = async () => 'discard'
  assert.equal((await f.get().closeProject()).ok, true)
})

test('late disconnect cannot clear a new project or edits typed during close', async t => {
  const f = fixture(t), pending = defer(), entered = defer()
  f.set({ connection: { status: 'connected' } })
  window.serial.disconnect = async () => { entered.resolve(); await pending.promise }
  const closing = f.get().closeProject()
  await entered.promise
  assert.equal((await f.get().setProject(document({ projectName: 'B' }))).ok, false)
  const meta = getVarMetadata(ini, 'reqFuel')
  f.get().updateProjectFieldDrafts({ [meta.page]: { reqFuel: 85 } })
  pending.resolve()
  assert.equal((await closing).ok, false)
  assert.equal(f.get().fieldDrafts[meta.page].reqFuel, 85)
})

test('field drafts persist between screens, save to raw bytes locally, and invalid edits block save', async t => {
  const f = fixture(t), meta = getVarMetadata(ini, 'reqFuel')
  f.get().updateProjectFieldDrafts({ [meta.page]: { reqFuel: 85 } })
  assert.equal(f.get().hasUnsavedProjectChanges(), true)
  assert.equal((await f.get().saveProject()).ok, true)
  assert.equal(f.get().currentProject.constants.decodedPages[meta.page].reqFuel, 85)
  assert.deepEqual(f.get().fieldDrafts, {})
  assert.equal(f.get().hasUnsavedProjectChanges(), false)
  f.get().updateProjectFieldDrafts({ [meta.page]: { reqFuel: NaN } })
  assert.equal((await f.get().saveProject()).ok, false)
  assert.equal(f.saved.length, 1)
  assert.ok(f.get().fieldDrafts[meta.page])
})

test('project color survives roundtrip and temperature settings reparse INI without changing bytes', async t => {
  const f = fixture(t), before = f.get().currentProject.constants.pages
  f.get().updateProjectField('color', 'purple')
  const loaded = normalizeProjectV3(serializeProjectForSave(f.get().currentProject), ini)
  assert.equal(loaded.ui.accentColor, 'purple')
  assert.equal(f.get().updateProjectSettings({ units: { temperature: 'fahrenheit' } }).ok, true)
  assert.notEqual(f.get().parsedIni, ini)
  assert.deepEqual(f.get().currentProject.constants.pages, before)
})

test('ECU verification status does not make a saved project dirty', t => {
  const f = fixture(t), project = f.get().currentProject
  const pages = Object.fromEntries(Object.entries(project.constants.pages).map(([id, snapshot]) =>
    [id, { ...snapshot, crc32: 'ignored-cache', syncState: 'verified', lastReadAt: new Date().toISOString(), lastVerifiedAt: new Date().toISOString() }]))
  f.set({ currentProject: { ...project, constants: { ...project.constants, pages }, ecu: { sync: { state: 'fully-verified' } } } })
  assert.equal(f.get().hasUnsavedProjectChanges(), false)
})

test('failed creation leaves the active project untouched and releases its operation', async t => {
  const f = fixture(t), before = f.get().currentProject
  window.projects.saveFile = async () => ({ error: 'Permission denied' })
  assert.equal((await f.get().setProject(document({ projectName: 'New' }), { persistNew: true })).ok, false)
  assert.equal(f.get().currentProject, before)
  assert.equal(f.get().operation, null)
})

test('missing historical base snapshots preserve the current tune as an explicitly labelled recovery point', async t => {
  const f = fixture(t), meta = getVarMetadata(ini, 'reqFuel')
  f.get().updateConstants({ [meta.page]: { reqFuel: 85 } })
  const legacy = serializeProjectForSave(f.get().currentProject)
  legacy.initialization.restorePoints = {}
  legacy.initialization.boardLayout = null
  window.projects.confirmTransition = async () => 'discard'
  assert.equal((await f.get().setProject(legacy)).ok, true)
  const point = f.get().currentProject.initialization.restorePoints.baseTune
  assert.equal(point.origin, 'recovered-current-tune')
  assert.equal(point.constants.decodedPages[meta.page].reqFuel, 85)
  assert.ok(f.get().currentProject.initialization.restorePoints.blankCanvas)
})

test('future schema, corrupt restore snapshot, missing INI and incompatible INI cannot replace a valid tune', async t => {
  const f = fixture(t), before = f.get().currentProject
  const corrupt = document()
  corrupt.initialization.restorePoints.baseTune.constants.pages[1].size = 1
  for (const candidate of [{ ...document(), schemaVersion: 99 }, corrupt, { ...document(), ini: {} }]) {
    assert.equal((await f.get().setProject(candidate)).ok, false)
    assert.equal(f.get().currentProject, before)
  }
  window.projects.loadIni = async () => content.replace(/pageSize\s*=\s*([0-9]+)/, 'pageSize = 1')
  assert.equal((await f.get().updateIni('different.ini')).ok, false)
  assert.equal(f.get().currentProject, before)
})

for (const failure of ['partial-write', 'backup', 'rename']) test(`atomic save preserves the original after ${failure} failure`, t => {
  const file = temporaryFile(t), original = '{"original":true}'
  fs.writeFileSync(file, original)
  fs.writeFileSync(`${file}.bak`, 'previous backup')
  const io = { ...fs }
  if (failure === 'partial-write') io.writeFileSync = (fd, text) => { fs.writeFileSync(fd, text.slice(0, 8)); throw new Error('ENOSPC') }
  if (failure === 'backup') io.copyFileSync = () => { throw new Error('backup failed') }
  if (failure === 'rename') io.renameSync = (from, to) => { if (to === file) throw new Error('locked'); fs.renameSync(from, to) }
  assert.throws(() => atomicWriteFile(file, '{"replacement":true}', io))
  assert.equal(fs.readFileSync(file, 'utf8'), original)
  assert.deepEqual(fs.readdirSync(path.dirname(file)).sort(), ['project.rynproj', 'project.rynproj.bak'])
})

test('saved projects are portable, checksummed, backed up and guarded against external overwrites', t => {
  const file = temporaryFile(t), project = document()
  saveProjectFile(file, serializeProjectForSave(project))
  const first = fs.readFileSync(file, 'utf8'), loaded = loadProjectFile(file)
  assert.equal(loaded.filePath, path.resolve(file))
  assert.equal(JSON.parse(first).filePath, undefined)
  assert.equal((saveProjectFile(file, { ...serializeProjectForSave(project), description: 'new' }, { expectedRevision: loaded.fileRevision })).ok, true)
  assert.equal(fs.readFileSync(`${file}.bak`, 'utf8'), first)
  assert.throws(() => saveProjectFile(file, serializeProjectForSave(project), { expectedRevision: loaded.fileRevision }), /changed on disk/)
  const damaged = JSON.parse(fs.readFileSync(file, 'utf8')); damaged.description = 'unexpected edit'
  fs.writeFileSync(file, JSON.stringify(damaged))
  assert.throws(() => loadProjectFile(file), /integrity check failed/)
  assert.equal(loadProjectFile(`${file}.bak`).projectName, project.projectName)
})

test('preload close bridge acknowledges the matching request only after the lifecycle approves', async () => {
  const bridges = {}, handlers = {}, sent = []
  vm.runInNewContext(fs.readFileSync(new URL('../src/main/preload.js', import.meta.url), 'utf8'), {
    require: () => ({ contextBridge: { exposeInMainWorld: (name, api) => { bridges[name] = api } },
      ipcRenderer: { on: (name, callback) => { handlers[name] = callback }, removeListener() {}, send: (...args) => sent.push(args) } }),
  })
  bridges.projects.onCloseRequested(async () => ({ ok: false }))
  await handlers['project:request-close'](null, 13)
  assert.deepEqual(sent.pop(), ['project:complete-close', 13, false])
  bridges.projects.onCloseRequested(async () => ({ ok: true }))
  await handlers['project:request-close'](null, 14)
  assert.deepEqual(sent.pop(), ['project:complete-close', 14, true])
})

test('unapplied Project Settings cannot be silently discarded by close or global save', async t => {
  const f = fixture(t), before = f.get().currentProject
  f.get().setProjectSettingsDirty(true)
  assert.equal((await f.get().closeProject()).ok, false)
  assert.equal((await f.get().saveProject()).ok, false)
  assert.equal(f.get().currentProject, before)
  f.get().setProjectSettingsDirty(false)
  assert.equal((await f.get().closeProject()).ok, true)
})

test('presentation-only INI replacement preserves tune bytes and rebuilds its tables', async t => {
  const f = fixture(t), before = f.get().currentProject.constants.pages
  window.projects.loadIni = async () => `${content}\n; Help text only\n`
  assert.equal((await f.get().updateIni('relabelled.ini')).ok, true)
  for (const [id, snapshot] of Object.entries(before)) assert.equal(f.get().currentProject.constants.pages[id].rawData, snapshot.rawData)
  assert.equal(f.get().currentProject.ini.path, 'relabelled.ini')
})

test('an editor routing correction can replace the INI without changing ECU memory', async t => {
  const f = fixture(t), oldContent = content.replace('"Base duty for closed loop", 15', '"Base duty for closed loop", 7')
  assert.notEqual(oldContent, content)
  const old = document()
  old.ini.content = oldContent
  assert.equal((await f.get().setProject(old)).ok, true)
  const before = f.get().currentProject.constants.pages
  assert.equal((await f.get().updateIni('corrected.ini')).ok, true)
  for (const [id, snapshot] of Object.entries(before)) assert.equal(f.get().currentProject.constants.pages[id].rawData, snapshot.rawData)
})

test('native window close waits for the matching approved renderer response', () => {
  const handlers = {}, requests = [], windows = []
  class FakeWindow {
    constructor() {
      this.handlers = {}
      this.webContents = { openDevTools() {}, send: (...args) => requests.push(args) }
      windows.push(this)
    }
    loadURL() {}
    loadFile() {}
    isDestroyed() { return !!this.destroyed }
    on(name, handler) { this.handlers[name] = handler }
    close() {
      let prevented = false
      this.handlers.close({ preventDefault() { prevented = true } })
      if (!prevented) { this.destroyed = true; this.handlers.closed() }
    }
  }
  const context = vm.createContext({ BrowserWindow: FakeWindow, path, __dirname: '/test', mainWindow: null,
    MAIN_WINDOW_VITE_DEV_SERVER_URL: 'http://fixture', MAIN_WINDOW_VITE_NAME: 'main_window',
    setTimeout, clearTimeout, ipcMain: { on: (name, callback) => { handlers[name] = callback } } })
  const source = fs.readFileSync(new URL('../src/main/index.js', import.meta.url), 'utf8')
  const ackStart = source.indexOf('let pendingClose = null;'), ackEnd = source.indexOf('\n});', ackStart) + 4
  vm.runInContext(source.slice(ackStart, ackEnd), context)
  const createStart = source.indexOf('const createWindow = () => {'), createEnd = source.indexOf('\napp.whenReady()', createStart)
  vm.runInContext(source.slice(createStart, createEnd) + '\ncreateWindow();', context)
  const window = windows[0], reply = handlers['project:complete-close'], event = { sender: window.webContents }
  window.close()
  const first = requests.at(-1)[1]
  assert.equal(window.isDestroyed(), false)
  reply(event, first - 1, true)
  assert.equal(window.isDestroyed(), false)
  reply(event, first, false)
  assert.equal(window.isDestroyed(), false)
  window.close()
  const second = requests.at(-1)[1]
  reply(event, first, true)
  assert.equal(window.isDestroyed(), false)
  reply(event, second, true)
  assert.equal(window.isDestroyed(), true)
})

test('cancelled serial opening and a late old close cannot reconnect or clear the next session', async () => {
  const handlers = {}, ports = [], status = []
  let portCreated = defer()
  class FakeSerialPort {
    constructor() { this.listeners = {}; ports.push(this); portCreated.resolve() }
    on(name, callback) { this.listeners[name] = callback }
    open(callback) { this.finishOpen = callback }
    close(callback) { this.closed = true; callback?.() }
  }
  const context = vm.createContext({ console: { log() {}, error() {} },
    activePort: null, serialConnectGeneration: 0, activeFirmwareFlash: null, activeECUReset: false, firmwareOperationReserved: false, serialQueue: createSerialQueue(), closeSerialPort, mainWindow: { webContents: { send: (...args) => status.push(args) } },
    getSerialPortModule: async () => ({ SerialPort: FakeSerialPort }),
    ipcMain: { handle: (channel, callback) => { handlers[channel] = callback } } })
  const source = fs.readFileSync(new URL('../src/main/index.js', import.meta.url), 'utf8')
  for (const channel of ['serial:connect', 'serial:disconnect']) {
    const a = source.search(new RegExp(`ipcMain\\.handle\\(["']${channel}["']`)), b = source.indexOf('\n});', a) + 4
    assert.ok(a >= 0 && b > a)
    vm.runInContext(source.slice(a, b).replace('import("serialport")', 'getSerialPortModule()'), context)
  }
  const first = handlers['serial:connect'](null, 'TEST', 115200)
  await portCreated.promise
  assert.equal(ports.length, 1)
  const disconnected = handlers['serial:disconnect']()
  ports[0].finishOpen()
  await disconnected
  assert.equal((await first).ok, false)
  assert.equal(ports[0].closed, true)
  assert.equal(context.activePort, null)
  assert.equal(status.some(([, value]) => value === 'connected'), false)
  portCreated = defer()
  const second = handlers['serial:connect'](null, 'TEST', 115200)
  await portCreated.promise
  ports[1].finishOpen()
  assert.equal((await second).ok, true)
  ports[0].listeners.close()
  assert.equal(context.activePort, ports[1])
  context.serialConnectGeneration++
  ports[1].listeners.data(Buffer.from([1, 2, 3]))
  assert.equal(status.some(([channel]) => channel === 'serial:data'), false, 'retired port data cannot reach the new parser')
  ports[1].close = callback => callback(new Error('Close failed'))
  await assert.rejects(handlers['serial:disconnect'](), /Close failed/)
  assert.equal(context.activePort, ports[1])
  assert.ok(status.some(([, value]) => value === 'error:Close failed'))
})
