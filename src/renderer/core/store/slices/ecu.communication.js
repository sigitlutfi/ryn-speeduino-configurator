// ECU communication primitives

import { Buffer } from "buffer";
import { assertWritableContract } from "../../../../shared/protocol/contract.js";
import { buildRuntimeFieldWrite, resolveRuntimeField } from "../../../../shared/protocol/runtime-fields.js";
import { formatReadCommand } from "../../../../shared/protocol/ecu-commands.js";
import { parsePage } from "../../../../shared/protocol/binary-parser.js";
import { serialService } from "../../services/serialService.js";
import { getVarMetadata } from "../../../../shared/ini-parser.js";
import { nowIso, deriveProjectSyncState } from "../utils/project.utils.js";
import { updatePageSnapshotStates } from "../utils/page.utils.js";
import { recordRestartWrite } from '../utils/ecu.restart.js';
import { prepareConfigurationWrite } from '../../../../shared/protocol/configuration-policy.js';
import { configurationWriteOptions } from '../../../../shared/protocol/board-pins.js';
import { validateConfigurationValues } from '../../../../shared/protocol/configuration-validation.js';

export function createECUCommunicationSlice(set, get) {
  const DEFAULT_PAGE_READ_CHUNK = 64;
  const MAX_PAGE_READ_CHUNK = 64;

  return {
    readPageFromECU: async (pageId) => {
      const { parsedIni, currentProject } = get();
      assertWritableContract(get());
      const epoch = get().projectEpoch;
      const session = get().connection.sessionId;

      const pageSize = parsedIni.constants.pageSizes[pageId];
      const pageMeta = parsedIni.constants.pages[pageId];
      if (!pageMeta || !Number.isInteger(pageSize) || pageSize <= 0) throw new Error(`Invalid INI page ${pageId}`);
      const configuredBlockingFactor = Number.parseInt(
        currentProject?.ini?.blockingFactor,
        10,
      );
      const chunkSize =
        Number.isFinite(configuredBlockingFactor) &&
        configuredBlockingFactor > 0
          ? Math.min(configuredBlockingFactor, MAX_PAGE_READ_CHUNK)
          : DEFAULT_PAGE_READ_CHUNK;

      return (async () => {
        const chunks = [];
        let offset = 0;

        while (offset < pageSize) {
          const length = Math.min(chunkSize, pageSize - offset);
          if (get().projectEpoch !== epoch || get().connection.sessionId !== session || get().parsedIni !== parsedIni || get().connection.status !== 'connected') throw new Error('Project or connection changed during page read');
          const cmd = formatReadCommand(pageId, offset, length);
          const chunk = await serialService.readPageBuffer(cmd, length);
          if (chunk.length !== length) throw new Error(`Short read on page ${pageId}`);
          chunks.push(chunk);
          offset += length;
        }

        if (get().projectEpoch !== epoch || get().connection.sessionId !== session || get().parsedIni !== parsedIni || get().connection.status !== 'connected') throw new Error('Project or connection changed during page read');
        const pageData = Buffer.concat(chunks);
        return {
          decoded: parsePage(pageData, pageMeta),
          buffer: pageData,
        };
      })();
    },

    syncConstantToECU: async (name, value) => {
      const {
        parsedIni,
        connection,
      } = get();
      if (connection.status !== "connected" || !parsedIni) return;

      const meta = getVarMetadata(parsedIni, name);
      if (!meta) return;

      let entered = false;
      const owner = {}, pollingSession = serialService.sessionGeneration;
      try {
        if (get().operation || ["ProfileActive", "Unknown"].includes(get().runtimeProfileSession?.state)) throw new Error("Return the runtime profile to DEFAULT before manual ECU writes");
        assertWritableContract(get());
        const field = resolveRuntimeField(parsedIni, name);
        const rangeError = validateConfigurationValues(parsedIni, { [field.page]: { [field.name]: value } });
        if (rangeError) throw new Error(rangeError);
        const epoch = get().projectEpoch, session = get().connection.sessionId;
        get().setOperation({ owner, type: "constant-write", scope: "runtime-write", label: "Manual ECU RAM write" });
        entered = true;
        await serialService.enterExclusiveMode();
        const page = await get().readPageFromECU(field.page);
        if (get().projectEpoch !== epoch || get().connection.sessionId !== session || get().parsedIni !== parsedIni) throw new Error("Project or ECU changed during manual write");
        const write = buildRuntimeFieldWrite(page.buffer, field, value);
        if (!write.changed) return;
        const target = Buffer.from(page.buffer);
        write.after.copy(target, write.offset);
        const prepared = await prepareConfigurationWrite(parsedIni, { [field.page]: target }, async id => {
          if (get().projectEpoch !== epoch || get().connection.sessionId !== session || get().parsedIni !== parsedIni) throw new Error('Project or ECU changed during manual write');
          return id === field.page ? page : get().readPageFromECU(id);
        }, { ...configurationWriteOptions(get().currentProject), readCRC: id => serialService.readPageCRC(id) });
        await recordRestartWrite(set, get, parsedIni, prepared.before, prepared.after);
        assertWritableContract(get());
        if (get().projectEpoch !== epoch || get().connection.sessionId !== session || get().parsedIni !== parsedIni) throw new Error('Project or ECU changed during manual write');
        await serialService.writePage(field.page, write.offset, write.length, Array.from(write.after));
        const verified = await get().readPageFromECU(field.page);
        if (get().projectEpoch !== epoch || get().connection.sessionId !== session || get().parsedIni !== parsedIni) throw new Error('Project or ECU changed during manual write');
        if (!Buffer.from(verified.buffer).equals(target)) throw new Error('Manual constant RAM verification failed');

        set((s) => {
          if (!s.currentProject) return {};
          const nextPages = updatePageSnapshotStates(s.currentProject, {
            [meta.page]: {
              syncState: "write-pending",
            },
          });
          return {
            currentProject: {
              ...s.currentProject,
              ecu: {
                ...s.currentProject.ecu,
                sync: {
                  ...s.currentProject.ecu.sync,
                  state: deriveProjectSyncState(
                    { pages: nextPages },
                    s.currentProject.ecu.sync.activePages,
                  ),
                },
              },
              constants: {
                ...(s.currentProject.constants || {}),
                pages: nextPages,
              },
            },
          };
        });
        console.log(
          `[ECU] Synced ${name} to Page ${meta.page}, Offset ${meta.offset}`,
        );
      } catch (e) {
        console.error(`[ECU] Sync failed for ${name}:`, e);
      } finally {
        if (entered) {
          serialService.resumeOutputChannelsPolling(pollingSession);
          if (get().operation?.owner === owner) get().clearOperation();
        }
      }
    },

    updateECUConnectionInfo: (info = {}) => {
      set((s) => {
        const connection = { ...s.connection, firmwareSignature: info.signature ?? null };
        if (!s.currentProject) return { connection };
        return {
          connection,
          currentProject: {
            ...s.currentProject,
            constants: { ...s.currentProject.constants, pages: Object.fromEntries(Object.entries(s.currentProject.constants?.pages || {}).map(([page, snapshot]) =>
              [page, { ...snapshot, syncState: 'unknown', lastVerifiedAt: null }])) },
            ecu: {
              ...s.currentProject.ecu,
              signature: info.signature ?? s.currentProject.ecu.signature,
              product: info.product ?? s.currentProject.ecu.product,
              protocol: {
                ...s.currentProject.ecu.protocol,
                probe: info.probe ?? s.currentProject.ecu.protocol.probe,
                baud: info.baud ?? s.currentProject.ecu.protocol.baud,
              },
              sync: {
                ...s.currentProject.ecu.sync,
                state: 'needs-initial-sync',
                lastConnectedAt: nowIso(),
              },
            },
          },
        };
      });
    },
  };
}
