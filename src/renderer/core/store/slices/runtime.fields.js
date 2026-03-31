// Runtime field read/write/verify operations

import { Buffer } from "buffer";
import {
  buildRuntimeFieldWrite,
  readRuntimeFieldFromBuffer,
  resolveRuntimeField,
  runtimeFieldValuesEqual,
} from "../../../../shared/protocol/runtime-fields.js";
import { serialService } from "../../services/serialService.js";

export function createRuntimeFieldsSlice(set, get) {
  return {
    readRuntimeField: async (fieldName) => {
      const { parsedIni, connection, readPageFromECU } = get();
      if (connection.status !== "connected") {
        throw new Error("Not connected");
      }
      if (!parsedIni) {
        throw new Error("No INI loaded");
      }

      const field = resolveRuntimeField(parsedIni, fieldName);

      serialService.suspendOutputChannelsPolling();
      try {
        const page = await readPageFromECU(field.page);
        return {
          field,
          value: readRuntimeFieldFromBuffer(page.buffer, field),
          pageBuffer: page.buffer,
        };
      } finally {
        serialService.resumeOutputChannelsPolling();
      }
    },

    writeRuntimeField: async (fieldName, nextValue, options = {}) => {
      const { parsedIni, connection, readPageFromECU } = get();
      if (connection.status !== "connected") {
        throw new Error("Not connected");
      }
      if (!parsedIni) {
        throw new Error("No INI loaded");
      }

      const field = resolveRuntimeField(parsedIni, fieldName);

      serialService.suspendOutputChannelsPolling();
      try {
        const page = options.pageBuffer
          ? { buffer: Buffer.from(options.pageBuffer) }
          : await readPageFromECU(field.page);
        const currentValue = readRuntimeFieldFromBuffer(page.buffer, field);
        const write = buildRuntimeFieldWrite(page.buffer, field, nextValue);

        if (!write.changed) {
          return {
            field,
            changed: false,
            currentValue,
            writtenValue: nextValue,
          };
        }

        await serialService.writePage(
          field.page,
          write.offset,
          write.length,
          Array.from(write.after),
        );

        return {
          field,
          changed: true,
          currentValue,
          writtenValue: nextValue,
          write,
        };
      } finally {
        serialService.resumeOutputChannelsPolling();
      }
    },

    verifyRuntimeField: async (fieldName, expectedValue) => {
      const result = await get().readRuntimeField(fieldName);
      return {
        ...result,
        expectedValue,
        matches: runtimeFieldValuesEqual(result.value, expectedValue),
      };
    },
  };
}
