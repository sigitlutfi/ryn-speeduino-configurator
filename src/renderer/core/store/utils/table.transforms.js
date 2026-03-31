// Table transformation and display utilities

import {
  RUNTIME_PROFILE_TABLE_DEFS,
  readRuntimeTableFromDecodedPage,
  resolveRuntimeTable,
} from "../../../../shared/protocol/runtime-tables.js";
import { INITIAL_TABLES } from "../tableSlice.js";

export function matrixFromFlatValues(flatValues = [], rows = 16, cols = 16) {
  const matrix = [];
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    matrix.push(flatValues.slice(rowIndex * cols, (rowIndex + 1) * cols));
  }
  return matrix;
}

export function buildDisplayTablesFromDecodedPages(
  parsedIni,
  decodedPages = {},
  baseTables = INITIAL_TABLES,
) {
  const nextTables = { ...INITIAL_TABLES, ...(baseTables || {}) };
  if (!parsedIni || !decodedPages) return nextTables;

  for (const definition of Object.values(RUNTIME_PROFILE_TABLE_DEFS)) {
    try {
      const tableDef = resolveRuntimeTable(parsedIni, definition.key);
      const decodedPage = decodedPages?.[tableDef.page];
      if (!decodedPage) continue;

      const runtimeTable = readRuntimeTableFromDecodedPage(decodedPage, tableDef);
      nextTables[definition.storeKey] = {
        values: runtimeTable.displayValues,
        rpmAxis: runtimeTable.displayRpmAxis,
        loadAxis: runtimeTable.displayLoadAxis,
      };
    } catch (error) {
      console.warn(
        `[project] Failed to build display table '${definition.key}' from ECU data:`,
        error,
      );
    }
  }

  return nextTables;
}

export function createNeutralRuntimeTablePreset(tableDef, baselineTable = null, fillValue = 100) {
  const totalCells = Math.max(1, (tableDef?.rows || 16) * (tableDef?.cols || 16));
  const rawValues = Array(totalCells).fill(fillValue);

  return {
    key: tableDef.logicalName,
    label: tableDef.label,
    tableId: tableDef.tableId,
    page: tableDef.page,
    xBinsVar: tableDef.xBinsVar,
    yBinsVar: tableDef.yBinsVar,
    zBinsVar: tableDef.zBinsVar,
    rows: tableDef.rows,
    cols: tableDef.cols,
    operation: "fill",
    source: "ve2-base",
    value: fillValue,
    rawValues,
    rawRpmAxis: Array.from(baselineTable?.rawRpmAxis || []),
    rawLoadAxis: Array.from(baselineTable?.rawLoadAxis || []),
    displayValues: matrixFromFlatValues(rawValues, tableDef.rows, tableDef.cols),
    displayRpmAxis: Array.from(baselineTable?.displayRpmAxis || []),
    displayLoadAxis: Array.from(baselineTable?.displayLoadAxis || []),
  };
}

export function summarizeAppliedRuntimeTable(table) {
  const rawValues = Array.from(table?.rawValues || []);
  const uniqueValues = Array.from(new Set(rawValues));

  return {
    key: table.key,
    operation: table.operation,
    source: table.source,
    changedCells: table.changedCells ?? rawValues.length,
    axesChanged: !!table.axesChanged,
    summary:
      uniqueValues.length === 1 && rawValues.length > 0
        ? `flat ${uniqueValues[0]}`
        : `${rawValues.length} cells`,
  };
}

export function summarizeExpectedActualTableDiff(expectedTable, actualTable) {
  const expectedValues = Array.from(expectedTable?.rawValues || []);
  const actualValues = Array.from(actualTable?.rawValues || []);
  const expectedRpm = Array.from(expectedTable?.rawRpmAxis || []);
  const actualRpm = Array.from(actualTable?.rawRpmAxis || []);
  const expectedLoad = Array.from(expectedTable?.rawLoadAxis || []);
  const actualLoad = Array.from(actualTable?.rawLoadAxis || []);

  let firstValueMismatch = -1;
  const valueSize = Math.max(expectedValues.length, actualValues.length);
  for (let index = 0; index < valueSize; index += 1) {
    if (expectedValues[index] !== actualValues[index]) {
      firstValueMismatch = index;
      break;
    }
  }

  let firstRpmMismatch = -1;
  const rpmSize = Math.max(expectedRpm.length, actualRpm.length);
  for (let index = 0; index < rpmSize; index += 1) {
    if (expectedRpm[index] !== actualRpm[index]) {
      firstRpmMismatch = index;
      break;
    }
  }

  let firstLoadMismatch = -1;
  const loadSize = Math.max(expectedLoad.length, actualLoad.length);
  for (let index = 0; index < loadSize; index += 1) {
    if (expectedLoad[index] !== actualLoad[index]) {
      firstLoadMismatch = index;
      break;
    }
  }

  return {
    expectedLengths: {
      values: expectedValues.length,
      rpm: expectedRpm.length,
      load: expectedLoad.length,
    },
    actualLengths: {
      values: actualValues.length,
      rpm: actualRpm.length,
      load: actualLoad.length,
    },
    firstValueMismatch,
    firstRpmMismatch,
    firstLoadMismatch,
    expectedAtMismatch:
      firstValueMismatch >= 0 ? expectedValues[firstValueMismatch] : null,
    actualAtMismatch:
      firstValueMismatch >= 0 ? actualValues[firstValueMismatch] : null,
  };
}
