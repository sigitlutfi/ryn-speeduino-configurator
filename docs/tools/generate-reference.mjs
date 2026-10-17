// Regenerate the Flutter handoff references from the reviewed working tree.
// No serial access. Synthetic project values are for interoperability tests.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { parseIni, getTableMetadata, getVarMetadata } from '../../src/shared/ini-parser.js'
import { createProjectDocument } from '../../src/renderer/features/projects/projectCreation.js'
import { serializeProjectForSave, normalizeProjectV3 } from '../../src/renderer/core/store/utils/project.normalization.js'
import { saveProjectFile, loadProjectFile } from '../../src/main/project-files.js'
import { formatReadCommand, formatWriteCommand, formatBurnCommand, formatCRCCommand, formatOutputChannelsCommand, calculatePageCRC, wrapModernProtocol } from '../../src/shared/protocol/ecu-commands.js'
import { calibrationCRCCommand, calibrationChunks } from '../../src/shared/protocol/sensor-calibration.js'
import { encodeDriveConfig, driveStatusCommand, driveSelectCommand } from '../../src/shared/protocol/drive-modes.js'
import { decodeOutputChannels } from '../../src/shared/protocol/output-channels.js'

// This script lives in docs/tools; imports above are resolved from docs/tools.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const docs = path.join(root, 'docs')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const write = (name, data) => fs.writeFileSync(path.join(docs, name), data, 'utf8')
const json = (name, value) => write(name, JSON.stringify(value, null, 2) + '\n')
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const content = read('speeduino.ini'), ini = parseIni(content, { CELSIUS: true })
const pair = JSON.parse(read('compatibility/firmware.json'))
assert.equal(sha256(content), pair.iniSha256)
fs.mkdirSync(path.join(docs, 'fixtures'), { recursive: true })
const cell = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
const table = (heads, rows) => `| ${heads.join(' | ')} |\n| ${heads.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.map(cell).join(' | ')} |`).join('\n')}\n`
let md = '# Referensi hasil ekstraksi source\n\nDihasilkan oleh [generator](tools/generate-reference.mjs). Jalankan `node docs/tools/generate-reference.mjs` dari root repository. Snapshot CELSIUS; Fahrenheit tetap harus diuji. Ekstraksi literal bukan daftar lengkap kontrol dinamis, dan nama field yang ditemukan belum tentu editable di layar itu.\n\n'
md += `## Baseline\n\n- Firmware: \`${pair.signature}\`\n- Firmware commit: \`${pair.firmwareRef}\`\n- App HEAD: \`${execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()}\`; dokumentasi mencakup perubahan working tree, bukan HEAD saja.\n- INI SHA-256: \`${pair.iniSha256}\`\n- Telemetry: ${ini.outputChannels.ochBlockSize} byte.\n\n`
md += '## Pages\n\n' + table(['Page', 'Bytes', 'Fields', 'requiresPowerCycle'], Object.entries(ini.constants.pages).map(([id, fields]) => [id, ini.constants.pageSizes[id], Object.keys(fields).length, Object.entries(fields).filter(([, m]) => m.requiresPowerCycle).map(([n]) => n).join(', ')]))
const app = read('src/renderer/App.jsx'), routeText = read('src/renderer/routes.js')
const routeMap = Object.fromEntries([...routeText.matchAll(/(\w+):\s*"([^"]+)"/g)].map(m => [m[1], m[2]]))
const imports = Object.fromEntries([...app.matchAll(/import\s+(\w+)\s+from\s+["']([^"']+)["']/g)].map(m => [m[1], m[2]]))
const routes = [...app.matchAll(/<Route\s+path=\{ROUTES\.(\w+)\}\s+component=\{(\w+)\}/g)].map(m => {
  let file = path.posix.normalize('src/renderer/' + imports[m[2]])
  if (!path.extname(file)) file += '.jsx'
  assert.ok(fs.existsSync(path.join(root, file)), file)
  return { id: m[1], route: routeMap[m[1]], component: m[2], file }
})
assert.equal(routes.length, Object.keys(routeMap).length)
md += '\n## Semua route terpasang\n\nGettingStarted tampil bila belum ada project; ProjectSettings dan dialog sinkronisasi bukan route terpisah.\n\n'
md += table(['Route ID', 'Path', 'Component/source'], routes.map(r => [r.id, r.route, `[${r.component}](../${r.file})`]))
md += '\n## Tabel INI\n\n' + table(['ID', 'Page', 'X / Y / Z', 'Z shape'], Object.keys(ini.tables).map(id => {
  const m = getTableMetadata(ini, id, { strict: true })
  return [id, m.page, [m.xBinsVar, m.yBinsVar, m.zBinsVar].join(' / '), getVarMetadata(ini, m.zBinsVar)?.shape?.join(' × ')]
}))
md += '\n## Referensi field literal per layar\n\nGabungkan dengan child component/curve dan kontrak INI. Field dengan `type=bits` adalah nilai enum hasil ekstraksi bit, bukan byte penuh.\n\n'
for (const r of routes) {
  const text = read(r.file)
  const literals = new Set([...text.matchAll(/["']([A-Za-z][A-Za-z0-9_]*)["']/g)].map(m => m[1]))
  const found = Object.entries(ini.constants.pages).flatMap(([page, fields]) => Object.entries(fields).filter(([name]) => literals.has(name)).map(([name, m]) => [name, page, `${m.type}/${m.dataType}`, m.offset, m.shape?.join('×') || m.bitRange?.join(':') || '', m.units || '', `${m.scale ?? 1}; ${m.translate ?? 0}`]))
  if (!found.length) continue
  md += `### ${r.component}\n\n[Source](../${r.file}) · \`${r.route}\`\n\n`
  md += table(['Field', 'Page', 'Type', 'Offset', 'Shape/bits', 'Unit INI', 'Scale; translate'], found) + '\n'
}
md += '## Output channels\n\nIni metadata raw; canonical model pada [telemetry](08_TELEMETRY_WIDGETS_LOGGING.md) melakukan pemetaan dan konversi khusus.\n\n'
md += table(['Field', 'Offset', 'Type', 'Bits', 'Scale', 'Translate', 'Unit'], Object.entries(ini.outputChannels.channels).map(([name, m]) => [name, m.offset, m.dataType, m.bitRange?.join(':'), m.scale ?? 1, m.translate ?? 0, m.units]))
write('13_GENERATED_REFERENCE.md', md)

const vectors = []
const add = (name, bytes, note) => vectors.push({ name, hex: Buffer.from(bytes).toString('hex').toUpperCase(), note })
add('legacy-F', Buffer.from('F'), 'Unframed boot probe; expected ASCII 002')
add('read-page14-offset0-count64', formatReadCommand(14, 0, 64), 'p payload offset/count LE; outer frame BE')
add('write-page14-one-byte', formatWriteCommand(14, 0, 1, [42]), 'Synthetic byte; test only')
add('burn-page14', formatBurnCommand(14), 'b, reserved=0, page=14')
add('crc-page14', formatCRCCommand(14), 'd page CRC request')
add('read-output-channels', formatOutputChannelsCommand(ini.outputChannels.ochGetCommand, 0, 167), 'Read current complete block')
add('reply-read-four-bytes', wrapModernProtocol(Buffer.from([0, 1, 2, 3, 4])), 'status=0, four data bytes')
add('reply-burn-ok', wrapModernProtocol(Buffer.from([4])), 'status=4, no data')
add('reply-range-error', wrapModernProtocol(Buffer.from([0x84])), 'status=0x84, no data')
add('clt-crc-request', calibrationCRCCommand('clt'), 'k sensor=0')
add('clt-zero-table-test', calibrationChunks('clt', Buffer.alloc(64))[0], 't header offset/count BE, data synthetic')
add('o2-first-zero-chunk-test', calibrationChunks('o2', Buffer.alloc(1024))[0], '96-byte chunk, header BE')
const drive = encodeDriveConfig()
add('drive-neutral-config', drive, '18-byte config, internal CRC16 LE; not a framed command')
add('drive-status-request', driveStatusCommand(), 'D subcommand 0')
add('drive-select-eco-token1', driveSelectCommand(1, 1, drive.readUInt16LE(16)), 'No automatic replay after lost ACK')
const p = Buffer.alloc(167)
p[1] = 0x30; p[2] = 0x09; p[3] = 7; p.writeUInt16LE(163, 4); p[6] = 55; p[7] = 127
p[9] = 142; p[10] = 147; p.writeUInt16LE(4321, 14); p.writeUInt16LE(123, 17); p[19] = 90
p.writeInt8(-12, 24); p[25] = 147; p.writeUInt16LE(12345, 26); p.writeUInt16LE(1600, 28)
p[32] = 0x80; p[35] = 45; p[36] = 110; p[41] = 99; p[74] = 201
p.writeUInt16LE(12345, 76); p.writeInt16LE(-12, 86); p.writeInt16LE(-31, 88); p.writeUInt16LE(3150, 90)
p.writeUInt16LE(123, 104); p[106] = 4; p[116] = 30; p.writeUInt16LE(180, 121); p.writeUInt16LE(2750, 125)
p[152] = 1; p[163] = 100; p[165] = 7; p[166] = 1
const expected = { rpm: 4321, map: 163, tps: 73.5, coolant: 87, iat: 15, battery: 14.2, afr: 14.7, advance: -12, pw1: 12.345, dwell: 3.15, dwellActual: 2.75, freeRAM: 1600, fuelLoadRaw: -12, ignLoadRaw: -31, emap: 180 }
const decoded = decodeOutputChannels(p, ini)
for (const [key, value] of Object.entries(expected)) assert.ok(Math.abs(decoded[key] - value) < 1e-9, key)
assert.equal(calculatePageCRC(Buffer.from('123456789')), 0xCBF43926)
json('fixtures/protocol-vectors.json', { firmwareSignature: pair.signature, iniSha256: pair.iniSha256, crc32: { inputAscii: '123456789', expectedHex: 'CBF43926' }, vectors, telemetry: { byteLength: 167, hex: p.toString('hex').toUpperCase(), expected } })
const { project } = createProjectDocument({ projectName: 'Flutter interop fixture — synthetic', description: 'Parsing and round-trip fixture only; not a vehicle tune.', ini: { content, signature: pair.signature }, parsedIni: ini, boardLayout: 41, engine: { cylinders: 4, displacement: 2000, injectorFlow: 440, injectorOpenTime: 1, stoich: 14.7 } })
const persistent = serializeProjectForSave(project)
const freeze = value => {
  if (Array.isArray(value)) return value.map(freeze)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freeze(child)]))
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:/.test(value) ? '2026-10-18T00:00:00.000Z' : value
}
const file = path.join(docs, 'fixtures/synthetic-project-v5.rynproj')
// A generated fixture is replaceable; the production writer still validates its checksum.
if (fs.existsSync(file)) fs.unlinkSync(file)
saveProjectFile(file, freeze(persistent))
const loaded = loadProjectFile(file)
assert.equal(loaded.schemaVersion, 5)
assert.equal(loaded.ini.content, content)
assert.deepEqual(loaded.constants.pages, freeze(persistent).constants.pages)
const normalized = normalizeProjectV3(loaded, ini)
const roundTrip = serializeProjectForSave(normalized)
for (const [page, snapshot] of Object.entries(loaded.constants.pages)) {
  assert.equal(roundTrip.constants.pages[page].rawData, snapshot.rawData, `Round-trip page ${page}`)
}
json('fixtures/project-fixture-manifest.json', { file: 'synthetic-project-v5.rynproj', bytes: fs.statSync(file).size, sha256: sha256(fs.readFileSync(file)), schemaVersion: 5, iniSha256: pair.iniSha256, pageSizes: ini.constants.pageSizes, purpose: 'Offline parsing, integrity and lossless round-trip. Never an ECU tuning recommendation.' })
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
  const file = `${dir}/${entry.name}`
  return entry.isDirectory() ? walk(file) : [file]
})
const sourceFiles = [...walk('src'), ...walk('test'), ...walk('compatibility'), 'package.json', 'bun.lock', 'speeduino.ini', 'scripts/upgrade-check.mjs']
json('fixtures/source-manifest.json', { recordedFor: '2026-10-18',
  appHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  firmwareRef: pair.firmwareRef, signature: pair.signature,
  note: 'Hashes identify working-tree files. HEAD alone does not include all handoff changes.',
  sources: Object.fromEntries(sourceFiles.sort().map(file => [file, sha256(fs.readFileSync(path.join(root, file)))])) })
console.log(JSON.stringify({ routes: routes.length, pages: Object.keys(ini.constants.pages).length, outputChannels: Object.keys(ini.outputChannels.channels).length, vectors: vectors.length, projectBytes: fs.statSync(file).size }))
