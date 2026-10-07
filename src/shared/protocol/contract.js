import supportedContract from './ini-contract.js'
import { metadataContract, sameMetadataContract } from './metadata-contract.js'

export function assertWritableContract(state) {
  const expected = state.parsedIni?.info?.signature?.trim()
  const actual = state.currentProject?.ecu?.signature?.trim()
  if (!expected || !actual || expected !== actual) {
    throw new Error('ECU writes require an INI matching the connected firmware signature. Update the project INI and reconnect.')
  }
  if (expected === supportedContract.signature) {
    const metadata = metadataContract(state.parsedIni)
    if (!supportedContract.variants.some(variant => sameMetadataContract(metadata, variant))) {
      throw new Error('The project INI has stale or incompatible metadata for this firmware signature. Update the project INI from the paired release and reconnect.')
    }
  }
}
