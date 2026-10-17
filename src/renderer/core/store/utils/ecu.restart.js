import { serialService } from '../../services/serialService.js'

export function restartChanges(ini, before, after) {
  const fields = []
  for (const [page, definitions] of Object.entries(ini.constants.pages)) {
    for (const [name, meta] of Object.entries(definitions)) {
      if (meta.requiresPowerCycle && after[page]?.[name] !== undefined &&
          JSON.stringify(before[page]?.[name]) !== JSON.stringify(after[page][name])) {
        fields.push({ page: Number(page), name, value: after[page][name] })
      }
    }
  }
  return fields
}

// Record before the first possible write: a lost ACK may still change ECU RAM.
export async function recordRestartWrite(set, get, ini, before, after) {
  const changes = restartChanges(ini, before, after)
  if (!changes.length) return
  const initial = get(), epoch = initial.projectEpoch, session = initial.connection.sessionId
  const telemetry = await serialService.readOutputChannels(ini)
  if (get().projectEpoch !== epoch || get().connection.sessionId !== session || get().parsedIni !== ini) throw new Error('Project or ECU changed during setup preflight')
  if (telemetry?.rpm !== 0 || telemetry.engine?.running !== false || telemetry.engine?.cranking !== false) throw new Error('Stop the engine before changing ECU hardware setup')
  const state = get(), previous = state.currentProject?.hardware?.restartRequired
  const fields = new Map((previous?.fields || []).map(field => [field.name, field]))
  changes.forEach(field => fields.set(field.name, field))
  const targetConfig = { ...previous?.targetConfig }
  for (const [page, definitions] of Object.entries(ini.constants.pages)) for (const [name, meta] of Object.entries(definitions)) {
    const value = after[page]?.[name]
    if (typeof value === 'number' || (meta.requiresPowerCycle && Array.isArray(value))) targetConfig[name] = value
  }
  const changedPages = new Set(changes.map(field => field.page))
  const pending = { fields: [...fields.values()], targetConfig,
    connectedAt: state.connection.lastConnectedAt ?? null,
    recordedAt: new Date().toISOString(),
    burnedPages: (previous?.burnedPages || []).filter(page => !changedPages.has(page)) }
  set(s => ({ currentProject: { ...s.currentProject, hardware: { ...s.currentProject.hardware, restartRequired: pending } } }))
  const saved = await get().saveECURestartState?.()
  if (saved?.ok === false) throw new Error('Restart requirement could not be saved: ' + saved.error)
}

export async function recordRestartBurn(set, get, page) {
  const pending = get().currentProject?.hardware?.restartRequired
  if (!pending?.fields.some(field => field.page === page)) return
  set(s => ({ currentProject: { ...s.currentProject, hardware: { ...s.currentProject.hardware,
    restartRequired: { ...pending, burnedPages: [...new Set([...pending.burnedPages, page])] } } } }))
  const saved = await get().saveECURestartState?.()
  if (saved?.ok === false) throw new Error('EEPROM verified, but restart tracking could not be saved: ' + saved.error)
}
