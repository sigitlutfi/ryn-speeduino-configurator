import { Buffer } from 'buffer'
import { serialService } from '../../services/serialService.js'
import { assertCompatibleContract } from '../../../../shared/protocol/contract.js'
import { parsePage } from '../../../../shared/protocol/binary-parser.js'
import { calculatePageCRC } from '../../../../shared/protocol/ecu-commands.js'

export function createECURestartSlice(set, get) {
  return {
    // The UI explicitly asks the user to power-cycle, then verifies the saved
    // values on a fresh connection. A serial reconnect is never auto-confirmed.
    verifyECUPowerCycle: async () => {
      const pollingSession = serialService.sessionGeneration
      let entered = false, operation = null
      const state = get(), pending = state.currentProject?.hardware?.restartRequired
      if (!pending) return { ok: true }
      const epoch = state.projectEpoch, session = state.connection.sessionId, ini = state.parsedIni
      const check = () => {
        const s = get()
        if (s.projectEpoch !== epoch || s.connection.sessionId !== session || s.parsedIni !== ini ||
            s.connection.status !== 'connected' || s.currentProject?.hardware?.restartRequired !== pending) throw new Error('Project, connection or restart state changed')
        assertCompatibleContract(s)
      }
      try {
        if (state.operation) throw new Error('Another ECU operation is running')
        if (state.connection.status !== 'connected') throw new Error('Power-cycle and reconnect the ECU first')
        if (!state.connection.lastConnectedAt || state.connection.lastConnectedAt === pending.connectedAt) throw new Error('Power-cycle the ECU, then reconnect before verification')
        if (pending.fields.some(field => !pending.burnedPages.includes(field.page))) throw new Error('Burn the changed setup pages before power-cycling the ECU')
        check()
        if (!pending.fields?.length) throw new Error('Restart tracking has no fields to verify')
        state.setOperation({ type: 'restart-verify', scope: 'sync', label: 'Verifying ECU setup after power cycle' })
        operation = get().operation
        entered = true
        await serialService.enterExclusiveMode()
        check()
        const telemetry = await serialService.readOutputChannels(ini)
        check()
        if (telemetry?.rpm !== 0 || telemetry.engine?.running !== false || telemetry.engine?.cranking !== false) throw new Error('Stop the engine before verifying ECU setup')
        const expected = []
        for (const [page, fields] of Object.entries(ini.constants.pages)) for (const [name, meta] of Object.entries(fields)) {
          if (meta.requiresPowerCycle && pending.targetConfig[name] !== undefined) expected.push({ page: Number(page), name, value: pending.targetConfig[name] })
        }
        if (!expected.length || pending.fields.some(field => !expected.some(target => target.name === field.name && target.page === field.page))) throw new Error('Restart tracking does not match the current INI; keep the requirement pending')
        for (const page of new Set(expected.map(field => field.page))) {
          const result = await get().readPageFromECU(page)
          check()
          const crc = await serialService.readPageCRC(page)
          check()
          const buffer = Buffer.from(result.buffer)
          if (buffer.length !== ini.constants.pageSizes[page] || calculatePageCRC(buffer).toString(16).toUpperCase().padStart(8, '0') !== crc) throw new Error('ECU setup CRC/readback mismatch')
          const decoded = parsePage(buffer, ini.constants.pages[page])
          for (const field of expected.filter(field => field.page === page)) {
            if (JSON.stringify(decoded[field.name]) !== JSON.stringify(field.value)) throw new Error(`ECU ${field.name} does not match the burned setup`)
          }
        }
        check()
        set(s => ({ currentProject: { ...s.currentProject, hardware: { ...s.currentProject.hardware, restartRequired: null } } }))
        const saved = await get().saveECURestartState?.()
        if (saved?.ok === false) {
          if (get().projectEpoch === epoch) set(s => ({ currentProject: { ...s.currentProject, hardware: { ...s.currentProject.hardware, restartRequired: pending } } }))
          throw new Error(saved.error)
        }
        if (get().projectEpoch !== epoch || get().connection.sessionId !== session || get().connection.status !== 'connected') {
          if (get().projectEpoch === epoch) {
            set(s => ({ currentProject: { ...s.currentProject, hardware: { ...s.currentProject.hardware, restartRequired: pending } } }))
            await get().saveECURestartState?.()
          }
          throw new Error('Connection changed before restart verification completed')
        }
        return { ok: true }
      } catch (error) {
        get().notify?.(error.message, 'error')
        return { ok: false, error: error.message }
      } finally {
        if (entered) { serialService.resumeOutputChannelsPolling(pollingSession); if (get().operation === operation) get().clearOperation() }
      }
    },
  }
}
