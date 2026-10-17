import { metadataContract, sameMetadataContract } from './metadata-contract.js'
import { assertDriveModeINI, encodeDriveConfig } from './drive-modes.js'
import { createPageSnapshot, validatePageSnapshot } from './page-cache.js'
import { parsePage } from './binary-parser.js'
import supportedContract from './ini-contract.js'

// Only the reviewed v4 -> v5 reserved region and appended telemetry may differ.
export function canMigrateDriveModes(oldIni, newIni) {
  if (oldIni?.info?.signature !== 'speeduino 202504-ryn-perf-v4') return false
  try {
    assertDriveModeINI(newIni)
  } catch {
    return false
  }
  if (
    !supportedContract.variants.some((variant) =>
      sameMetadataContract(metadataContract(newIni), variant)
    )
  )
    return false
  const comparable = (ini, newer) => {
    const { signature, tables, curves, ...contract } = metadataContract(ini)
    return {
      ...contract,
      realtimeSize: newer ? 152 : contract.realtimeSize,
      pages: contract.pages.map(([page, fields]) => [
        page,
        fields.filter(
          ([name]) =>
            page !== 15 ||
            !(newer
              ? name.startsWith('drive') || name === 'Unused15_124_255'
              : name === 'Unused15_106_255')
        )
      ]),
      channels: contract.channels.filter(([name]) => !newer || !name.startsWith('drive'))
    }
  }
  return sameMetadataContract(comparable(oldIni, false), comparable(newIni, true))
}
export function migrateDriveModeProject(project, oldIni, newIni) {
  if (!canMigrateDriveModes(oldIni, newIni)) throw new Error('Unsupported Drive Mode INI migration')
  const patch = (constants) => {
    if (!constants?.pages?.[15]) throw new Error('Missing page 15 in project/restore point')
    const buffer = validatePageSnapshot(constants.pages[15], 256).buffer
    encodeDriveConfig().copy(buffer, 106)
    return {
      ...constants,
      pages: {
        ...constants.pages,
        15: createPageSnapshot({
          pageId: 15,
          size: 256,
          buffer,
          source: 'drive-mode-v5-migration',
          syncState: 'dirty-local'
        })
      },
      decodedPages: { ...constants.decodedPages, 15: parsePage(buffer, newIni.constants.pages[15]) }
    }
  }
  return {
    ...project,
    constants: patch(project.constants),
    initialization: {
      ...project.initialization,
      restorePoints: Object.fromEntries(
        Object.entries(project.initialization?.restorePoints || {}).map(([key, point]) => [
          key,
          point ? { ...point, constants: patch(point.constants) } : point
        ])
      ),
      driveModeMigration: {
        from: oldIni.info.signature,
        to: newIni.info.signature,
        presets: 'neutral',
        migratedAt: new Date().toISOString()
      }
    }
  }
}
