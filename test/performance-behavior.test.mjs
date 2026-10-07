import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseIni, getVarMetadata } from '../src/shared/ini-parser.js'
import { selectedPerformanceFeature, performanceFeatureState, validatePerformanceSettings } from '../src/shared/protocol/performance-features.js'
import { validateConfigurationValues } from '../src/shared/protocol/configuration-validation.js'

const ini = parseIni(readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8'), { CELSIUS: true })

test('rumble labels match actual firmware OFF/IGN/FUEL/BOTH byte values', () => {
  const meta = getVarMetadata(ini, 'rumbleIdleCutType')
  assert.deepEqual(meta.options, ['Disabled', 'Ignition Only', 'Fuel Only', 'Both'])
  assert.equal(meta.defaultValue, 1)
  assert.equal(validateConfigurationValues(ini, { 6: { rumbleIdlePatternLength: 8, rumbleIdleFrequency: 30 } }), null)
  assert.match(validateConfigurationValues(ini, { 6: { rumbleIdlePatternLength: 15 } }), /invalid option/)
  assert.match(validateConfigurationValues(ini, { 6: { rumbleIdleFrequency: 31 } }), /range/)
})

test('fuel modifier range matches the effective 70–150 percent clamp', () => {
  for (const name of ['alsFuelModifier', 'rollingPopBangFuelModifier']) {
    const meta = getVarMetadata(ini, name)
    assert.equal(meta.lo, -30)
    assert.equal(meta.hi, 50)
  }
})

test('live status uses exactly the firmware effect priority and reports waiting', () => {
  const status = { rollingPopBangActive: true }
  assert.equal(selectedPerformanceFeature(status), 'popBang')
  status.alsActive = true
  assert.deepEqual(performanceFeatureState('popBang', status), { selected: 'als', conditionsMet: true, selectedLabel: 'ALS' })
  status.rumbleIdleActive = true
  assert.equal(selectedPerformanceFeature(status), 'rumbleIdle')
  status.pitLimiterActive = true
  assert.equal(selectedPerformanceFeature(status), 'pitLimiter')
})

test('soft and rolling pit mode reject settings that produce no intervention', () => {
  const values = { pitLimiterEnabled: 1, pitLimiterCutType: 1, pitLimiterRPM: 0, engineProtectType: 3 }
  assert.match(validatePerformanceSettings('pitLimiter', values), /RPM limit/)
  values.pitLimiterRPM = 40
  values.engineProtectType = 2
  assert.match(validatePerformanceSettings('pitLimiter', values), /ignition/)
  values.engineProtectType = 3
  assert.equal(validatePerformanceSettings('pitLimiter', values), null)
  values.pitLimiterCutType = 2
  values.engineProtectType = 0
  assert.match(validatePerformanceSettings('pitLimiter', values), /enabled/)
  assert.equal(getVarMetadata(ini, 'pitLimiterRPM').lo, 0)
})

test('ALS/rumbles validate activation windows, while disabling remains possible', () => {
  const values = { alsEnabled: 1, alsMaxTPS: 5, alsMinCLT: 90, alsMaxCLT: 70 }
  assert.match(validatePerformanceSettings('als', values), /Min CLT/)
  values.alsEnabled = 0
  assert.equal(validatePerformanceSettings('als', values), null)
  assert.match(validatePerformanceSettings('rumbleIdle', { rumbleIdleEnabled: 1, rumbleIdleMinRPM: 20, rumbleIdleMaxRPM: 10 }), /Min RPM/)
  assert.equal(getVarMetadata(ini, 'alsTargetRPM').lo, 0)
})

test('ALS UI exposes the target that gates both cut patterns; pit exposes shared controls', () => {
  const als = readFileSync(new URL('../src/renderer/features/racing/AntiLag.jsx', import.meta.url), 'utf8')
  assert.match(als, /value=\{getValue\("alsTargetRPM"\)\}/)
  const pit = readFileSync(new URL('../src/renderer/features/racing/PitLimiter.jsx', import.meta.url), 'utf8')
  for (const field of ['SoftLimitMode', 'SoftLimRetard', 'engineProtectType']) {
    assert.ok(pit.includes(`value={getValue("${field}")}`), field)
  }
})
