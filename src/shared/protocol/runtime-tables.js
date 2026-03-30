import { getTableMetadata, getVarMetadata } from "../ini-parser.js";

export const RUNTIME_PROFILE_TABLE_DEFS = {
  ve1: {
    key: "ve1",
    label: "VE1",
    tableId: "veTable1Tbl",
    storeKey: "ve",
  },
  ve2: {
    key: "ve2",
    label: "VE2",
    tableId: "fuelTable2Tbl",
    storeKey: "ve2",
  },
  spark1: {
    key: "spark1",
    label: "Spark1",
    tableId: "sparkTbl",
    storeKey: "ign",
  },
  spark2: {
    key: "spark2",
    label: "Spark2",
    tableId: "spark2Tbl",
    storeKey: "ign2",
  },
  afr1: {
    key: "afr1",
    label: "AFR1",
    tableId: "afrTable1Tbl",
    storeKey: "afr",
  },
};

function clampValue(value, meta) {
  if (!meta) return value;
  let next = value;
  if (Number.isFinite(meta.lo)) next = Math.max(meta.lo, next);
  if (Number.isFinite(meta.hi)) next = Math.min(meta.hi, next);
  return next;
}

function roundDisplayValue(value, digits = 0) {
  return Number.parseFloat(Number(value).toFixed(digits));
}

function toDisplayValue(raw, meta) {
  if (raw === null || raw === undefined || !meta) return raw;
  const scale = meta.scale ?? 1;
  const offset = meta.translate ?? 0;
  const digits = meta.digits ?? 0;
  return roundDisplayValue(raw * scale + offset, digits);
}

function toRawValue(display, meta) {
  if (display === null || display === undefined || !meta) return display;
  const scale = meta.scale ?? 1;
  const offset = meta.translate ?? 0;
  const safeScale = scale === 0 ? 1 : scale;
  return Math.round((display - offset) / safeScale);
}

function arrayToDisplay(rawValues = [], meta) {
  return Array.from(rawValues || []).map((value) => toDisplayValue(value, meta));
}

function arrayToRaw(displayValues = [], meta) {
  return Array.from(displayValues || []).map((value) => toRawValue(value, meta));
}

function matrixFromFlat(flatValues = [], rows = 16, cols = 16) {
  const flat = Array.from(flatValues || []);
  const matrix = [];
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    matrix.push(flat.slice(rowIndex * cols, (rowIndex + 1) * cols));
  }
  return matrix;
}

function flatFromMatrix(matrix = []) {
  return matrix.flatMap((row) => Array.from(row || []));
}

function arraysEqual(left = [], right = []) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }

  return true;
}

export function resolveRuntimeTable(parsedIni, logicalName) {
  const definition =
    RUNTIME_PROFILE_TABLE_DEFS[logicalName] ||
    Object.values(RUNTIME_PROFILE_TABLE_DEFS).find(
      (candidate) => candidate.tableId === logicalName,
    );

  if (!definition) {
    throw new Error(`Unknown runtime table '${logicalName}'`);
  }

  const table = getTableMetadata(parsedIni, definition.tableId);
  if (!table) {
    throw new Error(`Missing INI metadata for runtime table '${logicalName}'`);
  }

  const xMeta = table.xBinsVar ? getVarMetadata(parsedIni, table.xBinsVar) : null;
  const yMeta = table.yBinsVar ? getVarMetadata(parsedIni, table.yBinsVar) : null;
  const zMeta = table.zBinsVar ? getVarMetadata(parsedIni, table.zBinsVar) : null;

  if (!zMeta) {
    throw new Error(`Missing zBins metadata for runtime table '${logicalName}'`);
  }

  const [rows = 16, cols = 16] = zMeta.shape || [16, 16];

  return {
    ...definition,
    ...table,
    logicalName: definition.key,
    xMeta,
    yMeta,
    zMeta,
    rows,
    cols,
  };
}

export function readRuntimeTableFromDecodedPage(decodedPage = {}, tableDef) {
  if (!decodedPage || !tableDef) {
    throw new Error("Runtime table page data is unavailable");
  }

  const rawValues = Array.from(decodedPage[tableDef.zBinsVar] || []);
  const rawRpmAxis = Array.from(decodedPage[tableDef.xBinsVar] || []);
  const rawLoadAxis = Array.from(decodedPage[tableDef.yBinsVar] || []);

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
    rawValues,
    rawRpmAxis,
    rawLoadAxis,
    displayValues: matrixFromFlat(
      arrayToDisplay(rawValues, tableDef.zMeta),
      tableDef.rows,
      tableDef.cols,
    ),
    displayRpmAxis: arrayToDisplay(rawRpmAxis, tableDef.xMeta),
    displayLoadAxis: arrayToDisplay(rawLoadAxis, tableDef.yMeta),
  };
}

