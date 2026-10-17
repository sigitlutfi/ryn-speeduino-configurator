import { Buffer } from 'buffer'
import { wrapModernProtocol } from './ecu-commands.js'
import { getVarMetadata } from '../ini-parser.js'

export const DRIVE_MODES = ['DEFAULT', 'ECO', 'RACING', 'EXTREME']
export const DRIVE_REASONS = [
  '',
  'Lepaskan gas',
  'RPM harus ≤ 6000',
  'Menunggu mesin selesai cranking',
  'Menunggu sinkronisasi mesin',
  'Proteksi / launch / nitrous sedang aktif',
  'Fitur racing sedang aktif',
  'Permintaan kedaluwarsa; mode sebelumnya dipertahankan',
  'Konfigurasi mode tidak valid'
]
export const DRIVE_CONFIG_OFFSET = 106
export const DRIVE_CONFIG_SIZE = 18
export function driveCRC(bytes) {
  let crc = 0xffff
  for (const byte of bytes) {
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff
  }
  return crc
}
function integer(value, lo, hi) {
  if (!Number.isInteger(value) || value < lo || value > hi)
    throw new Error(`Drive Mode value must be ${lo}..${hi}`)
  return value
}
export function encodeDriveConfig(
  config = {
    maxTPS: 5,
    presets: Array.from({ length: 3 }, () => ({ fuel: 100, ignition: 0, features: 7 }))
  }
) {
  if (config.presets?.length !== 3) throw new Error('Three Drive Mode presets are required')
  const bytes = Buffer.alloc(18)
  bytes.set([68, 77, 1, integer(config.maxTPS, 0, 20)])
  config.presets.forEach((p, i) => {
    const offset = 4 + i * 4
    bytes[offset] = integer(p.fuel, 80, 120)
    bytes.writeInt8(integer(p.ignition, -10, 10), offset + 1)
    bytes[offset + 2] = integer(p.features, 0, 7)
  })
  bytes.writeUInt16LE(driveCRC(bytes.subarray(0, 16)), 16)
  return bytes
}
export function decodeDriveConfig(value) {
  const b = Buffer.from(value)
  if (
    b.length !== 18 ||
    b[0] !== 68 ||
    b[1] !== 77 ||
    b[2] !== 1 ||
    b.readUInt16LE(16) !== driveCRC(b.subarray(0, 16))
  )
    throw new Error('Drive Mode configuration checksum/version is invalid')
  const config = {
    maxTPS: b[3],
    presets: [0, 1, 2].map((i) => ({
      fuel: b[4 + i * 4],
      ignition: b.readInt8(5 + i * 4),
      features: b[6 + i * 4]
    }))
  }
  if (!encodeDriveConfig(config).equals(b))
    throw new Error('Drive Mode configuration contains invalid/reserved data')
  return config
}
export function assertDriveModeINI(ini) {
  const field = getVarMetadata(ini, 'driveMagicD')
  if (
    ini?.info?.signature !== 'speeduino 202504-ryn-perf-v5' ||
    field?.page !== 15 ||
    field.offset !== 106 ||
    getVarMetadata(ini, 'driveCRC')?.offset !== 122 ||
    ini.outputChannels?.ochBlockSize !== 167
  )
    throw new Error('Drive Mode requires the paired perf-v5 firmware and INI')
}
export function parseDriveStatus(value) {
  const b = Buffer.from(value)
  if (
    b.length !== 15 ||
    b[0] !== 1 ||
    b[1] > 3 ||
    b[2] > 3 ||
    b[3] > 2 ||
    b[4] > 8 ||
    b[11] < 80 ||
    b[11] > 120 ||
    b[13] > 7
  )
    throw new Error('Invalid ECU Drive Mode status')
  return {
    version: 1,
    active: b[1],
    requested: b[2],
    state: b[3],
    reason: b[4],
    requestToken: b.readUInt16LE(5),
    appliedToken: b.readUInt16LE(7),
    configCRC: b.readUInt16LE(9),
    fuel: b[11],
    ignition: b.readInt8(12),
    features: b[13],
    valid: !!(b[14] & 1)
  }
}
export function driveStatusCommand() {
  return wrapModernProtocol(Buffer.from([68, 0]))
}
export function driveSelectCommand(mode, token, crc) {
  const b = Buffer.from([68, 1, integer(mode, 0, 3), 0, 0, 0, 0])
  b.writeUInt16LE(integer(token, 1, 65535), 3)
  b.writeUInt16LE(integer(crc, 0, 65535), 5)
  return wrapModernProtocol(b)
}
