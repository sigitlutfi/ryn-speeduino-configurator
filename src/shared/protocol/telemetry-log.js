const COLUMNS = [
  ['timestamp_utc', e => Number.isFinite(e.timestamp) ? new Date(e.timestamp).toISOString() : ''],
  ['session_id', e => e.source?.sessionId], ['project', e => e.source?.projectName], ['firmware', e => e.source?.signature],
  ...[['rpm', 'rpm'], ['map_kpa', 'map'], ['tps_pct', 'tps'], ['coolant_c', 'coolant'], ['iat_c', 'iat'],
    ['battery_v', 'battery'], ['afr', 'afr'], ['advance_deg', 'advance'], ['pw1_ms', 'pw1'],
    ['dwell_requested_ms', 'dwell'], ['dwell_measured_ms', 'dwellActual'], ['ve_pct', 've'],
    ['speed_kmh', 'vss'], ['gear', 'gear'], ['free_ram_bytes', 'freeRAM'], ['loops_per_second', 'loopsPerSecond'],
    ['sync_loss_count', 'syncLossCounter']].map(([name, key]) => [name, e => Number.isFinite(e[key]) ? e[key] : '']),
  ['running', e => e.engine?.running], ['cranking', e => e.engine?.cranking], ['sync', e => e.engine?.sync],
  ['drive_mode', e => e.driveMode?.valid ? e.driveMode.active : ''],
  ['o2_enabled', e => e.source?.o2Enabled], ['tps_endpoints_distinct', e => e.source?.tpsEndpointsDistinct],
  ['coolant_at_sensor_limit', e => Number.isFinite(e.coolant) ? [-40, 215].includes(e.coolant) : ''],
  ['iat_at_sensor_limit', e => Number.isFinite(e.iat) ? [-40, 215].includes(e.iat) : ''],
]

function csvCell(value) {
  if (value === undefined || value === null) return ''
  const text = typeof value === 'boolean' ? value ? '1' : '0' : String(value)
  const safe = typeof value === 'string' && /^[=+@\-]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function telemetryCSV(entries) {
  return [COLUMNS.map(([name]) => name).join(','), ...entries.map(e => COLUMNS.map(([, get]) => csvCell(get(e))).join(','))].join('\r\n') + '\r\n'
}

export function recordingDuration(start, stop = Date.now()) {
  const seconds = Number.isFinite(start) ? Math.max(0, Math.floor((stop - start) / 1000)) : 0
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(v => String(v).padStart(2, '0')).join(':')
}
