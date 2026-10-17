// Runtime table read/write/verify operations

import { Buffer } from "buffer";
import { assertWritableContract } from "../../../../shared/protocol/contract.js";
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
import { prepareConfigurationWrite } from '../../../../shared/protocol/configuration-policy.js';
import { configurationWriteOptions } from '../../../../shared/protocol/board-pins.js';
import { validateConfigurationValues } from '../../../../shared/protocol/configuration-validation.js';

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

      if (get().operation) throw new Error('Another ECU operation is running');
      const pollingSession = serialService.sessionGeneration;
      serialService.suspendOutputChannelsPolling();
      try {
        const page = await readPageFromECU(tableDef.page);
        return {
          table: tableDef,
          ...readRuntimeTableFromDecodedPage(page.decoded, tableDef),
          pageBuffer: page.buffer,
        };
      } finally {
        serialService.resumeOutputChannelsPolling(pollingSession);
      }
    },

    writeRuntimeTable: async (tableName, nextTable, options = {}) => {
      if (get().operation || ['ProfileActive', 'Unknown'].includes(get().runtimeProfileSession?.state)) throw new Error('Return the runtime profile to DEFAULT before manual RAM writes');
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

      const epoch = get().projectEpoch;
      const session = get().connection.sessionId;
      const checkContext = () => {
        if (get().projectEpoch !== epoch || get().connection.sessionId !== session || get().parsedIni !== parsedIni) throw new Error("Project or ECU changed during manual write");
        assertWritableContract(get());
      };
      checkContext();
      const owner = {};
      get().setOperation({ owner, type: "runtime-write", scope: "runtime-write", label: "Manual ECU RAM write" });
      const pollingSession = serialService.sessionGeneration;
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

          const rangeError = validateConfigurationValues(parsedIni, { [tableDef.page]: { [target.varName]: target.values } });
          if (rangeError) throw new Error(rangeError);
          serializeValue(nextBuffer, meta.offset, target.values, meta);
        }

        checkContext();
        const dirtyRegion = findDirtyRegion(ecuPage.buffer, nextBuffer);

        if (dirtyRegion) {
          await prepareConfigurationWrite(parsedIni, { [tableDef.page]: nextBuffer }, async id => {
            checkContext();
            const result = id === tableDef.page ? ecuPage : await readPageFromECU(id);
            checkContext();
            return result;
          }, { ...configurationWriteOptions(get().currentProject), readCRC: id => serialService.readPageCRC(id) });
          checkContext();
          assertWritableContract(get());
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

            checkContext();
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

        const verified = await readPageFromECU(tableDef.page);
        checkContext();
        if (!Buffer.from(verified.buffer).equals(nextBuffer)) throw new Error('Manual table RAM verification failed');

        return {
          table: tableDef,
          dirtyRegion,
          buffer: nextBuffer,
        };
      } finally {
        serialService.resumeOutputChannelsPolling(pollingSession);
        if (get().operation?.owner === owner) get().clearOperation();
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
