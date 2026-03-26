export const INITIAL_CONNECTION = {
  status: 'disconnected',
  port: '',
  baud: 115200,
  errorMsg: '',
};

export const createConnectionSlice = (set) => ({
  connection: { ...INITIAL_CONNECTION },

  setConnectionStatus: (status, errorMsg = '') =>
    set((s) => ({ connection: { ...s.connection, status, errorMsg } })),

  setConnectionPort: (port) =>
    set((s) => ({ connection: { ...s.connection, port } })),

  setConnectionBaud: (baud) =>
    set((s) => ({ connection: { ...s.connection, baud } })),
});
