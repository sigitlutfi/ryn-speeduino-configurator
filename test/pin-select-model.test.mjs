import test from 'node:test'
import assert from 'node:assert/strict'
import { filterPinChoices, pinChoicePresentation, pinMenuPosition, pinSelectionStatus } from '../src/renderer/features/shared/utils/pinSelectModel.js'

test('pin popup flips above a low trigger and fits a narrow viewport', () => {
  const rect = { left: 240, top: 500, bottom: 548, width: 160 }
  const result = pinMenuPosition(rect, { width: 390, height: 580 })
  assert.ok(result.bottom > 0)
  assert.equal(result.top, undefined)
  assert.ok(result.left >= 12)
  assert.ok(result.left + result.width <= 378)
  assert.ok(result.maxHeight <= rect.top - 20)
})

test('pin popup uses the short viewport while leaving the option list scrollable', () => {
  const rect = { left: 16, top: 20, bottom: 68, width: 360 }
  const result = pinMenuPosition(rect, { width: 400, height: 230 })
  assert.equal(result.top, 12)
  assert.ok(result.top + result.maxHeight <= 218)
})

test('pin search does not confuse the feature ALS with the word Also in a status hint', () => {
  const inactive = pinChoicePresentation(choice({ owners: [{ field: 'pitLimiterPin', displayLabel: 'Pit Limiter Pin', isActive: false }] }), 'fanPin', context)
  assert.match(inactive.reason, /Also/)
  assert.deepEqual(filterPinChoices([inactive], 'ALS'), [])
})

const owner = { field: 'alsSwitchPin', displayLabel: 'ALS Switch Pin', isActive: true }
const choice = (patch = {}) => ({ index: 47, label: '47', assignmentState: 'explicit', disabled: false,
  activeOwners: [], owners: [], ...patch })
const context = { verified: true, values: {}, pins: {} }

test('pin search includes MCU aliases and owner names while preserving INI indices', () => {
  const entries = [pinChoicePresentation(choice({ activeOwners: [owner], owners: [owner] }), 'fanPin', context),
    pinChoicePresentation(choice({ index: 48, label: '48' }), 'fanPin', context)]
  assert.deepEqual(filterPinChoices(entries, 'D47').map(entry => entry.index), [47])
  assert.deepEqual(filterPinChoices(entries, 'als switch').map(entry => entry.index), [47])
  assert.deepEqual(filterPinChoices(entries, '', 'available').map(entry => entry.index), [48])
  assert.deepEqual(filterPinChoices(entries, '', 'reserved').map(entry => entry.index), [47])
  assert.deepEqual(filterPinChoices(entries, 'no match'), [])
})

test('invalid, unknown and conflicted pins cannot acquire a success status', () => {
  const invalid = pinChoicePresentation(choice({ assignmentState: 'unavailable', disabled: true }), 'fanPin', context)
  assert.equal(pinSelectionStatus(invalid, true, true).key, 'invalid')
  const reserved = pinChoicePresentation(choice({ activeOwners: [owner], owners: [owner] }), 'fanPin', context)
  assert.equal(reserved.locked, true)
  assert.match(reserved.reason, /ALS Switch Pin/)
  assert.equal(pinSelectionStatus(reserved, true, true).key, 'conflict')
  assert.equal(pinSelectionStatus(reserved, false, true).key, 'warning')
  assert.equal(pinSelectionStatus(choice(), true, false).label, 'Mapping incomplete')
})

test('lock reasons distinguish a missing default route, feature mode and invalid INI value', () => {
  assert.match(pinChoicePresentation(choice({ assignmentState: 'default', disabled: true }), 'fanPin', context).reason, /no default route/)
  assert.match(pinChoicePresentation(choice({ disabled: true }), 'knock_pin', context).reason, /feature mode/)
  assert.match(pinChoicePresentation(choice({ assignmentState: 'unavailable', disabled: true }), 'fanPin', context).reason, /loaded INI/)
})

test('inactive configured owners stay selectable and Auto Mode stays in its own group', () => {
  const inactive = pinChoicePresentation(choice({ owners: [{ ...owner, isActive: false }] }), 'fanPin', context)
  assert.equal(inactive.locked, false)
  assert.match(inactive.reason, /while inactive/)
  const auto = pinChoicePresentation(choice({ index: 0, label: 'Auto Mode (No Pin)', assignmentState: 'none' }), 'alsSwitchPin', context)
  assert.equal(auto.group, 'special')
  assert.deepEqual(filterPinChoices([inactive, auto], '', 'special').map(entry => entry.index), [0])
})
