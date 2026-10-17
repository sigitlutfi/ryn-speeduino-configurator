import { Buffer } from 'buffer'
import { serialService } from '../../services/serialService.js'
import { assertCompatibleContract } from '../../../../shared/protocol/contract.js'
import {
  assertDriveModeINI,
  decodeDriveConfig,
  parseDriveStatus,
  driveStatusCommand,
  driveSelectCommand,
  DRIVE_REASONS
} from '../../../../shared/protocol/drive-modes.js'
import { validatePageSnapshot, createPageSnapshot } from '../../../../shared/protocol/page-cache.js'
import { deriveProjectSyncState } from '../utils/project.utils.js'

export function createDriveModesSlice(set, get) {
  let busy = false
  const check = (context) => {
    const s = get()
    if (
      s.projectEpoch !== context.epoch ||
      s.parsedIni !== context.ini ||
      s.currentProject?.constants !== context.constants ||
      s.connection.sessionId !== context.session ||
      s.connection.lastConnectedAt !== context.connectedAt
    )
      throw new Error('Project, tune or ECU connection changed')
    assertCompatibleContract(s)
    assertDriveModeINI(s.parsedIni)
    if (
      ['ProfileActive', 'Unknown', 'Applying', 'RollingBack'].includes(
        s.runtimeProfileSession?.state
      )
    )
      throw new Error('Restore the legacy tune preset before using Drive Mode')
  }
  const read = async (context) => {
    try {
      check(context)
      const response = await serialService.sendCommand(driveStatusCommand())
      check(context)
      if (response.status !== 0) throw new Error('ECU rejected the Drive Mode status request')
      const status = parseDriveStatus(response.data)
      set({
        driveModeStatus: {
          ...status,
          receivedAt: Date.now(),
          session: context.session,
          epoch: context.epoch
        }
      })
      return status
    } catch (error) {
      if (get().projectEpoch === context.epoch && get().connection.sessionId === context.session && get().parsedIni === context.ini) set({ driveModeStatus: null })
      throw error
    }
  }
  const run = async (action) => {
    const s = get()
    if (busy || s.operation) throw new Error('Another ECU operation is running')
    const context = {
      epoch: s.projectEpoch,
      session: s.connection.sessionId,
      connectedAt: s.connection.lastConnectedAt,
      ini: s.parsedIni,
      constants: s.currentProject?.constants
    }
    check(context)
    busy = true
    const owner = {}, pollingSession = serialService.sessionGeneration
    s.setOperation({ owner, type: 'drive-mode', scope: 'drive-mode', label: 'Drive Mode' })
    try {
      await serialService.enterExclusiveMode()
      check(context)
      return await action(context)
    } finally {
      serialService.resumeOutputChannelsPolling(pollingSession)
      busy = false
      if (get().operation?.owner === owner) get().clearOperation()
    }
  }
  const projectConfig = (context) => {
    const page = validatePageSnapshot(
      context.constants?.pages?.[15],
      context.ini.constants.pageSizes[15]
    ).buffer
    const bytes = page.subarray(106, 124)
    decodeDriveConfig(bytes)
    return bytes
  }
  return {
    driveModeStatus: null,
    readDriveModeStatus: () => run(read),
    selectDriveMode: (mode) =>
      run(async (context) => {
        if (
          mode !== 0 &&
          (Object.keys(get().fieldDrafts || {}).length ||
            Object.keys(get().tableDrafts || {}).length ||
            get().projectSettingsDirty)
        )
          throw new Error('Save or discard pending tune edits first')
        if (mode !== 0 && get().currentProject?.hardware?.restartRequired) throw new Error('Complete ECU setup power cycle verification before switching Drive Mode')
        const config = mode === 0 ? null : projectConfig(context)
        const before = await read(context)
        if (!before.valid || (config && before.configCRC !== config.readUInt16LE(16)))
          throw new Error(
            'Upload and verify the project Drive Mode presets with the engine stopped first'
          )
        const token = (before.requestToken % 65535) + 1
        let sendError
        try {
          const reply = await serialService.sendCommand(
            driveSelectCommand(mode, token, before.configCRC)
          )
          check(context)
          if (reply.status !== 0) throw new Error('ECU rejected the Drive Mode selection')
        } catch (error) {
          sendError = error
        } // Reconcile a lost ACK; never replay a selection.
        const deadline = Date.now() + 4500
        while (Date.now() < deadline) {
          const status = await read(context)
          if (status.requestToken !== token || status.requested !== mode)
            throw (
              sendError ||
              new Error('Drive Mode request was superseded or ECU restarted; refresh its status')
            )
          if (status.state === 2)
            throw new Error(DRIVE_REASONS[status.reason] || 'ECU rejected mode switch')
          if (status.state === 0 && status.active === mode && status.appliedToken === token)
            return status
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        throw new Error('Mode status is unconfirmed; refresh ECU status before another selection')
      }),
    uploadDriveModeConfig: () =>
      run(async (context) => {
        if (
          Object.keys(get().fieldDrafts || {}).length ||
          Object.keys(get().tableDrafts || {}).length ||
          get().projectSettingsDirty
        )
          throw new Error('Save or discard pending tune edits before uploading presets')
        const target = projectConfig(context)
        const status = await read(context)
        if (status.active !== 0 || status.state === 1)
          throw new Error('Select DEFAULT before uploading presets')
        const telemetry = await serialService.readOutputChannels(context.ini)
        check(context)
        if (telemetry.rpm !== 0 || telemetry.engine?.running || telemetry.engine?.cranking)
          throw new Error('Stop the engine before uploading Drive Mode presets')
        const expected = validatePageSnapshot(context.constants.pages[15], 256).buffer
        const before = await get().readPageFromECU(15)
        check(context)
        const outsideMatches = (buffer) =>
          Buffer.from(buffer).subarray(0, 106).equals(expected.subarray(0, 106)) &&
          Buffer.from(buffer).subarray(124).equals(expected.subarray(124))
        if (!outsideMatches(before.buffer))
          throw new Error(
            'Page 15 differs outside Drive Mode presets. Compare or download the ECU tune before uploading presets'
          )
        await serialService.writePage(15, 106, 18, Array.from(target))
        check(context)
        const verified = await get().readPageFromECU(15)
        check(context)
        if (!Buffer.from(verified.buffer).subarray(106, 124).equals(target))
          throw new Error(
            'Drive Mode preset readback failed; repeat upload with the engine stopped'
          )
        if (!Buffer.from(verified.buffer).equals(expected))
          throw new Error(
            'ECU page 15 changed during preset upload; compare its tune before burning'
          )
        const actual = await read(context)
        if (!actual.valid || actual.configCRC !== target.readUInt16LE(16))
          throw new Error('ECU has not accepted the Drive Mode configuration; refresh status')
        const page = createPageSnapshot({
          pageId: 15,
          size: 256,
          buffer: expected,
          source: context.constants.pages[15].source,
          syncState: 'burn-pending',
          lastReadAt: new Date().toISOString(),
          lastVerifiedAt: new Date().toISOString()
        })
        set((state) => {
          const constants = {
            ...state.currentProject.constants,
            pages: { ...state.currentProject.constants.pages, 15: page }
          }
          return {
            currentProject: {
              ...state.currentProject,
              constants,
              ecu: {
                ...state.currentProject.ecu,
                sync: {
                  ...state.currentProject.ecu?.sync,
                  state: deriveProjectSyncState(
                    constants,
                    state.currentProject.ecu?.sync?.activePages || [15]
                  )
                }
              }
            }
          }
        })
        return actual
      })
  }
}
