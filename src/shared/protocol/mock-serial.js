/**
 * Mock serial port that simulates a Speeduino ECU response.
 * Used for development/testing without physical hardware.
 *
 * Supports modern protocol with CRC32 validation.
 */

const PACKET_SIZE = 152;
const OUTPUT_CHANNELS_SIZE = PACKET_SIZE;
const FIRMWARE_SIGNATURE = 'speeduino 202504-ryn-perf-v3';
const NUM_PAGES = 16; // Pages 0-15
const PAGE_SIZE = 512; // Standard page size
const PAGE_SIZES = [0, 128, 288, 288, 128, 288, 143, 240, 384, 192, 220, 288, 192, 128, 288, 256];

/**
 * CRC32 calculation (must match the one in ecu-commands.js)
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
 * Wrap response with modern protocol format
 */
function wrapResponse(payload) {
  const length = payload.length;
  const crc = crc32(payload);

  const wrapped = Buffer.alloc(2 + length + 4);
  wrapped.writeUInt16BE(length, 0);
  payload.copy(wrapped, 2);
  wrapped.writeUInt32BE(crc, 2 + length);

  return wrapped;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Simulate slowly varying ECU state
let _rpm = 850;
let _map = 55;
let _tps = 0;
let _coolant = 85;
let _afr = 147; // stored *10
let _phase = 0;

function buildRealtimePacket() {
  _phase += 0.05;

  // RPM: idle oscillation around 850, occasional blip
  _rpm = clamp(850 + Math.sin(_phase) * 80 + Math.random() * 20, 600, 7000);
  const rpm = Math.round(_rpm);

  // MAP: varies with RPM
  _map = clamp(55 + Math.sin(_phase * 1.3) * 15 + Math.random() * 5, 30, 105);
  const map = Math.round(_map);

  // TPS: mostly closed, occasional blip
  _tps = clamp(Math.abs(Math.sin(_phase * 0.4)) * 30 + Math.random() * 3, 0, 100);
  const tps = Math.round(_tps);

  // Coolant: warming up to 90°C
  _coolant = clamp(_coolant + (90 - _coolant) * 0.001 + Math.random() * 0.1, 20, 115);
  const coolant = Math.round(_coolant) + 40; // stored as °C + 40

  // IAT: ambient ~35°C
  const iat = 35 + 40; // stored as °C + 40

  // Battery: 13.8V nominal
  const battery10 = Math.round((13.8 + Math.sin(_phase * 2) * 0.1) * 10);

  // AFR: target 14.7 ± noise
  _afr = clamp(147 + Math.sin(_phase * 3) * 5 + Math.random() * 3 - 1, 100, 200);
  const o2 = Math.round(_afr);

  // VE: ~75%
  const ve1 = 75 + Math.round(Math.sin(_phase) * 5);
  const ve  = ve1;

  // Advance: ~15°
  const advance = 15 + Math.round(Math.sin(_phase * 0.7) * 3);

  // Corrections: ~100%
  const corr = 100;

  // Engine running flag (bit 0)
  const engineByte = 0x01; // running

  const buf = new Uint8Array(PACKET_SIZE);

  buf[0]  = (Date.now() / 1000) & 0xff; // secl
  buf[1]  = 0;                           // status1
  buf[2]  = engineByte;                  // engine status
  buf[3]  = 0;                           // syncLossCounter
  buf[4]  = map & 0xff;                  // MAP low
  buf[5]  = (map >> 8) & 0xff;           // MAP high
  buf[6]  = iat;                         // IAT (°C + 40)
  buf[7]  = coolant;                     // Coolant (°C + 40)
  buf[8]  = 100;                         // batCorrection
  buf[9]  = battery10;                   // battery * 10
  buf[10] = o2;                          // O2 (AFR * 10)
  buf[11] = 100;                         // egoCorrection
  buf[12] = 100;                         // iatCorrection
  buf[13] = 100;                         // wueCorrection
  buf[14] = rpm & 0xff;                  // RPM low
  buf[15] = (rpm >> 8) & 0xff;           // RPM high
  buf[16] = 0;                           // AE amount
  buf[17] = corr & 0xff;                 // corrections low
  buf[18] = (corr >> 8) & 0xff;          // corrections high
  buf[19] = ve1;                         // VE1
  buf[20] = 0;                           // VE2
  buf[21] = 147;                         // afrTarget (14.7 * 10)
  buf[24] = advance & 0xff;              // advance (signed)
  buf[25] = tps;                         // TPS 0-100
  buf[41] = 101;                         // baro kPa
  buf[90] = 100;                         // dwell low (100 = 10ms)
  buf[91] = 0;                           // dwell high
  buf[102] = ve;                         // current VE
  buf[116] = iat;                        // fuelTemp (same as IAT for mock)
  buf[139] = 0x08;                       // Rumble beat fires while inactive
  buf[142] = 100;                        // Neutral ALS fuel correction
  buf[151] = 100;                        // Neutral pop/bang fuel correction

  return buf;
}

function buildOutputChannelsBlock() {
  return Buffer.from(buildRealtimePacket()).subarray(0, OUTPUT_CHANNELS_SIZE);
}

/**
 * Creates a mock serial port object.
 * @param {(data: Uint8Array) => void} onData - callback when data is emitted
 * @returns {{ write: Function, close: Function }}
 */
export function createMockSerial(onData) {
  // Simulated ECU memory (16 pages x 512 bytes each)
  const ecuMemory = [];
  for (let i = 0; i < NUM_PAGES; i++) {
    ecuMemory[i] = Buffer.alloc(PAGE_SIZE);
    // Initialize with some default values
    ecuMemory[i].fill(0);
  }

  // Buffer for accumulating incoming bytes
  let receiveBuffer = Buffer.alloc(0);
  let expectedLength = null;

  /**
   * Process a complete modern protocol command
   */
  function processModernCommand(payload) {
    const cmd = String.fromCharCode(payload[0]);

    console.log(`[Mock ECU] Received modern protocol command: '${cmd}' (${payload.length} bytes)`);

    if (cmd === 'M') {
      // Write command
      // Payload: ['M'] [reserved] [page] [offset_low] [offset_high] [length_low] [length_high] [data...]
      const page = payload[2];
      const offset = payload.readUInt16LE(3);
      const length = payload.readUInt16LE(5);
      const data = payload.slice(7, 7 + length);

      console.log(`[Mock ECU] WRITE: Page ${page}, Offset ${offset}, Length ${length}`);

      // Write to simulated ECU memory
      if (page < NUM_PAGES && offset + length <= PAGE_SIZE) {
        data.copy(ecuMemory[page], offset);
        console.log(`[Mock ECU] Data written to memory:`, data);

        // Send OK response (0x00)
        const response = Buffer.from([0x00]);
        setTimeout(() => onData(wrapResponse(response)), 5);
      } else {
        // Send range error (0x84)
        const response = Buffer.from([0x84]);
        setTimeout(() => onData(wrapResponse(response)), 5);
      }

    } else if (cmd === 'b') {
      // Burn command
      // Payload: ['b'] [reserved] [page]
      const page = payload[2];
      console.log(`[Mock ECU] BURN: Page ${page} (simulated EEPROM write)`);

      // Send BURN_OK response (0x04)
      const response = Buffer.from([0x04]);
      setTimeout(() => onData(wrapResponse(response)), 5);

    } else if (cmd === 'p') {
      // Read page command
      // Payload: ['p'] [reserved] [page] [offset_low] [offset_high] [length_low] [length_high]
      const page = payload[2];
      const offset = payload.readUInt16LE(3);
      const length = payload.readUInt16LE(5);

      console.log(`[Mock ECU] READ: Page ${page}, Offset ${offset}, Length ${length}`);

      if (page < NUM_PAGES && offset + length <= PAGE_SIZE) {
        // Build response: [0x00] [data...]
        const responsePayload = Buffer.alloc(1 + length);
        responsePayload[0] = 0x00; // OK status
        ecuMemory[page].copy(responsePayload, 1, offset, offset + length);

        setTimeout(() => onData(wrapResponse(responsePayload)), 5);
      } else {
        // Send range error
        const response = Buffer.from([0x84]);
        setTimeout(() => onData(wrapResponse(response)), 5);
      }

    } else if (cmd === 'd') {
      const page = payload[2];
      if (page > 0 && page < NUM_PAGES) {
        const response = Buffer.alloc(5);
        response[0] = 0x00;
        response.writeUInt32BE(crc32(ecuMemory[page].subarray(0, PAGE_SIZES[page])), 1);
        setTimeout(() => onData(wrapResponse(response)), 5);
      } else {
        setTimeout(() => onData(wrapResponse(Buffer.from([0x84]))), 5);
      }
    } else if (cmd === 'r') {
      const subCommand = payload[2];
      const offset = payload.readUInt16LE(3);
      const length = payload.readUInt16LE(5);

      console.log(`[Mock ECU] OUTPUT CHANNELS: sub=0x${subCommand.toString(16)}, offset ${offset}, length ${length}`);

      if (subCommand !== 0x30) {
        const response = Buffer.from([0x83]);
        setTimeout(() => onData(wrapResponse(response)), 5);
      } else {
        const outputBlock = buildOutputChannelsBlock();
        const safeOffset = Math.max(0, Math.min(offset, outputBlock.length));
        const safeLength = Math.max(0, Math.min(length, outputBlock.length - safeOffset));
        const responsePayload = Buffer.alloc(1 + safeLength);
        responsePayload[0] = 0x00;
        outputBlock.copy(responsePayload, 1, safeOffset, safeOffset + safeLength);
        setTimeout(() => onData(wrapResponse(responsePayload)), 5);
      }

    } else if (cmd === 'C') {
      // Test comms (handshake)
      console.log(`[Mock ECU] Handshake`);
      const response = Buffer.from([0x00, 0xFF]);
      setTimeout(() => onData(wrapResponse(response)), 5);

    } else if (cmd === 'Q') {
      // Firmware signature
      console.log(`[Mock ECU] Firmware signature request`);
      const sig = FIRMWARE_SIGNATURE;
      const response = Buffer.alloc(1 + sig.length);
      response[0] = 0x00; // OK status
      response.write(sig, 1, 'ascii');
      setTimeout(() => onData(wrapResponse(response)), 5);

    } else if (cmd === 'S') {
      // Product string
      console.log(`[Mock ECU] Product string request`);
      const product = 'Speeduino 2025.04-dev';
      const response = Buffer.alloc(1 + product.length);
      response[0] = 0x00;
      response.write(product, 1, 'ascii');
      setTimeout(() => onData(wrapResponse(response)), 5);

    } else {
      console.warn(`[Mock ECU] Unknown command: '${cmd}'`);
      // Send unknown error (0x83)
      const response = Buffer.from([0x83]);
      setTimeout(() => onData(wrapResponse(response)), 5);
    }
  }

  function processLegacyCommand(newData) {
    const cmd = String.fromCharCode(newData[0]);

    if (cmd === "F") {
      setTimeout(() => onData(Buffer.from("002", "ascii")), 5);
      return true;
    }

    if (cmd === "Q") {
      setTimeout(() => onData(Buffer.from(FIRMWARE_SIGNATURE, "ascii")), 5);
      return true;
    }

    if (cmd === "S") {
      setTimeout(() => onData(Buffer.from("Speeduino 2025.04-dev", "ascii")), 5);
      return true;
    }

    if (cmd === "C") {
      setTimeout(() => onData(Buffer.from([0x01])), 5);
      return true;
    }

    return false;
  }

  /**
   * Process incoming data (modern protocol parser)
   */
  function processIncomingData(newData) {
    if (newData.length === 1 && processLegacyCommand(newData)) {
      return;
    }

    // Append to receive buffer
    receiveBuffer = Buffer.concat([receiveBuffer, newData]);

    // Parse modern protocol: [Length 2B] [Payload] [CRC32 4B]
    while (receiveBuffer.length > 0) {
      // Do we have at least the length header?
      if (expectedLength === null && receiveBuffer.length >= 2) {
        expectedLength = receiveBuffer.readUInt16BE(0);
      }

      // Do we have the complete message?
      const totalLength = 2 + expectedLength + 4; // length + payload + CRC
      if (expectedLength !== null && receiveBuffer.length >= totalLength) {
        // Extract the payload
        const payload = receiveBuffer.slice(2, 2 + expectedLength);

        // Extract and verify CRC
        const receivedCRC = receiveBuffer.readUInt32BE(2 + expectedLength);
        const calculatedCRC = crc32(payload);

        if (receivedCRC === calculatedCRC) {
          // CRC valid, process command
          processModernCommand(payload);
        } else {
          console.error(`[Mock ECU] CRC mismatch! Received: 0x${receivedCRC.toString(16)}, Calculated: 0x${calculatedCRC.toString(16)}`);
          // Send CRC error (0x82)
          const response = Buffer.from([0x82]);
          setTimeout(() => onData(wrapResponse(response)), 5);
        }

        // Remove processed message from buffer
        receiveBuffer = receiveBuffer.slice(totalLength);
        expectedLength = null;
      } else {
        // Wait for more data
        break;
      }
    }
  }

  return {
    write(buf) {
      processIncomingData(Buffer.from(buf));
    },
    flush(callback) {
      receiveBuffer = Buffer.alloc(0);
      expectedLength = null;
      if (callback) callback(null);
    },
    close() {
    },
  };
}
