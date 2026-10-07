import avrMapping from './avr-pin-mapping.js'

export function projectPinMapOptions(project) {
  const channels = { standard: [4, 5], '6-3': [6, 3], '8-1': [8, 1] }[project?.hardware?.channelBuild]
  return { platform: project?.hardware?.pinMapPlatform,
    injectorChannels: channels?.[0] ?? 8, ignitionChannels: channels?.[1] ?? 8 }
}

const ROUTES = {
  tachoPin: 'pinTachOut', fuelPumpPin: 'pinFuelPump', fanPin: 'pinFan',
  boostPin: 'pinBoost', vvt1Pin: 'pinVVT_1', vvt2Pin: 'pinVVT_2',
  launchPin: 'pinLaunch', vssPin: 'pinVSS', resetControlPin: 'pinResetControl',
  ignBypassPin: 'pinIgnBypass', wmiEmptyPin: 'pinWMIEmpty',
  wmiIndicatorPin: 'pinWMIIndicator', wmiEnabledPin: 'pinWMIEnabled',
  airConCompPin: 'pinAirConComp', airConReqPin: 'pinAirConRequest', airConFanPin: 'pinAirConFan',
}

export function boardPinContext(parsedIni, pages, options = {}) {
  const values = {}
  for (const [page, fields] of Object.entries(parsedIni?.constants?.pages || {})) {
    for (const [field, meta] of Object.entries(fields)) {
      values[field] = pages?.[page]?.[field] ?? meta.defaultValue ?? 0
    }
  }
  const pins = options.platform === 'mega2560' ? avrMapping.layouts[values.pinLayout] : null
  return { values, pins, verified: !!pins, platform: options.platform,
    warning: !pins ? options.platform === 'mega2560'
      ? 'This board layout is not compiled into the standard Mega firmware; it would fall back to v0.2 routing. Select the matching board layout and MCU before choosing pins.'
      : 'Board pin map is unverified. Select the MCU and firmware channel build in I/O Summary; check the board wiring before choosing pins.' : null,
    injectorChannels: options.injectorChannels ?? 8, ignitionChannels: options.ignitionChannels ?? 8 }
}

export function physicalPinForField(field, raw, label, context) {
  if (!context.verified) return null
  if (field === 'knock_pin' && context.values.knock_mode === 2) return raw >= 47 ? 54 + raw - 47 : 69
  if (field === 'knock_pin' && context.values.knock_mode === 1) return Number(raw)
  if (/^board\s*default$/i.test(label || '')) return context.pins[ROUTES[field]] ?? null
  // These three fields are translated unconditionally, with no board default.
  if (['idleUpPin', 'idleUpOutputPin', 'CTPSPin'].includes(field) && Number(raw) === 0) return 0
  const analog = String(label).match(/^A(\d+)$/i)
  if (analog) return 54 + Number(analog[1])
  return /^\d+$/.test(String(label)) ? Number(label) : null
}

export function boardFixedClaims(context) {
  if (!context.verified) return []
  const { pins, values: v } = context
  const claims = []
  const add = (field, label, pin, direction = 'Input') => {
    if (Number.isInteger(pin) && pin >= 0 && pin <= 69) claims.push({ field, label, pin, direction })
  }
  for (let i = 1; i <= context.injectorChannels; i++) add(`$injector${i}`, `Injector ${i} (firmware channel)`, pins[`injector${i}`], 'Output')
  for (let i = 1; i <= context.ignitionChannels; i++) add(`$coil${i}`, `Ignition ${i} (firmware channel)`, pins[`coil${i}`], 'Output')
  for (const [pinField, label] of Object.entries({ pinTrigger: 'Crank trigger', pinTrigger2: 'Cam trigger', pinTrigger3: 'Tertiary trigger', pinTPS: 'TPS', pinMAP: 'MAP', pinIAT: 'IAT', pinCLT: 'CLT', pinO2: 'O2', pinO2_2: 'O2 2', pinBat: 'Battery voltage' })) add(`$${pinField}`, label, pins[pinField])
  if (v.flexEnabled) add('$pinFlex', 'Flex sensor', pins.pinFlex)
  const idlePwm = [2, 3, 6].includes(v.iacAlgorithm)
  if (idlePwm || v.iacAlgorithm === 1) add('$pinIdle1', 'Idle output 1', pins.pinIdle1, 'Output')
  if (idlePwm && v.iacChannels === 1) add('$pinIdle2', 'Idle output 2', pins.pinIdle2, 'Output')
  if ([4, 5, 7].includes(v.iacAlgorithm)) {
    for (const field of ['pinStepperDir', 'pinStepperStep', 'pinStepperEnable']) add(`$${field}`, field.replace('pin', 'Idle '), pins[field], 'Output')
  }
  add('$reserved0', 'Serial RX / reserved', 0)
  return claims
}

export function fieldPinActive(field, context) {
  const v = context.values
  const gates = {
    pitLimiterPin: () => !!v.pitLimiterEnabled, rumbleIdlePin: () => !!v.rumbleIdleEnabled,
    alsSwitchPin: () => !!v.alsEnabled, rollingPopBangPin: () => !!v.rollingPopBangEnabled,
    tachoPin: () => true, fuelPumpPin: () => true,
    fanPin: () => [1, 2].includes(v.fanEnable), boostPin: () => v.boostEnabled === 1,
    vvt1Pin: () => !!v.vvtEnabled, vvt2Pin: () => !!v.vvt2Enabled || !!v.wmiEnabled,
    launchPin: () => !!v.launchEnable || !!v.flatSEnable, vssPin: () => [2, 3].includes(v.vssMode),
    baroPin: () => !!v.useExtBaro, EMAPPin: () => !!v.useEMAP,
    fuelPressurePin: () => !!v.fuelPressureEnable, oilPressurePin: () => !!v.oilPressureEnable,
    fuel2InputPin: () => v.fuel2Mode === 4, spark2InputPin: () => v.spark2Mode === 4,
    idleUpPin: () => !!v.idleUpEnabled, idleUpOutputPin: () => !!v.idleUpEnabled && !!v.idleUpOutputEnabled,
    CTPSPin: () => !!v.CTPSEnabled, resetControlPin: () => !!v.resetControl,
    ignBypassPin: () => !!v.ignBypassEnable, knock_pin: () => [1, 2].includes(v.knock_mode),
    airConReqPin: () => !!v.airConEnable, airConCompPin: () => !!v.airConEnable,
    airConFanPin: () => !!v.airConEnable && !!v.airConFanEnabled,
    wmiEnabledPin: () => !!v.wmiEnabled, wmiIndicatorPin: () => !!v.wmiEnabled && !!v.wmiIndicatorEnabled,
    wmiEmptyPin: () => !!v.wmiEnabled && !!v.wmiEmptyEnabled,
    n2o_arming_pin: () => !!v.n2o_enable,
    // initialiseNitrous initializes both stage outputs even when disabled.
    n2o_stage1_pin: () => true, n2o_stage2_pin: () => true,
  }
  return gates[field] ? { active: gates[field](), reason: 'Firmware pin ownership gate', source: 'firmware' } : null
}
