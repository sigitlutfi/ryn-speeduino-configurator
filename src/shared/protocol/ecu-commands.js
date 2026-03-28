/**
 * Speeduino Serial Protocol - Command Formatter
 *
 * Implements the modern protocol commands:
 * - 'M' (Write to RAM) - Modern protocol with CRC32
 * - 'b' (Burn to EEPROM)
 * - 'p' (Read page)
 */

import { Buffer } from 'buffer';

/**
 * CRC32 calculation using standard CRC-32 polynomial (0x04C11DB7)
 * Compatible with FastCRC32 library used by Speeduino firmware
 */
function crc32(buffer) {
  const polynomial = 0xEDB88320; // Reversed polynomial
  let crc = 0xFFFFFFFF;

  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? polynomial : 0);
    }
  }

  return (crc ^ 0xFFFFFFFF) >>> 0; // Finalize and ensure unsigned 32-bit
}

/**
 * Wrap payload with modern protocol format:
 * [PayloadLength (2 bytes BE)] [Payload] [CRC32 (4 bytes BE)]
 *
 * NOTE: Speeduino uses BIG ENDIAN for both length and CRC!
 */
export function wrapModernProtocol(payload) {
  const length = payload.length;
  const crc = crc32(payload);

  // Allocate: 2 (length) + payload + 4 (CRC32)
  const wrapped = Buffer.alloc(2 + length + 4);

  wrapped.writeUInt16BE(length, 0);           // Payload length (BE) - FIXED!
  payload.copy(wrapped, 2);                    // Payload
  wrapped.writeUInt32BE(crc, 2 + length);      // CRC32 (BE) - FIXED!

  return wrapped;
}

/**
 * Format a 'M' (Write) command buffer using modern protocol.
 *
 * Modern Protocol Format:
 * [Length (2B LE)] [Payload] [CRC32 (4B LE)]
 *
 * Payload for 'M' command:
 * ['M'] [0x00 reserved] [page] [offset_low] [offset_high] [length_low] [length_high] [data...]
 *
 * @param {number} page - Page number (0-15)
 * @param {number} offset - Offset within page
 * @param {number} length - Data length in bytes
 * @param {number|Array} value - Value(s) to write
 * @param {string} dataType - Data type hint (U08, S16, etc.)
 * @returns {Buffer} Complete command buffer ready to send
 */
export function formatWriteCommand(page, offset, length, value, dataType = "") {
  // Encode data based on type
  const dataBuf = Buffer.alloc(length);

  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      if (i < length) dataBuf[i] = v & 0xFF;
    });
  } else if (typeof value === "number") {
    if (length === 1) dataBuf.writeUInt8(value & 0xFF, 0);
    else if (length === 2) dataBuf.writeUInt16LE(value & 0xFFFF, 0);
    else if (length === 4) dataBuf.writeUInt32LE(value, 0);
  }

  // Build payload: 'M' + reserved + page + offset + length + data
  // Payload structure (7 + data bytes):
  // [0] = 'M'
  // [1] = 0x00 (reserved)
  // [2] = page
  // [3] = offset low byte
  // [4] = offset high byte
  // [5] = length low byte
  // [6] = length high byte
  // [7...] = data
  const payloadSize = 7 + length;
  const payload = Buffer.alloc(payloadSize);

  payload.write("M", 0, "ascii");           // Command
  payload.writeUInt8(0, 1);                 // Reserved byte
  payload.writeUInt8(page, 2);              // Page
  payload.writeUInt16LE(offset, 3);         // Offset (LE)
  payload.writeUInt16LE(length, 5);         // Length (LE)
  dataBuf.copy(payload, 7);                 // Data

  // Wrap with modern protocol (length prefix + CRC32 suffix)
  return wrapModernProtocol(payload);
}

/**
 * Format a 'b' (Burn) command buffer using modern protocol.
 *
 * Payload for 'b' command:
 * ['b'] [0x00 reserved] [page]
 *
 * @param {number} page - Page number to burn to EEPROM (0-15)
 * @returns {Buffer} Complete command buffer ready to send
 */
export function formatBurnCommand(page) {
  const payload = Buffer.alloc(3);
  payload.write("b", 0, "ascii");
  payload.writeUInt8(0, 1);        // Reserved byte
  payload.writeUInt8(page, 2);     // Page number

  return wrapModernProtocol(payload);
}

