/**
 * Binary Decoder for Speeduino ECU Responses
 */

/**
 * Extracts a scalar value from a buffer based on primitive data type.
 */
function parseScalar(buffer, offset, dataType) {
  if (offset >= buffer.length) return 0;
  
  switch (dataType?.toUpperCase()) {
    case "U08": return buffer.readUInt8(offset);
    case "S08": return buffer.readInt8(offset);
    case "U16": return buffer.readUInt16LE(offset);
    case "S16": return buffer.readInt16LE(offset);
    case "U32": return buffer.readUInt32LE(offset);
    case "S32": return buffer.readInt32LE(offset);
    default: return buffer.readUInt8(offset); // Default fallback
  }
}

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

/**
 * Extracts a value (scalar, bits, or array) from a page buffer.
 */
export function parseValue(buffer, offset, meta) {
  const { dataType, shape, bitRange, type } = meta;

  // 1. Handle Bits
  if (type === "bits") {
    // Bits are extracted from an underlying integer (usually U08 or U16)
    const raw = parseScalar(buffer, offset, dataType || "U08");
    if (!bitRange) return raw;

    const [lo, hi] = bitRange;
    const mask = (1 << (hi - lo + 1)) - 1;
    const value = (raw >> lo) & mask;

    // Debug logging removed - now handled in parsePage()

    return value;
  }

  // 2. Handle Arrays (Tables/Curves)
  if (type === "array" || (shape && shape.length > 0)) {
    const totalElements =
      shape && shape.length > 0
        ? shape.reduce((a, b) => a * b, 1)
        : 6;
    const elementSize = getDataTypeSize(dataType);
    const result = [];
    for (let i = 0; i < totalElements; i++) {
      result.push(parseScalar(buffer, offset + i * elementSize, dataType));
    }
    return result;
  }

  // 3. Handle Scalars
  return parseScalar(buffer, offset, dataType);
}

/**
 * Parses an entire page buffer into a key-value object of variable names.
 */
export function parsePage(buffer, pageMeta) {
  const result = {};
  for (const [varName, meta] of Object.entries(pageMeta)) {
    if (meta.offset !== undefined && meta.type !== "unknown") {
      try {
        let value = parseValue(buffer, meta.offset, { ...meta, name: varName });

        // WORKAROUND: Speeduino firmware quirk - pinLayout has +61 offset
        // This matches TunerStudio's internal handling (undocumented in INI)
        if (varName === 'pinLayout' && typeof value === 'number' && value > 60) {
          console.warn(`[BinaryParser] Applying pinLayout firmware quirk: ${value} → ${value - 61}`);
          value = value - 61;
        }

        result[varName] = value;
      } catch (e) {
        console.warn(`[BinaryParser] Failed to parse ${varName} at offset ${meta.offset}:`, e);
      }
    }
  }
  return result;
}
