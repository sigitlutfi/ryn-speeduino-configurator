/**
 * Parse a 138-byte TunerStudio realtime data packet from Speeduino.
 * Byte mapping sourced directly from speeduino/logger.cpp getTSLogEntry().
 *
 * Temperature values: firmware sends (actual + 40), so we subtract 40 to get °C.
 * Battery: firmware sends (V * 10), so we divide by 10.
 * AFR (O2): firmware sends (AFR * 10), so we divide by 10.
 * RPM: uint16 little-endian (low byte first).
 * MAP: uint16 little-endian.
 */
export function parseRealtime(bytes) {
  if (!bytes || bytes.length < 138) return null;
  const isExtended = bytes.length >= 144;
  const hasExtendedAlsTimer = bytes.length >= 145;

  const b = bytes;

  const rpm    = b[14] | (b[15] << 8);
  const map    = b[4]  | (b[5]  << 8);   // kPa
  const iat    = b[6]  - 40;             // °C
  const coolant = b[7] - 40;             // °C
  const battery = b[9] / 10;            // V
  const afr    = b[10] / 10;            // λ ratio * 14.7 (stored as AFR*10 / 10)
  const ve     = b[102];                // % (byte 102 = current VE)
  const ve1    = b[19];                 // % VE table 1
  const tps    = b[25];                 // 0-100%
  const advance = new Int8Array([b[24]])[0]; // signed, degrees
  const corrections = b[17] | (b[18] << 8); // %
  const pw1    = (b[76] | (b[77] << 8)) / 1000; // ms (stored in µs/100 => /10 for µs, /1000 for ms... actually in 100µs units)
  const dwell  = (b[90] | (b[91] << 8)) / 10;   // ms
  const baro   = b[41];                // kPa
  const vss    = b[104] | (b[105] << 8); // km/h
  const gear   = b[106];
  const ethanolPct = b[35];           // %
  const flexCorr   = b[36];          // %
  const fuelTemp   = b[116] - 40;    // °C
  const engineByte = b[2];
  const status1 = b[1];
  const engineStatus2 = b[32];
  const status3 = b[84];
  const status4 = b[110];
  const protectStatus = b[85];

  const engine = {
    running:          !!(engineByte & 0x01),
    cranking:         !!(engineByte & 0x02),
    ase:              !!(engineByte & 0x04),
    warmup:           !!(engineByte & 0x08),
    accelTPS:         !!(engineByte & 0x10),
    decelTPS:         !!(engineByte & 0x20),
    accelMAP:         !!(engineByte & 0x40),
    decelMAP:         !!(engineByte & 0x80),
    // Status 1
    dfco:             !!(status1 & 0x10),
    boostCutFuel:     !!(status1 & 0x20),
    // Limiter/Status flags from status2
    launchHard:       !!(engineStatus2 & 0x01),
    launchSoft:       !!(engineStatus2 & 0x02),
    hardLimit:        !!(engineStatus2 & 0x04),
    softLimit:        !!(engineStatus2 & 0x08),
    boostCutSpark:    !!(engineStatus2 & 0x10),
    error:            !!(engineStatus2 & 0x20),
    idleControl:      !!(engineStatus2 & 0x40),
    sync:             !!(engineStatus2 & 0x80),
    // Status 3
    resetLock:        !!(status3 & 0x01),
    nitrous:          !!(status3 & 0x02),
    halfSync:         !!(status3 & 0x10),
    // Status 4
    wmiEmpty:         !!(status4 & 0x01),
    vvt1Error:        !!(status4 & 0x02),
    vvt2Error:        !!(status4 & 0x04),
    fanStatus:        !!(status4 & 0x08),
    burnPending:      !!(status4 & 0x10),
    stagingActive:    !!(status4 & 0x20),
    // Protection flags from engineProtectStatus
    protectActive:    !!(protectStatus > 0),
    protectRPM:       !!(protectStatus & 0x01),
    protectMAP:       !!(protectStatus & 0x02),
    protectOil:       !!(protectStatus & 0x04),
    protectAFR:       !!(protectStatus & 0x08),
    protectCLT:       !!(protectStatus & 0x10),
    ioError:          !!(protectStatus & 0x80),
  };

  // Performance Features (Expanded Protocol 144 bytes)
  let performance = {
    pitLimiterActive: false,
    pitLimiterSwitch: false,
    rumbleIdleActive: false,
    rumbleIdleBeat:   true,
    alsActive:        false,
    alsSwitch:        false,
    alsTimingCorr:    0,
    alsFuelCorr:      100,
    alsActiveTime:    0
  };

  if (isExtended) {
    const perfByte1 = b[139];
    const perfByte2 = b[140];
    performance = {
      pitLimiterActive: !!(perfByte1 & 0x01),
      pitLimiterSwitch: !!(perfByte1 & 0x02),
      rumbleIdleActive: !!(perfByte1 & 0x04),
      rumbleIdleBeat:   !!(perfByte1 & 0x08),
      alsActive:        !!(perfByte2 & 0x01),
      alsSwitch:        !!(perfByte2 & 0x02),
      alsTimingCorr:    new Int8Array([b[141]])[0],
      alsFuelCorr:      b[142],
      alsActiveTime:    hasExtendedAlsTimer ? (b[143] | (b[144] << 8)) : b[143]
    };
  }

  const loopsPerSecond = b[26] | (b[27] << 8); // uint16
  const freeRAM = b[28] | (b[29] << 8);        // uint16
  const syncLossCounter = b[3];                // byte

  return {
    rpm,
    map,
    iat,
    coolant,
    battery,
    afr,
    ve,
    ve1,
    tps,
    advance,
    corrections,
    pw1,
    dwell,
    baro,
    vss,
    gear,
    ethanolPct,
    flexCorr,
    fuelTemp,
    engine,
    performance,
    // Diagnostic stats
    loopsPerSecond,
    freeRAM,
    syncLossCounter,
  };
}
