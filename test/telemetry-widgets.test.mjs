import test from 'node:test'
import assert from 'node:assert/strict'
import { createRealtimeChannelRegistry, resolveWidget } from '../src/renderer/features/dashboard/widgets/channelRegistry.js'
import { createDefaultRealtimeDashboard, normalizeRealtimeDashboard } from '../src/renderer/features/dashboard/widgets/widgetPresets.js'
import { appendPlotSample, telemetryPlotRange } from '../src/shared/protocol/telemetry-plot.js'
import { telemetryCSV, recordingDuration } from '../src/shared/protocol/telemetry-log.js'
import { createRealtimeSlice } from '../src/renderer/core/store/realtimeSlice.js'
import { createSettingsSlice } from '../src/renderer/core/store/settingsSlice.js'
import { decodeOutputChannels } from '../src/shared/protocol/output-channels.js'

test('widget registry distinguishes zero, absent, disabled and suspect readings', () => {
  const channels = createRealtimeChannelRegistry({ configuration: { egoType: 0, vssMode: 0, tpsMin: 0, tpsMax: 0 } })
  assert.equal(channels.rpm.getDisplay({ rpm: 0 }).text, '0')
  assert.equal(channels.rpm.getDisplay({}).value, null)
  assert.equal(channels.afr.getDisplay({ afr: 0 }).available, false)
  assert.match(channels.afr.getDisplay({ afr: 0 }).reason, /disabled/)
  assert.equal(channels.vss.getDisplay({ vss: 0 }).available, false)
  assert.equal(channels.tps.getDisplay({ tps: 127.5 }).value, 127.5)
  assert.equal(channels.tps.getDisplay({ tps: 127.5 }).quality, 'check')
  assert.equal(channels.coolant.getDisplay({ coolant: 215 }).quality, 'check')
  const thermal = channels.thermalPair.getDisplay({ coolant: 0 })
  assert.equal(thermal.available, true); assert.equal(thermal.lines[0].value, '0'); assert.equal(thermal.lines[1].value, '—')
  assert.equal(channels.engineState.getDisplay({ engine: {} }).groups[0].active, null)
  assert.equal(channels.engineState.getDisplay({ engine: { running: false } }).groups[0].active, false)
})

test('missing channels in a partial INI remain unknown in the decoder', () => {
  const rt = decodeOutputChannels(Buffer.alloc(1), { outputChannels: { ochBlockSize: 1, channels: {} } })
  assert.equal(rt.rpm, null); assert.equal(rt.tpsADC, null)
  assert.equal(rt.engine.running, null); assert.equal(rt.performance.alsFuelCorr, null)
})

test('widget units, precision, load source and configured RPM thresholds stay coherent', () => {
  const c = createRealtimeChannelRegistry({ convertPress: x => x / 100, pressUnit: () => 'bar',
    convertTemp: x => x * 1.8 + 32, tempUnit: () => '°F', configuration: { algorithm: 1, engineProtectType: 1, SoftRevLim: 60, hardRevLim: 65 } })
  assert.equal(c.map.getDisplay({ map: 163 }).text, '1.63')
  assert.equal(c.coolant.getDisplay({ coolant: 87 }).value, 188.6)
  assert.equal(c.fuelLoad.getDisplay({ fuelLoadRaw: 240 }).value, 60)
  assert.equal(c.dwell.getDisplay({ dwell: 3.15 }).text, '3.150')
  assert.equal(c.dwellActual.getDisplay({ dwellActual: 0 }).text, '0.000')
  assert.equal(c.rpm.getDisplay({ rpm: 6400 }).warning, 6000)
  assert.equal(c.rpm.getDisplay({ rpm: 6400 }).danger, 6500)
  assert.equal(c.tps.getDisplay({ tps: 100 }).danger, undefined)
  assert.equal(c.afr.getDisplay({ afr: 20 }).danger, undefined)
})

test('layout normalization repairs malformed IDs/types without erasing unsupported channels or hidden widgets', () => {
  const a = createDefaultRealtimeDashboard(), b = createDefaultRealtimeDashboard()
  a.presets[0].widgets[0].enabled = false
  assert.equal(b.presets[0].widgets[0].enabled, true)
  const layout = normalizeRealtimeDashboard({ presets: [null, { id: 'a', widgets: [null,
    { id: 'same', channelKey: 'removed-channel', type: 'bad', enabled: false },
    { id: 'same', channelKey: 'rpm', type: 'trace' }] }, { id: 'a', widgets: [] }] })
  assert.equal(new Set(layout.presets.map(p => p.id)).size, 2)
  const widgets = layout.presets[0].widgets
  assert.equal(new Set(widgets.map(w => w.id)).size, 2)
  assert.equal(widgets[0].channelKey, 'removed-channel'); assert.equal(widgets[0].enabled, false)
  assert.equal(widgets[1].span, 2)
  assert.equal(resolveWidget(widgets[0], createRealtimeChannelRegistry()).unsupported, true)
  assert.equal(resolveWidget({ type: 'status', channelKey: 'rpm' }, createRealtimeChannelRegistry()).type, 'digital')
})

