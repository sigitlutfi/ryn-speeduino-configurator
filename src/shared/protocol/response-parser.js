/**
 * Modern Protocol Response Parser
 *
 * Handles parsing of wrapped responses: [Length 2B LE] [Payload] [CRC32 4B LE]
 */

import { Buffer } from 'buffer';

/**
 * CRC32 calculation (must match ecu-commands.js)
 */
function crc32(buffer) {
  const polynomial = 0xedb88320;
  let crc = 0xffffffff;

  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? polynomial : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Response status codes from Speeduino firmware
 */
export const ResponseStatus = {
  OK: 0x00,
  REALTIME: 0x01,
  PAGE: 0x02,
  BURN_OK: 0x04,
  TIMEOUT: 0x80,
  CRC_ERR: 0x82,
  UNKNOWN_ERR: 0x83,
  RANGE_ERR: 0x84,
  BUSY_ERR: 0x85,
};

/**
 * Modern Protocol Response Parser
 * Accumulates incoming bytes and parses complete messages
 */
export class ModernProtocolParser {
  constructor() {
    this.buffer = Buffer.alloc(0);
    this.expectedLength = null;
    this.listeners = {
      response: [],
      realtime: [],
      error: [],
      rawData: [], // For unwrapped responses (page reads)
    };
    this.rawMode = false; // When true, bypass parsing and emit all data as raw
    this.rawExpectedBytes = 0; // Expected bytes in raw mode
  }

  /**
   * Feed incoming data to the parser
   * @param {Buffer|Uint8Array|Array} data - Incoming data
   */
  feed(data) {
    const newData = Buffer.from(data);

    // If in raw mode, accumulate until expected bytes received
    if (this.rawMode) {
      // Open-ended passthrough has no assembly target. Its consumer owns
      // buffering; retaining another copy here only grows memory usage.
      if (this.rawExpectedBytes > 0) this.buffer = Buffer.concat([this.buffer, newData]);

      // Emit each chunk immediately for streaming
      this._emit("rawData", newData);

      // Check if we've received all expected bytes
      if (this.rawExpectedBytes > 0 && this.buffer.length >= this.rawExpectedBytes) {
        // Exit raw mode
        this.rawMode = false;
        this.rawExpectedBytes = 0;
        this.buffer = Buffer.alloc(0);
      }
      return;
    }

    this.buffer = Buffer.concat([this.buffer, newData]);

    // Try to parse complete messages
    this._parseMessages();
  }

  /**
   * Internal message parser
   */
  _parseMessages() {
    while (this.buffer.length > 0) {
      // Raw output-channel reads are assembled by the request's INI size.
      // A serial chunk's length alone cannot identify a realtime packet.
      // Modern protocol: [Length 2B BE] [Payload] [CRC32 4B BE]
      // NOTE: Speeduino uses BIG ENDIAN for length and CRC!
      if (this.expectedLength === null && this.buffer.length >= 2) {
        this.expectedLength = this.buffer.readUInt16BE(0);
      }

      const totalLength = 2 + (this.expectedLength || 0) + 4;

      if (this.expectedLength !== null && this.buffer.length >= totalLength) {
        // Extract payload
        const payload = this.buffer.slice(2, 2 + this.expectedLength);

        // Verify CRC (BIG ENDIAN!)
        const receivedCRC = this.buffer.readUInt32BE(2 + this.expectedLength); // Changed to BE!
        const calculatedCRC = crc32(payload);

        if (receivedCRC !== calculatedCRC) {
          this._emit("error", {
            code: ResponseStatus.CRC_ERR,
            message: "CRC validation failed",
          });

          // Discard this message and reset
          this.buffer = this.buffer.slice(totalLength);
          this.expectedLength = null;
          continue;
        }

        // Parse payload (first byte is status code)
        const status = payload[0];
        const data = payload.slice(1);

        if (status !== ResponseStatus.OK && status !== ResponseStatus.BURN_OK) {
          // Error response
          this._emit("error", {
            code: status,
            message: this._getErrorMessage(status),
            data,
          });
        } else {
          // Success response
          this._emit("response", { status, data });
        }

        // Remove processed message
        this.buffer = this.buffer.slice(totalLength);
        this.expectedLength = null;
      } else {
        // Wait for more data
        break;
      }
    }
  }

  /**
   * Convert status code to error message
   */
  _getErrorMessage(status) {
    switch (status) {
      case ResponseStatus.TIMEOUT:
        return "Command timeout";
      case ResponseStatus.CRC_ERR:
        return "CRC error";
      case ResponseStatus.UNKNOWN_ERR:
        return "Unknown command";
      case ResponseStatus.RANGE_ERR:
        return "Range error";
      case ResponseStatus.BUSY_ERR:
        return "ECU busy";
      default:
        return `Unknown error (0x${status.toString(16)})`;
    }
  }

  /**
   * Emit event to listeners
   */
  _emit(event, data) {
    const callbacks = this.listeners[event] || [];
    callbacks.forEach((cb) => cb(data));
  }

  /**
   * Register event listener
   * @param {'response'|'realtime'|'error'} event - Event type
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(
      (cb) => cb !== callback,
    );
  }

  /**
   * Remove all listeners
   */
  offAll() {
    this.listeners = { response: [], realtime: [], error: [], rawData: [] };
  }

  /**
   * Reset parser state
   */
  reset() {
    this.buffer = Buffer.alloc(0);
    this.expectedLength = null;
    this.rawMode = false;
    this.rawExpectedBytes = 0;
  }

  /**
   * Enable raw data mode for reading unwrapped responses (e.g., page data)
   * @param {number} expectedBytes - Number of bytes to expect
   */
  enableRawMode(expectedBytes) {
    this.rawMode = true;
    this.rawExpectedBytes = expectedBytes;
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Disable raw data mode
   */
  disableRawMode() {
    this.rawMode = false;
    this.rawExpectedBytes = 0;
    this.buffer = Buffer.alloc(0);
  }
}
