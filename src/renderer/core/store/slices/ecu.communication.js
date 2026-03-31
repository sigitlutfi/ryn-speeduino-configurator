// ECU communication primitives

import { Buffer } from "buffer";
import { formatReadCommand } from "../../../../shared/protocol/ecu-commands.js";
import { parsePage } from "../../../../shared/protocol/binary-parser.js";
import { serialService } from "../../services/serialService.js";
import { getVarMetadata } from "../../../../shared/ini-parser.js";
import { nowIso, deriveProjectSyncState } from "../utils/project.utils.js";
import { updatePageSnapshotStates } from "../utils/page.utils.js";

export function createECUCommunicationSlice(set, get) {
  return {
    readPageFromECU: (pageId) => {
      const { parsedIni, currentProject } = get();
      if (!parsedIni) return Promise.reject("No INI loaded");

      const pageSize = parsedIni.constants.pageSizes[pageId] || 256;
      const pageMeta = parsedIni.constants.pages[pageId];
      const configuredBlockingFactor = Number.parseInt(
        currentProject?.ini?.blockingFactor,
        10,
      );
      const chunkSize =
        Number.isFinite(configuredBlockingFactor) &&
        configuredBlockingFactor > 0
          ? configuredBlockingFactor
          : 121;

      return (async () => {
        const chunks = [];
        let offset = 0;

        while (offset < pageSize) {
          const length = Math.min(chunkSize, pageSize - offset);
          const cmd = formatReadCommand(pageId, offset, length);
          const chunk = await serialService.readPageBuffer(cmd, length);
          chunks.push(chunk);
          offset += length;
        }

        const pageData = Buffer.concat(chunks, pageSize);
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

      try {
        await serialService.writePage(
          meta.page,
          meta.offset,
          meta.meta.length || 1,
          value,
          meta.meta.dataType,
        );

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
      }
    },

    updateECUConnectionInfo: (info = {}) => {
      set((s) => {
        if (!s.currentProject) return {};
        return {
          currentProject: {
            ...s.currentProject,
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
                lastConnectedAt: nowIso(),
              },
            },
          },
        };
      });
    },
  };
}
