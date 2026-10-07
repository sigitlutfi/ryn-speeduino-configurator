import { Buffer } from "buffer";
import { getVarMetadata } from "../ini-parser.js";
import { parseValue } from "./binary-parser.js";
import { serializeValue } from "./binary-serializer.js";

function getDataTypeSize(dataType) {
  switch (dataType?.toUpperCase()) {
    case "U08":
    case "S08":
      return 1;
    case "U16":
    case "S16":
      return 2;
    case "U32":
    case "S32":
      return 4;
    default:
      return 1;
  }
}

export function getRuntimeFieldByteLength(meta) {
  if (!meta) return 0;

  if (meta.type === "string") {
    return meta.length || 0;
  }

  if (meta.type === "array" || (Array.isArray(meta.shape) && meta.shape.length > 0)) {
    const elementCount = meta.shape.reduce((total, size) => total * size, 1);
    return elementCount * getDataTypeSize(meta.dataType);
  }

  return getDataTypeSize(meta.dataType);
}

export function resolveRuntimeField(parsedIni, fieldName) {
  const meta = getVarMetadata(parsedIni, fieldName);
  if (!meta) {
    throw new Error(`Unknown runtime field '${fieldName}'`);
  }

  const length = getRuntimeFieldByteLength(meta);
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error(`Runtime field '${fieldName}' has invalid byte length`);
  }

  return {
    ...meta,
    length,
  };
}

export function readRuntimeFieldFromBuffer(pageBuffer, meta) {
  if (!Buffer.isBuffer(pageBuffer)) {
    throw new Error("A page buffer is required to read a runtime field");
  }

  const value = parseValue(pageBuffer, meta.offset, meta);
  return value;
}

export function buildRuntimeFieldWrite(pageBuffer, meta, nextValue) {
  if (!Buffer.isBuffer(pageBuffer)) {
    throw new Error("A page buffer is required to build a runtime field write");
  }

  const beforeBuffer = Buffer.from(pageBuffer);
  const afterBuffer = Buffer.from(pageBuffer);
  serializeValue(afterBuffer, meta.offset, nextValue, meta);

  let firstDirtyByte = -1;
  let lastDirtyByte = -1;
  for (let index = 0; index < afterBuffer.length; index += 1) {
    if (beforeBuffer[index] !== afterBuffer[index]) {
      if (firstDirtyByte === -1) firstDirtyByte = index;
      lastDirtyByte = index;
    }
  }

  if (firstDirtyByte === -1) {
    return {
      changed: false,
      offset: meta.offset,
      length: 0,
      before: Buffer.alloc(0),
      after: Buffer.alloc(0),
      value: nextValue,
    };
  }

  return {
    changed: true,
    offset: firstDirtyByte,
    length: lastDirtyByte - firstDirtyByte + 1,
    before: beforeBuffer.slice(firstDirtyByte, lastDirtyByte + 1),
    after: afterBuffer.slice(firstDirtyByte, lastDirtyByte + 1),
    value: nextValue,
  };
}

export function runtimeFieldValuesEqual(actual, expected) {
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  return actual === expected;
}
