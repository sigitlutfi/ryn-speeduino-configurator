import { parseDriveStatus } from './drive-modes.js'
import { Buffer } from "buffer";
import { parsePage } from "./binary-parser.js";

function toBool(value) {
  return typeof value === 'boolean' ? value : typeof value === 'number' && Number.isFinite(value) ? value !== 0 : null;
}

function toTemp(rawValue) {
  if (typeof rawValue !== "number") return null;
  return rawValue - 40;
}

function applyMetaScale(rawValue, meta) {
  if (typeof rawValue !== "number") return null;
  if (!meta || meta.type !== "scalar") return rawValue;
  return (rawValue + (meta.translate ?? 0)) * (meta.scale ?? 1);
}

export function decodeOutputChannels(buffer, parsedIni) {
  if (!buffer || !parsedIni?.outputChannels?.channels) {
    return null;
  }

  const raw = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const expected = parsedIni.outputChannels.ochBlockSize;
  if (!Number.isInteger(expected) || expected <= 0 || raw.length !== expected) {
    throw new Error(`Invalid telemetry size: expected ${expected}, received ${raw.length}`);
  }
  const channels = parsePage(raw, parsedIni.outputChannels.channels);
  const channelMeta = parsedIni.outputChannels.channels;
  const scaled = (name) => applyMetaScale(channels[name], channelMeta[name]);
  const firstDefined = (...values) => values.find((value) => value !== undefined);

  const realtime = {
    driveMode: raw.length >= 167 && channelMeta.driveVersion ? parseDriveStatus(raw.subarray(152, 167)) : null,
    rpm: channels.rpm ?? null,
    map: scaled("map"),
    emap: channelMeta.emap ? scaled('emap') : null,
    fuelLoadRaw: channels.fuelLoad ?? null,
    ignLoadRaw: channels.ignLoad ?? null,
    tps: scaled("tps"),
    coolant: toTemp(channels.coolantRaw),
    clt: toTemp(channels.coolantRaw),
    iat: toTemp(channels.iatRaw),
    battery: scaled("batteryVoltage"),
    vbatt: scaled("batteryVoltage"),
    afr: scaled("afr"),
    ve: channels.veCurr ?? channels.VE1 ?? null,
    ve1: channels.VE1 ?? null,
    advance: scaled("advance"),
    corrections: channels.gammaEnrich ?? null,
    pw1: scaled("pulseWidth"),
    dwell: scaled('dwell'),
    dwellActual: channelMeta.dwellActual ? scaled('dwellActual') : null,
    baro: scaled("baro"),
    vss: scaled("vss"),
    gear: channels.gear ?? null,
    ethanolPct: channels.flex ?? null,
    flexCorr: channels.flexFuelCor ?? null,
    fuelTemp: toTemp(channels.fuelTempRaw),
    tpsADC: channels.tpsADC ?? null,
    loopsPerSecond: channels.loopsPerSecond ?? null,
    freeRAM: channels.freeRAM ?? null,
    syncLossCounter: channels.syncLossCounter ?? null,
    engine: {
      running: toBool(channels.running),
      cranking: toBool(channels.crank),
      ase: toBool(channels.ase),
      warmup: toBool(channels.warmup),
      accelTPS: toBool(channels.tpsaccaen),
      decelTPS: toBool(channels.tpsaccden),
      accelMAP: toBool(channels.mapaccaen),
      decelMAP: toBool(channels.mapaccden),
      dfco: toBool(channels.DFCOOn),
      boostCutFuel: toBool(channels.boostCutFuel),
      launchHard: toBool(channels.launchHard),
      launchSoft: toBool(channels.launchSoft),
      hardLimit: toBool(channels.hardLimitOn),
      softLimit: toBool(channels.softlimitOn),
      boostCutSpark: toBool(channels.boostCutSpark),
      error: toBool(channels.error),
      idleControl: toBool(channels.idleControlOn),
      sync: toBool(channels.sync),
      resetLock: toBool(channels.resetLockOn),
      nitrous: toBool(channels.nitrousOn),
      halfSync: toBool(channels.halfSync),
      wmiEmpty: toBool(channels.wmiEmptyBit),
      vvt1Error: toBool(channels.vvt1Error),
      vvt2Error: toBool(channels.vvt2Error),
      fanStatus: toBool(channels.fanStatus),
      burnPending: toBool(channels.burnPending),
      stagingActive: toBool(channels.stagingActive),
      protectActive: toBool(channels.engineProtectStatus),
      protectRPM: toBool(channels.engineProtectRPM),
      protectMAP: toBool(channels.engineProtectMAP),
      protectOil: toBool(channels.engineProtectOil),
      protectAFR: toBool(channels.engineProtectAFR),
      protectCLT: toBool(channels.engineProtectCoolant),
      ioError: toBool(channels.IOError),
    },
    performance: {
      pitLimiterActive: toBool(channels.pitLimiterActive),
      pitLimiterSwitch: toBool(channels.pitLimiterSwitchState),
      rumbleIdleActive: toBool(channels.rumbleIdleActive),
      rumbleIdleBeat: toBool(firstDefined(channels.rumbleIdleBeatState, null)),
      alsActive: toBool(channels.alsActive),
      alsSwitch: toBool(channels.alsSwitchState),
      alsTimingCorr: firstDefined(channels.alsTimingCorrection, null),
      alsFuelCorr: firstDefined(channels.alsFuelCorrection, null),
      alsActiveTime: firstDefined(channels.alsActiveTime, null),
      rollingPopBangActive: toBool(channels.rollingPopBangActive),
      rollingPopBangSwitch: toBool(channels.rollingPopBangSwitchState),
      rollingPopBangActiveTime: firstDefined(channels.rollingPopBangActiveTime, null),
      rollingPopBangCutCounter: firstDefined(channels.rollingPopBangCutCounter, null),
      rollingPopBangTimingCorr: firstDefined(channels.rollingPopBangTimingCorrection, null),
      rollingPopBangFuelCorr: firstDefined(channels.rollingPopBangFuelCorrection, null),
    },
    outputChannels: channels,
  };

  return realtime;
}
