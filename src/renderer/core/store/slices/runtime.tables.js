// Runtime table read/write/verify operations

import { Buffer } from "buffer";
import { getVarMetadata } from "../../../../shared/ini-parser.js";
import { serializeValue } from "../../../../shared/protocol/binary-serializer.js";
import { findDirtyRegion } from "../../../../shared/protocol/page-cache.js";
import {
  readRuntimeTableFromDecodedPage,
  resolveRuntimeTable,
  runtimeTablesEqual,
} from "../../../../shared/protocol/runtime-tables.js";
import { serialService } from "../../services/serialService.js";
import { getDecodedPages } from "../utils/page.utils.js";
import { delay } from "../utils/project.utils.js";

export function createRuntimeTablesSlice(set, get) {
  return {
    readRuntimeTable: async (tableName, options = {}) => {
      const { parsedIni, connection, currentProject, readPageFromECU } = get();
      const source = options.source || "ecu";

      if (!parsedIni) {
        throw new Error("No INI loaded");
      }

      const tableDef = resolveRuntimeTable(parsedIni, tableName);

      if (source === "project") {
        const decodedPages = getDecodedPages(currentProject?.constants);
        const decodedPage =
          decodedPages?.[tableDef.page] ||
          decodedPages?.[String(tableDef.page)];

        if (!decodedPage) {
          throw new Error(`Project page ${tableDef.page} is unavailable`);
        }

        return {
          table: tableDef,
          ...readRuntimeTableFromDecodedPage(decodedPage, tableDef),
        };
      }

      if (connection.status !== "connected") {
        throw new Error("Not connected");
      }

      serialService.suspendOutputChannelsPolling();
      try {
        const page = await readPageFromECU(tableDef.page);
        return {
          table: tableDef,
          ...readRuntimeTableFromDecodedPage(page.decoded, tableDef),
          pageBuffer: page.buffer,
        };
      } finally {
        serialService.resumeOutputChannelsPolling();
      }
    },

    writeRuntimeTable: async (tableName, nextTable, options = {}) => {
      const { parsedIni, connection, readPageFromECU } = get();
      if (connection.status !== "connected") {
        throw new Error("Not connected");
      }
      if (!parsedIni) {
        throw new Error("No INI loaded");
      }

      const tableDef = resolveRuntimeTable(parsedIni, tableName);
      if (!nextTable) {
        throw new Error(`No runtime table payload provided for '${tableName}'`);
      }

      serialService.suspendOutputChannelsPolling();
      try {
        const ecuPage = await readPageFromECU(tableDef.page);
        const nextBuffer = Buffer.from(ecuPage.buffer);
        const patchTargets = [
          {
            varName: tableDef.xBinsVar,
            values: Array.from(nextTable.rawRpmAxis || []),
          },
          {
            varName: tableDef.yBinsVar,
            values: Array.from(nextTable.rawLoadAxis || []),
          },
          {
            varName: tableDef.zBinsVar,
            values: Array.from(nextTable.rawValues || []),
          },
        ].filter((target) => target.varName);

        for (const target of patchTargets) {
          const meta = getVarMetadata(parsedIni, target.varName);
          if (!meta) {
            throw new Error(
              `Missing INI metadata for runtime table variable '${target.varName}'`,
            );
          }

          serializeValue(nextBuffer, meta.offset, target.values, meta);
        }

        const dirtyRegion = findDirtyRegion(ecuPage.buffer, nextBuffer);

        if (dirtyRegion) {
          const maxChunkLength = options.maxChunkLength ?? 32;
          for (
            let chunkOffset = 0;
            chunkOffset < dirtyRegion.length;
            chunkOffset += maxChunkLength
          ) {
            const chunkLength = Math.min(
              maxChunkLength,
              dirtyRegion.length - chunkOffset,
            );
            const chunkData = dirtyRegion.after.slice(
              chunkOffset,
              chunkOffset + chunkLength,
            );

            await serialService.writePage(
              tableDef.page,
              dirtyRegion.offset + chunkOffset,
              chunkLength,
              Array.from(chunkData),
            );
            await delay(options.chunkSettleMs ?? 8);
          }

          await delay(options.writeSettleMs ?? 40);
        }

        return {
          table: tableDef,
          dirtyRegion,
          buffer: nextBuffer,
        };
      } finally {
        serialService.resumeOutputChannelsPolling();
      }
    },

    verifyRuntimeTable: async (tableName, expectedTable) => {
      const result = await get().readRuntimeTable(tableName);
      return {
        ...result,
        expectedTable,
        matches: runtimeTablesEqual(result, expectedTable),
      };
    },
  };
}
