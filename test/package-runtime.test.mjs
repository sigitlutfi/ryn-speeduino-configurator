import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import staging from '../scripts/package-runtime.cjs'

test('staged SerialPort loads its full native dependency tree outside the checkout', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ryn-native-package-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  await staging.stageRuntimeDependencies(directory)
  const require = createRequire(path.join(directory, 'package.json'))
  // Load in a child so Windows releases the native DLL before fixture cleanup.
  const child = spawnSync(process.execPath, ['-e',
    "const r=require('node:module').createRequire(process.argv[1]);if(typeof r('serialport').SerialPort.list!=='function')process.exit(1)",
    path.join(directory, 'package.json')], { encoding: 'utf8', windowsHide: true })
  assert.equal(child.status, 0, child.stderr)
  assert.ok(require.resolve('serialport').startsWith(directory))
  assert.equal(await fs.stat(path.join(directory, 'node_modules/serialport/node_modules/@serialport/bindings-cpp/prebuilds')).then(s => s.isDirectory()), true)
  await assert.rejects(fs.access(path.join(directory, 'node_modules/react')))
})
