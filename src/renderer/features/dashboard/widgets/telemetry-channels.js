import { operatingLoad } from '../../../../shared/protocol/tuning-live.js'

const finite = Number.isFinite
const formatted = (value, digits = 0) => finite(value) ? value.toFixed(digits) : '—'
const stateGroup = (label, active, tone = 'cyan') => ({ label, active: typeof active === 'boolean' ? active : null, tone })

export function createRealtimeChannelRegistry(unitsApi = {}) {
  const { convertTemp = x => x, convertPress = x => x, convertSpeed = x => x,
    tempUnit = () => '°C', pressUnit = () => 'kPa', speedUnit = () => 'km/h',
    mapMax = 300, configuration = {} } = unitsApi
  const pressureDigits = () => pressUnit() === 'bar' ? 2 : pressUnit() === 'psi' ? 1 : 0
  const convert = (value, fn) => finite(value) ? fn(value) : null
  const metric = (label, category, unit, min, max, decimals = 0, transform = x => x, extra = {}) => ({
    label, category, defaultWidget: 'digital', supportedWidgets: ['digital', 'gauge', 'trace'],
    getDisplay: (rt, key) => {
      const value = convert(rt[key], transform), displayUnit = typeof unit === 'function' ? unit() : unit
      const digits = typeof decimals === 'function' ? decimals() : decimals
      const lo = typeof min === 'function' ? min() : min, hi = typeof max === 'function' ? max() : max
      return { label, value, unit: displayUnit, min: lo, max: hi, traceMin: lo, traceMax: hi, decimals: digits,
        text: formatted(value, digits), available: finite(value), ...extra }
    }
  })
  const temperature = label => metric(label, 'thermal', tempUnit, () => convertTemp(-40), () => convertTemp(120), 0, convertTemp)
  const pressure = label => metric(label, 'engine', pressUnit, () => convertPress(0),
    () => convertPress(finite(mapMax) && mapMax > 0 ? mapMax : 300), pressureDigits, convertPress)
  const registry = {
    rpm: metric('RPM', 'engine', 'rpm', 0, Math.max(8000, (configuration.hardRevLim || 0) * 100), 0, x => x,
      configuration.engineProtectType && !configuration.hardRevMode ? {
        warning: configuration.SoftRevLim > 0 ? configuration.SoftRevLim * 100 : undefined,
        danger: configuration.hardRevLim > 0 ? configuration.hardRevLim * 100 : undefined,
      } : {}),
    map: pressure('MAP'), tps: metric('TPS', 'engine', '%', 0, 100, 1),
    afr: metric('AFR', 'fuel', 'AFR', 7, 25.5, 1),
    advance: metric('Ignition advance', 'spark', '°', -40, 60, 0),
    coolant: temperature('Coolant'), iat: temperature('Intake air'),
    battery: metric('Battery', 'electrical', 'V', 0, 18, 1),
    pw1: metric('Injector pulse · 1', 'fuel', 'ms', 0, 20, 2),
    dwell: metric('Requested dwell', 'spark', 'ms', 0, 8, 3),
    dwellActual: metric('Measured dwell', 'spark', 'ms', 0, 8, 3),
    ve: metric('VE', 'fuel', '%', 0, 150),
    vss: metric('Vehicle speed', 'vehicle', speedUnit, 0, () => convertSpeed(240), 0, convertSpeed),
    gear: metric('Gear', 'vehicle', '', 0, 6), tpsADC: metric('TPS ADC', 'diagnostics', 'counts', 0, 255),
    baro: pressure('Barometric pressure'), freeRAM: metric('Free RAM', 'diagnostics', 'bytes', 0, 8192),
    loopsPerSecond: metric('Loop rate', 'diagnostics', 'loops/s', 0, 10000),
    syncLossCounter: metric('Sync losses', 'diagnostics', 'count', 0, 255),
    fuelLoad: {
      label: 'Fuel load', category: 'engine', defaultWidget: 'digital', supportedWidgets: ['digital', 'gauge', 'trace'],
      getDisplay: rt => {
        const algorithm = configuration.algorithm ?? 0, raw = operatingLoad(rt, algorithm, 'fuelLoadRaw')
        const map = algorithm === 0, value = map ? convert(raw, convertPress) : raw
        const max = map ? convertPress(finite(mapMax) && mapMax > 0 ? mapMax : 300) : algorithm === 2 ? 511 : 100
        const decimals = map ? pressureDigits() : 1
        return { label: 'Fuel load', value, available: finite(value), unit: map ? pressUnit() : '%', min: 0, max,
          traceMin: 0, traceMax: max, decimals, text: formatted(value, decimals), note: ['MAP', 'Alpha-N · TPS', 'IMAP / EMAP'][algorithm] }
      }
    },
    thermalPair: {
      label: 'Temperatures', category: 'thermal', defaultWidget: 'digital', supportedWidgets: ['digital'],
      getDisplay: rt => ({ label: 'Temperatures', available: finite(rt.coolant) || finite(rt.iat), unit: '',
        lines: [['CLT', rt.coolant], ['IAT', rt.iat]].map(([label, raw]) => ({ label, value: formatted(convert(raw, convertTemp)), unit: tempUnit(), available: finite(raw) })) })
    },
    engineState: {
      label: 'Engine state', category: 'status', defaultWidget: 'status', supportedWidgets: ['status'],
      getDisplay: rt => ({ label: 'Engine state', available: !!rt.engine, groups: [
        stateGroup('Running', rt.engine?.running, 'green'), stateGroup('Sync', rt.engine?.sync),
        stateGroup('Cranking', rt.engine?.cranking, 'orange'), stateGroup('Warmup', rt.engine?.warmup, 'orange'),
        stateGroup('DFCO', rt.engine?.dfco), stateGroup('Burn pending', rt.engine?.burnPending, 'yellow'),
      ] })
    },
    protectState: {
      label: 'Protection', category: 'status', defaultWidget: 'status', supportedWidgets: ['status'],
      getDisplay: rt => ({ label: 'Protection', available: !!rt.engine, groups: [
        ...[['Active', 'protectActive'], ['RPM', 'protectRPM'], ['MAP', 'protectMAP'], ['Coolant', 'protectCLT'],
          ['Oil', 'protectOil'], ['AFR', 'protectAFR'], ['I/O error', 'ioError']].map(([label, key]) => stateGroup(label, rt.engine?.[key], 'red')),
        stateGroup('WMI empty', rt.engine?.wmiEmpty, 'yellow'),
      ] })
    },
    performanceState: {
      label: 'Performance features', category: 'status', defaultWidget: 'status', supportedWidgets: ['status'],
      getDisplay: rt => ({ label: 'Performance features', available: !!rt.performance, groups: [
        ...[['Pit limiter', 'pitLimiterActive'], ['Rumble idle', 'rumbleIdleActive'], ['ALS', 'alsActive'], ['PopBang', 'rollingPopBangActive']].map(([label, key]) => stateGroup(label, rt.performance?.[key], 'orange')),
      ] })
    },
    driveMode: {
      label: 'Drive Mode', category: 'status', defaultWidget: 'digital', supportedWidgets: ['digital'],
      getDisplay: rt => ({ label: 'Drive Mode', available: rt.driveMode?.valid === true, value: rt.driveMode?.active,
        text: rt.driveMode?.active === 0 ? 'DEFAULT' : `PRESET ${rt.driveMode?.active}`, unit: '',
        note: rt.driveMode?.state === 1 ? 'Switch pending' : rt.driveMode?.state === 2 ? 'Request rejected' : 'Confirmed by ECU' })
    }
  }
  return Object.fromEntries(Object.entries(registry).map(([key, entry]) => [key, { ...entry,
    getDisplay: rt => {
      rt ||= {}
      const display = entry.getDisplay(rt, key)
      let reason = display.available ? null : 'No channel data'
      if (key === 'afr' && configuration.egoType === 0) reason = 'O₂ sensor disabled'
      else if (key === 'afr' && finite(display.value) && display.value <= 0) reason = 'No valid AFR reading'
      if (['vss', 'gear'].includes(key) && configuration.vssMode === 0) reason = 'Vehicle speed sensing disabled'
      else if (key === 'gear' && rt.gear === 0) reason = 'Gear not detected'
      if (display.groups?.every(group => group.active === null)) reason = 'No status flags available'
      const available = !reason
      let note = display.note, quality = available ? 'live' : 'unavailable'
      if (available && key === 'tps' && (rt.tps < 0 || rt.tps > 100 ||
          (finite(configuration.tpsMin) && configuration.tpsMin === configuration.tpsMax))) {
        quality = 'check'; note = 'Check TPS calibration'
      }
      if (available && ['coolant', 'iat'].includes(key) && [215, -40].includes(rt[key])) {
        quality = 'check'; note = 'Sensor limit · check calibration'
      }
      if (key === 'thermalPair' && available) {
        if ([rt.coolant, rt.iat].some(value => [215, -40].includes(value))) {
          quality = 'check'; note = 'Sensor limit · check calibration'
        } else if (display.lines.some(line => !line.available)) {
          quality = 'partial'; note = 'One temperature channel unavailable'
        }
      }
      if (display.groups && available && display.groups.some(group => group.active === null)) {
        quality = 'partial'; note = 'Some status flags unavailable'
      }
      if (available && quality !== 'check' && finite(display.value) && (display.value < display.min || display.value > display.max)) {
        quality = 'check'; note = note ? `${note} · Outside display range` : 'Outside display range'
      }
      return { ...display, available, quality, reason, note, value: available ? display.value : null,
        text: available ? display.text : '—' }
    }
  }]))
}

export function getChannelOptions(registry) {
  return Object.entries(registry).map(([key, entry]) => ({ key, label: entry.label,
    supportedWidgets: entry.supportedWidgets, defaultWidget: entry.defaultWidget, category: entry.category }))
}

export function resolveWidget(widget, registry) {
  const channel = registry[widget.channelKey]
  if (!channel) return { ...widget, type: 'digital', unsupported: true }
  return { ...widget, type: channel.supportedWidgets.includes(widget.type) ? widget.type : channel.defaultWidget }
}
