import { Buffer } from 'buffer'
import { parsePage } from './binary-parser.js'
import { validateConfigurationValues } from './configuration-validation.js'
import { validatePerformanceSettings } from './performance-features.js'
import { isPinAssignmentField, validateCustomPinAssignments } from './pin-registry.js'
import { calculatePageCRC } from './ecu-commands.js'
import { validateBoardSelection } from './board-pins.js'
import { injectionSquirts } from './required-fuel.js'
import { validateOperatingSettings } from './configuration-readiness.js'

// Configuration values used by boardFixedClaims and fieldPinActive. Pin enums
// and custom feature fields themselves are discovered from the loaded INI.
const OWNERSHIP_FIELDS = new Set([
  'pinLayout', 'flexEnabled', 'iacAlgorithm', 'iacChannels', 'fanEnable', 'boostEnabled',
  'vvtEnabled', 'vvt2Enabled', 'wmiEnabled', 'launchEnable', 'flatSEnable', 'vssMode',
  'useExtBaro', 'useEMAP', 'fuelPressureEnable', 'oilPressureEnable', 'fuel2Mode', 'spark2Mode',
  'idleUpEnabled', 'idleUpOutputEnabled', 'CTPSEnabled', 'resetControl', 'ignBypassEnable',
  'knock_mode', 'airConEnable', 'airConFanEnabled', 'wmiIndicatorEnabled', 'wmiEmptyEnabled',
  'n2o_enable', 'engineProtectType', 'SoftLimitMode', 'SoftLimRetard',
  'useDwellLim', 'dwellLim', 'dwellcrank', 'dwellrun', 'tpsflood', 'tpsMin', 'tpsMax',
  'hardRevLim', 'SoftRevLim', 'hardRevMode', 'algorithm',
])
const CUSTOM_FIELD = /^(pitLimiter|rumbleIdle|als|rollingPopBang)/

export function configurationPolicyPages(ini) {
  return Object.entries(ini?.constants?.pages || {})
    .filter(([, fields]) => Object.entries(fields).some(([name, meta]) =>
      OWNERSHIP_FIELDS.has(name) || CUSTOM_FIELD.test(name) || isPinAssignmentField(name, meta)))
    .map(([page]) => Number(page))
}

export function validateConfigurationChange(ini, before, after, options = {}) {
  const edits = {}, values = {}
  for (const [page, fields] of Object.entries(ini?.constants?.pages || {})) {
    for (const [name, meta] of Object.entries(fields)) {
      const value = after[page]?.[name]
      values[name] = value ?? meta.defaultValue ?? 0
      if (value !== undefined && JSON.stringify(value) !== JSON.stringify(before?.[page]?.[name])) {
        (edits[page] ||= {})[name] = value
      }
    }
  }
  const rangeError = validateConfigurationValues(ini, edits, after, before)
  if (rangeError) return rangeError
  const changedNames = Object.values(edits).flatMap(Object.keys)
  const operatingError = validateOperatingSettings(values, changedNames)
  if (operatingError) return operatingError
  if (changedNames.includes('pinLayout') || options.platform) {
    const boardError = validateBoardSelection(ini, values.pinLayout, options.platform)
    if (boardError) return boardError
  }
  if (changedNames.some(name => ['nCylinders', 'divider', 'injLayout', 'twoStroke', 'injType'].includes(name)) &&
      Object.values(ini.constants?.pages || {}).some(fields => fields.divider) &&
      Object.values(ini.constants?.pages || {}).some(fields => fields.nCylinders)) {
    try { injectionSquirts(values.nCylinders, values.divider, values.injLayout, values.twoStroke, values.injType) }
    catch (error) { return error.message }
  }
  if (options.restartPending) {
    for (const [page, fields] of Object.entries(edits)) for (const [name, value] of Object.entries(fields)) {
      const meta = ini.constants.pages[page]?.[name]
      if ((OWNERSHIP_FIELDS.has(name) || CUSTOM_FIELD.test(name) || isPinAssignmentField(name, meta) || meta?.requiresPowerCycle) &&
          JSON.stringify(options.restartPending.targetConfig?.[name]) !== JSON.stringify(value)) {
        return 'ECU setup is waiting for burn and power cycle verification. Complete it before changing dependent pins or hardware settings.'
      }
    }
  }
  const pinError = validateCustomPinAssignments(ini, after, options, changedNames, before)
  if (pinError) return pinError
  for (const feature of ['pitLimiter', 'rumbleIdle', 'als', 'popBang']) {
    const error = validatePerformanceSettings(feature, values)
    if (error) return error
  }
  return null
}

// Read the effective ECU configuration, including ownership gates on pages
// outside this write. A project's cached values cannot describe live pin usage.
export async function prepareConfigurationWrite(ini, targets, readPage, options = {}) {
  const pages = [...new Set([...Object.keys(targets).map(Number), ...configurationPolicyPages(ini)])]
  const before = {}, after = {}, buffers = {}
  for (const page of pages) {
    const result = await readPage(page)
    const buffer = Buffer.from(result.buffer)
    if (buffer.length !== ini.constants.pageSizes[page]) throw new Error(`Wrong configuration page size: ${page}`)
    if (options.readCRC && calculatePageCRC(buffer).toString(16).toUpperCase().padStart(8, '0') !== await options.readCRC(page)) {
      throw new Error(`Configuration page ${page} CRC/readback mismatch`)
    }
    buffers[page] = buffer
    before[page] = parsePage(buffer, ini.constants.pages[page])
    after[page] = targets[page] ? parsePage(targets[page], ini.constants.pages[page]) : before[page]
  }
  const error = validateConfigurationChange(ini, before, after, options)
  if (error) throw new Error(error)
  return { buffers, before, after }
}
