import supportedContract from './ini-contract.js'
import { metadataContract, sameMetadataContract } from './metadata-contract.js'

export function assertCompatibleContract(state) {
  if (state.connection?.status && state.connection.status !== 'connected') throw new Error('Not connected to ECU')
  if (state.connection?.handshakeStatus && state.connection.handshakeStatus !== 'ok') throw new Error('Wait for the ECU handshake before accessing tune pages')
  const expected = state.parsedIni?.info?.signature?.trim()
  const actual = (Object.hasOwn(state.connection || {}, 'firmwareSignature')
    ? state.connection.firmwareSignature : state.currentProject?.ecu?.signature)?.trim()
  if (!expected || !actual || expected !== actual) {
    throw new Error('ECU access requires an INI matching the connected firmware signature. Update the project INI and reconnect.')
  }
  if (expected === supportedContract.signature) {
    const metadata = metadataContract(state.parsedIni)
    if (!supportedContract.variants.some(variant => sameMetadataContract(metadata, variant))) {
      throw new Error('The project INI has stale or incompatible metadata for this firmware signature. Update the project INI from the paired release and reconnect.')
    }
  }
}

export function assertWritableContract(state) {
  assertCompatibleContract(state)
  const mode = state.driveModeStatus
  if (mode && mode.session === state.connection?.sessionId && mode.epoch === state.projectEpoch && (mode.active !== 0 || mode.state === 1)) throw new Error('Select Drive Mode DEFAULT before writing or burning the base tune')
}
