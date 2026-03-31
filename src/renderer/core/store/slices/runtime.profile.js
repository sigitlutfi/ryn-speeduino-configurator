// Runtime profile apply/rollback operations

import {
  resolveRuntimeField,
  runtimeFieldValuesEqual,
} from "../../../../shared/protocol/runtime-fields.js";
import {
  buildRuntimeTableOverlay,
  readRuntimeTableFromDecodedPage,
  resolveRuntimeTable,
  runtimeTablesEqual,
  summarizeRuntimeTableDiff,
} from "../../../../shared/protocol/runtime-tables.js";
import { DEFAULT_RUNTIME_PROFILE_GUARDS, DEFAULT_RUNTIME_PROFILE_FIELDS } from "../utils/project.constants.js";
import { evaluateRuntimeProfileGuards } from "../utils/runtime.guards.js";
import { nowIso } from "../utils/project.utils.js";
import { getDecodedPages } from "../utils/page.utils.js";
import { summarizeAppliedRuntimeTable, summarizeExpectedActualTableDiff } from "../utils/table.transforms.js";
import {
  createEmptyRuntimeProfileSession,
  mergeRuntimeProfileSession,
  appendRuntimeProfileHistory,
} from "../types/runtime.types.js";

function readRuntimeFieldFromProjectPages(currentProject, field) {
  const decodedPages = getDecodedPages(currentProject?.constants);
  const decodedPage = decodedPages?.[field.page] || decodedPages?.[String(field.page)];

  if (!decodedPage) {
    throw new Error(`Project page ${field.page} is unavailable`);
  }

  if (decodedPage[field.name] !== undefined) return decodedPage[field.name];
  if (decodedPage[field.key] !== undefined) return decodedPage[field.key];

  throw new Error(`Project field '${field.name || field.key}' is unavailable`);
}

