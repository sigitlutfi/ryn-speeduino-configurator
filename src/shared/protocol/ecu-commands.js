/**
 * Speeduino Serial Protocol - Command Formatter
 * 
 * Implements the standard 'w' (Write) and 'b' (Burn) commands.
 */

/**
 * Format a 'w' (Write) command buffer.
 * Protocol: 'w' (1 byte) + page (1 byte) + offset (2 bytes, LE) + length (2 bytes, LE) + data (N bytes)
 */
export function formatWriteCommand(page, offset, length, value, dataType = "") {
  // Determine buffer size: 1 (cmd) + 1 (page) + 2 (offset) + 2 (length) + data
  const headerSize = 6;
  const dataBuf = Buffer.alloc(length);

  // Encode data based on type (Simplistic implementation for now)
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
        if (i < length) dataBuf[i] = v & 0xFF;
    });
  } else if (typeof value === "number") {
    if (length === 1) dataBuf.writeUInt8(value & 0xFF, 0);
    else if (length === 2) dataBuf.writeUInt16LE(value & 0xFFFF, 0);
    else if (length === 4) dataBuf.writeUInt32LE(value, 0);
  }

  const cmdBuf = Buffer.alloc(headerSize + length);
  cmdBuf.write("w", 0, "ascii");
  cmdBuf.writeUInt8(page, 1);
  cmdBuf.writeUInt16LE(offset, 2);
  cmdBuf.writeUInt16LE(length, 4);
  dataBuf.copy(cmdBuf, 6);

  return cmdBuf;
}

/**
 * Format a 'b' (Burn) command buffer.
 * Protocol: 'b' (1 byte) + page (1 byte)
 */
export function formatBurnCommand(page) {
  const buf = Buffer.alloc(2);
  buf.write("b", 0, "ascii");
  buf.writeUInt8(page, 1);
  return buf;
}

/**
 * Format an 'r' (Read) command buffer.
 * Protocol: 'r' (1 byte) + page (1 byte) + offset (2 bytes, LE) + length (2 bytes, LE)
 */
export function formatReadCommand(page, offset, length) {
  const buf = Buffer.alloc(6);
  buf.write("r", 0, "ascii");
  buf.writeUInt8(page, 1);
  buf.writeUInt16LE(offset, 2);
  buf.writeUInt16LE(length, 4);
  return buf;
}
