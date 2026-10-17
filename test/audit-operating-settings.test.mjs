import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseIni } from '../src/shared/ini-parser.js'
import { buildProjectInitialization } from '../src/renderer/features/projects/projectInitialization.js'
import { validateConfigurationChange } from '../src/shared/protocol/configuration-policy.js'
import { buildPinRegistry, isPinAssignmentField } from '../src/shared/protocol/pin-registry.js'

const ini = parseIni(readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8'), { CELSIUS: true })
const make = () => buildProjectInitialization({ parsedIni: ini, selectedBoardLayout: 41, initBaseTune: true,
  engine: { cylinders: 4, displacement: 2000, injectorFlow: 440, injectorOpenTime: 1, stoich: 14.7 } }).pages
const options = { platform: 'mega2560', injectorChannels: 4, ignitionChannels: 5 }

test('new tunes have positive operating limits without inventing TPS calibration', () => {
  const p = make()
  assert.equal(p[4].useDwellLim, 1)
  assert.ok(p[4].dwellLim * 10 >= Math.max(p[4].dwellrun, p[4].dwellcrank))
  assert.equal(p[4].tpsflood, 160)
  assert.ok(p[4].SoftRevLim > 0 && p[4].hardRevLim >= p[4].SoftRevLim)
  assert.equal(p[1].tpsMin, p[1].tpsMax)
  assert.deepEqual(p[10].crankingEnrichValues, [20, 20, 20, 20])
  assert.ok(p[10].crankingEnrichBins.every((v, i, all) => !i || v > all[i - 1]))
})

test('write policy rejects invalid combinations but lets an old tune be repaired', () => {
  const p = make()
  for (const [page, patch, match] of [[4, { dwellLim: 0 }, /Overdwell/], [4, { dwellcrank: 70 }, /Overdwell/],
    [4, { tpsflood: 0 }, /Flood-clear/], [1, { tpsMin: 1, tpsMax: 1 }, /endpoints/],
    [6, { engineProtectType: 1 }, null]]) {
    const next = structuredClone(p); Object.assign(next[page], patch)
    const error = validateConfigurationChange(ini, p, next, options)
    if (match) assert.match(error, match); else assert.equal(error, null)
  }
  const old = structuredClone(p); old[4].dwellLim = 0; old[4].tpsflood = 0
  const fixed = structuredClone(old); fixed[4].dwellLim = 6
  assert.equal(validateConfigurationChange(ini, old, fixed, options), null)
  const reverse = structuredClone(p); reverse[1].tpsMin = 200; reverse[1].tpsMax = 20
  assert.equal(validateConfigurationChange(ini, p, reverse, options), null)
  const map = structuredClone(p); map[1].algorithm = 0; map[1].reqFuel++
  assert.equal(validateConfigurationChange(ini, p, map, options), null)
})

test('logging enable is not a pin; disabled external logging has no active claim', () => {
  const p = make(), registry = buildPinRegistry(ini, p, options)
  assert.equal(isPinAssignmentField('onboard_log_trigger_Epin', ini.constants.pages[13].onboard_log_trigger_Epin), false)
  assert.equal(registry.rows.some(r => r.field === 'onboard_log_trigger_Epin'), false)
  assert.equal(registry.rows.find(r => r.field === 'onboard_log_tr5_Epin_pin').isActive, false)
  // Nitrous reserves output pins during initialization even with the feature off.
  assert.match(registry.rows.find(r => r.field === 'n2o_stage1_pin').activityReason, /initialization/)
  assert.match(registry.rows.find(r => r.field === 'n2o_stage1_pin').note, /Encoded pin value 0/)
})
