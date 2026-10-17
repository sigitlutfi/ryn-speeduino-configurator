import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = new URL('../.cache/realtime-ui-audit.mjs', import.meta.url)
await mkdir(new URL('../.cache/', import.meta.url), { recursive: true })
await build({
  stdin: { resolveDir: root, loader: 'jsx', contents: `
    import React from 'react'
    import { renderToStaticMarkup } from 'react-dom/server'
    import Dashboard from './src/renderer/features/dashboard/Dashboard.jsx'
    import Analysis from './src/renderer/features/dashboard/Analysis.jsx'
    import IndicatorTray from './src/renderer/features/shared/components/IndicatorTray.jsx'
    import { TuningTablePage } from './src/renderer/features/shared/components/TuningTablePage.jsx'
    import { CalibrationTable } from './src/renderer/features/tools/CalibrationTables.jsx'
    import WidgetTile from './src/renderer/features/dashboard/widgets/WidgetTile.jsx'
    import Gauge from './src/renderer/ui/Gauge/Index.jsx'
    import { setSnapshot } from './src/renderer/core/store.js'
    export function renderTelemetry(view, state) {
      setSnapshot(state)
      if (view === 'tuning') return renderToStaticMarkup(<TuningTablePage tableKey="ve" iniTableId="veTable1Tbl" />)
      if (view === 'calibration') return renderToStaticMarkup(<CalibrationTable sensor="clt" title="CLT" />)
      const Component = view === 'analysis' ? Analysis : view === 'indicators' ? IndicatorTray : Dashboard
      return renderToStaticMarkup(<Component />)
    }
    export function renderWidget(state, widget, display) {
      setSnapshot(state)
      return renderToStaticMarkup(<WidgetTile widget={widget} display={display} color="#d672ff" telemetryStatus="live" />)
    }
    export function renderGauges(state) {
      setSnapshot(state)
      return renderToStaticMarkup(<><Gauge label="RPM" value={1000} max={8000} color="#d672ff" /><Gauge label="RPM" value={2000} max={8000} color="#00ffb4" /><Gauge label="Battery" value={14} max={18} warning={11} warningMode="low" color="#d672ff" /></>)
    }
  ` },
  bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: fileURLToPath(output),
  plugins: [{ name: 'realtime-state-fixture', setup(builder) {
    builder.onResolve({ filter: /\/useTableSync\.js$/ }, () => ({ path: 'table', namespace: 'table-fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'table-fixture' }, () => ({ contents: `
      export const useTableSync = () => ({ values: [[50,60],[70,80]], rpmAxis: [500,1000], loadAxis: [0,100], meta: { title: 'VE' }, scaling: {}, update() {}, handleSave() {}, isDirty: false })
    ` }))
    builder.onResolve({ filter: /(?:^|\/)core\/store(?:\.js)?$/ }, () => ({ path: 'store', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      let snapshot
      export function setSnapshot(value) { snapshot = value }
      export function useStore(selector = x => x) { return selector(snapshot) }
      useStore.getState = () => snapshot
    ` }))
    builder.onResolve({ filter: /\.css$/ }, () => ({ path: 'css', namespace: 'empty' }))
    builder.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '' }))
  } }],
})
const { renderTelemetry, renderWidget, renderGauges } = await import(output.href)

function fixture(status) {
  const now = Date.now()
  return {
    connection: { status: status === 'offline' ? 'disconnected' : 'connected', handshakeStatus: 'ok', sessionId: 1 },
    projectEpoch: 1, realtimeError: status === 'blocked' ? 'INI mismatch' : null,
    realtimeReceivedAt: status === 'waiting' ? null : now - (status === 'stale' ? 5000 : 0),
    realtime: { rpm: 4321, map: 180, tps: 60, coolant: 87, iat: 20, battery: 14.2,
      afr: 14.7, advance: -12, pw1: 12.345, engine: { running: true }, freeRAM: 1600 },
    currentProject: { units: { temperature: 'celsius' } }, settings: { accentColor: 'cyan' },
    updateRealtimeDashboard() {}, logEntries: [], logRecording: false, setLogRecording() {}, clearLog() {}, showIndicatorTray: true, toggleIndicatorTray() {},
    convertTemp: x => x, convertPress: x => x, convertSpeed: x => x,
    tempUnit: () => '°C', pressUnit: () => 'kPa', speedUnit: () => 'km/h',
  }
}

