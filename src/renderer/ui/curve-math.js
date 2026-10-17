export function roundAxis(value, precision = 0, step = 10 ** -precision) {
  return Number((Math.round(value / step) * step).toFixed(precision))
}

export function evenlySpaceCurveAxis(values, fallback, precision = 0, step = 10 ** -precision) {
  if (values.length < 2) return [...values]
  const ordered = values.every((value, i) => Number.isFinite(value) && (!i || value > values[i - 1]))
  const start = ordered ? values[0] : fallback.min
  const end = ordered ? values.at(-1) : fallback.max
  return values.map((_, index) => index === 0 ? start : index === values.length - 1 ? end
    : roundAxis(start + (end - start) * index / (values.length - 1), precision, step))
}

export function moveCurvePoint(xValues, yValues, index, point, options = {}) {
  const { xRange, yRange, xPrecision = 0, precision = 0,
    xStep = 10 ** -xPrecision, step = 10 ** -precision, xFixed = false } = options
  const x = [...xValues], y = [...yValues]
  if (index < 0 || index >= Math.min(x.length, y.length)) return { x, y }
  if (!xFixed && Number.isFinite(point.x)) {
    const low = Math.max(xRange.min, index > 0 ? x[index - 1] + xStep : -Infinity)
    const high = Math.min(xRange.max, index + 1 < x.length ? x[index + 1] - xStep : Infinity)
    const first = Math.ceil((low - 1e-9) / xStep) * xStep
    const last = Math.floor((high + 1e-9) / xStep) * xStep
    if (first <= last) x[index] = Number(Math.max(first, Math.min(last, roundAxis(point.x, xPrecision, xStep))).toFixed(xPrecision))
  }
  if (Number.isFinite(point.y)) y[index] = Math.max(yRange.min,
    Math.min(yRange.max, roundAxis(point.y, precision, step)))
  return { x, y }
}

export function interpolateCurve(x, y, value) {
  if (!x.length || !Number.isFinite(value)) return null
  if (value <= x[0]) return y[0]
  for (let i = 1; i < x.length; i++) {
    if (value <= x[i]) return x[i] > x[i - 1]
      ? y[i - 1] + (y[i] - y[i - 1]) * (value - x[i - 1]) / (x[i] - x[i - 1]) : y[i]
  }
  return y[x.length - 1]
}
