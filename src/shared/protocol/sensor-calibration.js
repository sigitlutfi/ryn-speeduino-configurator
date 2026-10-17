import { Buffer } from 'buffer'
import { wrapModernProtocol, calculatePageCRC } from './ecu-commands.js'

export const CALIBRATION_SENSORS = { clt: 0, iat: 1, o2: 2 }
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
const sensorId = name => {
  if (!Object.hasOwn(CALIBRATION_SENSORS, name)) throw new Error('Unknown calibration sensor')
  return CALIBRATION_SENSORS[name]
}
export const calibrationCRCCommand = name => wrapModernProtocol(Buffer.from([0x6b, 0, sensorId(name)]))

export function calibrationChunks(name, data) {
  const id = sensorId(name), bytes = Buffer.from(data)
  if (bytes.length !== (id === 2 ? 1024 : 64)) throw new Error('Wrong calibration table size')
  // Mega advertises a 121-byte blocking factor. Aligned 96-byte O2 chunks
  // fit it and preserve firmware's x % 32 downsampling across chunk boundaries.
  const commands = []
  for (let offset = 0; offset < bytes.length; offset += id === 2 ? 96 : 64) {
    const chunk = bytes.subarray(offset, Math.min(offset + (id === 2 ? 96 : 64), bytes.length))
    const payload = Buffer.alloc(7 + chunk.length)
    payload.set([0x74, 0, id]); payload.writeUInt16BE(offset, 3); payload.writeUInt16BE(chunk.length, 5)
    chunk.copy(payload, 7); commands.push(wrapModernProtocol(payload))
  }
  return commands
}

// Three-point Steinhart-Hart fit: 1/T = A + B ln(R) + C ln(R)^3.
export function thermistorCalibration(params) {
  const points = [1, 2, 3].map(i => ({ t: Number(params[`t${i}`]), r: Number(params[`r${i}`]) }))
  const bias = Number(params.bias)
  if (!(bias > 0) || !Number.isFinite(bias) || points.some(p => !Number.isFinite(p.t) || p.t < -40 || p.t > 215 || !(p.r > 0) || !Number.isFinite(p.r))) {
    throw new Error('Use a positive bias/resistance and temperatures between -40 and 215°C')
  }
  points.sort((a, b) => a.t - b.t)
  if (points.some((p, i) => i && (p.t <= points[i - 1].t || p.r >= points[i - 1].r))) throw new Error('NTC points need distinct temperatures and decreasing resistance as temperature rises')
  const matrix = points.map(p => { const l = Math.log(p.r); return [1, l, l ** 3, 1 / (p.t + 273.15)] })
  for (let col = 0; col < 3; col++) {
    let pivot = col
    for (let row = col + 1; row < 3; row++) if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row
    ;[matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]]
    const divisor = matrix[col][col]
    if (Math.abs(divisor) < 1e-12) throw new Error('Thermistor points cannot produce a stable curve')
    for (let j = col; j < 4; j++) matrix[col][j] /= divisor
    for (let row = 0; row < 3; row++) if (row !== col) {
      const factor = matrix[row][col]
      for (let j = col; j < 4; j++) matrix[row][j] -= factor * matrix[col][j]
    }
  }
  const [a, b, c] = matrix.map(row => row[3])
  const temperatureAtResistance = resistance => {
    const l = Math.log(resistance), inverse = a + b * l + c * l ** 3
    if (!(inverse > 0)) throw new Error('Thermistor fit is invalid over the ADC range')
    return 1 / inverse - 273.15
  }
  const samples = Array.from({ length: 32 }, (_, i) => {
    const adc = i * 33
    const temperature = adc === 0 ? 215 : adc === 1023 ? -40 : clamp(temperatureAtResistance(bias * adc / (1023 - adc)), -40, 215)
    return { adc, value: Math.round(temperature) }
  })
  if (samples.some((p, i) => i && p.value > samples[i - 1].value)) throw new Error('Thermistor fit is not monotonic over the ADC range')
  const bytes = Buffer.alloc(64)
  samples.forEach(({ value }, i) => {
    // Firmware truncates Fahrenheit to whole degrees before converting to C.
    const f = 32 + value * 9 / 5
    bytes.writeInt16LE((value >= 0 ? Math.ceil(f) : Math.floor(f)) * 10, i * 2)
  })
  return { bytes, samples, crc: calculatePageCRC(bytes), temperatureAtResistance }
}

export function oxygenCalibration(params) {
  const { vMin, vMax, afrMin, afrMax } = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Number(v)]))
  if (![vMin, vMax, afrMin, afrMax].every(Number.isFinite) || vMin < 0 || vMax > 5 || vMin >= vMax || afrMin < 0 || afrMax > 25.5 || afrMin >= afrMax) throw new Error('Use increasing voltage points within 0–5 V and AFR within 0–25.5')
  const bytes = Buffer.from(Array.from({ length: 1024 }, (_, adc) => Math.round(clamp((afrMin + (adc * 5 / 1023 - vMin) * (afrMax - afrMin) / (vMax - vMin)) * 10, 0, 255))))
  return { bytes, crc: calculatePageCRC(bytes), samples: Array.from({ length: 32 }, (_, i) => ({ adc: i * 32, value: bytes[i * 32] / 10 })) }
}
