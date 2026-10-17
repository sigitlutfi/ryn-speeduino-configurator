import { useEffect, useMemo, useCallback, useRef } from "react";
import { useStore } from "../../../core/store.js";
import { getTableMetadata, getVarMetadata } from "../../../../shared/ini-parser.js";
import { getDecodedPage, getDecodedPages } from "../utils/projectConstants.js";
import { resolveNumericMetadata } from '../../../../shared/protocol/ini-numeric.js';
import { toDisplay, toRaw } from "../utils/normalization.js";

function arraysEqual(a = [], b = []) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function matricesEqual(a = [], b = []) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!arraysEqual(a[i], b[i])) return false;
  }
  return true;
}

/**
 * useTableSync Hook
 * 
 * Centralized entity for Normalizing & Denormalizing firmware data.
 * 
 * @param {string} storeKey - Key in tables slice (afr, ve, ign, etc)
 * @param {string} iniTableId - Table name in speeduino.ini (e.g. 'afrTable1Tbl')
 * @param {object} options - Optional { 
 *    transform: { toDisplay: (val, scaling) => v, toRaw: (val, scaling) => v }, 
 *    prec: 1 
 * }
 */
export function useTableSync(storeKey, iniTableId, options = {}) {
  const parsedIni = useStore((s) => s.parsedIni);
  const currentProject = useStore((s) => s.currentProject);
  const constants = currentProject?.constants;
  const tableState = useStore((s) => s.tables[storeKey]);
  
  const updateTable = useStore((s) => s.updateTable);
  const writePagesToRAM = useStore((s) => s.writePagesToRAM);
  const burnPendingPages = useStore((s) => s.burnPendingPages);
  const saveProject = useStore((s) => s.saveProject);
  const notify = useStore((s) => s.notify);
  const connection = useStore((s) => s.connection);
  const tableStateRef = useRef(tableState);

  useEffect(() => {
    tableStateRef.current = tableState;
  }, [tableState]);

  const DIRTY_SYNC_STATES = useMemo(
    () =>
      new Set([
        "dirty-local",
        "write-pending",
        "burn-pending",
        "different",
        "verify-failed",
        "unknown",
      ]),
    [],
  );

  const meta = useMemo(() => getTableMetadata(parsedIni, iniTableId), [parsedIni, iniTableId]);
  const decodedPages = useMemo(() => getDecodedPages(constants, parsedIni), [constants, parsedIni]);
  const xMeta = useMemo(
    () => resolveNumericMetadata(meta?.xBinsVar ? getVarMetadata(parsedIni, meta.xBinsVar) : null, parsedIni, decodedPages),
    [parsedIni, meta?.xBinsVar, decodedPages],
  );
  const yMeta = useMemo(
    () => resolveNumericMetadata(meta?.yBinsVar ? getVarMetadata(parsedIni, meta.yBinsVar) : null, parsedIni, decodedPages),
    [parsedIni, meta?.yBinsVar, decodedPages],
  );

  const scaling = useMemo(() => {
    if (!meta) return { scale: 1, offset: 0, digits: 0 };
    const zDef = getVarMetadata(parsedIni, meta.zBinsVar);
    return {
      scale: zDef?.scale || 1,
      offset: zDef?.translate || 0,
      digits: zDef?.digits || 0,
      shape: zDef?.shape
    };
  }, [meta, parsedIni]);

  const normalizeAxisValues = useCallback((rawValues, axisMeta) => {
    if (!Array.isArray(rawValues)) return rawValues;
    return toDisplay(rawValues, axisMeta) ?? rawValues;
  }, []);

  const denormalizeAxisValues = useCallback((displayValues, axisMeta) => {
    if (!Array.isArray(displayValues)) return displayValues;
    return toRaw(displayValues, axisMeta) ?? displayValues;
  }, []);

  // Normalization (Raw -> Display)
  useEffect(() => {
    if (!meta || !constants) return;

    const pageData = getDecodedPage(constants, meta.page);
    if (!pageData) return;

    const zData = pageData[meta.zBinsVar];
    if (zData && scaling) {
      const flatData = Array.from(zData);
      const [rows, cols] = scaling.shape || [16, 16];
      let matrix = [];
      for (let i = 0; i < rows; i++) {
        const row = flatData.slice(i * cols, (i + 1) * cols).map((val) => {
          // If custom transform provided, use it. Otherwise use INI scaling.
          if (options.transform?.toDisplay) {
            return options.transform.toDisplay(val, scaling);
          }

          const displayDigits = options.prec !== undefined ? options.prec : scaling.digits;
          return parseFloat(((val + scaling.offset) * scaling.scale).toFixed(displayDigits));
        });
        matrix.push(row);
      }

      const xData = pageData[meta.xBinsVar];
      const yData = pageData[meta.yBinsVar];
      const currentTableState = tableStateRef.current || {};
      const nextRpmAxis = xData ? normalizeAxisValues(xData, xMeta) : currentTableState?.rpmAxis;
      const nextLoadAxis = yData ? normalizeAxisValues(yData, yMeta) : currentTableState?.loadAxis;

      const sameValues = matricesEqual(matrix, currentTableState?.values || []);
      const sameRpmAxis = arraysEqual(nextRpmAxis, currentTableState?.rpmAxis || []);
      const sameLoadAxis = arraysEqual(nextLoadAxis, currentTableState?.loadAxis || []);

      if (sameValues && sameRpmAxis && sameLoadAxis) {
        return;
      }

      updateTable(storeKey, {
         values: matrix,
         rpmAxis: nextRpmAxis,
         loadAxis: nextLoadAxis,
      });
    }
  }, [meta, constants, scaling, storeKey, options.transform?.toDisplay, updateTable, normalizeAxisValues, xMeta, yMeta]);

  // Denormalization & Save
  const handleSave = useCallback(async (isBurn = false) => {
    if (!meta) return;
    
    const committed = useStore.getState().applyProjectTableDrafts();
    if (!committed.ok) {
      notify(committed.error, 'error');
      return committed;
    }

    if (connection.status === "connected") {
      const ramResult = await writePagesToRAM([meta.page]);
      if (!ramResult.ok) {
        notify(`ECU RAM Sync Failed: ${ramResult.errors?.[0]?.error || "Unknown error"}`, "error");
        return { ok: false, error: ramResult.errors?.[0]?.error || "ECU RAM sync failed" };
      }

      if (isBurn) {
        const burnResult = await burnPendingPages([meta.page]);
        if (!burnResult.ok) {
          notify(`ECU Burn Failed: ${burnResult.errors?.[0]?.error || "Unknown error"}`, "error");
          return { ok: false, error: burnResult.errors?.[0]?.error || "ECU burn failed" };
        }
      }
    }

    const result = await saveProject();
    if (result.ok) {
      notify(
        isBurn
          ? "RAM write, burn, and project save successful"
          : connection.status === "connected"
            ? "RAM write and project save successful"
            : "Project save successful",
        "success",
      );
    } else {
      notify(`Save Failed: ${result.error}`, "error");
    }
    return result;
  }, [meta, writePagesToRAM, burnPendingPages, saveProject, notify, connection.status]);

  const isDirty = useMemo(() => {
    if (!meta || !constants) return false;

    const pageSnapshot =
      constants?.pages?.[meta.page] || constants?.pages?.[String(meta.page)];
    if (DIRTY_SYNC_STATES.has(pageSnapshot?.syncState)) return true;

    const original = getDecodedPage(constants, meta.page)?.[meta.zBinsVar];
    const originalRpmAxis = getDecodedPage(constants, meta.page)?.[meta.xBinsVar];
    const originalLoadAxis = getDecodedPage(constants, meta.page)?.[meta.yBinsVar];
    if (!original) return false;
    const currentRaw = tableState.values.flat().map(v => {
        if (options.transform?.toRaw) return options.transform.toRaw(v, scaling);
        return Math.round(v / scaling.scale - scaling.offset);
    });
    const currentRawRpmAxis = denormalizeAxisValues(tableState?.rpmAxis || [], xMeta);
    const currentRawLoadAxis = denormalizeAxisValues(tableState?.loadAxis || [], yMeta);
    return (
      JSON.stringify(currentRaw) !== JSON.stringify(Array.from(original)) ||
      JSON.stringify(currentRawRpmAxis) !== JSON.stringify(Array.from(originalRpmAxis || [])) ||
      JSON.stringify(currentRawLoadAxis) !== JSON.stringify(Array.from(originalLoadAxis || []))
    );
  }, [tableState?.values, tableState?.rpmAxis, tableState?.loadAxis, constants, meta, scaling, options.transform?.toRaw, DIRTY_SYNC_STATES, denormalizeAxisValues, xMeta, yMeta]);

  return {
    values: tableState?.values || [],
    rpmAxis: tableState?.rpmAxis || [],
    loadAxis: tableState?.loadAxis || [],
    meta,
    scaling,
    update: (newMatrix) => updateTable(storeKey, newMatrix, true),
    handleSave,
    isDirty
  };
}
