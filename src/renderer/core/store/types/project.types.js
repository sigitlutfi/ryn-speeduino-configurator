// Project state shape definitions

import { DEFAULT_ACTIVE_PAGES } from "../utils/project.constants.js";

export function createEmptyEcuState(raw = {}) {
  const mergedActivePages = Array.from(
    new Set([...(raw.sync?.activePages ?? []), ...DEFAULT_ACTIVE_PAGES]),
  ).sort((a, b) => a - b);

  return {
    signature: raw.signature ?? null,
    product: raw.product ?? null,
    protocol: {
      probe: raw.protocol?.probe ?? null,
      envelope: raw.protocol?.envelope ?? "msEnvelope_1.0",
      baud: raw.protocol?.baud ?? 115200,
    },
    sync: {
      state: raw.sync?.state ?? "needs-initial-sync",
      activePages: mergedActivePages,
      lastConnectedAt: raw.sync?.lastConnectedAt ?? null,
      lastSyncAt: raw.sync?.lastSyncAt ?? null,
    },
  };
}
