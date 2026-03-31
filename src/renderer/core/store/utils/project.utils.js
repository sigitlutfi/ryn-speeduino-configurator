// Project-level utility functions

import { isPageSnapshot } from "../../../../shared/protocol/page-cache.js";
import { DEFAULT_ACTIVE_PAGES } from "./project.constants.js";

export function nowIso() {
  return new Date().toISOString();
}

export function splitLegacyConstants(constants = {}) {
  const decodedPages = {};
  const pageSnapshots = {};

  if (constants?.decodedPages) {
    Object.assign(decodedPages, constants.decodedPages);
  }

  if (constants?.pages) {
    for (const [pageId, value] of Object.entries(constants.pages)) {
      if (isPageSnapshot(value)) {
        pageSnapshots[pageId] = value;
      } else if (value && typeof value === "object") {
        decodedPages[pageId] = value;
      }
    }
  }

  for (const [key, value] of Object.entries(constants || {})) {
    if (key === "pages" || key === "decodedPages") continue;
    if (!Number.isNaN(Number(key)) && value && typeof value === "object") {
      decodedPages[key] = value;
    }
  }

  return { decodedPages, pageSnapshots };
}

export function deriveProjectSyncState(
  constants,
  activePages = DEFAULT_ACTIVE_PAGES,
) {
  const pageSnapshots = constants?.pages || {};
  if (!Object.keys(pageSnapshots).length) return "needs-initial-sync";

  let verified = 0;
  let relevant = 0;

  for (const pageId of activePages) {
    const snapshot = pageSnapshots[pageId] || pageSnapshots[String(pageId)];
    if (!snapshot) continue;
    relevant += 1;
    if (snapshot.syncState === "verified") verified += 1;
  }

  if (relevant === 0) return "needs-initial-sync";
  if (verified === relevant) return "fully-verified";
  return "partially-synced";
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
