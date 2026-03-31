// Runtime profile safety guards

export function evaluateRuntimeProfileGuards(realtime, requirements = {}) {
  const reasons = [];
  const rpm = realtime?.rpm ?? 0;
  const tps = realtime?.tps ?? 0;
  const cranking = !!realtime?.engine?.cranking;

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
