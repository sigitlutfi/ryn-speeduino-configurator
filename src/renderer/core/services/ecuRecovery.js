const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export function assertStoppedForReset(telemetry) {
  if (telemetry?.rpm !== 0 || telemetry.engine?.running !== false || telemetry.engine?.cranking !== false) {
    throw new Error('Fresh, stopped-engine telemetry is required before ECU reset')
  }
  const channels = telemetry.outputChannels
  if (![0, false].includes(channels?.burnPending)) throw new Error('EEPROM burn is active or its status is unknown')
  if (![0, false].includes(channels?.testenabled) || ![0, false].includes(channels?.testactive)) {
    throw new Error('Disable output test mode before ECU reset; its status must be known')
  }
}

export async function validateConnectedECU({ compare, readTelemetry, check }) {
  check()
  const comparison = await compare()
  check()
  if (!comparison || comparison.ok === false || comparison.error || comparison.errors?.length) {
    const pages = comparison?.errors?.filter(page => Number.isInteger(page)) || []
    const error = new Error(comparison?.error || `ECU configuration comparison failed${pages.length ? ` on page(s) ${pages.join(', ')}` : ''}; inspect the sync results`)
    error.comparison = comparison
    throw error
  }
  const telemetry = await readTelemetry()
  check()
  if (!Number.isFinite(telemetry?.rpm) || typeof telemetry.engine?.running !== 'boolean' ||
      typeof telemetry.engine?.cranking !== 'boolean') throw new Error('ECU returned incomplete telemetry after reconnect')
  const review = ['different', 'generated', 'missing'].some(key => comparison[key]?.length)
  return { comparison, telemetry, status: review ? 'review' : 'ready' }
}

// Open success is only the transport stage. App owns handshake, CRC comparison
// and the first fresh telemetry read, and publishes their outcome to the store.
export async function recoverECUConnection(options) {
  const { getState } = options
  const initial = getState(), epoch = initial.projectEpoch, generation = initial.connection.recoveryGeneration
  const attempt = initial.beginConnectionAttempt?.(options.owner || 'recovery')
  const check = () => {
    options.check?.()
    const state = getState()
    if (state.projectEpoch !== epoch || state.connection.recoveryGeneration !== generation ||
        (attempt && state.connection.connectionAttempt !== attempt)) throw new Error('Connection attempt superseded or cancelled')
  }
  try { return await performConnectionRecovery({ ...options, check }) }
  finally { if (attempt) getState().endConnectionAttempt(attempt) }
}

async function performConnectionRecovery({ serial, getState, port, baud = 115200, check = () => {},
  attempts = 5, wait = delay, now = Date.now, onStage = () => {}, timeout = 45000 }) {
  let lastError = 'ECU port unavailable'
  for (let attempt = 0; attempt < attempts; attempt++) {
    check()
    if (attempt) await wait(Math.min(500 * 2 ** (attempt - 1), 4000))
    check()
    onStage(`Waiting for ${port} (${attempt + 1}/${attempts})`)
    const ports = await serial.listPorts()
    check()
    if (!ports.some(candidate => candidate.path === port)) continue
    if (getState().operation) throw new Error('Another ECU operation is running');
    try {
      await serial.disconnect()
      check()
      const state = getState()
      state.setConnectionPort(port)
      state.setConnectionBaud(baud)
      state.setConnectionStatus('connecting')
      state.setConnectionTransportStatus('connecting')
      state.setConnectionHandshakeStatus('idle')
      const result = await serial.connect(port, baud)
      check()
      if (!result?.ok) throw new Error(result?.error || 'Serial open failed')
      const deadline = now() + timeout
      while (now() < deadline) {
        check()
        const connection = getState().connection
        if (connection.validationStatus === 'failed') {
          // Reopening a port cannot resolve a contract or tune-read failure.
          return { ok: false, error: connection.validationError || 'ECU validation failed' }
        }
        if (connection.status === 'connected' && ['ready', 'review'].includes(connection.validationStatus)) {
          return { ok: true, review: connection.validationStatus === 'review' }
        }
        if (connection.status === 'error' || connection.status === 'disconnected') {
          throw new Error(connection.errorMsg || 'Connection lost during ECU recovery')
        }
        onStage(connection.handshakeStatus === 'ok' ? 'Checking configuration and fresh telemetry' : 'Waiting for ECU handshake')
        await wait(100)
      }
      throw new Error('ECU handshake/validation timed out')
    } catch (error) {
      check()
      lastError = error.message
      await serial.disconnect()
    }
  }
  return { ok: false, error: `ECU recovery failed after ${attempts} attempts: ${lastError}` }
}

// A bounded background retry loop. Each tick reads current store state so
// project changes, manual Disconnect and firmware operations stop old attempts.
export function createAutoReconnect({ getState, connect, now = Date.now, onError = () => {} }) {
  let key = null, attempts = 0, nextAt = 0, busy = false
  return async () => {
    const state = getState(), connection = state.connection
    const nextKey = `${state.projectEpoch}|${state.settings.lastSerialPort}|${state.settings.lastSerialBaud}|${state.settings.autoReconnect}|${connection.autoReconnectPaused}`
    if (key !== nextKey || connection.status === 'connected') { key = nextKey; attempts = 0; nextAt = 0 }
    if (busy || !state.currentProject || !state.settings.autoReconnect || !state.settings.lastSerialPort ||
        connection.autoReconnectPaused || connection.connectionAttempt || state.operation || !['disconnected', 'error'].includes(connection.status) ||
        attempts >= 8 || now() < nextAt) return
    busy = true
    attempts++
    try { await connect(state.settings.lastSerialPort, Number(state.settings.lastSerialBaud || 115200), nextKey) }
    catch (error) { onError(error) }
    finally {
      busy = false
      nextAt = now() + Math.min(500 * 2 ** attempts, 8000)
      if (attempts === 8) onError(new Error('Auto reconnect stopped after 8 attempts; connect manually to retry'))
    }
  }
}

export async function disconnectECU({ serial, getState, reset = () => {} }) {
  getState().cancelConnectionRecovery()
  const generation = getState().connection.recoveryGeneration
  getState().setConnectionStatus('disconnecting')
  getState().clearRealtime?.()
  reset()
  try {
    await serial.disconnect()
    if (getState().connection.recoveryGeneration === generation) getState().setConnectionStatus('disconnected')
  } catch (error) {
    if (getState().connection.recoveryGeneration === generation) getState().setConnectionStatus('error', error.message)
    throw error
  }
}
