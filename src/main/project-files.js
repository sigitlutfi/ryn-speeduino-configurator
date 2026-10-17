import fs from 'node:fs'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { assertProjectFormat } from '../shared/project-format.js'

export const fileRevision = content => createHash('sha256').update(content).digest('hex')

// The old file remains in place until a complete, flushed replacement exists.
// A failed backup or replacement also leaves that original intact.
export function atomicWriteFile(filePath, content, io = fs, backup = true) {
  const target = path.resolve(filePath)
  const temporary = `${target}.${randomUUID()}.tmp`
  const backupTemporary = `${temporary}.bak`
  let fd
  try {
    fd = io.openSync(temporary, 'wx')
    io.writeFileSync(fd, content, 'utf8')
    io.fsyncSync(fd)
    io.closeSync(fd)
    fd = undefined
    if (backup && io.existsSync(target)) {
      io.copyFileSync(target, backupTemporary)
      const backupFd = io.openSync(backupTemporary, 'r+')
      try { io.fsyncSync(backupFd) } finally { io.closeSync(backupFd) }
      io.renameSync(backupTemporary, `${target}.bak`)
    }
    io.renameSync(temporary, target)
  } finally {
    if (fd !== undefined) io.closeSync(fd)
    for (const leftover of [temporary, backupTemporary]) {
      try { io.unlinkSync(leftover) } catch (error) { if (error.code !== 'ENOENT') console.warn('Temporary file cleanup failed:', error.message) }
    }
  }
}

export function loadProjectFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(content.replace(/^\uFEFF/, ''))
  assertProjectFormat(data)
  const { integrity, ...document } = data
  if (data.schemaVersion >= 5 && (integrity?.algorithm !== 'sha256' || integrity.digest !== fileRevision(JSON.stringify(document)))) {
    throw new Error('Project integrity check failed. Recover the backup or open an intact copy.')
  }
  return { ...document, filePath: path.resolve(filePath), fileRevision: fileRevision(content) }
}

export function saveProjectFile(filePath, data, options = {}) {
  assertProjectFormat(data)
  if (options.expectedRevision && (!fs.existsSync(filePath) || fileRevision(fs.readFileSync(filePath)) !== options.expectedRevision)) {
    throw new Error('This project file changed on disk. Reopen it or use Save As to preserve both versions.')
  }
  const { filePath: ignoredPath, fileRevision: ignoredRevision, integrity: ignoredIntegrity, ...document } = data
  const integrity = { algorithm: 'sha256', digest: fileRevision(JSON.stringify(document)) }
  const content = `${JSON.stringify({ ...document, integrity })}\n`
  atomicWriteFile(filePath, content)
  return { ok: true, fileRevision: fileRevision(content) }
}
