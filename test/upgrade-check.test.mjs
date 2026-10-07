import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { checkPair, renderMetadataContract } from '../scripts/upgrade-check.mjs'
import { assertWritableContract } from '../src/shared/protocol/contract.js'
import { parseIni } from '../src/shared/ini-parser.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const firmwareRoot = process.env.RYN_FIRMWARE_ROOT
const content = readFileSync(resolve(root, 'speeduino.ini'), 'utf8')
const state = ini => ({ parsedIni: ini, currentProject: { ecu: { signature: ini.info.signature } } })

test('the runtime guard accepts paired Celsius/Fahrenheit metadata and rejects same-signature drift', () => {
  for (const symbols of [{ CELSIUS: true }, { FAHRENHEIT: true }, {}]) {
    const parsed = parseIni(content, symbols)
    assert.doesNotThrow(() => assertWritableContract(state(parsed)))
    for (const mutate of [
      ini => { ini.constants.pages[10].alsFuelModifier.offset++ },
      ini => { ini.constants.pages[10].alsFuelModifier.dataType = 'U08' },
      ini => { ini.constants.pages[6].rumbleIdleCutType.options.reverse() },
      ini => { ini.constants.pages[6].pitLimiterPin.bitRange = [0, 5] },
      ini => { ini.constants.pages[6].pitLimiterRPM.scale = 1 },
      ini => { ini.constants.pages[6].pitLimiterRPM.defaultValue++ },
      ini => { ini.constants.pageSizes[10]++ },
      ini => { ini.outputChannels.channels.alsActiveTime.offset++ },
      ini => { delete ini.constants.pages[6].pitLimiterPin.requiresPowerCycle },
    ]) {
      const changed = structuredClone(parsed)
      mutate(changed)
      assert.throws(() => assertWritableContract(state(changed)), /stale or incompatible/)
    }
  }
})

test('presentation-only INI differences preserve the runtime contract', () => {
  const parsed = parseIni(content, { CELSIUS: true })
  parsed.fieldHelp.alsFuelModifier = 'Project-specific explanation'
  parsed.dialogs = {}
  assert.doesNotThrow(() => assertWritableContract(state(parsed)))
  assert.equal(renderMetadataContract(content.replace(/\r\n/g, '\n')), renderMetadataContract(content))
})

test('a failed CLI check invalidates a previous success report', t => {
  const directory = mkdtempSync(resolve(tmpdir(), 'ryn-report-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const report = resolve(directory, 'report.json')
  writeFileSync(report, JSON.stringify({ status: 'software-validated' }))
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/upgrade-check.mjs'), '--firmware', directory, '--report', report], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.equal(JSON.parse(readFileSync(report, 'utf8')).status, 'failed')
})

function fixture(t) {
  const directory = mkdtempSync(resolve(tmpdir(), 'ryn-pair-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const pair = JSON.parse(readFileSync(resolve(root, 'compatibility/firmware.json'), 'utf8'))
  const paths = ['compatibility/firmware.json', 'speeduino.ini', 'src/shared/protocol/ini-contract.js', 'src/shared/protocol/avr-pin-mapping.js', ...Object.keys(pair.ownershipSources)]
  for (const path of paths) {
    mkdirSync(dirname(resolve(directory, path)), { recursive: true })
    copyFileSync(resolve(root, path), resolve(directory, path))
  }
  for (const args of [['init', '-q'], ['-c', 'user.name=Compatibility Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'fixture']]) {
    const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
  return directory
}

test('pair gate verifies the actual firmware checkout', { skip: !firmwareRoot }, async () => {
  const report = await checkPair(firmwareRoot)
  assert.equal(report.avrLayouts, 14)
  assert.equal(report.status, 'contract-checked')
})

test('pair gate rejects stale INI, generated map and configurator ownership sources', { skip: !firmwareRoot }, async t => {
  const directory = fixture(t)
  for (const [path, message] of [
    ['speeduino.ini', /Bundled INI differs/],
    ['src/shared/protocol/avr-pin-mapping.js', /AVR map is stale/],
    ['src/shared/protocol/ini-contract.js', /runtime INI contract is stale/],
    ['src/shared/protocol/board-pins.js', /pin ownership\/validation changed/],
  ]) {
    const filename = resolve(directory, path)
    const original = readFileSync(filename, 'utf8')
    writeFileSync(filename, original + '\n// drift\n')
    await assert.rejects(checkPair(firmwareRoot, { root: directory }), message)
    writeFileSync(filename, original)
  }
})

test('pair gate rejects a changed contract digest even when the signature still matches', { skip: !firmwareRoot }, async t => {
  const directory = fixture(t)
  const filename = resolve(directory, 'compatibility/firmware.json')
  const pair = JSON.parse(readFileSync(filename, 'utf8'))
  pair.contractSha256 = 'stale'
  writeFileSync(filename, JSON.stringify(pair))
  await assert.rejects(checkPair(firmwareRoot, { root: directory }), /Paired firmware contract changed/)
})

test('pair gate requires an immutable firmware SHA for repeatable CI', { skip: !firmwareRoot }, async t => {
  const directory = fixture(t)
  const filename = resolve(directory, 'compatibility/firmware.json')
  const pair = JSON.parse(readFileSync(filename, 'utf8'))
  pair.firmwareRef = 'master'
  writeFileSync(filename, JSON.stringify(pair))
  await assert.rejects(checkPair(firmwareRoot, { root: directory }), /immutable firmware commit SHA/)
})
