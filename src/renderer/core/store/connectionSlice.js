const MAX_CONNECTION_EVENTS = 25

const nowIso = () => new Date().toISOString()

export const INITIAL_CONNECTION = {
  status: 'disconnected',
  sessionId: 0,
  firmwareSignature: null,
  port: '',
  baud: 115200,
  errorMsg: '',
  transportStatus: 'idle',
  handshakeStatus: 'idle',
  validationStatus: 'idle',
  validationError: '',
  autoReconnectPaused: false,
  recoveryGeneration: 0,
  connectionAttempt: null,
  connectionAttemptSequence: 0,
  availablePorts: [],
  refreshingPorts: false,
  lastConnectedAt: null,
  lastErrorAt: null,
  eventLog: [],
}

function appendEvent(eventLog = [], event) {
  return [event, ...eventLog].slice(0, MAX_CONNECTION_EVENTS)
}

export const createConnectionSlice = (set) => ({
  connection: { ...INITIAL_CONNECTION },

  setConnectionStatus: (status, errorMsg = '') =>
    set((s) => ({
      realtimeReceivedAt: status !== s.connection.status ? null : s.realtimeReceivedAt,
      driveModeStatus: status !== s.connection.status ? null : s.driveModeStatus,
      ...(status !== s.connection.status && ['ProfileActive', 'Applying', 'RollingBack', 'Unknown'].includes(s.runtimeProfileSession?.state) ? {
        runtimeProfileSession: { ...s.runtimeProfileSession, state: 'Unknown', activeProfile: null }
      } : {}),
      connection: {
        ...s.connection,
        status,
        sessionId: s.connection.sessionId + (status !== s.connection.status ? 1 : 0),
        firmwareSignature: status !== s.connection.status ? null : s.connection.firmwareSignature,
        validationStatus: status !== s.connection.status ? 'idle' : s.connection.validationStatus,
        validationError: status !== s.connection.status ? '' : s.connection.validationError,
        errorMsg,
        lastConnectedAt:
          status === 'connected' && status !== s.connection.status ? nowIso() : s.connection.lastConnectedAt,
        lastErrorAt:
          status === 'error' ? nowIso() : s.connection.lastErrorAt,
      },
    })),

  setConnectionPort: (port) =>
    set((s) => ({ connection: { ...s.connection, port } })),

  cancelConnectionRecovery: () => set(s => ({ connection: { ...s.connection,
    autoReconnectPaused: true, connectionAttempt: null, recoveryGeneration: s.connection.recoveryGeneration + 1 } })),

  beginConnectionAttempt: (owner = 'recovery') => {
    let attempt
    set(s => {
      if (s.connection.connectionAttempt) throw new Error('Another connection attempt is running')
      attempt = { owner, id: s.connection.connectionAttemptSequence + 1 }
      return { connection: { ...s.connection, connectionAttempt: attempt, connectionAttemptSequence: attempt.id } }
    })
    return attempt
  },

  endConnectionAttempt: attempt => set(s => s.connection.connectionAttempt === attempt
    ? { connection: { ...s.connection, connectionAttempt: null } } : {}),

  setAutoReconnectPaused: (autoReconnectPaused) =>
    set(s => ({ connection: { ...s.connection, autoReconnectPaused } })),

  setConnectionValidation: (validationStatus, validationError = '') =>
    set(s => ({ connection: { ...s.connection, validationStatus, validationError } })),

  setConnectionBaud: (baud) =>
    set((s) => ({ connection: { ...s.connection, baud } })),

  setConnectionTransportStatus: (transportStatus) =>
    set((s) => ({ connection: { ...s.connection, transportStatus } })),

  setConnectionHandshakeStatus: (handshakeStatus) =>
    set((s) => ({ connection: { ...s.connection, handshakeStatus } })),

  setAvailablePorts: (availablePorts = []) =>
    set((s) => ({ connection: { ...s.connection, availablePorts } })),

  setRefreshingPorts: (refreshingPorts) =>
    set((s) => ({ connection: { ...s.connection, refreshingPorts } })),

  addConnectionEvent: (type, message, details = {}) =>
    set((s) => ({
      connection: {
        ...s.connection,
        eventLog: appendEvent(s.connection.eventLog, {
          id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          at: nowIso(),
          type,
          message,
          details,
        }),
      },
    })),
})
