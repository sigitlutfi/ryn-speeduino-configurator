import { decodePageSnapshots } from "../../../../shared/protocol/page-cache.js";

export function getDecodedPages(constants, parsedIni = null) {
  if (!constants) return {};
  if (constants.decodedPages && Object.keys(constants.decodedPages).length > 0) {
    return constants.decodedPages;
  }
  if (parsedIni && constants.pages) {
    return decodePageSnapshots(parsedIni, constants.pages);
  }
  return {};
}

export function getDecodedPage(constants, pageId, parsedIni = null) {
  const decodedPages = getDecodedPages(constants, parsedIni);
  return decodedPages?.[pageId] || decodedPages?.[String(pageId)] || {};
}
