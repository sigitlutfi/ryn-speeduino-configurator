// These checks describe effective settings, never modify an existing tune.
export function configurationReadiness(values = {}) {
  const issues = []
  if (values.useDwellLim && (!(values.dwellLim > 0) ||
      values.dwellLim * 10 < Math.max(values.dwellcrank || 0, values.dwellrun || 0))) {
    issues.push({ fields: ['useDwellLim', 'dwellLim', 'dwellcrank', 'dwellrun'], message: 'Overdwell protection needs a positive limit at least as long as the configured crank/run dwell.' })
  }
  if (values.tpsflood !== undefined && !(values.tpsflood > 0)) {
    issues.push({ fields: ['tpsflood'], message: 'Flood-clear must be above 0% TPS; zero cuts fuel whenever the engine is cranking.' })
  }
  if (values.tpsMin !== undefined && values.tpsMin === values.tpsMax) {
    issues.push({ fields: ['tpsMin', 'tpsMax', 'algorithm'], message: 'TPS endpoints are identical. Capture distinct closed/open readings before using TPS calibration or Alpha-N.' })
  }
  if (values.engineProtectType && (values.hardRevMode ?? 0) === 0 && (!(values.hardRevLim > 0) ||
      (values.SoftRevLim !== undefined && !(values.SoftRevLim > 0)))) {
    issues.push({ fields: ['engineProtectType', 'hardRevLim', 'SoftRevLim', 'hardRevMode'], message: 'Set positive soft/hard RPM limits before enabling engine protection.' })
  }
  if (values.engineProtectType && (values.hardRevMode ?? 0) === 0 && values.SoftRevLim > values.hardRevLim) {
    issues.push({ fields: ['engineProtectType', 'hardRevLim', 'SoftRevLim', 'hardRevMode'], message: 'Soft RPM limit must not exceed the hard RPM limit.' })
  }
  return issues
}

export function validateOperatingSettings(values, changedNames) {
  const changed = new Set(changedNames)
  return configurationReadiness(values).find(issue => {
    if (issue.fields.includes('tpsMin')) return changed.has('tpsMin') || changed.has('tpsMax') || (changed.has('algorithm') && values.algorithm === 1)
    return issue.fields.some(field => changed.has(field))
  })?.message || null
}
