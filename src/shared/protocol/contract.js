export function assertWritableContract(state) {
  const expected = state.parsedIni?.info?.signature?.trim()
  const actual = state.currentProject?.ecu?.signature?.trim()
  if (!expected || !actual || expected !== actual) {
    throw new Error('ECU writes require an INI matching the connected firmware signature. Update the project INI and reconnect.')
  }
}