/**
 * Format a 'p' (Read Page) command buffer using modern protocol.
 *
 * Speeduino uses 'p' for reading pages (not 'r').
 * Command 'r' is for realtime data/output channels.
 *
 * Payload for 'p' command:
 * ['p'] [0x00 reserved] [page] [offset_low] [offset_high] [length_low] [length_high]
 *
 * @param {number} page - Page number to read (0-15)
 * @param {number} offset - Offset within page
 * @param {number} length - Number of bytes to read
 * @returns {Buffer} Complete command buffer ready to send
 */
export function formatReadCommand(page, offset, length) {
  const payload = Buffer.alloc(7);
  payload.write("p", 0, "ascii");       // Command 'p' for page read
  payload.writeUInt8(0, 1);             // Reserved byte
  payload.writeUInt8(page, 2);          // Page
  payload.writeUInt16LE(offset, 3);     // Offset (LE)
  payload.writeUInt16LE(length, 5);     // Length (LE)

  return wrapModernProtocol(payload);
}

/**
 * Format a 'd' (CRC32 Check) command for a page
 * Used to verify if local data matches ECU without reading full page
 *
 * @param {number} page - Page number (0-15)
 * @returns {Buffer} Complete command buffer
 */
export function formatCRCCommand(page) {
  const payload = Buffer.alloc(3);
  payload.write("d", 0, "ascii");       // Command 'd' for CRC check
  payload.writeUInt8(0, 1);             // Reserved byte
  payload.writeUInt8(page, 2);          // Page

  return wrapModernProtocol(payload);
}

/**
 * Calculate CRC32 for local page data (exported for comparison)
 * @param {Buffer} pageData - Page data buffer
 * @returns {number} CRC32 checksum
 */
export function calculatePageCRC(pageData) {
  return crc32(pageData);
}

function pushUIntLE(bytes, value, size) {
  for (let index = 0; index < size; index += 1) {
    bytes.push((value >> (index * 8)) & 0xff);
  }
}

/**
 * Expand an INI command template such as:
 *   r$tsCanId\x30%2o%2c
 *
 * Supported tokens:
 * - $tsCanId / \$tsCanId
 * - \xNN
 * - %2o (offset, 2-byte LE)
 * - %2c (count, 2-byte LE)
 * - %2i (index/page, 2-byte LE)
 */
export function expandCommandTemplate(template, variables = {}) {
  const bytes = [];
  const source = String(template || "");

  for (let index = 0; index < source.length; ) {
    const remainder = source.slice(index);

    if (remainder.startsWith("\\$tsCanId")) {
      bytes.push((variables.tsCanId ?? 0) & 0xff);
      index += "\\$tsCanId".length;
      continue;
    }

    if (remainder.startsWith("$tsCanId")) {
      bytes.push((variables.tsCanId ?? 0) & 0xff);
      index += "$tsCanId".length;
      continue;
    }

    if (remainder.startsWith("\\x") && remainder.length >= 4) {
      const hex = remainder.slice(2, 4);
      const value = Number.parseInt(hex, 16);
      if (!Number.isNaN(value)) {
        bytes.push(value & 0xff);
        index += 4;
        continue;
      }
    }

    if (remainder.startsWith("%2o")) {
      pushUIntLE(bytes, variables.offset ?? 0, 2);
      index += 3;
      continue;
    }

    if (remainder.startsWith("%2c")) {
      pushUIntLE(bytes, variables.count ?? 0, 2);
      index += 3;
      continue;
    }

    if (remainder.startsWith("%2i")) {
      pushUIntLE(bytes, variables.index ?? 0, 2);
      index += 3;
      continue;
    }

    bytes.push(source.charCodeAt(index) & 0xff);
    index += 1;
  }

  return Buffer.from(bytes);
}

/**
 * Format a modern output-channels read command based on INI ochGetCommand.
 */
export function formatOutputChannelsCommand(template, offset, count, tsCanId = 0) {
  const payload = expandCommandTemplate(template, {
    tsCanId,
    offset,
    count,
  });
  return wrapModernProtocol(payload);
}
