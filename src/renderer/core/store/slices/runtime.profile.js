// Profiles modify RAM using the standard INI page protocol. Project base stays intact.
import { Buffer } from 'buffer'
import { resolveRuntimeField, buildRuntimeFieldWrite, readRuntimeFieldFromBuffer } from '../../../../shared/protocol/runtime-fields.js'
import { resolveRuntimeTable, readRuntimeTableFromDecodedPage, buildRuntimeTableOverlay } from '../../../../shared/protocol/runtime-tables.js'
import { validateRuntimeProfileTable } from '../../../../shared/protocol/runtime-profile-table.js'
import { serializeValue } from '../../../../shared/protocol/binary-serializer.js'
import { parsePage } from '../../../../shared/protocol/binary-parser.js'
import { validatePageSnapshot, createPageSnapshot } from '../../../../shared/protocol/page-cache.js'
import { assertWritableContract } from '../../../../shared/protocol/contract.js'
import { serialService } from '../../services/serialService.js'
import { DEFAULT_RUNTIME_PROFILE_FIELDS, DEFAULT_RUNTIME_PROFILE_GUARDS, DEFAULT_ACTIVE_PAGES } from '../utils/project.constants.js'
import { evaluateRuntimeProfileGuards } from '../utils/runtime.guards.js'
import { deriveProjectSyncState } from '../utils/project.utils.js'
import { createEmptyRuntimeProfileSession, appendRuntimeProfileHistory } from '../types/runtime.types.js'
import { prepareConfigurationWrite } from '../../../../shared/protocol/configuration-policy.js'
import { configurationWriteOptions } from '../../../../shared/protocol/board-pins.js'