test('plots use unique packet timestamps, break stale lines and include outliers in the scale', () => {
  const h = { ts: [], vals: [], lastReceivedAt: null }
  assert.equal(appendPlotSample(h, 0, 1000, 1000), true)
  assert.equal(appendPlotSample(h, 10, 1000, 1001), false)
  appendPlotSample(h, null, 1000, 4000); appendPlotSample(h, null, 1000, 5000)
  appendPlotSample(h, 215, 6000, 6000)
  assert.deepEqual(h.vals, [0, null, 215])
  assert.ok(telemetryPlotRange(-40, 120, -50, 215)[1] > 215)
  assert.ok(telemetryPlotRange(-40, 120, -50, 215)[0] < -50)
  for (let i = 7; i < 80; i++) appendPlotSample(h, i, i * 1000, i * 1000)
  assert.ok(h.ts[1] >= 49); assert.ok(h.ts.length <= 32)
})

test('recordings retain provenance, stop on source changes and never start on stale data', t => {
  let now = 10000
  t.mock.method(Date, 'now', () => now)
  let s = { connection: { status: 'connected', handshakeStatus: 'ok', sessionId: 1, firmwareSignature: 'fixture' },
    currentProject: { projectName: 'Bench' }, projectEpoch: 1 }
  const set = patch => { s = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } }
  s = { ...s, ...createRealtimeSlice(set) }
  s.setLogRecording(true); assert.equal(s.logRecording, false)
  s.setRealtime({ rpm: 0 }); s.setLogRecording(true)
  now += 125; s.setRealtime({ rpm: 1000, coolant: 87, dwell: 3.15 })
  assert.equal(s.realtimeRateHz, 8)
  assert.equal(s.logEntries[0].source.projectName, 'Bench')
  assert.equal(s.logEntries[0].source.sessionId, 1)
  s.connection.sessionId = 2; now += 125; s.setRealtime({ rpm: 0 })
  assert.equal(s.logRecording, false); assert.equal(s.logEntries.length, 1); assert.equal(s.realtimeRateHz, null)
  now += 3000; s.setLogRecording(true); assert.equal(s.logRecording, false)
  assert.equal(recordingDuration(1000, 3662000), '01:01:01')
})

test('CSV keeps canonical units, legitimate zeros, unknown blanks and quoted provenance', () => {
  const csv = telemetryCSV([{ timestamp: 0, rpm: 0, coolant: 87, advance: -12, dwellActual: 0,
    source: { projectName: 'Bench, "A"', sessionId: 2 }, engine: { running: false } }])
  assert.ok(csv.includes('coolant_c')); assert.ok(csv.includes('dwell_measured_ms'))
  assert.ok(csv.includes('"Bench, ""A"""'))
  assert.ok(csv.includes(',-12,')); assert.ok(csv.includes('1970-01-01T00:00:00.000Z'))
  assert.ok(!csv.includes('undefined')); assert.ok(!csv.includes('NaN'))
  const [headers, row] = telemetryCSV([{ timestamp: 1, coolant: 215, iat: -40, source: { o2Enabled: false, tpsEndpointsDistinct: false } }]).trim().split('\r\n').map(line => line.split(','))
  const record = Object.fromEntries(headers.map((key, index) => [key, row[index]]))
  assert.equal(record.o2_enabled, '0'); assert.equal(record.tps_endpoints_distinct, '0')
  assert.equal(record.coolant_at_sensor_limit, '1'); assert.equal(record.iat_at_sensor_limit, '1')
  assert.equal(record.running, '')
})

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
test('rapid layout edits compose immediately and persist in order', async t => {
  const original = globalThis.window, calls = [], first = deferred()
  globalThis.window = { config: { saveSettings: async settings => { calls.push(settings); if (calls.length === 1) await first.promise } } }
  t.after(() => { globalThis.window = original })
  let s = {}; const set = patch => { s = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } }
  s = createSettingsSlice(set, () => s)
  const a = s.updateRealtimeDashboard(d => ({ ...d, activePresetId: 'street' }))
  const b = s.updateRealtimeDashboard(d => ({ ...d, presets: d.presets.map(p => p.id === 'street' ? { ...p, name: 'My layout' } : p) }))
  assert.equal(s.settings.realtimeDashboard.activePresetId, 'street')
  assert.equal(s.settings.realtimeDashboard.presets[1].name, 'My layout')
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls.length, 1)
  first.resolve(); await Promise.all([a, b]); assert.equal(calls.length, 2)
  assert.equal(calls[1].realtimeDashboard.activePresetId, 'street')
})

test('failed queued layout saves restore the last confirmed settings', async t => {
  const original = globalThis.window
  t.mock.method(console, 'error', () => {})
  globalThis.window = { config: { saveSettings: async () => { throw new Error('Disk failure') } } }
  t.after(() => { globalThis.window = original })
  let s = {}; const set = patch => { s = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } }
  s = createSettingsSlice(set, () => s)
  const originalSettings = s.settings
  await Promise.all([s.updateRealtimeDashboard(d => ({ ...d, activePresetId: 'street' })),
    s.updateRealtimeDashboard(d => ({ ...d, activePresetId: 'diag' }))])
  assert.equal(s.settings, originalSettings)
})
