import React from 'react'
import { useStore } from '../../../core/store.js'
import { useTuningModule } from '../hooks/useTuningModule.js'
import { CurveTablePanel } from './CurveTablePanel.jsx'
import { buildCurvePreset, curveMetadata, curveDisplay, curveRaw, inspectCurve, curvePreset, describeCurveValues } from '../../../../shared/protocol/curve-presets.js'

function extent(values, fallback, step) {
  const valid = values.filter(Number.isFinite)
  const min = Math.min(fallback.min, ...valid), max = Math.max(fallback.max, ...valid)
  return { min, max: max > min ? max : min + step }
}

const precision = meta => Math.max(meta?.digits ?? 0, String(meta?.scale ?? 1).split('.')[1]?.length ?? 0)
const X_LABELS = {
  brvBins: 'Battery voltage', injAngRPM: 'Engine speed', airDenBins: 'Intake temperature',
  wueBins: 'Coolant temperature', primeBins: 'Coolant temperature', aseBins: 'Coolant temperature',
  iacBins: 'Coolant temperature', flexFuelBins: 'Ethanol', flexAdvBins: 'Ethanol', flexBoostBins: 'Ethanol',
  iatRetBins: 'Intake temperature', cltAdvBins: 'Coolant temperature', fanPWMBins: 'Coolant temperature',
  wmiAdvBins: 'MAP', coolantProtTemp: 'Coolant temperature', oilPressureProtRPM: 'Engine speed', rollingProtRPMDelta: 'RPM below limit',
}
const Y_VIEWS = {
  injBatRates: [50, 200], injAng: [0, 720], airDenRates: [40, 160], wueRates: [100, 200],
  primePulse: [0, 25], asePct: [0, 100], aseCount: [0, 30], iacCLValues: [500, 2000],
  flexFuelAdj: [50, 200], flexAdvAdj: [-10, 20], flexBoostAdj: [-100, 100], dwellRates: [50, 200],
  iatRetRates: [0, 30], cltAdvValues: [-15, 15], PWMFanDuty: [0, 100], wmiAdvAdj: [-10, 20],
  coolantProtRPM: [0, 10000], oilPressureProtMins: [0, 100], rollingProtCutPercent: [0, 100],
}

// All curves share the same project drafts and explicit Save/Burn flow.
export default function IniCurvePanel({ xName, yName, liveXValue = null, ...props }) {
  const ini = useStore(s => s.parsedIni)
  const { getFieldValue, setFieldValue, localConstants } = useTuningModule([xName, yName])
  const xMeta = curveMetadata(ini, xName, localConstants), yMeta = curveMetadata(ini, yName, localConstants)
  let preset = null, metadataError = null
  try { preset = buildCurvePreset(ini, yName, localConstants) } catch (error) { metadataError = error.message }
  const decode = (raw, meta) => Array.isArray(raw) && meta ? raw.map(value => curveDisplay(value, meta)) : []
  const x = decode(getFieldValue(xName), xMeta), y = decode(getFieldValue(yName), yMeta)
  const definition = curvePreset(yName)
  const issues = inspectCurve(x, y, xMeta, yMeta, definition)
  if (preset && x.length === preset.x.length && x.every((value, i) => Number.isFinite(value) && value >= xMeta.lo && value <= xMeta.hi && (!i || value > x[i - 1]))) {
    preset = { ...preset, x: [...x] }
  }
  const xStep = xMeta?.scale || 1, yStep = yMeta?.scale || 1
  const range = values => ({ min: Math.min(...values), max: Math.max(...values) })
  const xRange = preset ? extent(x, range(preset.x), xStep) : props.xRange || { min: 0, max: 100 }
  const view = Y_VIEWS[yName] || [0, 100]
  const yRange = preset ? extent(y, { min: view[0], max: view[1] }, yStep) : props.yRange || { min: 0, max: 100 }
  return <CurveTablePanel {...props}
    xValues={x} yValues={y} xRange={xRange} yRange={yRange}
    xLabel={`${X_LABELS[xName] || xName} (${xMeta?.units || ''})`} yLabel={`${props.title} (${yMeta?.units || ''})`}
    xUnit={xMeta?.units} yUnit={yMeta?.units}
    xBounds={{ min: xMeta?.lo ?? 0, max: xMeta?.hi ?? 100 }}
    yBounds={{ min: yMeta?.lo ?? 0, max: yMeta?.hi ?? 100 }}
    xStep={xStep} step={yStep} xPrecision={precision(xMeta)} precision={precision(yMeta)}
    disabled={props.disabled || !!metadataError} error={metadataError || props.error}
    curveIssues={issues} preset={preset} footerNote={definition?.note}
    valueStatus={preset && !issues.length ? describeCurveValues(y, preset) : null}
    liveXValue={xMeta?.units === 'F' && Number.isFinite(liveXValue) ? liveXValue * 1.8 + 32 : liveXValue}
    normalize={(nextX, nextY) => {
      const roundedX = nextX.map(value => curveDisplay(curveRaw(value, xMeta), xMeta))
      const ordered = roundedX.every((value, i) => !i || value > roundedX[i - 1])
      return { x: ordered ? roundedX : x, y: nextY.map(value => curveDisplay(curveRaw(value, yMeta), yMeta)) }
    }}
    onChange={(nextX, nextY) => {
      setFieldValue(xName, nextX.map(value => curveRaw(value, xMeta)))
      setFieldValue(yName, nextY.map(value => curveRaw(value, yMeta)))
    }} />
}
