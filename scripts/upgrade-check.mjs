import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { parseIni } from '../src/shared/ini-parser.js'
import { metadataContract } from '../src/shared/protocol/metadata-contract.js'
import { extractAvrPinMappings, renderAvrMapping } from './avr-pin-mapping.mjs'

const configuratorRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const normalize = text => text.replace(/\r\n?/g, '\n')
const read = path => normalize(readFileSync(path, 'utf8'))
const sha256 = text => createHash('sha256').update(normalize(text)).digest('hex')
const pairPath = 'compatibility/firmware.json'
const metadataPath = 'src/shared/protocol/ini-contract.js'
const mappingPath = 'src/shared/protocol/avr-pin-mapping.js'
const ownershipPaths = ['src/shared/protocol/board-pins.js', 'src/renderer/features/shared/utils/pinRegistry.js', 'src/shared/protocol/configuration-validation.js']

function git(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr?.trim()}`)
  return result.stdout.trim()
}

function revisionState(root) {
  const status = git(root, ['status', '--porcelain'])
  return { revision: git(root, ['rev-parse', 'HEAD']), dirty: !!status,
    trackedDirty: status.split('\n').some(line => line && !line.startsWith('??')),
    untrackedFiles: status.split('\n').filter(line => line.startsWith('??')).map(line => line.slice(3)) }
}

export function renderMetadataContract(content) {
  // All modes the app supports. No symbols currently selects Fahrenheit via
  // the INI's #else; its resulting contract equals the FAHRENHEIT variant.
  const variants = [{ CELSIUS: true }, { FAHRENHEIT: true }].map(symbols => metadataContract(parseIni(content, symbols)))
  // Intern repeated pin enums/metadata and shared Celsius/Fahrenheit fields.
  // This preserves exact comparisons without adding megabytes to the renderer.
  const nodes = [], ids = new Map()
  const intern = value => {
    const node = Array.isArray(value) ? [1, value.map(intern)]
      : value && typeof value === 'object' ? [2, Object.entries(value).map(([key, child]) => [key, intern(child)])]
      : [0, value]
    const key = JSON.stringify(node)
    if (!ids.has(key)) { ids.set(key, nodes.length); nodes.push(node) }
    return ids.get(key)
  }
  const index = intern(JSON.parse(JSON.stringify({ signature: variants[0].signature, variants })))
  return `// Generated from the paired firmware INI by scripts/upgrade-check.mjs.\n// Shared nodes deduplicate repeated enums without weakening schema checks.\nconst nodes = ${JSON.stringify(nodes)}\nconst values = []\nfor (const [type, data] of nodes) values.push(type === 0 ? data : type === 1 ? data.map(index => values[index]) : Object.fromEntries(data.map(([key, index]) => [key, values[index]])))\nexport default values[${index}]\n`
}

