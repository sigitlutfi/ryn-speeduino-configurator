const MAX_CONNECTION_EVENTS = 25

const nowIso = () => new Date().toISOString()

export const INITIAL_CONNECTION = {
  status: 'disconnected',
  port: '',
  baud: 115200,
  errorMsg: '',
  transportStatus: 'idle',
  handshakeStatus: 'idle',
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
      connection: {
        ...s.connection,
        status,
        errorMsg,
        lastConnectedAt:
          status === 'connected' ? nowIso() : s.connection.lastConnectedAt,
        lastErrorAt:
          status === 'error' ? nowIso() : s.connection.lastErrorAt,
      },
    })),

  setConnectionPort: (port) =>
    set((s) => ({ connection: { ...s.connection, port } })),

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
