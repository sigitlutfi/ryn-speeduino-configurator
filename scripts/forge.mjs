import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// Forge 8 does not detect Bun as a package manager. Bun owns installation;
// Forge's native rebuild helpers run under Node with npm-compatible detection.
const child = spawn(process.execPath, [require.resolve('@electron-forge/cli/dist/electron-forge.js'), ...process.argv.slice(2)], {
  stdio: 'inherit', windowsHide: true,
  env: { ...process.env, npm_config_user_agent: 'npm/10.9.0' },
})
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
