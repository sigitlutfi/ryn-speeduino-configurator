/**
 * Binary Serializer for Speeduino ECU
 * Converts parsed constants back to raw binary format for upload to ECU
 */

import { Buffer } from 'buffer';

/**
 * Get size in bytes for a data type.
 */
function getDataTypeSize(dataType) {
  switch (dataType?.toUpperCase()) {
    case "U08": case "S08": return 1;
    case "U16": case "S16": return 2;
    case "U32": case "S32": return 4;
    default: return 1;
  }
}

function canAccess(buffer, offset, dataType) {
  const typeSize = getDataTypeSize(dataType);
  return offset >= 0 && offset + typeSize <= buffer.length;
}

/**
 * Write a scalar value to buffer based on data type
 */
function writeScalar(buffer, offset, value, dataType) {
  if (offset >= buffer.length) return;

  // Handle non-numeric values
  if (typeof value !== 'number' || isNaN(value)) {
    console.warn(`[Serializer] Invalid value for ${dataType} at offset ${offset}:`, value);
    return;
  }

  try {
    switch (dataType?.toUpperCase()) {
      case "U08":
        // Clamp to 0-255
        buffer.writeUInt8(Math.max(0, Math.min(255, Math.floor(value))), offset);
        break;
      case "S08":
        // Clamp to -128 to 127
        buffer.writeInt8(Math.max(-128, Math.min(127, Math.floor(value))), offset);
        break;
      case "U16":
        // Clamp to 0-65535
        buffer.writeUInt16LE(Math.max(0, Math.min(65535, Math.floor(value))), offset);
        break;
      case "S16":
        // Clamp to -32768 to 32767
        buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.floor(value))), offset);
        break;
      case "U32":
        buffer.writeUInt32LE(Math.floor(value) >>> 0, offset);
        break;
      case "S32":
        buffer.writeInt32LE(Math.floor(value), offset);
        break;
      default:
        // Default to U08 with clamping
        buffer.writeUInt8(Math.max(0, Math.min(255, Math.floor(value))), offset);
        break;
    }
  } catch (err) {
    console.warn(`[Serializer] Failed to write ${dataType} value ${value} at offset ${offset}:`, err.message);
  }
}

/**
 * Serialize a single variable (scalar, bits, or array) to buffer
 */
export function serializeValue(buffer, offset, value, meta) {
  const { dataType, shape, bitRange, type } = meta;

  // 1. Handle Bits
  if (type === "bits") {
    // Bits can be backed by U08, U16, U32 (matching binary-parser.js)
    const underlyingType = dataType || "U08";
    const typeSize = getDataTypeSize(underlyingType);

    if (!canAccess(buffer, offset, underlyingType)) {
      console.warn(
        `[Serializer] Skipping bitfield write at offset ${offset}: ${underlyingType} needs ${typeSize} byte(s), buffer length is ${buffer.length}`,
      );
      return;
    }

    // Read current underlying value
    let raw = 0;
    switch (underlyingType.toUpperCase()) {
      case "U08": raw = buffer.readUInt8(offset); break;
      case "U16": raw = buffer.readUInt16LE(offset); break;
      case "U32": raw = buffer.readUInt32LE(offset); break;
      case "S08": raw = buffer.readInt8(offset); break;
      case "S16": raw = buffer.readInt16LE(offset); break;
      case "S32": raw = buffer.readInt32LE(offset); break;
      default: raw = buffer.readUInt8(offset); break;
    }

    // Modify bits
    const [lo, hi] = bitRange || [0, 7];
    const mask = (1 << (hi - lo + 1)) - 1;
    const cleared = raw & ~(mask << lo); // Clear target bits
    const updated = cleared | ((value & mask) << lo); // Set new value

    // Write back underlying value
    switch (underlyingType.toUpperCase()) {
      case "U08": buffer.writeUInt8(updated & 0xFF, offset); break;
      case "U16": buffer.writeUInt16LE(updated & 0xFFFF, offset); break;
      case "U32": buffer.writeUInt32LE(updated >>> 0, offset); break;
      case "S08": buffer.writeInt8(updated, offset); break;
      case "S16": buffer.writeInt16LE(updated, offset); break;
      case "S32": buffer.writeInt32LE(updated, offset); break;
      default: buffer.writeUInt8(updated & 0xFF, offset); break;
    }
    return;
  }

  // 2. Handle Arrays
  if (type === "array" || Array.isArray(value) || (shape && shape.length > 0)) {
    const totalElements =
      shape && shape.length > 0
        ? shape.reduce((a, b) => a * b, 1)
        : Array.isArray(value)
          ? value.flat(Infinity).length
          : 0;
    const elementSize = getDataTypeSize(dataType);

    if (Array.isArray(value)) {
      const flatValues = value.flat(Infinity);
      for (let i = 0; i < Math.min(totalElements, flatValues.length); i++) {
        const elementValue = flatValues[i];
        writeScalar(buffer, offset + i * elementSize, elementValue, dataType);
      }
    }
    return;
  }

  // 3. Handle Scalars
  writeScalar(buffer, offset, value, dataType);
}

/**
 * Serialize a full page from parsed constants
 * @param {Object} parsedConstants - Parsed constants object (e.g., from parsePage)
 * @param {Object} pageMeta - Page metadata from INI (dictionary keyed by variable name)
 * @param {number} pageSize - Expected page size in bytes
 * @returns {Buffer} Serialized page data
 */
export function serializePage(parsedConstants, pageMeta, pageSize) {
  const buffer = Buffer.alloc(pageSize);
  buffer.fill(0); // Initialize with zeros

  if (!pageMeta) {
    return buffer;
  }

  // Debug: Check if this is Page 1 (has pinLayout)
  const isPage1 = 'pinLayout' in pageMeta;

  // Iterate through all variables in pageMeta (matching binary-parser.js pattern)
  for (const [varName, varMeta] of Object.entries(pageMeta)) {
    const { offset } = varMeta;
    let value = parsedConstants[varName];

    if (value !== undefined && offset !== undefined && varMeta.type !== "unknown") {
      try {
        // WORKAROUND: Speeduino firmware quirk - pinLayout needs +61 offset when writing
        // This matches TunerStudio's internal handling (undocumented in INI)
        if (varName === 'pinLayout' && typeof value === 'number' && value <= 60) {
          console.warn(`[Serializer] Applying pinLayout firmware quirk: ${value} → ${value + 61}`);
          value = value + 61;
        }

        serializeValue(buffer, offset, value, varMeta);
      } catch (err) {
        console.error(`[Serializer] Failed to serialize ${varName} at offset ${offset}:`, err);
      }
    }
  }

  return buffer;
}
