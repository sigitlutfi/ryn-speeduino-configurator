import { getVarMetadata } from '../ini-parser.js'
import { resolveNumericMetadata } from './ini-numeric.js'

// Values are display units. These are starting points, never measured calibration.
export const CURVE_PRESETS = [
  ['crankingEnrichBins', 'crankingEnrichValues', [-40, 100], 100, 'neutral', 'Cranking 100% tidak menambah bahan bakar. Sesuaikan pengayaan start terhadap mesin dan suhu.'],
  ['taeBins', 'taeRates', [0, 1500], 0, 'neutral', 'TPS acceleration enrichment 0% tidak menambah bahan bakar. Sesuaikan respons transien mesin.'],
  ['maeBins', 'maeRates', [0, 1500], 0, 'neutral', 'MAP acceleration enrichment 0% tidak menambah bahan bakar. Sesuaikan respons transien mesin.'],
  ['brvBins', 'injBatRates', [6, 24], 100, 'neutral', 'Koreksi injektor 100% tidak mengubah waktu buka dasar. Sesuaikan dengan data pengukuran injektor.'],
  ['injAngRPM', 'injAng', [500, 6500], 355, 'reference', 'Sudut akhir injeksi adalah nilai referensi. Sesuaikan dengan konfigurasi mesin.'],
  ['airDenBins', 'airDenRates', [-40, 120], 100, 'neutral', 'IAT 100% tidak menambah atau mengurangi bahan bakar. Kalibrasikan kompensasi terhadap suhu udara.'],
  ['wueBins', 'wueRates', [-40, 100], 100, 'neutral', 'WUE 100% tidak menambahkan bahan bakar saat mesin dingin. Kalibrasikan pengayaan selama pemanasan.'],
  ['primeBins', 'primePulse', [-40, 100], 0, 'neutral', 'Priming 0 ms berarti tidak ada injeksi awal saat kontak dinyalakan. Sesuaikan kebutuhan start mesin.'],
  ['aseBins', 'asePct', [-40, 100], 0, 'neutral', 'ASE 0% berarti tidak ada tambahan bahan bakar setelah mesin menyala.'],
  ['aseBins', 'aseCount', [-40, 100], 0, 'neutral', 'Durasi ASE 0 detik berarti periode pengayaan setelah start belum diterapkan.'],
  ['iacBins', 'iacCLValues', [-40, 100], 900, 'reference', 'Target idle 900 RPM adalah referensi awal. Sesuaikan target mesin pada setiap suhu.'],
  ['flexFuelBins', 'flexFuelAdj', [0, 100], 100, 'neutral', 'Flex fuel 100% tidak mengubah bahan bakar. Kalibrasikan terhadap kadar etanol sebelum fitur digunakan.'],
  ['flexAdvBins', 'flexAdvAdj', [0, 100], 0, 'neutral', 'Tambahan pengapian 0° tidak mengubah timing dasar.'],
  ['flexBoostBins', 'flexBoostAdj', [0, 100], 0, 'neutral', 'Offset boost 0 kPa tidak mengubah target. Nilai negatif mengurangi, nilai positif menambah target boost.'],
  ['brvBins', 'dwellRates', [6, 24], 100, 'neutral', 'Dwell 100% mempertahankan dwell dasar. Gunakan data coil; sumbu tegangan juga dipakai koreksi injektor.'],
  ['iatRetBins', 'iatRetRates', [0, 120], 0, 'neutral', 'Retard IAT 0° tidak mengurangi timing pengapian.'],
  ['cltAdvBins', 'cltAdvValues', [-40, 100], 0, 'neutral', 'Cold advance 0° tidak menambahkan timing saat mesin dingin.'],
  ['fanPWMBins', 'PWMFanDuty', [60, 110], 0, 'reference', 'Duty fan 0% tidak memutar kipas. Atur kebutuhan pendinginan sebelum memakai mode PWM.'],
  ['wmiAdvBins', 'wmiAdvAdj', [0, 300], 0, 'neutral', 'Koreksi WMI 0° tidak menambahkan timing. Menyiapkan kurva tidak mengaktifkan fitur WMI.'],
  ['coolantProtTemp', 'coolantProtRPM', [-40, 120], 6500, 'reference', 'Batas 6500 RPM adalah referensi awal. Tentukan penurunan batas RPM sesuai suhu mesin.'],
  ['oilPressureProtRPM', 'oilPressureProtMins', [1000, 7000], 0, 'reference', 'Ambang oli 0 belum memberikan proteksi tekanan rendah yang berguna. Isi batas tekanan sesuai mesin.'],
  ['rollingProtRPMDelta', 'rollingProtCutPercent', [-300, -50], 0, 'reference', 'Sesuaikan persentase pemotongan dan rentang RPM dengan strategi limiter mesin.'],
].map(([xName, yName, range, value, kind, note]) => ({ xName, yName, range, value, kind, note }))

