export function getDecodedPages(constants) {
  if (!constants) return {};
  return constants.decodedPages || {};
}

export function getDecodedPage(constants, pageId) {
  const decodedPages = getDecodedPages(constants);
  return decodedPages?.[pageId] || decodedPages?.[String(pageId)] || {};
}

