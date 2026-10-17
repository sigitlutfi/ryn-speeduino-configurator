import { appendTelemetrySample } from './tuning-live.js'

export function appendPlotSample(history, value, timestamp, now = Date.now(), windowSeconds = 30) {
  if (!appendTelemetrySample(history, value, timestamp, now, 600)) return false
  const cutoff = history.ts.at(-1) - windowSeconds
  while (history.ts.length > 1 && history.ts[1] < cutoff) { history.ts.shift(); history.vals.shift() }
  return true
}

export function telemetryPlotRange(baseMin, baseMax, observedMin, observedMax) {
  const lo = Number.isFinite(baseMin) ? baseMin : 0, hi = Number.isFinite(baseMax) && baseMax > lo ? baseMax : lo + 1
  const min = Number.isFinite(observedMin) ? Math.min(lo, observedMin) : lo
  const max = Number.isFinite(observedMax) ? Math.max(hi, observedMax) : hi
  const padding = (max - min) * 0.04
  return [min < lo ? min - padding : lo, max > hi ? max + padding : hi]
}
