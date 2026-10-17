import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseIni, getVarMetadata } from '../src/shared/ini-parser.js'
import { CURVE_PRESETS, buildCurvePreset, curveDisplay, curveRaw, inspectCurve, describeCurveValues } from '../src/shared/protocol/curve-presets.js'
import { evenlySpaceCurveAxis } from '../src/renderer/ui/curve-math.js'
import { buildProjectInitialization } from '../src/renderer/features/projects/projectInitialization.js'
import { createInitializationPages } from '../src/shared/protocol/initialization-pages.js'
import { validatePageSnapshot } from '../src/shared/protocol/page-cache.js'
import { normalizeProjectV3, serializeProjectForSave } from '../src/renderer/core/store/utils/project.normalization.js'

const content = readFileSync(new URL('../speeduino.ini', import.meta.url), 'utf8')
const engine = { cylinders: 4, displacement: 2000, injectorFlow: 440, injectorOpenTime: 1, stoich: 14.7 }
for (const flags of [{ CELSIUS: true }, { FAHRENHEIT: true }]) {
  const ini = parseIni(content, flags)
  for (const initBaseTune of [true, false]) test(`all ${CURVE_PRESETS.length} curves survive binary pages and save/reload (${Object.keys(flags)[0]}, starter maps ${initBaseTune})`, () => {
    const result = buildProjectInitialization({ parsedIni: ini, selectedBoardLayout: 3, engine: initBaseTune ? engine : {}, initBaseTune })
    assert.equal(result.metadata.curves.length, CURVE_PRESETS.length)
    assert.equal(result.metadata.calibrationRequired, true)
    const project = normalizeProjectV3({ projectName: 'Curves', ini: { content }, constants: result.constants, engine }, ini)
    const saved = serializeProjectForSave(project, {})
    const loaded = normalizeProjectV3(JSON.parse(JSON.stringify(saved)), ini)
    for (const definition of CURVE_PRESETS) {
      const preset = buildCurvePreset(ini, definition.yName, loaded.constants.decodedPages)
      const rawX = loaded.constants.decodedPages[preset.xMeta.page][definition.xName]
      const rawY = loaded.constants.decodedPages[preset.yMeta.page][definition.yName]
      assert.deepEqual(rawX, preset.xRaw, definition.xName)
      assert.deepEqual(rawY, preset.yRaw, definition.yName)
      assert.deepEqual(inspectCurve(rawX.map(v => curveDisplay(v, preset.xMeta)), rawY.map(v => curveDisplay(v, preset.yMeta)), preset.xMeta, preset.yMeta, definition), [])
    }
    for (const [page, snapshot] of Object.entries(loaded.constants.pages)) validatePageSnapshot(snapshot, ini.constants.pageSizes[page])
    const decoded = loaded.constants.decodedPages
    for (const name of ['flexEnabled', 'boostEnabled', 'fanEnable', 'wmiEnabled', 'wmiAdvEnabled']) {
      const meta = getVarMetadata(ini, name)
      assert.equal(decoded[meta.page][name], 0, `${name} remains disabled`)
    }
  })
  test(`repair proposal preserves source, uses actual INI offsets and units (${Object.keys(flags)[0]})`, () => {
    const original = createInitializationPages(ini).constants.decodedPages
    const before = JSON.stringify(original)
    for (const name of ['airDenRates', 'wueRates', 'dwellRates', 'flexAdvAdj', 'cltAdvValues', 'PWMFanDuty']) {
      const proposal = buildCurvePreset(ini, name, original)
      const x = original[proposal.xMeta.page][proposal.xName].map(v => curveDisplay(v, proposal.xMeta))
      const y = original[proposal.yMeta.page][name].map(v => curveDisplay(v, proposal.yMeta))
      assert.ok(inspectCurve(x, y, proposal.xMeta, proposal.yMeta, proposal).length > 0, name)
      assert.deepEqual(proposal.x.map(v => curveRaw(v, proposal.xMeta)), proposal.xRaw)
      assert.deepEqual(proposal.y.map(v => curveRaw(v, proposal.yMeta)), proposal.yRaw)
    }
    assert.equal(JSON.stringify(original), before)
    assert.ok(buildCurvePreset(ini, 'flexAdvAdj').yRaw.every(v => v === 40))
    assert.ok(buildCurvePreset(ini, 'cltAdvValues').yRaw.every(v => v === 15))
  })
}

test('invalid and unrepresentable INI curve contracts fail explicitly', () => {
  const ini = parseIni(content, { CELSIUS: true })
  const preset = buildCurvePreset(ini, 'flexFuelAdj')
  assert.deepEqual(inspectCurve([], [], preset.xMeta, preset.yMeta, preset), ['Curve points are missing or do not match the INI dimensions.'])
  const changed = structuredClone(ini)
  changed.constants.pages[preset.xMeta.page].flexFuelBins.shape = [5]
  assert.throws(() => buildCurvePreset(changed, 'flexFuelAdj'), /dimensions/)
  changed.constants.pages[preset.xMeta.page].flexFuelBins.shape = [6]
  changed.constants.pages[preset.xMeta.page].flexFuelBins.hi = 1
  assert.throws(() => buildCurvePreset(changed, 'flexFuelAdj'), /ordered/)
})

test('flex boost preset is signed kPa offset and accepts negative calibration', () => {
  const preset = buildCurvePreset(parseIni(content, { CELSIUS: true }), 'flexBoostAdj')
  assert.equal(preset.yMeta.units, 'kPa')
  assert.equal(preset.yMeta.dataType, 'S16')
  assert.equal(curveRaw(-25, preset.yMeta), -25)
  assert.ok(preset.y.every(value => value === 0))
})

test('curve labels distinguish a neutral baseline, reference and edits without claiming calibration', () => {
  const ini = parseIni(content, { CELSIUS: true })
  const neutral = buildCurvePreset(ini, 'airDenRates')
  assert.equal(describeCurveValues(neutral.y, neutral).label, 'Nilai awal netral')
  assert.equal(describeCurveValues(neutral.y, neutral).flat, true)
  const reference = buildCurvePreset(ini, 'iacCLValues')
  assert.equal(describeCurveValues(reference.y, reference).label, 'Nilai referensi awal')
  const edited = [...neutral.y]; edited[0] = 105
  assert.equal(describeCurveValues(edited, neutral).label, 'Nilai disesuaikan')
  assert.equal(describeCurveValues(edited, neutral).flat, false)
})

test('spacing X retains the tuned operating range and never mutates input values', () => {
  const x = [6, 8, 12, 15], y = [150, 130, 100, 95]
  assert.deepEqual(evenlySpaceCurveAxis(x, { min: 0, max: 24 }, 1, 0.1), [6, 9, 12, 15])
  assert.deepEqual(x, [6, 8, 12, 15])
  assert.deepEqual(y, [150, 130, 100, 95])
  assert.deepEqual(evenlySpaceCurveAxis([-40, -40, -40], { min: -40, max: 100 }), [-40, 30, 100])
})
