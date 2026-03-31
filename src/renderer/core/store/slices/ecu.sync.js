// ECU sync, burn, compare, and upload operations

import { Buffer } from "buffer";
import {
  createPageSnapshot,
  decodePageSnapshot,
  findDirtyRegion,
  serializeDecodedPage,
} from "../../../../shared/protocol/page-cache.js";
import {
  readRuntimeTableFromDecodedPage,
  resolveRuntimeTable,
} from "../../../../shared/protocol/runtime-tables.js";
import { serialService } from "../../services/serialService.js";
import { DEFAULT_ACTIVE_PAGES } from "../utils/project.constants.js";
import {
  getActiveProjectPages,
  getPendingBurnPages,
  getDecodedPages,
  updatePageSnapshotStates,
} from "../utils/page.utils.js";
import {
  delay,
  nowIso,
  deriveProjectSyncState,
} from "../utils/project.utils.js";
import { buildDisplayTablesFromDecodedPages } from "../utils/table.transforms.js";

export function createECUSyncSlice(set, get) {
  const formatDiffHex = (buffer, maxBytes = 16) => {
    const bytes = Array.from(Buffer.from(buffer || []).slice(0, maxBytes));
    return bytes.map((value) => value.toString(16).toUpperCase().padStart(2, "0")).join(" ");
  };

  return {
    syncPagesToECU: async (pageIds = [], options = {}) => {
      const {
        connection,
        currentProject,
        parsedIni,
        notify,
        readPageFromECU,
        burnPage,
        setOperation,
        updateOperation,
        clearOperation,
      } = get();
      if (connection.status !== "connected") {
        return { ok: false, error: "Not connected" };
      }

      const targetPages = (
        pageIds?.length ? pageIds : getActiveProjectPages(currentProject)
      )
        .map(Number)
        .filter((value) => !Number.isNaN(value));

      const results = { ok: true, pages: {}, errors: [] };

      serialService.suspendOutputChannelsPolling();
      try {
        setOperation({
          type: options.burn ? "upload" : "write",
          stage: "read",
          label: options.burn ? "Preparing ECU upload" : "Preparing RAM sync",
          current: 0,
          total: targetPages.length,
          scope: "sync",
        });

        for (let index = 0; index < targetPages.length; index += 1) {
          const pageId = targetPages[index];
          try {
            const localSnapshot =
              currentProject?.constants?.pages?.[pageId] ||
              currentProject?.constants?.pages?.[String(pageId)];
            let effectiveLocalSnapshot = localSnapshot;

            if (!effectiveLocalSnapshot && parsedIni) {
              const decodedPage =
                currentProject?.constants?.decodedPages?.[pageId] ||
                currentProject?.constants?.decodedPages?.[String(pageId)];
              const rebuiltBuffer = serializeDecodedPage(
                parsedIni,
                Number(pageId),
                decodedPage || {},
              );

              if (rebuiltBuffer.length > 0) {
                effectiveLocalSnapshot = createPageSnapshot({
                  pageId: Number(pageId),
                  size: rebuiltBuffer.length,
                  buffer: rebuiltBuffer,
                  source: "generated",
                  syncState: "dirty-local",
                  lastReadAt: null,
                  lastVerifiedAt: null,
                });

                set((s) => {
                  if (!s.currentProject) return {};
                  return {
                    currentProject: {
                      ...s.currentProject,
                      constants: {
                        ...(s.currentProject.constants || {}),
                        pages: {
                          ...(s.currentProject.constants?.pages || {}),
                          [pageId]: effectiveLocalSnapshot,
                        },
                      },
                    },
                  };
                });
              }
            }

            if (!effectiveLocalSnapshot) {
              results.ok = false;
              results.errors.push({ pageId, error: "Missing local snapshot" });
              updateOperation({
                stage: "error",
                label: `Missing local snapshot for page ${pageId}`,
                current: index + 1,
                total: targetPages.length,
              });
              continue;
            }

            updateOperation({
              stage: "read",
              label: `Reading ECU page ${pageId}`,
              current: index,
              total: targetPages.length,
            });

            set((s) => {
              if (!s.currentProject) return {};
              const nextPages = updatePageSnapshotStates(s.currentProject, {
                [pageId]: { syncState: "write-pending" },
              });
              return {
                currentProject: {
                  ...s.currentProject,
                  constants: {
                    ...(s.currentProject.constants || {}),
                    pages: nextPages,
                  },
                },
              };
            });

            const ecuPage = await readPageFromECU(pageId);
            const localBuffer = decodePageSnapshot(effectiveLocalSnapshot);
            const dirtyRegion = findDirtyRegion(ecuPage.buffer, localBuffer);

            if (dirtyRegion) {
              updateOperation({
                stage: "write",
                label: `Writing page ${pageId}`,
                current: index,
                total: targetPages.length,
              });
              await serialService.writePage(
                pageId,
                dirtyRegion.offset,
                dirtyRegion.length,
                Array.from(dirtyRegion.after),
              );
              await delay(options.writeSettleMs ?? 1200);
            }

            if (options.burn) {
              updateOperation({
                stage: "burn",
                label: `Burning page ${pageId}`,
                current: index,
                total: targetPages.length,
              });
              const burnResult = await burnPage(pageId);
              if (!burnResult.ok) {
                results.ok = false;
                results.errors.push({
                  pageId,
                  error: burnResult.error || "Burn failed",
                });
                updateOperation({
                  stage: "error",
                  label: `Burn failed on page ${pageId}`,
                  current: index + 1,
                  total: targetPages.length,
                });
                continue;
              }
              results.pages[pageId] = {
                dirtyRegion,
                verified: true,
                burned: true,
              };
            } else {
              updateOperation({
                stage: "verify",
                label: `Verifying page ${pageId}`,
                current: index,
                total: targetPages.length,
              });
              const verifyPage = await readPageFromECU(pageId);
              const verified =
                Buffer.compare(
                  Buffer.from(verifyPage.buffer),
                  Buffer.from(localBuffer),
                ) === 0;

              const verifiedAt = nowIso();
              set((s) => {
                if (!s.currentProject) return {};
                const nextPages = updatePageSnapshotStates(s.currentProject, {
                  [pageId]: {
                    syncState: verified ? "burn-pending" : "different",
                    crc32: verified
                      ? effectiveLocalSnapshot.crc32
                      : s.currentProject.constants?.pages?.[pageId]?.crc32,
                    lastReadAt: verifiedAt,
                    lastVerifiedAt: verifiedAt,
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
                      decodedPages: {
                        ...(s.currentProject.constants?.decodedPages || {}),
                        [pageId]: verifyPage.decoded,
                      },
                    },
                  },
                };
              });

              if (!verified) {
                results.ok = false;
                results.errors.push({ pageId, error: "RAM verify mismatch" });
                updateOperation({
                  stage: "error",
                  label: `Verify mismatch on page ${pageId}`,
                  current: index + 1,
                  total: targetPages.length,
                });
              }
              results.pages[pageId] = {
                dirtyRegion,
                verified,
                burned: false,
                syncState: verified ? "burn-pending" : "different",
              };
            }
          } catch (error) {
            results.ok = false;
            results.errors.push({ pageId, error: error.message });
            updateOperation({
              stage: "error",
              label: `Failed on page ${pageId}`,
              current: index + 1,
              total: targetPages.length,
            });
          }

          updateOperation({
            current: index + 1,
            total: targetPages.length,
          });
        }
      } finally {
        serialService.resumeOutputChannelsPolling();
        clearOperation();
      }

      if (results.errors.length > 0) {
        const firstError = results.errors[0];
        const detail = firstError?.pageId !== undefined
          ? ` Page ${firstError.pageId}: ${firstError.error}.`
          : firstError?.error
            ? ` ${firstError.error}.`
            : "";
        notify(
          `ECU sync completed with ${results.errors.length} issue(s).${detail}`,
          "warning",
        );
      }

      return results;
    },

    writePagesToRAM: async (pageIds = []) => {
      return get().syncPagesToECU(pageIds, { burn: false });
    },

    burnPage: async (pageId) => {
      const { connection, notify, readPageFromECU } = get();
      if (connection.status !== "connected") {
        notify("Device not connected", "error");
        return { ok: false };
      }

      try {
        set((s) => {
          if (!s.currentProject) return {};
          const nextPages = updatePageSnapshotStates(s.currentProject, {
            [pageId]: {
              syncState: "write-pending",
            },
          });
          return {
            currentProject: {
              ...s.currentProject,
              constants: {
                ...(s.currentProject.constants || {}),
                pages: nextPages,
              },
            },
          };
        });

        await serialService.burnPage(pageId);
        await delay(2000);

        const currentState = get();
        const localSnapshot =
          currentState?.currentProject?.constants?.pages?.[pageId] ||
          currentState?.currentProject?.constants?.pages?.[String(pageId)];
        const ecuCRC = await serialService.readPageCRC(pageId);

        if (localSnapshot?.crc32 === ecuCRC) {
          set((s) => {
            if (!s.currentProject) return {};
            const nextPages = updatePageSnapshotStates(s.currentProject, {
              [pageId]: {
                crc32: ecuCRC,
                syncState: "verified",
                lastVerifiedAt: nowIso(),
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
          notify(`Page ${pageId} burned and verified`, "success");
          return { ok: true, verified: true };
        }

        const ecuPage = await readPageFromECU(pageId);
        const localBuffer = decodePageSnapshot(localSnapshot);
        const rawMatch =
          localBuffer.length === ecuPage.buffer.length &&
          Buffer.compare(
            Buffer.from(localBuffer),
            Buffer.from(ecuPage.buffer),
          ) === 0;

        if (rawMatch) {
          set((s) => {
            if (!s.currentProject) return {};
            const nextPages = updatePageSnapshotStates(s.currentProject, {
              [pageId]: {
                crc32: ecuCRC,
                syncState: "verified",
                lastReadAt: nowIso(),
                lastVerifiedAt: nowIso(),
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
                  decodedPages: {
                    ...(s.currentProject.constants?.decodedPages || {}),
                    [pageId]: ecuPage.decoded,
                  },
                },
              },
            };
          });
          notify(`Page ${pageId} burned and verified`, "success");
          return { ok: true, verified: true, healed: true };
        }

        const rebuiltSnapshot = createPageSnapshot({
          pageId,
          size: ecuPage.buffer.length,
          buffer: ecuPage.buffer,
          source: "ecu-read",
          syncState: "different",
          lastReadAt: nowIso(),
          lastVerifiedAt: nowIso(),
        });

        set((s) => {
          if (!s.currentProject) return {};
          const nextPages = updatePageSnapshotStates(s.currentProject, {
            [pageId]: rebuiltSnapshot,
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
                pages: nextPages,
                decodedPages: {
                  ...(s.currentProject.constants?.decodedPages || {}),
                  [pageId]: ecuPage.decoded,
                },
              },
            },
          };
        });

        notify(`Page ${pageId} burn verify failed`, "warning");
        return { ok: false, verified: false, error: "CRC/readback mismatch" };
      } catch (e) {
        set((s) => {
          if (!s.currentProject) return {};
          const nextPages = updatePageSnapshotStates(s.currentProject, {
            [pageId]: {
              syncState: "verify-failed",
              lastVerifiedAt: nowIso(),
            },
          });
          return {
            currentProject: {
              ...s.currentProject,
              constants: {
                ...(s.currentProject.constants || {}),
                pages: nextPages,
              },
            },
          };
        });
        notify(`Burn failed for Page ${pageId}`, "error");
        return { ok: false, error: e.message };
      }
    },

    burnPendingPages: async (pageIds = null) => {
      const {
        currentProject,
        burnPage,
        notify,
        setOperation,
        updateOperation,
        clearOperation,
      } = get();
      if (!currentProject?.constants) return;

      const pages = (
        pageIds?.length ? pageIds : getPendingBurnPages(currentProject)
      )
        .map(Number)
        .filter((value) => !Number.isNaN(value));

      if (!pages.length) {
        notify("No pending RAM changes to burn", "info");
        return { ok: true, pages: [] };
      }

      const results = { ok: true, pages: [], errors: [] };
      setOperation({
        type: "burn",
        stage: "burn",
        label: "Burning ECU pages",
        current: 0,
        total: pages.length,
        scope: "sync",
      });

      serialService.suspendOutputChannelsPolling();
      try {
        for (let index = 0; index < pages.length; index += 1) {
          const pId = pages[index];
          updateOperation({
            stage: "burn",
            label: `Burning page ${pId}`,
            current: index,
            total: pages.length,
          });

          const result = await burnPage(pId);
          if (!result?.ok) {
            results.ok = false;
            results.errors.push({
              pageId: pId,
              error: result?.error || "Burn failed",
            });
          } else {
            results.pages.push(pId);
          }

          updateOperation({
            stage: "verify",
            label: `Verified page ${pId}`,
            current: index + 1,
            total: pages.length,
          });
          await new Promise((r) => setTimeout(r, 200));
        }
        return results;
      } finally {
        serialService.resumeOutputChannelsPolling();
        clearOperation();
      }
    },

    burnActiveProjectPages: async () => {
      return get().burnPendingPages();
    },

    compareWithECU: async () => {
      const {
        currentProject,
        parsedIni,
        connection,
        readPageFromECU,
        setOperation,
        updateOperation,
        clearOperation,
      } = get();
      if (connection.status !== "connected") return { error: "Not connected" };
      if (!currentProject?.constants || !parsedIni)
        return { error: "No project loaded" };

      const pagesToSync =
        currentProject.ecu?.sync?.activePages || DEFAULT_ACTIVE_PAGES;
      const localSnapshots = currentProject.constants.pages || {};
      const results = {
        matching: [],
        different: [],
        missing: [],
        errors: [],
        pageStates: {},
        pageDiffs: {},
      };
      const pageStateUpdates = {};

      setOperation({
        type: "compare",
        stage: "compare",
        label: "Checking ECU",
        current: 0,
        total: pagesToSync.length,
        scope: "sync",
      });

      serialService.suspendOutputChannelsPolling();
      try {
        for (let index = 0; index < pagesToSync.length; index += 1) {
          const pId = pagesToSync[index];
          if (!parsedIni.constants.pages[pId]) continue;

          updateOperation({
            stage: "compare",
            label: `Checking page ${pId}`,
            current: index,
            total: pagesToSync.length,
          });

          try {
            const localSnapshot =
              localSnapshots[pId] || localSnapshots[String(pId)];
            if (!localSnapshot) {
              results.missing.push(pId);
              results.pageStates[pId] = "missing-local";
              results.pageDiffs[pId] = {
                pageId: pId,
                status: "missing-local",
                summary: "Local snapshot is missing",
              };
              pageStateUpdates[pId] = {
                syncState: "missing-local",
                lastVerifiedAt: nowIso(),
              };
              console.warn("[project] compareWithECU missing local snapshot", {
                pageId: pId,
                status: "missing-local",
              });
              continue;
            }

            const ecuCRC = await serialService.readPageCRC(pId);
            if (localSnapshot.crc32 === ecuCRC) {
              results.matching.push(pId);
              results.pageStates[pId] = "verified";
              pageStateUpdates[pId] = {
                crc32: ecuCRC,
                syncState: "verified",
                lastVerifiedAt: nowIso(),
              };
            } else {
              updateOperation({
                stage: "verify",
                label: `Verifying page ${pId}`,
                current: index,
                total: pagesToSync.length,
              });

              const localBuffer = decodePageSnapshot(localSnapshot);
              const ecuPage = await readPageFromECU(pId);
              const buffersMatch =
                localBuffer.length === ecuPage.buffer.length &&
                Buffer.compare(
                  Buffer.from(localBuffer),
                  Buffer.from(ecuPage.buffer),
                ) === 0;

              if (buffersMatch) {
                results.matching.push(pId);
                results.pageStates[pId] = "verified";
                results.pageDiffs[pId] = {
                  pageId: pId,
                  status: "verified",
                  localCRC: localSnapshot.crc32,
                  ecuCRC,
                  summary: "Raw page matches after readback",
                };
                pageStateUpdates[pId] = {
                  crc32: ecuCRC,
                  syncState: "verified",
                  lastReadAt: nowIso(),
                  lastVerifiedAt: nowIso(),
                };
                console.warn(
                  "[project] compareWithECU healed CRC mismatch from raw page match",
                  {
                    pageId: pId,
                    localCRC: localSnapshot.crc32,
                    ecuCRC,
                    status: "verified",
                  },
                );
              } else {
                const dirtyRegion = findDirtyRegion(localBuffer, ecuPage.buffer);
                results.different.push(pId);
                results.pageStates[pId] = "different";
                results.pageDiffs[pId] = {
                  pageId: pId,
                  status: "different",
                  localCRC: localSnapshot.crc32,
                  ecuCRC,
                  offset: dirtyRegion?.offset ?? 0,
                  length: dirtyRegion?.length ?? ecuPage.buffer.length,
                  localHex: formatDiffHex(dirtyRegion?.before),
                  ecuHex: formatDiffHex(dirtyRegion?.after),
                  summary: dirtyRegion
                    ? `${dirtyRegion.length} byte(s) differ starting at offset ${dirtyRegion.offset}`
                    : "Raw page differs",
                };
                pageStateUpdates[pId] = {
                  syncState: "different",
                  lastVerifiedAt: nowIso(),
                };
                console.warn("[project] compareWithECU page differs", {
                  pageId: pId,
                  localCRC: localSnapshot.crc32,
                  ecuCRC,
                  status: "different",
                });
              }
            }
          } catch (e) {
            results.errors.push(pId);
            results.pageStates[pId] = "unknown";
            results.pageDiffs[pId] = {
              pageId: pId,
              status: "unknown",
              summary: e?.message || String(e),
            };
            pageStateUpdates[pId] = {
              syncState: "unknown",
              lastVerifiedAt: nowIso(),
            };
            console.error("[project] compareWithECU page error", {
              pageId: pId,
              status: "unknown",
              error: e?.message || String(e),
            });
          }

          updateOperation({
            current: index + 1,
            total: pagesToSync.length,
          });
        }

        set((s) => {
          const nextPages = updatePageSnapshotStates(
            s.currentProject,
            pageStateUpdates,
          );
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

        console.log("[project] compareWithECU summary", {
          matching: results.matching,
          different: results.different,
          missing: results.missing,
          errors: results.errors,
          pageStates: results.pageStates,
        });

        return results;
      } finally {
        serialService.resumeOutputChannelsPolling();
        clearOperation();
      }
    },

    uploadToECU: async (pages = null) => {
      const { currentProject, connection, notify, syncPagesToECU } = get();
      if (connection.status !== "connected") {
        return { ok: false, error: "Not connected" };
      }

      const decodedPages = getDecodedPages(currentProject?.constants);
      const targetPages = pages || Object.keys(decodedPages).map(Number);

      try {
        notify(`Uploading ${targetPages.length} pages to ECU...`, "info");
        return await syncPagesToECU(targetPages, { burn: true });
      } catch (err) {
        console.error("[ECU Sync] Upload failed:", err);
        return { ok: false, error: err.message };
      }
    },

    syncAllFromECU: async () => {
      const {
        parsedIni,
        readPageFromECU,
        connection,
        notify,
        setOperation,
        updateOperation,
        clearOperation,
      } = get();
      if (connection.status !== "connected") {
        notify("Not connected to ECU", "error");
        return;
      }

      notify("Synchronizing with ECU...", "info");

      const pagesToSync = DEFAULT_ACTIVE_PAGES;
      const decodedPages = {};
      const pageSnapshots = {};

      serialService.suspendOutputChannelsPolling();
      try {
        setOperation({
          type: "pull",
          stage: "read",
          label: "Pulling from ECU",
          current: 0,
          total: pagesToSync.length,
          scope: "sync",
        });

        for (let index = 0; index < pagesToSync.length; index += 1) {
          const pId = pagesToSync[index];
          if (parsedIni.constants.pages[pId]) {
            updateOperation({
              stage: "read",
              label: `Reading page ${pId}`,
              current: index,
              total: pagesToSync.length,
            });
            const pageResult = await readPageFromECU(pId);

            updateOperation({
              stage: "verify",
              label: `Checking page ${pId}`,
              current: index,
              total: pagesToSync.length,
            });
            const ecuCRC = await serialService.readPageCRC(pId);
            decodedPages[pId] = pageResult.decoded;
            pageSnapshots[pId] = {
              ...createPageSnapshot({
                pageId: pId,
                size: pageResult.buffer.length,
                buffer: pageResult.buffer,
                source: "ecu-read",
                syncState: "verified",
                lastReadAt: nowIso(),
                lastVerifiedAt: nowIso(),
              }),
              crc32: ecuCRC,
            };
            updateOperation({
              current: index + 1,
              total: pagesToSync.length,
            });
            await new Promise((r) => setTimeout(r, 100));
          }
        }

        const refreshedTables = buildDisplayTablesFromDecodedPages(
          parsedIni,
          {
            ...(get().currentProject?.constants?.decodedPages || {}),
            ...decodedPages,
          },
          get().tables,
        );

        try {
          const ve2Def = resolveRuntimeTable(parsedIni, "ve2");
          const ve2Page = decodedPages?.[ve2Def.page];
          const ve2Table = ve2Page
            ? readRuntimeTableFromDecodedPage(ve2Page, ve2Def)
            : null;
          if (ve2Table) {
            console.log("[ECU Sync] VE2 snapshot", {
              rawHead: ve2Table.rawValues.slice(0, 16),
              rawTail: ve2Table.rawValues.slice(-16),
              rpmAxis: ve2Table.rawRpmAxis,
              loadAxis: ve2Table.rawLoadAxis,
            });
          }
        } catch (error) {
          console.warn("[ECU Sync] Failed to inspect VE2 snapshot", error);
        }

        set((s) => ({
          currentProject: {
            ...s.currentProject,
            ecu: {
              ...s.currentProject.ecu,
              sync: {
                ...s.currentProject.ecu.sync,
                state: deriveProjectSyncState(
                  {
                    pages: {
                      ...(s.currentProject.constants?.pages || {}),
                      ...pageSnapshots,
                    },
                  },
                  s.currentProject.ecu.sync.activePages,
                ),
                lastSyncAt: nowIso(),
              },
            },
            constants: {
              pages: {
                ...(s.currentProject.constants?.pages || {}),
                ...pageSnapshots,
              },
              decodedPages: {
                ...(s.currentProject.constants?.decodedPages || {}),
                ...decodedPages,
              },
            },
          },
          tables: refreshedTables,
        }));

        notify("ECU Data Synchronized", "success");
        console.log("[ECU Sync] Synchronization complete", {
          pages: Object.keys(pageSnapshots).map(Number),
        });
      } catch (e) {
        console.error("[ECU Sync] Failed:", e);
        notify(`Sync Failed: ${e}`, "error");
      } finally {
        serialService.resumeOutputChannelsPolling();
        clearOperation();
      }
    },
  };
}
