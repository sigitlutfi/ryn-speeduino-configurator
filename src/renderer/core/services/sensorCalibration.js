import { assertWritableContract, assertCompatibleContract } from '../../../shared/protocol/contract.js'
import { calibrationChunks, calibrationCRCCommand } from '../../../shared/protocol/sensor-calibration.js'
import { calculatePageCRC } from '../../../shared/protocol/ecu-commands.js'
import { serialService } from './serialService.js'
import supportedContract from '../../../shared/protocol/ini-contract.js'

export async function sensorCalibrationOperation(get, sensor, data = null, progress = () => {}, service = serialService) {
  const initial = get(), epoch = initial.projectEpoch, session = initial.connection.sessionId, ini = initial.parsedIni
  if (initial.operation) throw new Error('Another ECU operation is running')
  if (data && initial.currentProject?.hardware?.restartRequired) throw new Error('Complete ECU setup power-cycle verification first')
  const check = () => {
    const s = get()
    if (s.projectEpoch !== epoch || s.connection.sessionId !== session || s.parsedIni !== ini) throw new Error('Project or ECU connection changed')
    if (data) assertWritableContract(s)
    else assertCompatibleContract(s)
    if (ini?.info?.signature !== supportedContract.signature) throw new Error('Calibration requires the paired firmware INI')
    if (s.connection.status !== 'connected' || s.connection.handshakeStatus !== 'ok') throw new Error('Connect and complete the ECU handshake first')
    if (data && ['ProfileActive', 'Unknown', 'Applying', 'RollingBack'].includes(s.runtimeProfileSession?.state)) throw new Error('Restore the runtime tune preset first')
  }
  check()
  // Construct/validate everything before the first write; EEPROM changes are immediate.
  const commands = data ? calibrationChunks(sensor, data) : []
  const expectedCRC = data ? calculatePageCRC(data) : null
  const pollingSession = service.sessionGeneration
  initial.setOperation({ type: 'sensor-calibration', label: `Calibration ${sensor.toUpperCase()}` })
  const operation = get().operation
  let attemptedWrite = false
  try {
    await service.enterExclusiveMode()
    const stopped = async () => {
      check()
      const telemetry = await service.readOutputChannels(ini)
      check()
      if (telemetry.rpm !== 0 || telemetry.engine?.running !== false || telemetry.engine?.cranking !== false) throw new Error('Calibration requires a fresh stopped-engine reading')
      if (telemetry.outputChannels?.testenabled || telemetry.outputChannels?.testactive) throw new Error('Stop ECU output tests before calibration')
      if (!telemetry.driveMode?.valid || telemetry.driveMode.active !== 0 || telemetry.driveMode.state !== 0) throw new Error('Select Drive Mode DEFAULT before calibration')
    }
    for (let i = 0; i < commands.length; i++) {
      await stopped()
      // Never replay an O2 continuation on timeout: the firmware accumulates
      // CRC across chunks. A manual retry must restart the whole table at zero.
      attemptedWrite = true
      const response = await service.sendCommand(commands[i], 5000)
      check()
      if (response.status !== 0 || response.data.length !== 0) throw new Error('ECU rejected the calibration chunk')
      progress(Math.round((i + 1) * 100 / commands.length))
    }
    check()
    const reply = await service.sendCommand(calibrationCRCCommand(sensor), 3000)
    check()
    if (reply.status !== 0 || reply.data.length !== 4) throw new Error('Invalid calibration CRC response')
    const crc = reply.data.readUInt32BE(0)
    if (expectedCRC !== null && crc !== expectedCRC) throw new Error('Calibration CRC mismatch; calibration is unverified. Retry the complete table with the engine stopped.')
    return { crc, empty: crc === 0xffffffff, verified: data !== null }
  } catch (error) {
    if (attemptedWrite) throw new Error(`${error.message} Calibration may be partially written; do not treat it as verified.`)
    throw error
  } finally {
    service.resumeOutputChannelsPolling(pollingSession)
    if (get().operation === operation) get().clearOperation()
  }
}
