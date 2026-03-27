/**
 * Mock serial port that simulates a Speeduino ECU response.
 * Used for development/testing without physical hardware.
 */

const PACKET_SIZE = 138;

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

  return buf;
}

/**
 * Creates a mock serial port object.
 * @param {(data: Uint8Array) => void} onData - callback when data is emitted
 * @returns {{ write: Function, close: Function }}
 */
export function createMockSerial(onData) {
  let interval = null;

  // Emit a realtime packet every 100ms (10 Hz, typical TunerStudio rate)
  interval = setInterval(() => {
    onData(buildRealtimePacket());
  }, 100);

  return {
    write(buf) {
      // Simulate ECU responses to specific commands
      const cmd = String.fromCharCode(buf[0]);
      if (cmd === 'C') {
        // Handshake — return 'A'
        setTimeout(() => onData(new Uint8Array([0x41])), 5);
      } else if (cmd === 'Q') {
        // Firmware signature
        const sig = 'speeduino 202402';
        const sigBytes = new Uint8Array(sig.length + 1);
        for (let i = 0; i < sig.length; i++) sigBytes[i] = sig.charCodeAt(i);
        setTimeout(() => onData(sigBytes), 5);
      } else if (cmd === 'w') {
        // Write command: Log for debugging
        const page = buf[1];
        const offset = buf.readUInt16LE(2);
        const length = buf.readUInt16LE(4);
        console.log(`[Mock ECU] Received WRITE: Page ${page}, Offset ${offset}, Length ${length}`);
      } else if (cmd === 'b') {
        // Burn command: Log for debugging
        const page = buf[1];
        console.log(`[Mock ECU] Received BURN: Page ${page}`);
      }
    },
    close() {
      if (interval) clearInterval(interval);
      interval = null;
    },
  };
}
