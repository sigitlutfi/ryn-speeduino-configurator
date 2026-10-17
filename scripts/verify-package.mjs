import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const appPath = process.argv[2]
if (!appPath) throw new Error('Usage: bun run test:package -- /path/to/packaged-app')
const resources = path.join(path.resolve(appPath), process.platform === 'darwin' ? 'Contents/Resources' : 'resources')
await fs.access(path.join(resources, 'speeduino.ini'))
await fs.access(path.join(resources, 'bin'))
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ryn-packaged-runtime-'))
try {
  for (const name of ['app.asar', 'app.asar.unpacked']) {
    await fs.cp(path.join(resources, name), path.join(directory, name), { recursive: true })
  }
  const child = spawnSync(require('electron'), [fileURLToPath(new URL('./check-packaged-runtime.cjs', import.meta.url)), path.join(directory, 'app.asar')], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_PATH: '' },
    encoding: 'utf8', windowsHide: true, timeout: 20000,
  })
  if (child.error || child.status !== 0) throw new Error(child.error?.message || child.stderr || 'Packaged runtime verification failed')
  console.log(child.stdout.trim())
} finally {
  // Only the fresh, task-owned fixture directory is removed.
  if (path.dirname(path.resolve(directory)) !== path.resolve(os.tmpdir())) throw new Error('Unexpected package fixture location')
  await fs.rm(directory, { recursive: true, force: true })
}