test('tuning tables render a blocked status without crashing or reusing cached telemetry', () => {
  const html = renderTelemetry('tuning', fixture('blocked'))
  assert.ok(html.includes('TELEMETRY BLOCKED'))
  assert.ok(!html.includes('4321'))
})

test('calibration renders a real generated curve and disables EEPROM writes offline', () => {
  const html = renderTelemetry('calibration', fixture('offline'))
  assert.ok(html.includes('Write table and verify CRC'))
  assert.ok(html.includes('disabled=""'))
  assert.ok(/polyline points="[^"]{100,}"/.test(html))
  assert.ok(html.includes('editable reference'))
})

test('duplicate gauges have distinct SVG definitions and respect their individual colors', () => {
  const html = renderGauges(fixture('live'))
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1])
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(html.includes('#d672ff')); assert.ok(html.includes('#00ffb4'))
  assert.ok(!html.includes('#f43f5e'), 'a missing low danger threshold must not turn every value red')
})

test('status widgets preserve unknown flags while displaying an explicit false as OFF', () => {
  const html = renderWidget(fixture('live'), { type: 'status', channelKey: 'engineState' },
    { label: 'Engine', available: true, groups: [{ label: 'Running', active: false }, { label: 'Sync', active: null }] })
  assert.ok(html.includes('OFF')); assert.ok(html.includes('—'))
  assert.equal((html.match(/>OFF</g) || []).length, 1)
})

test('unavailable sensors explain their absence and never render a believable zero', () => {
  const html = renderWidget(fixture('live'), { type: 'digital', channelKey: 'afr' },
    { label: 'AFR', available: false, value: null, reason: 'O₂ sensor disabled', unit: 'AFR' })
  assert.ok(html.includes('O₂ sensor disabled')); assert.ok(html.includes('NO DATA')); assert.ok(html.includes('—'))
})

test('indicator tray does not report STOPPED when the running flag is missing', () => {
  const state = fixture('live'); state.realtime.engine = {}
  const html = renderTelemetry('indicators', state)
  assert.ok(!html.includes('STOPPED')); assert.ok(html.includes('—'))
})

test('the indicator tray distinguishes unavailable engine status from stopped/off', () => {
  assert.ok(renderTelemetry('indicators', fixture('live')).includes('RUNNING'))
  for (const status of ['offline', 'waiting', 'stale', 'blocked']) {
    const html = renderTelemetry('indicators', fixture(status))
    assert.ok(!html.includes('RUNNING'))
    assert.ok(!html.includes('STOPPED'))
    assert.ok(html.includes('—'))
    assert.ok(html.includes(status))
  }
})

test('dashboard exposes invalid calibration while preserving the actual received value', () => {
  const state = fixture('live')
  state.realtime.tps = 127.5
  state.currentProject.constants = { decodedPages: { 1: { tpsMin: 0, tpsMax: 0 } } }
  const html = renderTelemetry('dashboard', state)
  assert.ok(html.includes('TPS calibration has identical'))
  assert.ok(html.includes('role="alert"'))
})

for (const view of ['dashboard', 'analysis']) {
  test(`${view} binds received telemetry into visible numeric values`, () => {
    const html = renderTelemetry(view, fixture('live'))
    for (const value of ['4321', '14.7', '-12', '87']) assert.ok(html.includes(value), `${view}: ${value}`)
    assert.ok(html.includes('12.35'))
  })
  for (const status of ['offline', 'waiting', 'stale', 'blocked']) {
    test(`${view} hides old values when telemetry is ${status}, even with a cached sample`, () => {
      const html = renderTelemetry(view, fixture(status))
      assert.ok(!html.includes('4321'))
      assert.ok(!html.includes('12.35'))
      assert.ok(html.includes('—'))
      assert.ok(html.toLowerCase().includes(status))
    })
  }
}
