// Runtime profile safety guards

export function evaluateRuntimeProfileGuards(realtime, requirements = {}) {
  const reasons = [];
  const rpm = realtime?.rpm;
  const tps = realtime?.tps;
  const cranking = realtime?.engine?.cranking;
  if (!Number.isFinite(rpm) || rpm < 0 || !Number.isFinite(tps) || tps < 0 || typeof cranking !== "boolean" || typeof realtime?.engine?.running !== "boolean") {
    reasons.push("ECU telemetry is missing or invalid");
  }
  if (requirements.max_rpm === 0 && realtime?.engine?.running) reasons.push("Stop the engine before writing a profile");

  if (requirements.engine_not_cranking !== false && cranking) {
    reasons.push("Engine is cranking");
  }

  if (
    Number.isFinite(requirements.max_tps_pct) &&
    tps > requirements.max_tps_pct
  ) {
    reasons.push(`TPS ${tps}% exceeds ${requirements.max_tps_pct}%`);
  }

  if (
    Number.isFinite(requirements.max_rpm) &&
    rpm > requirements.max_rpm
  ) {
    reasons.push(`RPM ${rpm} exceeds ${requirements.max_rpm}`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    snapshot: {
      rpm,
      tps,
      cranking,
    },
  };
}
