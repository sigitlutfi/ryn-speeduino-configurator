export const TELEMETRY_MAX_AGE = 2000

export function telemetryState(connected, receivedAt, now = Date.now()) {
  if (!connected) return 'offline'
  if (!Number.isFinite(receivedAt) || receivedAt <= 0) return 'waiting'
  return now - receivedAt <= TELEMETRY_MAX_AGE && now >= receivedAt ? 'live' : 'stale'
}

export function telemetryIssues(realtime, sensorSettings = {}) {
  if (!realtime) return []
  const issues = []
  if (Number.isFinite(sensorSettings.tpsMin) && sensorSettings.tpsMin === sensorSettings.tpsMax) {
    issues.push('TPS calibration has identical minimum and maximum values; calibrate TPS before trusting its percentage.')
  } else if (Number.isFinite(realtime.tps) && (realtime.tps < 0 || realtime.tps > 100)) {
    issues.push('TPS is outside 0–100%; check its calibration and input.')
  }
  const temperatures = [['CLT', realtime.coolant], ['IAT', realtime.iat]].filter(([, value]) => value === 215)
  if (temperatures.length) issues.push(`${temperatures.map(([name]) => name).join('/')} is at the telemetry upper limit; verify sensors and temperature calibration.`)
  return issues
}

export function liveTpsADC(state, now = Date.now()) {
  const connected = state.connection?.status === 'connected' && state.connection.handshakeStatus === 'ok'
  const value = state.realtime?.tpsADC
  return !state.realtimeError && telemetryState(connected, state.realtimeReceivedAt, now) === 'live' &&
    Number.isInteger(value) && value >= 0 && value <= 255 ? value : null
}

// Charts append once per ECU packet, with a gap when telemetry stops.
export function appendTelemetrySample(history, value, receivedAt, now = Date.now(), limit = 300) {
  if (Number.isFinite(value) && Number.isFinite(receivedAt) && receivedAt > 0) {
    if (history.lastReceivedAt === receivedAt) return false
    history.lastReceivedAt = receivedAt
    history.ts.push(receivedAt / 1000)
    history.vals.push(value)
  } else {
    if (!history.vals.length || history.vals.at(-1) === null) return false
    history.ts.push(now / 1000)
    history.vals.push(null)
  }
  if (history.ts.length > limit) {
    history.ts.splice(0, history.ts.length - limit)
    history.vals.splice(0, history.vals.length - limit)
  }
  return true
}

export function loadAxisLabel(algorithm, ignition = false) {
  const source = ['MAP kPa', 'TPS %', 'IMAP/EMAP %'][algorithm]
  return source ? `${ignition ? 'Ignition' : 'Fuel'} load · ${source}` : 'Unsupported load source'
}

export function operatingLoad(realtime, algorithm, primaryChannel = null) {
  if (!realtime || ![0, 1, 2].includes(algorithm)) return null
  // Primary load comes directly from firmware getLoad(). TPS uses 0..400
  // internally; INI fuelLoadFeedBack / ignLoadFeedBack convert it to percent.
  const raw = primaryChannel && realtime[primaryChannel]
  if (Number.isFinite(raw)) return algorithm === 1 ? raw / 4 : raw
  if (algorithm === 0) return Number.isFinite(realtime.map) ? realtime.map : null
  if (algorithm === 1) return Number.isFinite(realtime.tps) ? realtime.tps : null
  if (!Number.isFinite(realtime.map) || !Number.isFinite(realtime.emap) || !(realtime.emap > 0)) return null
  return Math.floor(realtime.map * 100 / realtime.emap)
}

export function interpolateTable(values, xAxis, yAxis, x, y) {
  if (![x, y].every(Number.isFinite) || !Array.isArray(xAxis) || !xAxis.length ||
    !Array.isArray(yAxis) || !yAxis.length || !Array.isArray(values) ||
    ![xAxis, yAxis].every(axis => axis.every((v, i) => Number.isFinite(v) && (!i || v > axis[i - 1])))) return null
  const bracket = (axis, value) => {
    if (value <= axis[0]) return [0, 0, 0]
    const last = axis.length - 1
    if (value >= axis[last]) return [last, last, 0]
    const high = axis.findIndex(v => v > value)
    return [high - 1, high, (value - axis[high - 1]) / (axis[high] - axis[high - 1])]
  }
  const [x0, x1, tx] = bracket(xAxis, x), [y0, y1, ty] = bracket(yAxis, y)
  const corners = [values[y0]?.[x0], values[y0]?.[x1], values[y1]?.[x0], values[y1]?.[x1]]
  if (!corners.every(Number.isFinite)) return null
  const [a, b, c, d] = corners
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty
}
