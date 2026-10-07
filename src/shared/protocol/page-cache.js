import { Buffer } from "buffer";
import { parsePage } from "./binary-parser.js";
import { serializePage } from "./binary-serializer.js";
import { calculatePageCRC } from "./ecu-commands.js";

export function encodePageBuffer(buffer) {
  return Buffer.from(buffer).toString("base64");
}

export function decodePageBuffer(rawData) {
  return Buffer.from(rawData || "", "base64");
}

export function formatCRC32Hex(value) {
  return (value >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

export function isPageSnapshot(value) {
  return !!(
    value &&
    typeof value === "object" &&
    value.rawEncoding === "base64" &&
    typeof value.rawData === "string"
  );
}

export function createPageSnapshot({
  pageId,
  size,
  buffer,
  source = "generated",
  syncState = "unknown",
  lastReadAt = null,
  lastVerifiedAt = null,
}) {
  const normalized = Buffer.from(buffer || Buffer.alloc(size || 0));
  const crc32 = formatCRC32Hex(calculatePageCRC(normalized));

  return {
    pageId: Number(pageId),
    size: size ?? normalized.length,
    rawEncoding: "base64",
    rawData: encodePageBuffer(normalized),
    crc32,
    syncState,
    lastReadAt,
    lastVerifiedAt,
    source,
  };
}

export function decodePageSnapshot(snapshot) {
  if (!isPageSnapshot(snapshot)) return Buffer.alloc(0);
  return decodePageBuffer(snapshot.rawData);
}

export function decodePageSnapshots(parsedIni, pageSnapshots = {}) {
  const decodedPages = {};

  for (const [pageId, snapshot] of Object.entries(pageSnapshots)) {
    if (!isPageSnapshot(snapshot)) continue;
    const pageMeta = parsedIni?.constants?.pages?.[pageId];
    if (!pageMeta) continue;

    const buffer = decodePageSnapshot(snapshot);
    decodedPages[pageId] = parsePage(buffer, pageMeta);
  }

  return decodedPages;
}

export function serializeDecodedPage(parsedIni, pageId, decodedPage = {}, baseBuffer) {
  const numericPageId = Number(pageId);
  const pageMeta = parsedIni?.constants?.pages?.[numericPageId];
  const pageSize = parsedIni?.constants?.pageSizes?.[numericPageId] || 0;

  if (!pageMeta || !pageSize) {
    return Buffer.alloc(0);
  }

  return serializePage(decodedPage, pageMeta, pageSize, baseBuffer);
}

export function replacePageRegion(buffer, offset, dataBuffer) {
  const next = Buffer.from(buffer);
  Buffer.from(dataBuffer).copy(next, offset);
  return next;
}

export function findDirtyRegion(beforeBuffer, afterBuffer) {
  const before = Buffer.from(beforeBuffer);
  const after = Buffer.from(afterBuffer);
  const size = Math.min(before.length, after.length);

  let first = -1;
  let last = -1;

  for (let i = 0; i < size; i++) {
    if (before[i] !== after[i]) {
      if (first === -1) first = i;
      last = i;
    }
  }

  if (before.length !== after.length) {
    if (first === -1) first = size;
    last = Math.max(before.length, after.length) - 1;
  }

  if (first === -1 || last === -1) {
    return null;
  }

  return {
    offset: first,
    length: last - first + 1,
    before: before.slice(first, last + 1),
    after: after.slice(first, last + 1),
  };
}

