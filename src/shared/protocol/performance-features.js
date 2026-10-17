export const PERFORMANCE_PRIORITY = [
  ['pitLimiter', 'pitLimiterActive', 'Pit limiter'],
  ['rumbleIdle', 'rumbleIdleActive', 'Rumble idle'],
  ['als', 'alsActive', 'ALS'],
  ['popBang', 'rollingPopBangActive', 'Pop & bang'],
]

export function selectedPerformanceFeature(performance = {}) {
  return PERFORMANCE_PRIORITY.find(([, flag]) => performance[flag])?.[0] ?? null
}

export function performanceFeatureState(feature, performance = {}) {
  const selected = selectedPerformanceFeature(performance)
  const entry = PERFORMANCE_PRIORITY.find(([key]) => key === feature)
  return { selected, conditionsMet: !!performance[entry?.[1]],
    selectedLabel: PERFORMANCE_PRIORITY.find(([key]) => key === selected)?.[2] ?? 'None' }
}

export function validatePerformanceSettings(feature, values) {
  if (feature === 'pitLimiter' && values.pitLimiterEnabled && values.pitLimiterRPM <= 0 && values.pitLimiterSpeed <= 0) {
    return 'Pit limiter requires an RPM or speed limit.'
  }
  if (feature === 'pitLimiter' && values.pitLimiterEnabled && values.pitLimiterCutType === 2 && !values.engineProtectType) {
    return 'Pit rolling mode requires an enabled Engine Protection cut type.'
  }
  if (feature === 'als' && values.alsEnabled) {
    if (values.alsMaxTPS <= 0) return 'ALS Max TPS must be above 0% (activation uses TPS below the threshold).'
    if (values.alsMinCLT > values.alsMaxCLT) return 'ALS Min CLT must not exceed Max CLT.'
  }
  if (feature === 'rumbleIdle' && values.rumbleIdleEnabled) {
    if (values.rumbleIdleMinRPM > values.rumbleIdleMaxRPM) return 'Rumble Min RPM must not exceed Max RPM.'
    if (values.rumbleIdleMaxTPS <= 0) return 'Rumble Max TPS must be above 0%.'
    if (values.rumbleIdlePatternLength < 1 || values.rumbleIdlePatternLength > 8) return 'Rumble pattern length must be 1–8 steps.'
  }
  if (feature === 'pitLimiter' && values.pitLimiterEnabled && values.pitLimiterCutType === 1) {
    if (values.pitLimiterRPM <= 0) return 'Pit soft mode requires an RPM limit. Use hard or rolling mode for a speed-only limit.'
    if (![1, 3].includes(values.engineProtectType)) return 'Pit soft mode requires Engine Protection to include ignition.'
  }
  if (feature === 'popBang' && values.rollingPopBangEnabled) {
    if (values.rollingPopBangMinRPM > values.rollingPopBangMaxRPM) return 'Pop & bang Min RPM must not exceed Max RPM.'
    if (values.rollingPopBangCutType > 0 && values.rollingPopBangCutPattern === 0) return 'Pop & bang cut mode requires a nonzero cut pattern.'
  }
  return null
}
