import { useEffect, useMemo, useCallback } from "react";
import { useStore } from "../../../core/store.js";
import { getTableMetadata, getVarMetadata } from "../../../../shared/ini-parser.js";
import { getDecodedPage } from "../utils/projectConstants.js";

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
  const updateConstants = useStore((s) => s.updateConstants);
  const writePagesToRAM = useStore((s) => s.writePagesToRAM);
  const burnPendingPages = useStore((s) => s.burnPendingPages);
  const saveProject = useStore((s) => s.saveProject);
  const notify = useStore((s) => s.notify);
  const connection = useStore((s) => s.connection);

  const meta = useMemo(() => getTableMetadata(parsedIni, iniTableId), [parsedIni, iniTableId]);

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

          const needsScaling = (scaling.scale !== 1 && val > 40 && val > scaling.scale * 100);
          if (needsScaling || scaling.scale === 1) {
            const displayDigits = options.prec !== undefined ? options.prec : scaling.digits;
            return parseFloat((val * scaling.scale + scaling.offset).toFixed(displayDigits));
          }
          return val; 
        });
        matrix.push(row);
      }

      const xData = pageData[meta.xBinsVar];
      const yData = pageData[meta.yBinsVar];

      updateTable(storeKey, { 
         values: matrix, 
         rpmAxis: xData || tableState?.rpmAxis, 
         loadAxis: yData || tableState?.loadAxis 
      });
    }
  }, [meta, constants, scaling, storeKey, options.transform?.toDisplay]);

  // Denormalization & Save
  const handleSave = useCallback(async (isBurn = false) => {
    if (!meta) return;
    
    const rawValues = tableState.values.flat().map(v => {
        if (options.transform?.toRaw) {
            return options.transform.toRaw(v, scaling);
        }
        return Math.round((v - scaling.offset) / scaling.scale);
    });

    const pageData = getDecodedPage(constants, meta.page);

    await updateConstants({
      [meta.page]: {
        ...pageData,
        [meta.zBinsVar]: rawValues,
      },
    });

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
  }, [meta, tableState?.values, scaling, constants, updateConstants, writePagesToRAM, burnPendingPages, saveProject, notify, options.transform?.toRaw, connection.status]);

  const isDirty = useMemo(() => {
    if (!meta || !constants) return false;
    const original = getDecodedPage(constants, meta.page)?.[meta.zBinsVar];
    if (!original) return false;
    const currentRaw = tableState.values.flat().map(v => {
        if (options.transform?.toRaw) return options.transform.toRaw(v, scaling);
        return Math.round((v - scaling.offset) / scaling.scale);
    });
    return JSON.stringify(currentRaw) !== JSON.stringify(Array.from(original));
  }, [tableState?.values, constants, meta, scaling, options.transform?.toRaw]);

  return {
    values: tableState?.values || [],
    rpmAxis: tableState?.rpmAxis || [],
    loadAxis: tableState?.loadAxis || [],
    meta,
    scaling,
    update: (newMatrix) => updateTable(storeKey, newMatrix),
    handleSave,
    isDirty
  };
}