export async function checkPair(firmwareRoot, { root = configuratorRoot, sync = false } = {}) {
  firmwareRoot = resolve(firmwareRoot)
  const checker = await import(pathToFileURL(resolve(firmwareRoot, 'scripts/check-compatibility.mjs')))
  const snapshot = checker.checkFirmware(firmwareRoot)
  const content = read(resolve(firmwareRoot, 'reference/speeduino.ini'))
  const mapping = renderAvrMapping(extractAvrPinMappings(read(resolve(firmwareRoot, 'speeduino/src/pins/pinMapping.cpp'))))
  const metadata = renderMetadataContract(content)
  const ownershipSources = Object.fromEntries(ownershipPaths.map(path => [path, sha256(read(resolve(root, path)))]))
  const contractSha256 = sha256(JSON.stringify(snapshot))
  const actualFirmwareRef = git(firmwareRoot, ['rev-parse', 'HEAD'])
  if (sync) {
    const committed = JSON.parse(git(firmwareRoot, ['show', 'HEAD:compatibility/contract.json']))
    if (JSON.stringify({ ...committed, review: undefined }) !== JSON.stringify(snapshot)) throw new Error('Commit the reviewed firmware baseline before recording its paired revision')
    const files = ['compatibility/contract.json', 'reference/speeduino.ini', 'test/test_compatibility/main.cpp', 'scripts/check-compatibility.mjs', ...Object.values(snapshot.sources).flatMap(group => Object.keys(group))]
    const diff = spawnSync('git', ['-C', firmwareRoot, 'diff', '--quiet', 'HEAD', '--', ...files], { encoding: 'utf8' })
    if (diff.status !== 0) throw new Error('Commit reviewed firmware contract sources/tooling before upgrade:sync')
    const remote = git(firmwareRoot, ['remote', 'get-url', 'origin'])
    const match = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)
    if (!match) throw new Error('Paired CI requires an explicit GitHub firmware repository')
    mkdirSync(resolve(root, 'compatibility'), { recursive: true })
    const pair = { schemaVersion: 1, firmwareRepository: match[1], firmwareRef: actualFirmwareRef,
      signature: snapshot.signature, contractSha256, iniSha256: snapshot.iniSha256, ownershipSources }
    // Derivation only: does not change firmware sources or accept its baseline.
    writeFileSync(resolve(root, 'speeduino.ini'), content)
    writeFileSync(resolve(root, mappingPath), mapping)
    writeFileSync(resolve(root, metadataPath), metadata)
    writeFileSync(resolve(root, pairPath), JSON.stringify(pair, null, 2) + '\n')
  }
  const pair = JSON.parse(read(resolve(root, pairPath)))
  if (!/^[a-f0-9]{40}$/.test(pair.firmwareRef) || !/^[\w.-]+\/[\w.-]+$/.test(pair.firmwareRepository)) throw new Error('The pairing file must identify a repository and immutable firmware commit SHA')
  if (pair.schemaVersion !== 1 || pair.contractSha256 !== contractSha256 || pair.iniSha256 !== snapshot.iniSha256 || pair.signature !== snapshot.signature) throw new Error('Paired firmware contract changed. Audit it, then run upgrade:sync')
  if (!isDeepStrictEqual(pair.ownershipSources, ownershipSources)) throw new Error('Configurator pin ownership/validation changed. Review firmware parity before upgrade:sync')
  if (read(resolve(root, 'speeduino.ini')) !== content) throw new Error('Bundled INI differs from firmware INI')
  if (read(resolve(root, mappingPath)) !== mapping) throw new Error('Generated AVR map is stale or its source hash differs')
  if (read(resolve(root, metadataPath)) !== metadata) throw new Error('Generated runtime INI contract is stale')
  const parsed = parseIni(content, { CELSIUS: true })
  for (const [page, fields] of Object.entries(parsed.constants.pages)) {
    for (const [name, field] of Object.entries(fields)) {
      if (!['scalar', 'array', 'bits'].includes(field.type)) continue
      if (!/^[US](08|16|32)$/.test(field.dataType)) throw new Error(`Unsupported wire type ${page}:${name}`)
      const bytes = Number(field.dataType.slice(1)) / 8 * (field.shape?.reduce((a, b) => a * b, 1) ?? 1)
      if (!Number.isInteger(field.offset) || field.offset < 0 || field.offset + bytes > parsed.constants.pageSizes[page]) throw new Error(`Field outside declared page: ${page}:${name}`)
    }
  }
  return { signature: snapshot.signature, contractSha256, iniSha256: snapshot.iniSha256,
    firmware: { ...revisionState(firmwareRoot), testedBaseline: pair.firmwareRef },
    configurator: revisionState(root),
    avrLayouts: Object.keys(JSON.parse(mapping.slice(mapping.indexOf('export default ') + 15)).layouts).length,
    status: 'contract-checked' }
}

