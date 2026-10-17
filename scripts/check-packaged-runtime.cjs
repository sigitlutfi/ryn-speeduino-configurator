const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const { pathToFileURL } = require('node:url')

const archive = process.argv[2]
assert.ok(fs.existsSync(path.join(archive, '.vite', 'build', 'index.cjs')), 'Packaged main bundle missing')
assert.ok(fs.existsSync(path.join(archive, '.vite', 'build', 'preload.cjs')), 'Packaged preload bundle missing')
const requireFromApp = createRequire(path.join(archive, '.vite', 'build', 'index.cjs'))
const entry = requireFromApp.resolve('serialport')
assert.ok(entry.startsWith(archive), 'SerialPort resolved outside package')
// Enumerating ports exercises the native binding without opening any port.
// Use dynamic import, matching the main process's serial IPC handlers.
import(pathToFileURL(entry).href).then(async ({ SerialPort }) => {
  const ports = await SerialPort.list()
  console.log(JSON.stringify({ main: true, preload: true, serialport: true, nativeBinding: true,
    electron: process.versions.electron, enumeratedPorts: ports.length }))
}).catch(error => { console.error(error); process.exitCode = 1 })
