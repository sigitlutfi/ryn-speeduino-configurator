// Page snapshot utility functions

export function getDecodedPages(constants) {
  return constants?.decodedPages || {};
}

export function getActiveProjectPages(currentProject) {
  const decodedPages = getDecodedPages(currentProject?.constants);
  return Object.keys(decodedPages).map(Number).filter((value) => !Number.isNaN(value));
}

export function getPendingBurnPages(currentProject) {
  const pageSnapshots = currentProject?.constants?.pages || {};
  return Object.entries(pageSnapshots)
    .filter(([, snapshot]) => snapshot?.syncState === "burn-pending")
    .map(([pageId]) => Number(pageId))
    .filter((value) => !Number.isNaN(value));
}

export function updatePageSnapshotStates(currentProject, updates) {
  const existingPages = currentProject?.constants?.pages || {};
  const nextPages = { ...existingPages };

  for (const [pageId, patch] of Object.entries(updates || {})) {
    const existing = existingPages[pageId] || existingPages[String(pageId)] || {};
    nextPages[pageId] = { ...existing, ...patch };
  }

  return nextPages;
}
