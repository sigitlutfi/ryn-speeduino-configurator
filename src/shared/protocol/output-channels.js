import { Buffer } from "buffer";
import { parsePage } from "./binary-parser.js";

function toBool(value) {
  return !!value;
}

function toTemp(rawValue) {
  if (typeof rawValue !== "number") return 0;
  return rawValue - 40;
}

function applyMetaScale(rawValue, meta) {
  if (typeof rawValue !== "number") return 0;
  if (!meta || meta.type !== "scalar") return rawValue;
  return rawValue * (meta.scale ?? 1) + (meta.translate ?? 0);
}

export function decodeOutputChannels(buffer, parsedIni) {
  if (!buffer || !parsedIni?.outputChannels?.channels) {
    return null;
  }

  const raw = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const channels = parsePage(raw, parsedIni.outputChannels.channels);
  const channelMeta = parsedIni.outputChannels.channels;
  const scaled = (name) => applyMetaScale(channels[name], channelMeta[name]);
  const firstDefined = (...values) => values.find((value) => value !== undefined);

  const realtime = {
    rpm: channels.rpm ?? 0,
    map: scaled("map"),
    tps: scaled("tps"),
    coolant: toTemp(channels.coolantRaw),
    clt: toTemp(channels.coolantRaw),
    iat: toTemp(channels.iatRaw),
    battery: scaled("batteryVoltage"),
    vbatt: scaled("batteryVoltage"),
    afr: scaled("afr"),
    ve: channels.veCurr ?? channels.VE1 ?? 0,
    ve1: channels.VE1 ?? 0,
    advance: scaled("advance"),
    corrections: channels.gammaEnrich ?? 0,
    pw1: scaled("pulseWidth"),
    dwell: channels.dwellActual !== undefined ? scaled("dwellActual") : scaled("dwell"),
    baro: scaled("baro"),
    vss: scaled("vss"),
    gear: channels.gear ?? 0,
    ethanolPct: channels.flex ?? 0,
    flexCorr: channels.flexFuelCor ?? 0,
    fuelTemp: toTemp(channels.fuelTempRaw),
    tpsADC: channels.tpsADC ?? 0,
    loopsPerSecond: channels.loopsPerSecond ?? 0,
    freeRAM: channels.freeRAM ?? 0,
    syncLossCounter: channels.syncLossCounter ?? 0,
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
      rumbleIdleBeat: toBool(firstDefined(channels.rumbleIdleBeatState, true)),
      alsActive: toBool(channels.alsActive),
      alsSwitch: toBool(channels.alsSwitchState),
      alsTimingCorr: firstDefined(channels.alsTimingCorrection, 0),
      alsFuelCorr: firstDefined(channels.alsFuelCorrection, 100),
      alsActiveTime: firstDefined(channels.alsActiveTime, 0),
    },
    outputChannels: channels,
  };

  return realtime;
}
