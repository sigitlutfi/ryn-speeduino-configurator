// Version 5 persists raw ECU bytes and embeds the INI once. Decoded fields and
// display tables are rebuilt on load; they are never a second tune authority.
import { Buffer } from 'buffer'
import { calculatePageCRC } from './protocol/ecu-commands.js'

export const PROJECT_SCHEMA_VERSION = 5

export function assertProjectFormat(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid project document')
  const version = raw.schemaVersion ?? 1
  if (!Number.isInteger(version) || version < 1 || version > PROJECT_SCHEMA_VERSION) {
    throw new Error(`Unsupported project schema ${version}. Update the configurator before opening this file.`)
  }
  if (raw.constants !== undefined && (!raw.constants || typeof raw.constants !== 'object' || Array.isArray(raw.constants))) {
    throw new Error('Invalid project constants')
  }
}

export function compactTemplate(template) {
  if (!template?.contract) return template
  const { contract, ...rest } = template
  return { ...rest, contract: {
    signature: contract.signature || '',
    metadataCrc32: contract.metadataCrc32 || (calculatePageCRC(Buffer.from(JSON.stringify(contract))) >>> 0).toString(16).padStart(8, '0'),
  } }
}

export function compactRestorePoint(point) {
  if (!point) return null
  // Keep decoded-only legacy snapshots until they have been materialized.
  const pages = Object.values(point.constants?.pages || {})
  const constants = pages.length && pages.every(page => page.rawEncoding === 'base64')
    ? { pages: point.constants.pages } : point.constants
  const { tables, ...persistent } = point
  return { ...persistent, constants, runtimeProfiles: point.runtimeProfiles || {} }
}

export function recentProjectDescriptor(project) {
  return {
    filePath: project.filePath,
    projectName: project.projectName || project.name || 'Unnamed Project',
    description: project.description || '',
    color: project.ui?.accentColor || project.color || 'cyan',
    lastOpened: project.lastOpened || new Date().toISOString(),
    signature: project.ini?.signature || project.signature || '',
  }
}

export function normalizeRecentProjects(projects = []) {
  if (!Array.isArray(projects)) return []
  const seen = new Set()
  return projects.filter(project => {
    if (!project?.filePath || typeof project.filePath !== 'string') return false
    const key = project.filePath.replaceAll('\\', '/').toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 10).map(recentProjectDescriptor)
}
