import { buildProjectInitialization } from './projectInitialization.js'
import { createProjectRestorePoint, normalizeProjectV3 } from '../../core/store/utils/project.normalization.js'

// Build the entire document before changing the active project or writing it.
export function createProjectDocument({ projectName, description = '', color = 'cyan', ini,
  parsedIni, boardLayout, engine, initBaseTune = true, filePath }) {
  if (!projectName?.trim()) throw new Error('Enter a project name')
  const plan = buildProjectInitialization({ parsedIni, selectedBoardLayout: boardLayout, engine, initBaseTune })
  const blank = buildProjectInitialization({ parsedIni, selectedBoardLayout: boardLayout, initBaseTune: false })
  const project = normalizeProjectV3({
    projectName: projectName.trim(), description, ui: { accentColor: color },
    ini, engine, constants: plan.constants, filePath,
    hardware: { pinMapPlatform: 'mega2560', channelBuild: 'standard' },
    initialization: {
      iniSignature: parsedIni.info.signature, boardLayout: plan.metadata.boardLayout,
      baseTune: { requested: initBaseTune, applied: plan.metadata.applied,
        providerId: plan.metadata.providerId, providerOwner: plan.metadata.providerOwner,
        appliedFields: plan.metadata.appliedFields, warningCount: plan.warnings.length, template: plan.metadata },
    },
  }, parsedIni)
  project.initialization.restorePoints = {
    blankCanvas: createProjectRestorePoint({ constants: blank.constants, runtimeProfiles: project.runtimeProfiles }),
    baseTune: createProjectRestorePoint({ constants: plan.constants, runtimeProfiles: project.runtimeProfiles }),
  }
  return { project, plan }
}