export function buildRuntimeTableOverlay(
  sourceTable,
  targetTableDef,
  overlay = {},
  targetBaselineTable = null,
) {
  const operation = overlay.operation || "copy";

  if (!sourceTable && operation !== "fill") {
    throw new Error(`Missing source table '${overlay.source || "unknown"}'`);
  }

  if (!targetTableDef) {
    throw new Error(`Missing target table '${overlay.target || "unknown"}'`);
  }

  const multiplier = Number.isFinite(overlay.value) ? overlay.value : 100;
  const fillValue = Number.isFinite(overlay.value) ? overlay.value : 100;
  const templateValues =
    sourceTable?.displayValues ||
    targetBaselineTable?.displayValues ||
    matrixFromFlat([], targetTableDef.rows, targetTableDef.cols);

  const nextDisplayValues = templateValues.map((row) =>
    row.map((cell) => {
      let nextCell = cell;

      if (operation === "scale_percent") {
        nextCell = (cell * multiplier) / 100;
      } else if (operation === "fill") {
        nextCell = fillValue;
      } else if (operation !== "copy") {
        throw new Error(`Unsupported runtime table operation '${operation}'`);
      }

      nextCell = clampValue(nextCell, targetTableDef.zMeta);
      return roundDisplayValue(nextCell, targetTableDef.zMeta?.digits ?? 0);
    }),
  );

  const rawValues = flatFromMatrix(nextDisplayValues).map((value) =>
    toRawValue(value, targetTableDef.zMeta),
  );

  const baselineRpmAxis = Array.from(
    targetBaselineTable?.rawRpmAxis || sourceTable?.rawRpmAxis || [],
  );
  const baselineLoadAxis = Array.from(
    targetBaselineTable?.rawLoadAxis || sourceTable?.rawLoadAxis || [],
  );
  const displayRpmAxis = targetBaselineTable?.displayRpmAxis
    ? [...targetBaselineTable.displayRpmAxis]
    : arrayToDisplay(baselineRpmAxis, targetTableDef.xMeta);
  const displayLoadAxis = targetBaselineTable?.displayLoadAxis
    ? [...targetBaselineTable.displayLoadAxis]
    : arrayToDisplay(baselineLoadAxis, targetTableDef.yMeta);

  return {
    key: targetTableDef.logicalName,
    label: targetTableDef.label,
    tableId: targetTableDef.tableId,
    page: targetTableDef.page,
    xBinsVar: targetTableDef.xBinsVar,
    yBinsVar: targetTableDef.yBinsVar,
    zBinsVar: targetTableDef.zBinsVar,
    rows: targetTableDef.rows,
    cols: targetTableDef.cols,
    operation,
    source: overlay.source,
    value: overlay.value ?? null,
    rawValues,
    rawRpmAxis: baselineRpmAxis,
    rawLoadAxis: baselineLoadAxis,
    displayValues: nextDisplayValues,
    displayRpmAxis,
    displayLoadAxis,
  };
}

export function summarizeRuntimeTableDiff(previousTable, nextTable) {
  const previousValues = Array.from(previousTable?.rawValues || []);
  const nextValues = Array.from(nextTable?.rawValues || []);
  const size = Math.max(previousValues.length, nextValues.length);

  let changedCells = 0;
  for (let index = 0; index < size; index += 1) {
    if (previousValues[index] !== nextValues[index]) changedCells += 1;
  }

  const axesChanged =
    !arraysEqual(previousTable?.rawRpmAxis, nextTable?.rawRpmAxis) ||
    !arraysEqual(previousTable?.rawLoadAxis, nextTable?.rawLoadAxis);

  return {
    changedCells,
    axesChanged,
    changed: changedCells > 0 || axesChanged,
  };
}

export function runtimeTablesEqual(leftTable, rightTable) {
  return (
    arraysEqual(leftTable?.rawValues, rightTable?.rawValues) &&
    arraysEqual(leftTable?.rawRpmAxis, rightTable?.rawRpmAxis) &&
    arraysEqual(leftTable?.rawLoadAxis, rightTable?.rawLoadAxis)
  );
}
