const fs = require('node:fs/promises')
const path = require('node:path')
const { createRequire } = require('node:module')

// The Vite plugin copies bundles only. Stage external native dependencies and
// their exact dependency trees, including nested versions and Bun symlinks.
async function stageRuntimeDependencies(buildPath, projectPath = path.resolve(__dirname, '..')) {
  async function findManifest(name, sourceParent) {
    const resolve = createRequire(path.join(sourceParent, 'package.json')).resolve
    try {
      return resolve(`${name}/package.json`)
    } catch (error) {
      if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error
      let directory = path.dirname(resolve(name))
      while (true) {
        const candidate = path.join(directory, 'package.json')
        try {
          const manifest = JSON.parse(await fs.readFile(candidate, 'utf8'))
          if (manifest.name === name) return candidate
        } catch (failure) {
          if (failure.code !== 'ENOENT') throw failure
        }
        const parent = path.dirname(directory)
        if (parent === directory) throw new Error(`Cannot locate runtime package ${name}`)
        directory = parent
      }
    }
  }
  async function copyDependency(name, sourceParent, destinationParent, ancestors = new Set()) {
    const manifestPath = await findManifest(name, sourceParent)
    const source = path.dirname(manifestPath)
    const identity = await fs.realpath(source)
    if (ancestors.has(identity)) return
    const destination = path.join(destinationParent, 'node_modules', name)
    await fs.cp(source, destination, {
      recursive: true,
      dereference: true,
      filter: entry => path.basename(entry) !== 'node_modules',
    })
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    const nextAncestors = new Set([...ancestors, identity])
    for (const dependency of Object.keys(manifest.dependencies || {})) {
      await copyDependency(dependency, source, destination, nextAncestors)
    }
    for (const dependency of Object.keys(manifest.optionalDependencies || {})) {
      if (manifest.dependencies?.[dependency]) continue
      try {
        await findManifest(dependency, source)
      } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') continue
        throw error
      }
      await copyDependency(dependency, source, destination, nextAncestors)
    }
  }
  await copyDependency('serialport', projectPath, buildPath)
}

module.exports = { stageRuntimeDependencies }
