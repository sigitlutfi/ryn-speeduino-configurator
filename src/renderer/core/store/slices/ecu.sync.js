// Tune pages use the same read/write/CRC/burn commands and INI as TunerStudio.
import { Buffer } from 'buffer'
import { assertCompatibleContract } from '../../../../shared/protocol/contract.js'
import { configurationWriteOptions } from '../../../../shared/protocol/board-pins.js'
import { recordRestartWrite, recordRestartBurn } from '../utils/ecu.restart.js'
import { prepareConfigurationWrite } from '../../../../shared/protocol/configuration-policy.js'
import { createPageSnapshot, validatePageSnapshot, findDirtyRegion } from '../../../../shared/protocol/page-cache.js'
import { serialService } from '../../services/serialService.js'
import { DEFAULT_ACTIVE_PAGES } from '../utils/project.constants.js'
import { getPendingBurnPages, updatePageSnapshotStates } from '../utils/page.utils.js'
import { delay, nowIso, deriveProjectSyncState } from '../utils/project.utils.js'
import { buildDisplayTablesFromDecodedPages } from '../utils/table.transforms.js'
import { decodeDriveConfig } from '../../../../shared/protocol/drive-modes.js'

export function createECUSyncSlice(set, get) {
  let running = false
  const failure = error => ({ ok: false, error: error?.message || String(error), errors: [{ error: error?.message || String(error) }] })

  function capture() {
    const state = get()
    if (state.connection.status !== 'connected') throw new Error('Not connected')
    if (!state.currentProject || !state.parsedIni) throw new Error('No project or INI loaded')
    assertCompatibleContract(state)
    return { epoch: state.projectEpoch, session: state.connection.sessionId,
      connectedAt: state.connection.lastConnectedAt, ini: state.parsedIni,
      project: state.currentProject, constants: state.currentProject.constants, tables: state.tables }
  }

  function check(context) {
    const state = get()
    if (state.connection.status !== 'connected' || state.projectEpoch !== context.epoch ||
        state.connection.sessionId !== context.session || state.connection.lastConnectedAt !== context.connectedAt ||
        state.parsedIni !== context.ini || !state.currentProject) {
      throw new Error('Project, INI or connection changed during sync; reconnect and compare again')
    }
    assertCompatibleContract(state)
  }

  function targets(context, requested) {
    const pages = [...new Set((requested ?? context.project.ecu?.sync?.activePages ?? DEFAULT_ACTIVE_PAGES).map(Number))]
    if (!pages.length) throw new Error('No tune pages selected')
    for (const page of pages) {
      if (!Number.isInteger(page) || !context.ini.constants?.pages?.[page] ||
          !Number.isInteger(context.ini.constants?.pageSizes?.[page]) || context.ini.constants.pageSizes[page] <= 0) {
        throw new Error(`Invalid INI page ${page}`)
      }
    }
    return pages
  }

  function localTarget(context, page) {
    const snapshot = context.project.constants?.pages?.[page]
    if (!snapshot) throw new Error(`Page ${page} has no complete local snapshot; download a baseline first`)
    if (snapshot.source === 'legacy-partial') throw new Error(`Page ${page} is a partial legacy tune; download a complete baseline before upload`)
    return { snapshot, ...validatePageSnapshot(snapshot, context.ini.constants.pageSizes[page]) }
  }

  function checkTarget(context, page, target) {
    check(context)
    if (Object.keys(get().tableDrafts || {}).length) throw new Error('Table edited during ECU sync')
    if (get().currentProject.constants?.pages?.[page]?.rawData !== target.snapshot.rawData) {
      throw new Error(`Page ${page} changed locally during sync`)
    }
  }

  function patchPages(context, patches) {
    check(context)
    set(state => {
      const pages = updatePageSnapshotStates(state.currentProject, patches)
      return { currentProject: { ...state.currentProject,
        constants: { ...state.currentProject.constants, pages },
        ecu: { ...state.currentProject.ecu, sync: { ...state.currentProject.ecu.sync,
          state: deriveProjectSyncState({ pages }, state.currentProject.ecu.sync.activePages) } } } }
    })
  }

  // Validate the complete page, not only individual serial packet envelopes.
  async function readVerified(context, page, attempts = 3) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      check(context)
      const result = await get().readPageFromECU(page)
      check(context)
      if (result.buffer.length !== context.ini.constants.pageSizes[page]) throw new Error(`Wrong read size on page ${page}`)
      const snapshot = createPageSnapshot({ pageId: page, size: result.buffer.length, buffer: result.buffer,
        source: 'ecu-read', syncState: 'verified', lastReadAt: nowIso(), lastVerifiedAt: nowIso() })
      const ecuCRC = await serialService.readPageCRC(page)
      check(context)
      if (snapshot.crc32 === ecuCRC) return { ...result, snapshot }
    }
    throw new Error(`Page ${page} CRC/readback mismatch after ${attempts} reads`)
  }

  async function verifyTarget(context, page, target) {
    const actual = await readVerified(context, page)
    checkTarget(context, page, target)
    if (!Buffer.from(actual.buffer).equals(target.buffer)) throw new Error(`Page ${page} RAM verify mismatch`)
    return actual
  }

  async function waitForBurn(context) {
    if (!context.ini.outputChannels?.channels?.burnPending) {
      throw new Error('This INI cannot confirm EEPROM completion (missing burnPending)')
    }
    const deadline = Date.now() + 15000
    do {
      check(context)
      const status = await serialService.readOutputChannels(context.ini)
      check(context)
      const pending = status?.outputChannels?.burnPending
      if (pending === 0 || pending === false) return
      if (pending !== 1 && pending !== true) throw new Error('Invalid EEPROM burnPending response')
      await delay(100)
    } while (Date.now() < deadline)
    throw new Error('EEPROM burn did not finish before timeout')
  }

  async function burn(context, page, target) {
    // Standalone burn must also prove RAM matches the local target first.
    await prepareConfigurationWrite(context.ini, { [page]: target.buffer }, id => readVerified(context, id), configurationWriteOptions(get().currentProject))
    await verifyTarget(context, page, target)
    if (!context.ini.outputChannels?.channels?.burnPending) throw new Error('Missing INI burnPending; EEPROM completion cannot be verified')
    checkTarget(context, page, target)
    patchPages(context, { [page]: { crc32: target.crc32, syncState: 'burn-pending', lastVerifiedAt: null } })
    await serialService.burnPage(page)
    checkTarget(context, page, target)
    await waitForBurn(context)
    await verifyTarget(context, page, target)
    patchPages(context, { [page]: { crc32: target.crc32, syncState: 'verified', lastVerifiedAt: nowIso() } })
    await recordRestartBurn(set, get, page)
    return { ok: true, verified: true, burned: true }
  }

  async function transaction(type, work) {
    if (running || get().operation) return failure(new Error('Another ECU operation is running'))
    running = true
    const owner = {}, pollingSession = serialService.sessionGeneration
    let entered = false
    try {
      if (Object.keys(get().fieldDrafts || {}).length) throw new Error('Save or discard field drafts before ECU sync')
      if (type === 'download' && Object.keys(get().tableDrafts || {}).length) throw new Error('Save or discard table drafts before downloading ECU RAM')
      const profile = get().runtimeProfileSession
      if (['write', 'upload', 'burn'].includes(type) && ['ProfileActive', 'Unknown'].includes(profile?.state)) throw new Error('Return the runtime profile to DEFAULT before upload or burn; download ECU RAM to recover an unknown state')
      const context = capture()
      get().setOperation({ owner, type, stage: 'read', label: `${type} ECU pages`, current: 0, total: 0, scope: 'sync' })
      entered = true
      await serialService.enterExclusiveMode()
      check(context)
      if (['write', 'upload', 'burn'].includes(type) && context.ini.info.signature === 'speeduino 202504-ryn-perf-v5') {
        const telemetry = await serialService.readOutputChannels(context.ini)
        check(context)
        get().setRealtime?.(telemetry)
        if (telemetry?.driveMode?.version !== 1 || !telemetry.driveMode.valid) throw new Error('Refresh or repair ECU Drive Mode status before tune writes')
        if (telemetry.driveMode.active !== 0 || telemetry.driveMode.state === 1) throw new Error('Select Drive Mode DEFAULT before uploading or burning the base tune')
      }
      return await work(context)
    } catch (error) {
      get().notify(`ECU ${type} failed: ${error.message || error}`, 'error', 12000)
      return failure(error)
    } finally {
      if (entered) {
        serialService.resumeOutputChannelsPolling(pollingSession)
        if (get().operation?.owner === owner) get().clearOperation()
      }
      running = false
    }
  }

  return {
    syncPagesToECU: (pageIds = [], options = {}) => transaction(options.burn ? 'upload' : 'write', async context => {
      if (Object.keys(get().tableDrafts || {}).length) throw new Error('Save table edits to the project before uploading')
      const pages = targets(context, pageIds.length ? pageIds : undefined)
      if (options.burn && !context.ini.outputChannels?.channels?.burnPending) throw new Error('Missing INI burnPending; EEPROM completion cannot be verified')
      // Validate every target before sending the first write.
      const local = Object.fromEntries(pages.map(page => [page, localTarget(context, page)]))
      const prepared = await prepareConfigurationWrite(context.ini,
        Object.fromEntries(pages.map(page => [page, local[page].buffer])),
        id => readVerified(context, id), configurationWriteOptions(get().currentProject))
      if (local[15] && context.ini.info.signature === 'speeduino 202504-ryn-perf-v5') {
        const region = findDirtyRegion(prepared.buffers[15], local[15].buffer)
        if (region && region.offset < 124 && region.offset + region.length > 106) {
          decodeDriveConfig(local[15].buffer.subarray(106, 124))
          const telemetry = await serialService.readOutputChannels(context.ini)
          checkTarget(context, 15, local[15])
          if (telemetry.rpm !== 0 || telemetry.engine?.running || telemetry.engine?.cranking) throw new Error('Stop the engine before uploading a tune that writes Drive Mode presets')
        }
      }
      const result = { ok: true, pages: {}, errors: [] }
      await recordRestartWrite(set, get, context.ini, prepared.before, prepared.after)
      get().updateOperation({ total: pages.length })
      for (const [index, page] of pages.entries()) {
        const target = local[page]
        try {
          checkTarget(context, page, target)
          const actual = { buffer: prepared.buffers[page] }
          checkTarget(context, page, target)
          const dirtyRegion = findDirtyRegion(actual.buffer, target.buffer)
          patchPages(context, { [page]: { crc32: target.crc32, syncState: 'write-pending', lastVerifiedAt: null } })
          get().updateOperation({ stage: 'write', label: `Writing page ${page}`, current: index })
          if (dirtyRegion) {
            for (let offset = 0; offset < dirtyRegion.length; offset += 64) {
              checkTarget(context, page, target)
              const chunk = dirtyRegion.after.subarray(offset, offset + 64)
              await serialService.writePage(page, dirtyRegion.offset + offset, chunk.length, Array.from(chunk))
              checkTarget(context, page, target)
            }
            await delay(options.writeSettleMs ?? 100)
          }
          get().updateOperation({ stage: 'verify', label: `Verifying RAM page ${page}` })
          await verifyTarget(context, page, target)
          // Matching RAM may still contain unburned changes from TunerStudio.
          patchPages(context, { [page]: { crc32: target.crc32, syncState: 'burn-pending', lastReadAt: nowIso() } })
          if (options.burn) {
            get().updateOperation({ stage: 'burn', label: `Burning page ${page}` })
            await burn(context, page, target)
          }
          result.pages[page] = { dirtyRegion, verified: true, burned: !!options.burn }
        } catch (error) {
          result.ok = false
          result.errors.push({ pageId: page, error: error.message })
          // Keep both raw and decoded target intact, even on failed verification.
          try { checkTarget(context, page, target); patchPages(context, { [page]: { syncState: 'verify-failed', lastVerifiedAt: null } }) } catch {}
          break
        }
        get().updateOperation({ current: index + 1 })
      }
      return result
    }),

    writePagesToRAM: (pages = []) => get().syncPagesToECU(pages, { burn: false }),
    uploadToECU: (pages = null) => get().syncPagesToECU(pages || [], { burn: true }),

    burnPage: page => transaction('burn', async context => {
      const [pageId] = targets(context, [page])
      const target = localTarget(context, pageId)
      try { return await burn(context, pageId, target) }
      catch (error) {
        try { checkTarget(context, pageId, target); patchPages(context, { [pageId]: { syncState: 'verify-failed', lastVerifiedAt: null } }) } catch {}
        throw error
      }
    }),

    burnPendingPages: (pageIds = null) => transaction('burn', async context => {
      const requested = pageIds?.length ? pageIds : getPendingBurnPages(context.project)
      if (!requested.length) return { ok: true, pages: [], errors: [] }
      const pages = targets(context, requested)
      const local = Object.fromEntries(pages.map(page => [page, localTarget(context, page)]))
      const result = { ok: true, pages: [], errors: [] }
      get().updateOperation({ total: pages.length })
      for (const [index, page] of pages.entries()) {
        try { await burn(context, page, local[page]); result.pages.push(page) }
        catch (error) {
          result.ok = false
          result.errors.push({ pageId: page, error: error.message })
          try { checkTarget(context, page, local[page]); patchPages(context, { [page]: { syncState: 'verify-failed', lastVerifiedAt: null } }) } catch {}
          break
        }
        get().updateOperation({ current: index + 1 })
      }
      return result
    }),
    burnActiveProjectPages: () => get().burnPendingPages(),

    compareWithECU: async () => {
      const result = await transaction('compare', async context => {
        if (Object.keys(get().tableDrafts || {}).length) throw new Error('Save table edits before comparing with ECU')
        const pages = targets(context)
        const comparison = { ok: true, matching: [], different: [], generated: [], missing: [], errors: [], pageStates: {}, pageDiffs: {} }
        const patches = {}
        get().updateOperation({ total: pages.length })
        for (const [index, page] of pages.entries()) {
          check(context)
          const snapshot = context.project.constants?.pages?.[page]
          try {
            if (!snapshot) {
              comparison.missing.push(page)
              comparison.pageStates[page] = 'missing-local'
              continue
            }
            const local = localTarget(context, page)
            const ecuCRC = await serialService.readPageCRC(page)
            checkTarget(context, page, local)
            let matches = local.crc32 === ecuCRC
            let actual
            if (!matches) {
              actual = await readVerified(context, page)
              checkTarget(context, page, local)
              matches = Buffer.from(actual.buffer).equals(local.buffer)
            }
            const status = matches ? 'verified' : snapshot.source === 'generated' ? 'generated-local' : 'different'
            comparison[matches ? 'matching' : status === 'generated-local' ? 'generated' : 'different'].push(page)
            comparison.pageStates[page] = status
            const diff = actual ? findDirtyRegion(local.buffer, actual.buffer) : null
            const hex = buffer => Buffer.from(buffer || []).subarray(0, 16).toString('hex').toUpperCase().match(/../g)?.join(' ') || ''
            comparison.pageDiffs[page] = { pageId: page, status, source: snapshot.source, localCRC: local.crc32,
              ecuCRC: actual?.snapshot.crc32 || ecuCRC, offset: diff?.offset || 0, length: diff?.length || 0,
              localHex: hex(diff?.before), ecuHex: hex(diff?.after),
              ecuLooksBlank: actual ? actual.buffer.every(value => value === 0) : false,
              summary: matches ? 'Local bytes match ECU RAM' : `${diff?.length || 0} byte(s) differ` }
            patches[page] = { crc32: local.crc32, syncState: status, lastVerifiedAt: matches ? nowIso() : null }
          } catch (error) {
            check(context)
            comparison.ok = false
            comparison.errors.push(page)
            comparison.pageStates[page] = 'verify-failed'
            comparison.pageDiffs[page] = { pageId: page, status: 'verify-failed', summary: error.message }
            if (snapshot) patches[page] = { syncState: 'verify-failed', lastVerifiedAt: null }
          }
          get().updateOperation({ current: index + 1 })
        }
        if (get().currentProject.constants !== context.constants) throw new Error('Project tune changed during compare')
        patchPages(context, patches)
        return comparison
      })
      // Keep the dialog's comparison shape even on contract/session errors.
      if (!result.pageStates) return { ...result, matching: [], different: [], generated: [], missing: [], pageStates: {}, pageDiffs: {} }
      return result
    },

    syncAllFromECU: () => transaction('download', async context => {
      const pages = targets(context)
      const snapshots = {}, decoded = {}
      get().updateOperation({ total: pages.length })
      for (const [index, page] of pages.entries()) {
        get().updateOperation({ stage: 'read', label: `Reading page ${page}`, current: index })
        const result = await readVerified(context, page)
        snapshots[page] = result.snapshot
        decoded[page] = result.decoded
        get().updateOperation({ current: index + 1 })
      }
      check(context)
      if (Object.keys(get().fieldDrafts || {}).length || Object.keys(get().tableDrafts || {}).length) throw new Error('Local edits were made during download; nothing was replaced')
      if (get().currentProject.constants !== context.constants || get().tables !== context.tables) {
        throw new Error('Local tune changed during download; nothing was replaced')
      }
      const constants = { pages: { ...context.constants.pages, ...snapshots },
        decodedPages: { ...context.constants.decodedPages, ...decoded } }
      const tables = buildDisplayTablesFromDecodedPages(context.ini, constants.decodedPages, get().tables)
      set(state => ({ currentProject: { ...state.currentProject, constants, tables,
        ecu: { ...state.currentProject.ecu, sync: { ...state.currentProject.ecu.sync,
          state: deriveProjectSyncState(constants, state.currentProject.ecu.sync.activePages), lastSyncAt: nowIso() } } },
        tables, tableDrafts: {}, runtimeProfileSession: { state: "Base", activeProfile: null, history: state.runtimeProfileSession?.history || [] } }))
      get().notify('ECU RAM downloaded and verified. Save the project to keep the .rynproj file.', 'success')
      return { ok: true, pages, errors: [], saved: false }
    })
  }
}