function run(command, args, cwd, env = process.env) {
  console.log(`\n${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: false })
  if (result.error || result.status !== 0) throw new Error(`${command} failed (${result.error?.message || result.status})`)
}

function runNative(firmwareRoot, args, value) {
  if (process.platform !== 'win32') return run(value('--pio') || 'pio', args, firmwareRoot)
  const prefix = ['--distribution', value('--wsl-distro') || 'Ubuntu']
  const query = args => {
    const result = spawnSync('wsl.exe', [...prefix, '--exec', ...args], { encoding: 'utf8' })
    if (result.error || result.status !== 0 || !result.stdout.trim()) throw new Error('Native tests require WSL with PlatformIO installed; use --wsl-distro to select the distribution')
    return result.stdout.trim()
  }
  const home = query(['printenv', 'HOME'])
  const project = query(['wslpath', '-u', firmwareRoot])
  const pio = query(['bash', '-lc', 'command -v pio'])
  const cache = `${home}/.cache/ryn-upgrade-${sha256(firmwareRoot).slice(0, 12)}`
  run('wsl.exe', [...prefix, '--cd', project, '--exec', 'env',
    `PLATFORMIO_BUILD_DIR=${value('--native-build-dir') || `${cache}/build`}`,
    `PLATFORMIO_LIBDEPS_DIR=${value('--native-libdeps-dir') || `${cache}/libdeps`}`,
    pio, ...args], firmwareRoot)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let reportPath
  try {
    const args = process.argv.slice(2)
    const options = {}
    for (let i = 0; i < args.length; i++) {
      const flag = args[i]
      if (['--sync', '--full'].includes(flag)) options[flag] = true
      else if (['--firmware', '--report', '--pio', '--wsl-distro', '--native-build-dir', '--native-libdeps-dir'].includes(flag) && args[i + 1] && !args[i + 1].startsWith('--')) options[flag] = args[++i]
      else throw new Error(`Unknown option or missing value: ${flag}`)
    }
    const value = flag => options[flag]
    const firmwareRoot = value('--firmware')
    if (!firmwareRoot) throw new Error('Usage: npm run upgrade:check -- --firmware /path/to/firmware [--full] [--report report.json] [--pio /path/to/pio]')
    if (value('--report')) {
      reportPath = resolve(value('--report'))
      mkdirSync(dirname(reportPath), { recursive: true })
      writeFileSync(reportPath, JSON.stringify({ status: 'running' }, null, 2) + '\n')
    }
    const report = await checkPair(firmwareRoot, { sync: args.includes('--sync') })
    if (args.includes('--full')) {
      run(process.execPath, ['--test', ...readdirSync(resolve(firmwareRoot, 'scripts')).filter(name => name.endsWith('.test.mjs')).map(name => resolve(firmwareRoot, 'scripts', name))], resolve(firmwareRoot))
      run(process.execPath, ['--test', ...readdirSync(resolve(configuratorRoot, 'test')).filter(name => name.endsWith('.test.mjs')).map(name => resolve(configuratorRoot, 'test', name))], configuratorRoot,
        { ...process.env, RYN_FIRMWARE_ROOT: resolve(firmwareRoot) })
      // Separate output directory keeps tracked dist artifacts intact.
      run(process.execPath, [resolve(configuratorRoot, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'vite.renderer.config.mjs', '--outDir', '.cache/upgrade-renderer'], configuratorRoot)
      const pio = value('--pio') || 'pio'
      runNative(resolve(firmwareRoot), ['test', '-e', 'native_base', ...['compatibility', 'storage', 'performance', 'init', 'programmableio', 'n2ocontrol', 'secondary', 'sensors', 'general', 'ign', 'ign_controller', 'engineprotect'].flatMap(name => ['-f', `test_${name}`])], value)
      for (const environment of ['megaatmega2560', 'megaatmega2560-6-3', 'megaatmega2560-8-1']) {
        run(pio, ['run', '-e', environment], resolve(firmwareRoot))
        run(pio, ['test', '-e', environment, '-f', 'test_compatibility', '--without-uploading', '--without-testing'], resolve(firmwareRoot))
      }
      report.status = 'software-validated'
    }
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report, null, 2))
  } catch (error) {
    if (reportPath) writeFileSync(reportPath, JSON.stringify({ status: 'failed', error: error.message }, null, 2) + '\n')
    console.error(error.message)
    process.exitCode = 1
  }
}