export function createRuntimeProfileSlice(set, get) {
  return {
    clearRuntimeProfileSession: (overrides = {}) => {
      set({
        runtimeProfileSession: createEmptyRuntimeProfileSession(overrides),
      });
    },

    exportRuntimeProfileLog: () => {
      const { runtimeProfileSession } = get();
      const history = runtimeProfileSession?.history || [];

      return history
        .map((entry) => {
          const details = Object.entries(entry)
            .filter(([key]) => key !== "at")
            .map(([key, value]) => {
              if (value && typeof value === "object") {
                return `${key}=${JSON.stringify(value)}`;
              }
              return `${key}=${value}`;
            })
            .join(" ");

          return `[${entry.at}] ${details}`.trim();
        })
        .join("\n");
    },

    getRuntimeProfileGuardStatus: (requirements = {}) => {
      const { realtime, connection } = get();
      const mergedRequirements = {
        ...DEFAULT_RUNTIME_PROFILE_GUARDS,
        ...requirements,
      };

      return {
        connected: connection.status === "connected",
        ...evaluateRuntimeProfileGuards(realtime, mergedRequirements),
        requirements: mergedRequirements,
      };
    },

    captureRuntimeProfileTableBaseline: async (tableNames = []) => {
      const {
        parsedIni,
        readRuntimeTable,
        runtimeProfileSession,
        currentProject,
      } = get();

      if (!parsedIni) {
        throw new Error("No INI loaded");
      }
      if (!currentProject?.constants) {
        throw new Error("No project base is available");
      }

      const targetTables = Array.from(new Set((tableNames || []).filter(Boolean)));
      if (!targetTables.length) {
        throw new Error("No runtime profile tables selected");
      }

      const baselineTables = {};
      const currentTables = {};
      const missing = [];

      for (const tableName of targetTables) {
        try {
          const result = await readRuntimeTable(tableName, { source: "project" });
          baselineTables[tableName] = result;
          currentTables[tableName] = result;
        } catch (error) {
          missing.push({
            table: tableName,
            error: error.message,
          });
        }
      }

      if (missing.length > 0) {
        const failedAt = nowIso();
        const nextSession = mergeRuntimeProfileSession(runtimeProfileSession, {
          state: "Unknown",
          tables: targetTables,
          history: appendRuntimeProfileHistory(runtimeProfileSession, {
            type: "table-baseline-capture-failed",
            missing,
          }),
          lastResult: {
            ok: false,
            type: "table-baseline-capture",
            missing,
            capturedAt: failedAt,
          },
        });
        set({ runtimeProfileSession: nextSession });
        throw new Error(`Table baseline capture failed for ${missing.length} runtime table(s)`);
      }

      const capturedAt = nowIso();
      const nextSession = mergeRuntimeProfileSession(runtimeProfileSession, {
        state: "Base",
        activeProfile: null,
        baselineTables,
        currentTables,
        tables: targetTables,
        capturedAt,
        history: appendRuntimeProfileHistory(runtimeProfileSession, {
          type: "table-baseline-captured",
          tables: targetTables,
          source: "project",
        }),
        lastResult: {
          ok: true,
          type: "table-baseline-capture",
          tableCount: targetTables.length,
          capturedAt,
          source: "project",
        },
      });

      set({ runtimeProfileSession: nextSession });
      return nextSession;
    },

    captureRuntimeProfileBaseline: async (fields = DEFAULT_RUNTIME_PROFILE_FIELDS) => {
      const {
        parsedIni,
        runtimeProfileSession,
        currentProject,
      } = get();

      if (!parsedIni) {
        throw new Error("No INI loaded");
      }
      if (!currentProject?.constants) {
        throw new Error("No project base is available");
      }

      const targetFields = Array.from(new Set((fields || []).filter(Boolean)));
      if (!targetFields.length) {
        throw new Error("No runtime profile fields selected");
      }

      const baseline = {};
      const currentValues = {};
      const missing = [];

      for (const fieldName of targetFields) {
        try {
          const field = resolveRuntimeField(parsedIni, fieldName);
          const value = readRuntimeFieldFromProjectPages(currentProject, field);
          baseline[fieldName] = {
            page: field.page,
            offset: field.offset,
            length: field.length,
            value,
          };
          currentValues[fieldName] = value;
        } catch (error) {
          missing.push({
            field: fieldName,
            error: error.message,
          });
        }
      }

      if (missing.length > 0) {
        const nextSession = mergeRuntimeProfileSession(runtimeProfileSession, {
          state: "Unknown",
          fields: targetFields,
          history: appendRuntimeProfileHistory(runtimeProfileSession, {
            type: "baseline-capture-failed",
            missing,
          }),
          lastResult: {
            ok: false,
            type: "baseline-capture",
            missing,
            capturedAt: nowIso(),
          },
        });
        set({ runtimeProfileSession: nextSession });
        throw new Error(`Baseline capture failed for ${missing.length} runtime field(s)`);
      }

      const capturedAt = nowIso();
      const nextSession = mergeRuntimeProfileSession(runtimeProfileSession, {
        state: "Base",
        activeProfile: null,
        baseline,
        currentValues,
        history: appendRuntimeProfileHistory(runtimeProfileSession, {
          type: "baseline-captured",
          fields: targetFields,
          source: "project",
        }),
        fields: targetFields,
        capturedAt,
        lastResult: {
          ok: true,
          type: "baseline-capture",
          fieldCount: targetFields.length,
          capturedAt,
          source: "project",
        },
      });

      set({ runtimeProfileSession: nextSession });
      return nextSession;
    },

    applyRuntimeProfile: async (profile) => {
      const {
        connection,
        parsedIni,
        realtime,
        runtimeProfileSession,
        captureRuntimeProfileBaseline,
        captureRuntimeProfileTableBaseline,
        readRuntimeTable,
        writeRuntimeTable,
        verifyRuntimeTable,
        writeRuntimeField,
        verifyRuntimeField,
        rollbackRuntimeProfile,
        setOperation,
        updateOperation,
        clearOperation,
        notify,
      } = get();

      if (!profile?.name) {
        throw new Error("Runtime profile must have a name");
      }
      const scalarChanges = Array.isArray(profile.changes) ? profile.changes : [];
      const tableOverlays = Array.isArray(profile.table_overlays)
        ? profile.table_overlays
        : Array.isArray(profile.tableOverlays)
          ? profile.tableOverlays
          : [];

      if (scalarChanges.length === 0 && tableOverlays.length === 0) {
        throw new Error("Runtime profile has no changes");
      }
      if (connection.status !== "connected") {
        throw new Error("Not connected");
      }
      if (!parsedIni) {
        throw new Error("No INI loaded");
      }

      const requirements = {
        ...DEFAULT_RUNTIME_PROFILE_GUARDS,
        ...(profile.apply_requirements || {}),
      };
      const guard = evaluateRuntimeProfileGuards(realtime, requirements);
      if (!guard.ok) {
        const error = new Error(`Unsafe runtime state: ${guard.reasons.join(", ")}`);
        error.reasons = guard.reasons;
        throw error;
      }

      const requiredFields = Array.from(
        new Set(scalarChanges.map((change) => change?.key).filter(Boolean)),
      );
      const requiredTables = Array.from(
        new Set(tableOverlays.map((overlay) => overlay?.target).filter(Boolean)),
      );

      let session = runtimeProfileSession;

      const hasFieldBaseline = requiredFields.every(
        (fieldName) => runtimeProfileSession?.baseline?.[fieldName],
      );
      if (!hasFieldBaseline && requiredFields.length > 0) {
        session = await captureRuntimeProfileBaseline(requiredFields);
      }

      const hasTableBaseline = requiredTables.every(
        (tableName) => session?.baselineTables?.[tableName],
      );
      if (!hasTableBaseline && requiredTables.length > 0) {
        session = await captureRuntimeProfileTableBaseline(requiredTables);
      }

      set({
        runtimeProfileSession: {
          ...session,
          state: "Applying",
          activeProfile: null,
          history: appendRuntimeProfileHistory(session, {
            type: "apply-started",
            profile: profile.name,
            requirements,
            guard: guard.snapshot,
          }),
          lastResult: {
            ok: true,
            type: "apply-started",
            profileName: profile.name,
            startedAt: nowIso(),
          },
        },
      });

      const totalSteps = tableOverlays.length + scalarChanges.length;
      let completedSteps = 0;
      setOperation({
        type: "runtime-profile",
        stage: "apply",
        label: `Applying ${profile.name}`,
        current: 0,
        total: totalSteps > 0 ? totalSteps : null,
        scope: "runtime-profile",
      });

      const appliedTables = [];
      const appliedChanges = [];
      const changedTables = [];
      const noopTables = [];
      const changedFields = [];
      const noopFields = [];

      try {
        for (const overlay of tableOverlays) {
          if (!overlay?.target || !overlay?.source) continue;

          const previousTable =
            get().runtimeProfileSession?.currentTables?.[overlay.target] ||
            session?.baselineTables?.[overlay.target];
          const targetTable = resolveRuntimeTable(parsedIni, overlay.target);
          const sourceTable = overlay.table
            ? null
            : await readRuntimeTable(overlay.source, { source: "project" });
          const nextTable = overlay.table
            ? {
                ...overlay.table,
                key: targetTable.logicalName,
                label: targetTable.label,
                tableId: targetTable.tableId,
                page: targetTable.page,
                xBinsVar: targetTable.xBinsVar,
                yBinsVar: targetTable.yBinsVar,
                zBinsVar: targetTable.zBinsVar,
                rows: targetTable.rows,
                cols: targetTable.cols,
                operation: overlay.operation || overlay.table.operation || "preset",
                source: overlay.source || overlay.table.source || "preset",
                value: overlay.value ?? overlay.table.value ?? null,
                rawValues: Array.from(overlay.table.rawValues || []),
                rawRpmAxis: Array.from(
                  overlay.table.rawRpmAxis || previousTable?.rawRpmAxis || [],
                ),
                rawLoadAxis: Array.from(
                  overlay.table.rawLoadAxis || previousTable?.rawLoadAxis || [],
                ),
                displayValues: overlay.table.displayValues || previousTable?.displayValues || [],
                displayRpmAxis:
                  overlay.table.displayRpmAxis || previousTable?.displayRpmAxis || [],
                displayLoadAxis:
                  overlay.table.displayLoadAxis || previousTable?.displayLoadAxis || [],
              }
            : buildRuntimeTableOverlay(
                sourceTable,
                targetTable,
                overlay,
                previousTable,
              );
          const tableUnchanged = runtimeTablesEqual(previousTable, nextTable);

          if (tableUnchanged) {
            const diff = summarizeRuntimeTableDiff(previousTable, nextTable);
            appliedTables.push({
              ...nextTable,
              changedCells: diff.changedCells,
              axesChanged: diff.axesChanged,
            });

            set({
              runtimeProfileSession: {
                ...get().runtimeProfileSession,
                history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
                  type: "table-noop",
                  profile: profile.name,
                  table: overlay.target,
                  source: overlay.source,
                  operation: overlay.operation || "copy",
                  value: overlay.value ?? null,
                  changedCells: diff.changedCells,
                  axesChanged: diff.axesChanged,
                }),
              },
            });

            noopTables.push(overlay.target);
            completedSteps += 1;
            updateOperation({
              stage: `table-noop:${overlay.target}`,
              label: `${targetTable.label || overlay.target} already matches`,
              current: completedSteps,
              total: totalSteps > 0 ? totalSteps : null,
            });
            continue;
          }

          updateOperation({
            stage: `writing-table:${overlay.target}`,
            label: `Writing ${targetTable.label || overlay.target}`,
            current: completedSteps,
            total: totalSteps > 0 ? totalSteps : null,
          });
          await writeRuntimeTable(overlay.target, nextTable);
          updateOperation({
            stage: `verifying-table:${overlay.target}`,
            label: `Verifying ${targetTable.label || overlay.target}`,
            current: completedSteps,
            total: totalSteps > 0 ? totalSteps : null,
          });
          const verification = await verifyRuntimeTable(overlay.target, nextTable);
          if (!verification.matches) {
            const mismatch = summarizeExpectedActualTableDiff(nextTable, verification);
            set({
              runtimeProfileSession: {
                ...get().runtimeProfileSession,
                history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
                  type: "table-mismatch",
                  profile: profile.name,
                  table: overlay.target,
                  expectedSample: Array.from(nextTable.rawValues || []).slice(0, 8),
                  actualSample: Array.from(verification.rawValues || []).slice(0, 8),
                  expectedAxisSample: {
                    rpm: Array.from(nextTable.rawRpmAxis || []).slice(0, 4),
                    load: Array.from(nextTable.rawLoadAxis || []).slice(0, 4),
                  },
                  actualAxisSample: {
                    rpm: Array.from(verification.rawRpmAxis || []).slice(0, 4),
                    load: Array.from(verification.rawLoadAxis || []).slice(0, 4),
                  },
                  mismatch,
                }),
              },
            });
            throw new Error(`Readback mismatch for ${overlay.target}`);
          }

          const diff = summarizeRuntimeTableDiff(previousTable, nextTable);
          appliedTables.push({
            ...nextTable,
            changedCells: diff.changedCells,
            axesChanged: diff.axesChanged,
          });

          set({
            runtimeProfileSession: {
              ...get().runtimeProfileSession,
              history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
                type: diff.changed ? "table-changed" : "table-noop",
                profile: profile.name,
                table: overlay.target,
                source: overlay.source,
                operation: overlay.operation || "copy",
                changedCells: diff.changedCells,
                axesChanged: diff.axesChanged,
                summary:
                  summarizeAppliedRuntimeTable({
                    ...nextTable,
                    changedCells: diff.changedCells,
                    axesChanged: diff.axesChanged,
                  }).summary,
              }),
            },
          });

          if (diff.changed) {
            changedTables.push(overlay.target);
          } else {
            noopTables.push(overlay.target);
          }

          completedSteps += 1;
          updateOperation({
            stage: `table-complete:${overlay.target}`,
            label: `Applied ${targetTable.label || overlay.target}`,
            current: completedSteps,
            total: totalSteps > 0 ? totalSteps : null,
          });
        }

        for (const change of scalarChanges) {
          if (!change?.key) continue;

          const previousValue =
            get().runtimeProfileSession?.currentValues?.[change.key] ??
            get().runtimeProfileSession?.baseline?.[change.key]?.value;
          const changed = !runtimeFieldValuesEqual(previousValue, change.value);

          if (!changed) {
            set({
              runtimeProfileSession: {
                ...get().runtimeProfileSession,
                history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
                  type: "field-noop",
                  profile: profile.name,
                  field: change.key,
                  value: change.value,
                  previous: previousValue,
                }),
              },
            });

            appliedChanges.push({
              key: change.key,
              value: change.value,
            });
            noopFields.push(change.key);
            completedSteps += 1;
            updateOperation({
              stage: `field-noop:${change.key}`,
              label: `${change.key} already matches`,
              current: completedSteps,
              total: totalSteps > 0 ? totalSteps : null,
            });
            continue;
          }

          updateOperation({
            stage: `writing-field:${change.key}`,
            label: `Applying ${change.key}`,
            current: completedSteps,
            total: totalSteps > 0 ? totalSteps : null,
          });
          await writeRuntimeField(change.key, change.value);
          updateOperation({
            stage: `verifying-field:${change.key}`,
            label: `Verifying ${change.key}`,
            current: completedSteps,
            total: totalSteps > 0 ? totalSteps : null,
          });
          const verification = await verifyRuntimeField(change.key, change.value);
          if (!verification.matches) {
            throw new Error(`Readback mismatch for ${change.key}`);
          }

          set({
            runtimeProfileSession: {
              ...get().runtimeProfileSession,
              history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
                type: changed ? "field-changed" : "field-noop",
                profile: profile.name,
                field: change.key,
                value: change.value,
                previous: previousValue,
              }),
            },
          });

          appliedChanges.push({
            key: change.key,
            value: change.value,
          });

          if (changed) {
            changedFields.push(change.key);
          } else {
            noopFields.push(change.key);
          }

          completedSteps += 1;
          updateOperation({
            stage: `field-complete:${change.key}`,
            label: `Applied ${change.key}`,
            current: completedSteps,
            total: totalSteps > 0 ? totalSteps : null,
          });
        }

        const completedAt = nowIso();
        const nextSession = {
          ...get().runtimeProfileSession,
          state: "ProfileActive",
          activeProfile: profile.name,
          currentTables: {
            ...(get().runtimeProfileSession?.currentTables || {}),
            ...Object.fromEntries(appliedTables.map((table) => [table.key, table])),
          },
          currentValues: {
            ...(get().runtimeProfileSession?.currentValues || {}),
            ...Object.fromEntries(appliedChanges.map((change) => [change.key, change.value])),
          },
          history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
            type: "apply-succeeded",
            profile: profile.name,
            tables: appliedTables.map((table) => summarizeAppliedRuntimeTable(table)),
            changes: appliedChanges,
            changedTables,
            noopTables,
            changedFields,
            noopFields,
          }),
          fields: Array.from(new Set([...(session.fields || []), ...requiredFields])),
          tables: Array.from(new Set([...(session.tables || []), ...requiredTables])),
          lastResult: {
            ok: true,
            type: "apply",
            profileName: profile.name,
            appliedTables: appliedTables.map((table) => summarizeAppliedRuntimeTable(table)),
            appliedChanges,
            changedTables,
            noopTables,
            changedFields,
            noopFields,
            completedAt,
          },
        };

        set({ runtimeProfileSession: nextSession });
        clearOperation();
        notify(`Runtime profile '${profile.name}' applied`, "success", 2500);
        return nextSession;
      } catch (error) {
        let rollbackResult = null;
        try {
          rollbackResult = await rollbackRuntimeProfile({
            tables: appliedTables.map((table) => table.key),
            fields: appliedChanges.map((change) => change.key),
            suppressNotify: true,
          });
        } catch (rollbackError) {
          rollbackResult = {
            ok: false,
            error: rollbackError.message,
          };
        }

        const failedAt = nowIso();
        set({
          runtimeProfileSession: {
            ...get().runtimeProfileSession,
            state: rollbackResult?.ok ? "Base" : "Unknown",
            activeProfile: null,
            history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
              type: "apply-failed",
              profile: profile.name,
              tables: appliedTables.map((table) => table.key),
              changes: appliedChanges,
              error: error.message,
              rollback: rollbackResult,
            }),
            lastResult: {
              ok: false,
              type: "apply",
              profileName: profile.name,
              appliedTables: appliedTables.map((table) => table.key),
              appliedChanges,
              failedAt,
              error: error.message,
              rollback: rollbackResult,
            },
          },
        });

        clearOperation();
        notify(`Runtime profile '${profile.name}' failed`, "error", 4000);
        throw error;
      }
    },

    rollbackRuntimeProfile: async (options = {}) => {
      const {
        connection,
        runtimeProfileSession,
        writeRuntimeTable,
        verifyRuntimeTable,
        writeRuntimeField,
        verifyRuntimeField,
        setOperation,
        updateOperation,
        clearOperation,
        notify,
      } = get();

      if (connection.status !== "connected") {
        throw new Error("Not connected");
      }

      const baseline = runtimeProfileSession?.baseline || {};
      const baselineTables = runtimeProfileSession?.baselineTables || {};
      const targetFields = Array.from(
        new Set(
          (options.fields?.length ? options.fields : runtimeProfileSession?.fields || [])
            .filter((fieldName) => baseline[fieldName]),
        ),
      );
      const targetTables = Array.from(
        new Set(
          (options.tables?.length ? options.tables : runtimeProfileSession?.tables || [])
            .filter((tableName) => baselineTables[tableName]),
        ),
      );

      if (!targetFields.length && !targetTables.length) {
        throw new Error("No runtime profile baseline is available");
      }

      set({
        runtimeProfileSession: {
          ...runtimeProfileSession,
          state: "RollingBack",
          activeProfile: null,
          history: appendRuntimeProfileHistory(runtimeProfileSession, {
            type: "rollback-started",
            fields: targetFields,
            tables: targetTables,
          }),
          lastResult: {
            ok: true,
            type: "rollback-started",
            startedAt: nowIso(),
            fieldCount: targetFields.length,
            tableCount: targetTables.length,
          },
        },
      });

      const totalSteps = targetTables.length + targetFields.length;
      let completedSteps = 0;
      setOperation({
        type: "runtime-profile",
        stage: "rollback",
        label: "Returning to base",
        current: 0,
        total: totalSteps > 0 ? totalSteps : null,
        scope: "runtime-profile",
      });

      const restoredTables = [];
      for (const tableName of targetTables) {
        const targetTable = baselineTables[tableName];
        updateOperation({
          stage: `restoring-table:${tableName}`,
          label: `Restoring ${tableName}`,
          current: completedSteps,
          total: totalSteps > 0 ? totalSteps : null,
        });
        await writeRuntimeTable(tableName, targetTable);
        updateOperation({
          stage: `verifying-table:${tableName}`,
          label: `Verifying ${tableName}`,
          current: completedSteps,
          total: totalSteps > 0 ? totalSteps : null,
        });
        const verification = await verifyRuntimeTable(tableName, targetTable);
        if (!verification.matches) {
          const failedAt = nowIso();
          set({
            runtimeProfileSession: {
              ...get().runtimeProfileSession,
              state: "Unknown",
              activeProfile: null,
              history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
                type: "rollback-failed",
                table: tableName,
                restoredTables,
              }),
              lastResult: {
                ok: false,
                type: "rollback",
                table: tableName,
                restoredTables,
                failedAt,
                error: `Readback mismatch for ${tableName}`,
              },
            },
          });
          clearOperation();
          throw new Error(`Rollback readback mismatch for ${tableName}`);
        }

        restoredTables.push({
          key: tableName,
          changedCells: summarizeRuntimeTableDiff(
            get().runtimeProfileSession?.currentTables?.[tableName],
            targetTable,
          ).changedCells,
        });

        set({
          runtimeProfileSession: {
            ...get().runtimeProfileSession,
            history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
              type: "table-restored",
              table: tableName,
            }),
          },
        });

        completedSteps += 1;
        updateOperation({
          stage: `table-restored:${tableName}`,
          label: `Restored ${tableName}`,
          current: completedSteps,
          total: totalSteps > 0 ? totalSteps : null,
        });
      }

      const restored = [];
      for (const fieldName of targetFields) {
        const targetValue = baseline[fieldName]?.value;
        updateOperation({
          stage: `restoring-field:${fieldName}`,
          label: `Restoring ${fieldName}`,
          current: completedSteps,
          total: totalSteps > 0 ? totalSteps : null,
        });
        await writeRuntimeField(fieldName, targetValue);
        updateOperation({
          stage: `verifying-field:${fieldName}`,
          label: `Verifying ${fieldName}`,
          current: completedSteps,
          total: totalSteps > 0 ? totalSteps : null,
        });
        const verification = await verifyRuntimeField(fieldName, targetValue);
        if (!verification.matches) {
          const failedAt = nowIso();
          set({
            runtimeProfileSession: {
              ...get().runtimeProfileSession,
              state: "Unknown",
              activeProfile: null,
              history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
                type: "rollback-failed",
                field: fieldName,
                restored,
              }),
              lastResult: {
                ok: false,
                type: "rollback",
                field: fieldName,
                restored,
                failedAt,
                error: `Readback mismatch for ${fieldName}`,
              },
            },
          });
          clearOperation();
          throw new Error(`Rollback readback mismatch for ${fieldName}`);
        }

        restored.push({
          key: fieldName,
          value: targetValue,
        });

        set({
          runtimeProfileSession: {
            ...get().runtimeProfileSession,
            history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
              type: "field-restored",
              field: fieldName,
              value: targetValue,
            }),
          },
        });

        completedSteps += 1;
        updateOperation({
          stage: `field-restored:${fieldName}`,
          label: `Restored ${fieldName}`,
          current: completedSteps,
          total: totalSteps > 0 ? totalSteps : null,
        });
      }

      const completedAt = nowIso();
      const nextSession = {
        ...get().runtimeProfileSession,
        state: "Base",
        activeProfile: null,
        currentTables: {
          ...(get().runtimeProfileSession?.currentTables || {}),
          ...Object.fromEntries(
            targetTables.map((tableName) => [tableName, baselineTables[tableName]]),
          ),
        },
        currentValues: Object.fromEntries(
          Object.entries(get().runtimeProfileSession?.baseline || {}).map(([fieldName, entry]) => [
            fieldName,
            entry?.value,
          ]),
        ),
        history: appendRuntimeProfileHistory(get().runtimeProfileSession, {
          type: "rollback-succeeded",
          restoredTables,
          restored,
        }),
        lastResult: {
          ok: true,
          type: "rollback",
          restoredTables,
          restored,
          completedAt,
        },
      };
      set({ runtimeProfileSession: nextSession });
      clearOperation();

      if (!options.suppressNotify) {
        notify("Runtime profile rolled back to base", "success", 2500);
      }

      return {
        ok: true,
        restored,
        session: nextSession,
      };
    },
  };
}