export const curvePreset = yName => CURVE_PRESETS.find(curve => curve.yName === yName)
export const curveDisplay = (raw, meta) => Number(((raw + (meta.translate ?? 0)) * meta.scale).toFixed(meta.digits ?? 0))
export const curveRaw = (display, meta) => Math.round(display / meta.scale - (meta.translate ?? 0))

export function describeCurveValues(y, preset) {
  const baseline = !!preset && y.length === preset.y.length && y.every((value, index) => value === preset.y[index])
  return {
    label: baseline ? (preset.kind === 'neutral' ? 'Nilai awal netral' : 'Nilai referensi awal') : 'Nilai disesuaikan',
    note: baseline ? preset.note : 'Nilai telah disesuaikan. Kesesuaian dengan mesin tetap perlu diverifikasi.',
    flat: y.length > 1 && y.every(value => value === y[0]),
  }
}

export function curveMetadata(ini, name, pages = {}) {
  return resolveNumericMetadata(getVarMetadata(ini, name), ini, pages)
}

function count(meta) {
  return meta?.type === 'array' && meta.shape?.length === 1 ? meta.shape[0] : 0
}

function encode(values, meta) {
  const bits = Number(meta.dataType?.slice(1))
  const signed = meta.dataType?.startsWith('S')
  const min = signed ? -(2 ** (bits - 1)) : 0
  const max = signed ? 2 ** (bits - 1) - 1 : 2 ** bits - 1
  if (!Number.isFinite(meta.scale) || meta.scale <= 0) throw new Error('Unresolved curve scaling')
  // INI translations for Fahrenheit are rounded (e.g. -22.23). Compare in
  // declared display precision and choose a representable bin inside the limits.
  const tolerance = 0.5 * 10 ** -(meta.digits ?? 0) - 1e-8
  const first = Math.max(min, Math.ceil((meta.lo - tolerance) / meta.scale - (meta.translate ?? 0)))
  const last = Math.min(max, Math.floor((meta.hi + tolerance) / meta.scale - (meta.translate ?? 0)))
  return values.map(value => {
    if (!Number.isFinite(value) || value < meta.lo || value > meta.hi || first > last) throw new Error(`Curve value is outside the INI range: ${meta.name}`)
    const raw = Math.max(first, Math.min(last, curveRaw(value, meta)))
    const display = curveDisplay(raw, meta)
    if (!Number.isFinite(raw) || raw < min || raw > max || display < meta.lo || display > meta.hi) {
      throw new Error(`Curve value is outside the INI range: ${meta.name}`)
    }
    return raw
  })
}

export function buildCurvePreset(ini, yName, pages = {}) {
  const definition = curvePreset(yName)
  if (!definition) throw new Error('No reviewed preset for this curve')
  const xMeta = curveMetadata(ini, definition.xName, pages)
  const yMeta = curveMetadata(ini, yName, pages)
  const length = count(xMeta)
  if (length < 2 || length !== count(yMeta)) throw new Error('INI curve dimensions do not match')
  const fahrenheit = xMeta.units === 'F'
  const range = definition.range.map(value => fahrenheit ? value * 1.8 + 32 : value)
  const lo = Math.max(xMeta.lo, range[0]), hi = Math.min(xMeta.hi, range[1])
  const xRaw = Array.isArray(xMeta.defaultValue) ? [...xMeta.defaultValue] : encode(
    Array.from({ length }, (_, i) => lo + (hi - lo) * i / (length - 1)), xMeta)
  const yRaw = Array.isArray(yMeta.defaultValue) ? [...yMeta.defaultValue] : encode(Array(length).fill(definition.value), yMeta)
  const x = xRaw.map(value => curveDisplay(value, xMeta)), y = yRaw.map(value => curveDisplay(value, yMeta))
  // Validate defaults as well as generated values, including quantization.
  encode(x, xMeta); encode(y, yMeta)
  if (x.length !== length || y.length !== length || !x.every((value, i) => !i || value > x[i - 1])) throw new Error('INI cannot represent ordered curve bins')
  return { ...definition, xMeta, yMeta, xRaw, yRaw, x, y }
}

export function inspectCurve(x, y, xMeta, yMeta, definition) {
  const issues = []
  if (!Array.isArray(x) || !Array.isArray(y) || x.length !== count(xMeta) || y.length !== count(yMeta) || x.length < 2) {
    return ['Curve points are missing or do not match the INI dimensions.']
  }
  if (!x.every((value, i) => Number.isFinite(value) && (!i || value > x[i - 1]))) issues.push('X bins overlap or are unordered.')
  if (!y.every(Number.isFinite)) issues.push('Y values contain invalid numbers.')
  if (x.some(value => value < xMeta.lo || value > xMeta.hi) || y.some(value => value < yMeta.lo || value > yMeta.hi)) issues.push('Values are outside the INI limits.')
  if (definition?.value === 100 && y.every(value => value === 0)) issues.push('0% is not neutral: this multiplier needs calibration. Neutral is 100%.')
  if (definition?.yName === 'iacCLValues' && y.every(value => value === 0)) issues.push('Idle target is 0 RPM. Set valid engine targets.')
  return issues
}