export function createRuntimeProfileSlice(set, get) {
  let running = false
  const status = () => {
    const state = get()
    const result = evaluateRuntimeProfileGuards(state.realtime, DEFAULT_RUNTIME_PROFILE_GUARDS)
    if (!state.realtimeReceivedAt || Date.now() - state.realtimeReceivedAt > 2000) {
      result.ok = false
      result.reasons.push('Waiting for fresh ECU telemetry')
    }
    return { ...result, connected: state.connection.status === 'connected', requirements: DEFAULT_RUNTIME_PROFILE_GUARDS }
  }

  function check(context) {
    const state = get()
    if (state.projectEpoch !== context.epoch || state.connection.sessionId !== context.session ||
        state.connection.lastConnectedAt !== context.connectedAt || state.parsedIni !== context.ini ||
        state.currentProject?.constants !== context.constants) throw new Error('Project, tune, INI or ECU connection changed during profile operation')
    if (Object.keys(state.tableDrafts || {}).length) throw new Error('Save table drafts before applying a profile')
    if (Object.keys(state.fieldDrafts || {}).length) throw new Error('Save field drafts before applying a profile')
    assertWritableContract(state)
  }

  async function safety(context) {
    check(context)
    // Explicit reads keep guards live even while background polling is suspended.
    const telemetry = await serialService.readOutputChannels(context.ini)
    check(context)
    const guard = evaluateRuntimeProfileGuards(telemetry, DEFAULT_RUNTIME_PROFILE_GUARDS)
    if (!guard.ok) throw new Error(guard.reasons.join('; '))
    get().setRealtime?.(telemetry)
  }

  async function read(context, page) {
    check(context)
    const result = await get().readPageFromECU(page)
    check(context)
    const size = context.ini.constants.pageSizes[page]
    if (result.buffer.length !== size) throw new Error(`Wrong ECU page size: ${page}`)
    const expected = createPageSnapshot({ pageId: page, size, buffer: result.buffer }).crc32
    const actual = await serialService.readPageCRC(page)
    check(context)
    if (expected !== actual) throw new Error(`ECU page ${page} CRC/readback mismatch`)
    return Buffer.from(result.buffer)
  }

  function tableFrom(buffer, def) {
    return readRuntimeTableFromDecodedPage(parsePage(buffer, get().parsedIni.constants.pages[def.page]), def)
  }

  function putTable(buffer, table, def) {
    const valid = validateRuntimeProfileTable(table, def)
    for (const [meta, values] of [[def.xMeta, valid.rawRpmAxis], [def.yMeta, valid.rawLoadAxis], [def.zMeta, valid.rawValues]]) {
      serializeValue(buffer, meta.offset, values, meta)
    }
  }

  function putField(buffer, field, value) {
    if (!Number.isFinite(value) || !Number.isInteger(value)) throw new Error(`Invalid profile field '${field.name}'`)
    const display = (value + (field.translate ?? 0)) * (field.scale ?? 1)
    if ((Number.isFinite(field.lo) && display < field.lo) || (Number.isFinite(field.hi) && display > field.hi) || field.options?.[value]?.toUpperCase().includes('INVALID')) throw new Error(`Profile field '${field.name}' is outside its INI range`)
    const write = buildRuntimeFieldWrite(buffer, field, value)
    if (write.changed) write.after.copy(buffer, write.offset)
    if (readRuntimeFieldFromBuffer(buffer, field) !== value) throw new Error(`Profile field '${field.name}' is outside its INI range`)
  }

  async function write(context, page, target, before, onAttempt = () => {}) {
    // Include each attempted page in the rollback set before the first packet.
    await safety(context)
    if (target.equals(before)) return
    for (let offset = 0; offset < target.length; offset += 32) {
      const bytes = target.subarray(offset, offset + 32)
      if (bytes.equals(before.subarray(offset, offset + bytes.length))) continue
      await safety(context)
      onAttempt()
      await serialService.writePage(page, offset, bytes.length, Array.from(bytes))
      check(context)
    }
    const verified = await read(context, page)
    if (!verified.equals(target)) throw new Error(`Profile RAM verification failed on page ${page}`)
  }

  async function execute(profile, restoring = false) {
    if (running || get().operation) throw new Error('Another ECU operation is running')
    const initial = get()
    if (!restoring && initial.currentProject?.hardware?.restartRequired) throw new Error('Complete ECU setup power cycle verification before applying a tune preset')
    assertWritableContract(initial)
    if (!initial.currentProject || !initial.parsedIni) throw new Error('No project or INI loaded')
    if (!restoring && initial.runtimeProfileSession?.state === 'Unknown') throw new Error('ECU profile state is unknown; download ECU RAM before applying another profile')
    const prior = initial.runtimeProfileSession || createEmptyRuntimeProfileSession()
    if (!restoring && prior.state !== 'ProfileActive' && (initial.currentProject.ecu?.sync?.activePages || DEFAULT_ACTIVE_PAGES).some(page => !['verified', 'burn-pending'].includes(initial.currentProject.constants.pages?.[page]?.syncState))) {
      throw new Error('Complete initial ECU sync or compare the project base before applying a profile')
    }
    if (prior.context && (prior.context.epoch !== initial.projectEpoch || prior.context.session !== initial.connection.sessionId || prior.context.ini !== initial.parsedIni)) {
      throw new Error('Profile belongs to an earlier project or connection; download ECU RAM first')
    }
    const context = { epoch: initial.projectEpoch, session: initial.connection.sessionId,
      connectedAt: initial.connection.lastConnectedAt, ini: initial.parsedIni, constants: initial.currentProject.constants }
    const overlays = restoring ? [] : (profile?.table_overlays ?? profile?.tableOverlays ?? [])
    const changes = restoring ? [] : (profile?.changes ?? []).map(item => ({ ...item, field: item.field ?? item.key }))
    for (const [table, field, value] of [['ve2', 'fuel2Mode', 1], ['spark2', 'spark2Mode', 2]]) {
      if (overlays.some(item => item.target === table) && !changes.some(item => item.field === field)) changes.push({ field, value })
    }
    if (!restoring && (!profile?.name || (!overlays.length && !changes.length))) throw new Error('Empty runtime profile')
    const tables = [...new Set([...(prior.appliedTables || []), ...overlays.map(item => item.target)])]
    const fields = [...new Set([...(prior.appliedFields || []), ...changes.map(item => item.field)])]
    if (!tables.length && !fields.length) throw new Error('No profile changes to restore')
    for (const name of tables) if (!['ve2', 'spark2', 'afr1'].includes(name)) throw new Error(`Unsupported profile table '${name}'`)
    for (const name of fields) if (!DEFAULT_RUNTIME_PROFILE_FIELDS.includes(name)) throw new Error(`Unsupported profile field '${name}'`)
    if (new Set(overlays.map(item => item.target)).size !== overlays.length || new Set(changes.map(item => item.field)).size !== changes.length) throw new Error('Duplicate profile target')
    const defs = Object.fromEntries(tables.map(name => [name, resolveRuntimeTable(context.ini, name)]))
    const metas = Object.fromEntries(fields.map(name => [name, resolveRuntimeField(context.ini, name)]))
    const pages = [...new Set([...Object.values(defs), ...Object.values(metas)].map(def => def.page))]
    const base = {}
    for (const page of pages) {
      const snapshot = context.constants.pages?.[page]
      if (!snapshot || snapshot.source === 'legacy-partial') throw new Error(`A complete project baseline is required for page ${page}`)
      base[page] = validatePageSnapshot(snapshot, context.ini.constants.pageSizes[page]).buffer
    }
    check(context)
    running = true
    const before = {}, targets = {}, touched = []
    const owner = {}, pollingSession = serialService.sessionGeneration
    let entered = false
    let transactionSession = null
    try {
      get().setOperation({ owner, type: restoring ? 'runtime-rollback' : 'runtime-profile', scope: 'runtime-profile', stage: 'read', label: 'Checking ECU profile', current: 0, total: pages.length })
      entered = true
      transactionSession = { ...prior, state: restoring ? 'RollingBack' : 'Applying' }
      set({ runtimeProfileSession: transactionSession })
      await serialService.enterExclusiveMode()
      await safety(context)
      for (const page of pages) {
        before[page] = await read(context, page)
        targets[page] = Buffer.from(before[page])
      }
      // Restore previously used targets to project base when switching profiles.
      for (const name of tables) putTable(targets[defs[name].page], tableFrom(base[defs[name].page], defs[name]), defs[name])
      for (const name of fields) putField(targets[metas[name].page], metas[name], readRuntimeFieldFromBuffer(base[metas[name].page], metas[name]))
      for (const overlay of overlays) {
        const def = defs[overlay.target]
        const baseline = tableFrom(base[def.page], def)
        let next = overlay.table
        if (!next) {
          let sourceTable = null
          if (overlay.operation !== 'fill') {
            const sourceDef = resolveRuntimeTable(context.ini, overlay.source)
            const source = validatePageSnapshot(context.constants.pages?.[sourceDef.page], context.ini.constants.pageSizes[sourceDef.page]).buffer
            sourceTable = tableFrom(source, sourceDef)
          }
          next = buildRuntimeTableOverlay(sourceTable, def, overlay, baseline)
        }
        putTable(targets[def.page], next, def)
      }
      for (const change of changes) putField(targets[metas[change.field].page], metas[change.field], change.value)
      for (const field of Object.values(metas)) {
        if (field.requiresPowerCycle && readRuntimeFieldFromBuffer(before[field.page], field) !== readRuntimeFieldFromBuffer(targets[field.page], field)) {
          throw new Error(`'${field.name}' requires a power cycle according to the INI; configure it through settings, burn, and restart the ECU before using runtime profiles`)
        }
      }
      // The overlay concept uses percentage fuel and added ignition degrees.
      const mode = name => {
        const meta = resolveRuntimeField(context.ini, name)
        return readRuntimeFieldFromBuffer(targets[meta.page] || base[meta.page] || validatePageSnapshot(context.constants.pages[meta.page], context.ini.constants.pageSizes[meta.page]).buffer, meta)
      }
      if (!restoring && overlays.some(item => item.target === 've2') && mode('fuel2Mode') !== 1) throw new Error('VE2 profiles require Fuel2 Mode = Multiplied %')
      if (!restoring && overlays.some(item => item.target === 'spark2') && mode('spark2Mode') !== 2) throw new Error('Spark2 profiles require Spark2 Mode = Added')
      if (!restoring && overlays.some(item => item.target === 'spark2')) {
        const def = defs.spark2
        const values = tableFrom(targets[def.page], def).rawValues.map(value => (value + def.zMeta.translate) * def.zMeta.scale)
        if (values.some(value => value < -40 || value > 70)) throw new Error('Added Spark2 profile values must be within the INI range -40 to 70 degrees')
      }
      await prepareConfigurationWrite(context.ini, targets, async page => ({ buffer: before[page] || await read(context, page) }), configurationWriteOptions(get().currentProject))
      for (const [index, page] of pages.entries()) {
        get().updateOperation?.({ stage: 'write', current: index, label: `Profile page ${page}` })
        await write(context, page, targets[page], before[page], () => { if (!touched.includes(page)) touched.push(page) })
      }
      check(context)
      const currentTables = Object.fromEntries(tables.map(name => [name, tableFrom(targets[defs[name].page], defs[name])]))
      const currentValues = Object.fromEntries(fields.map(name => [name, readRuntimeFieldFromBuffer(targets[metas[name].page], metas[name])]))
      const next = { ...prior, state: restoring ? 'Base' : 'ProfileActive', activeProfile: restoring ? null : profile.name,
        context, appliedTables: tables, appliedFields: fields, tables, fields,
        currentTables, currentValues, baselineTables: Object.fromEntries(tables.map(name => [name, tableFrom(base[defs[name].page], defs[name])])),
        baseline: Object.fromEntries(fields.map(name => [name, { ...metas[name], value: readRuntimeFieldFromBuffer(base[metas[name].page], metas[name]) }])),
        capturedAt: new Date().toISOString(), lastResult: { ok: true, type: restoring ? 'rollback' : 'apply', ramOnly: true },
        history: appendRuntimeProfileHistory(prior, { type: restoring ? 'rollback' : 'apply', profile: profile?.name, pages, ramOnly: true }) }
      set(state => {
        const snapshots = Object.fromEntries(Object.entries(state.currentProject.constants.pages).map(([page, snapshot]) => {
          if (!pages.includes(Number(page))) return [page, snapshot]
          const syncState = restoring && targets[page].equals(base[page]) ? 'burn-pending' : 'unknown'
          return [page, { ...snapshot, syncState, lastVerifiedAt: syncState === 'burn-pending' ? new Date().toISOString() : null }]
        }))
        return { runtimeProfileSession: next, currentProject: {
          ...state.currentProject, constants: { ...state.currentProject.constants, pages: snapshots },
          ecu: { ...state.currentProject.ecu, sync: { ...state.currentProject.ecu.sync,
            state: restoring ? deriveProjectSyncState({ pages: snapshots }, state.currentProject.ecu.sync.activePages) : 'runtime-overlay' } }
        } }
      })
      get().notify(restoring ? 'Project base restored to RAM; burn separately if needed' : `${profile.name} verified in ECU RAM; project base preserved`, 'success')
      return restoring ? { ok: true, session: next } : next
    } catch (error) {
      let rollbackError = null
      // Try every attempted page, including the one whose write failed midway.
      const recoveryErrors = []
      for (const page of touched.slice().reverse()) {
        try {
          const actual = await read(context, page)
          await write(context, page, before[page], actual)
        } catch (failure) { recoveryErrors.push(`Page ${page}: ${failure.message}`) }
      }
      rollbackError = recoveryErrors.length ? recoveryErrors.join('; ') : null
      const sameContext = get().projectEpoch === context.epoch && get().connection.sessionId === context.session && get().parsedIni === context.ini
      if (sameContext || get().runtimeProfileSession === transactionSession) set({ runtimeProfileSession: { ...prior, state: rollbackError || !sameContext ? 'Unknown' : prior.state,
        lastResult: { ok: false, error: error.message, rollbackOk: !rollbackError, rollbackError },
        history: appendRuntimeProfileHistory(prior, { type: 'apply-failed', error: error.message, rollbackError }) } })
      get().notify(`Profile failed: ${error.message}${rollbackError ? `; recovery failed: ${rollbackError}. Download ECU RAM before continuing.` : '; pre-transaction ECU RAM restored'}`, 'error')
      throw error
    } finally {
      if (entered) {
        serialService.resumeOutputChannelsPolling(pollingSession)
        if (get().operation?.owner === owner) get().clearOperation()
      }
      running = false
    }
  }

  return {
    clearRuntimeProfileSession: (overrides = {}) => set({ runtimeProfileSession: createEmptyRuntimeProfileSession(overrides) }),
    exportRuntimeProfileLog: () => (get().runtimeProfileSession?.history || []).map(entry => JSON.stringify(entry)).join('\n'),
    getRuntimeProfileGuardStatus: status,
    applyRuntimeProfile: profile => execute(profile),
    rollbackRuntimeProfile: () => execute(null, true)
  }
}
