import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseIni, getVarMetadata } from '../src/shared/ini-parser.js'

const root = resolve(import.meta.dirname, '..')
const ini = parseIni(readFileSync(resolve(root, 'speeduino.ini'), 'utf8'), { CELSIUS: true })
const directory = resolve(root, '.cache/contract-fix')
mkdirSync(directory, { recursive: true })
const bundle = await build({
  stdin: { contents: `export {default as PinSelect} from './src/renderer/features/shared/components/PinSelect.jsx';
export {SelectField} from './src/renderer/features/shared/components/SelectField.jsx';
export {default as ProgrammableOutputs} from './src/renderer/features/io/ProgrammableOutputs.jsx';`, resolveDir: root },
  bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external',
  plugins: [{ name: 'pin-store-fixture', setup(builder) {
    builder.onResolve({ filter: /(?:^|\/)core\/store(?:\.js)?$/ }, () => ({ path: 'pin-store', namespace: 'pin-store' }))
    builder.onLoad({ filter: /.*/, namespace: 'pin-store' }, () => ({ contents: 'export const useStore = selector => selector ? selector(globalThis.__pinSelectorState) : globalThis.__pinSelectorState' }))
    builder.onResolve({ filter: /\/hooks\/useTuningModule(?:\.js)?$/ }, () => ({ path: 'pin-tuning', namespace: 'pin-tuning' }))
    builder.onLoad({ filter: /.*/, namespace: 'pin-tuning' }, () => ({ contents: 'export const useTuningModule = () => globalThis.__pinTuningState' }))
  } }],
})
const path = resolve(directory, 'pin-selector-test.cjs')
writeFileSync(path, bundle.outputFiles[0].text)
const { PinSelect, SelectField, ProgrammableOutputs } = createRequire(import.meta.url)(path)

function state(t) {
  const previous = globalThis.__pinSelectorState
  const decodedPages = { 1: { pinLayout: 3 }, 6: {}, 10: {} }
  globalThis.__pinSelectorState = { parsedIni: ini,
    currentProject: { constants: { decodedPages }, hardware: { pinMapPlatform: 'mega2560', channelBuild: 'standard' } } }
  t.after(() => { if (previous === undefined) delete globalThis.__pinSelectorState; else globalThis.__pinSelectorState = previous })
  return decodedPages
}

for (const value of [1, 99]) {
  test(`pin selector displays unsupported raw ${value} rather than another selectable pin`, t => {
    state(t)
    const html = renderToStaticMarkup(React.createElement(PinSelect, { fieldName: 'pitLimiterPin', label: 'Pit pin', value, onChange() {} }))
    assert.match(html, new RegExp(`INI value ${value}`))
    assert.match(html, /Unavailable/)
    assert.match(html, /data-pin-status="invalid"/)
    assert.match(html, /aria-invalid="true"/)
  })
}

test('pin selector keeps the complete INI auto-mode label', t => {
  state(t)
  const html = renderToStaticMarkup(React.createElement(PinSelect, { fieldName: 'alsSwitchPin', label: 'ALS pin', value: 0, onChange() {} }))
  assert.ok(html.includes(getVarMetadata(ini, 'alsSwitchPin').options[0]))
})

test('selector identifies the preview source and incomplete channel mapping', t => {
  state(t)
  globalThis.__pinSelectorState.currentProject.hardware.channelBuild = ''
  const html = renderToStaticMarkup(React.createElement(PinSelect, { fieldName: 'alsSwitchPin', label: 'ALS pin', value: 30, onChange() {} }))
  assert.match(html, /Project preview/)
  assert.match(html, /Live ECU check when writing/)
  assert.match(html, /Mapping incomplete/)
  assert.match(html, /channel build is unknown/)
  assert.match(html, /data-pin-status="warning"/)
})

test('standard SelectField delegates pin metadata to the same selector and uses unsaved ownership', t => {
  const pages = state(t)
  const draft = structuredClone(pages)
  draft[10] = { alsEnabled: 1, alsSwitchPin: 47 }
  const html = renderToStaticMarkup(React.createElement(SelectField, {
    name: 'fanPin', label: 'Fan pin', getValue: () => 0,
    getFieldInfo: name => ({ meta: getVarMetadata(ini, name) }), updateValue() {}, pinPages: draft,
  }))
  assert.match(html, /Pin reserved by another feature/)
  assert.match(html, /ALS Switch Pin/)
  assert.match(html, /D47/)
  assert.equal(pages[10].alsEnabled, undefined)
})

test('programmable outputs selector receives the tuning draft rather than store-only pages', t => {
  const pages = state(t), draft = structuredClone(pages)
  draft[10] = { alsEnabled: 1, alsSwitchPin: 47 }
  draft[13] = { outputPin0: 47 }
  const previous = globalThis.__pinTuningState
  globalThis.__pinTuningState = { pinPages: draft, localConstants: { 13: draft[13] },
    isReady: true, isConnected: false, isSaving: false, isDirty: true }
  t.after(() => { if (previous === undefined) delete globalThis.__pinTuningState; else globalThis.__pinTuningState = previous })
  const html = renderToStaticMarkup(React.createElement(ProgrammableOutputs))
  assert.match(html, /ALS Switch Pin/)
  assert.equal(pages[10].alsEnabled, undefined)
})
