import { Buffer } from 'buffer'
import { encodeDriveConfig } from '../../../shared/protocol/drive-modes.js'
import { createPageSnapshot } from '../../../shared/protocol/page-cache.js'
import { parsePage } from '../../../shared/protocol/binary-parser.js'
import { getVarMetadata } from "../../../shared/ini-parser.js";
import { resolveRuntimeTable } from "../../../shared/protocol/runtime-tables.js";
import { INITIAL_TABLES } from "../../core/store/tableSlice.js";
import { toRaw } from "../shared/utils/normalization.js";

import { createInitializationPages } from "../../../shared/protocol/initialization-pages.js";
import { calculateRequiredFuel, injectionDivider } from "../../../shared/protocol/required-fuel.js";
import { metadataContract } from "../../../shared/protocol/metadata-contract.js";
import { compactTemplate } from '../../../shared/project-format.js';
import { resolveNumericMetadata } from '../../../shared/protocol/ini-numeric.js';
import { CURVE_PRESETS, buildCurvePreset } from '../../../shared/protocol/curve-presets.js';
import { getSupportedBoardChoices, validateBoardSelection } from '../../../shared/protocol/board-pins.js';

export const GENERIC_BASE_TUNE_PROVIDER = {
  id: "ryn-12-1-wasted-spark-v5",
  label: "RYN 12-1 Wasted Spark Base Tune",
  owner: "base-tune/ryn",
};

const BASE_TUNE_SHARED_RPM_AXIS = [
  500, 700, 1000, 1500, 2000, 2500, 3000, 3500,
  4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500,
];

const BASE_TUNE_SHARED_LOAD_AXIS = [
  20, 26, 30, 36, 40, 46, 50, 60,
  66, 70, 76, 80, 86, 90, 96, 100,
];

const BASE_TUNE_SPARK_RPM_AXIS = [
  500, 1000, 1500, 2000, 2500, 3000, 3500, 4000,
  4500, 5000, 5500, 6000, 6500, 7000, 8000, 9000,
];

const BASE_TUNE_SPARK_LOAD_AXIS = [
  10, 16, 20, 26, 30, 36, 40, 46,
  50, 56, 66, 74, 80, 88, 96, 100,
];

const BASE_TUNE_VE_VALUES = [
  [40, 40, 40, 40, 40, 39, 38, 37, 36, 35, 34, 34, 34, 34, 34, 34],
  [41, 41, 42, 43, 43, 42, 41, 40, 40, 40, 48, 49, 50, 51, 51, 50],
  [40, 41, 42, 44, 45, 47, 47, 45, 45, 47, 50, 52, 54, 54, 54, 54],
  [43, 44, 46, 49, 51, 52, 52, 49, 48, 50, 53, 56, 58, 58, 58, 59],
  [47, 48, 51, 53, 56, 57, 56, 54, 53, 54, 57, 60, 61, 62, 62, 63],
  [50, 52, 55, 57, 58, 59, 59, 58, 57, 59, 62, 64, 65, 65, 65, 66],
  [53, 56, 59, 60, 61, 62, 62, 61, 62, 63, 66, 68, 69, 69, 69, 69],
  [56, 59, 62, 65, 64, 65, 67, 65, 65, 67, 70, 71, 72, 72, 72, 72],
  [59, 61, 65, 68, 69, 70, 70, 69, 68, 71, 74, 75, 75, 74, 74, 74],
  [61, 64, 67, 70, 73, 73, 73, 71, 71, 73, 76, 78, 78, 77, 76, 76],
  [63, 66, 70, 74, 77, 77, 75, 73, 73, 76, 79, 80, 81, 80, 79, 79],
  [65, 68, 72, 77, 79, 79, 78, 76, 76, 78, 82, 83, 84, 83, 83, 83],
  [67, 69, 74, 79, 81, 81, 79, 78, 78, 80, 84, 86, 87, 86, 85, 86],
  [69, 71, 75, 80, 81, 81, 80, 79, 79, 82, 85, 88, 90, 89, 87, 87],
  [70, 72, 75, 78, 80, 80, 80, 79, 80, 83, 86, 89, 91, 90, 89, 89],
  [71, 72, 74, 77, 80, 81, 80, 80, 82, 84, 86, 89, 91, 91, 90, 91],
];

const BASE_TUNE_SPARK_VALUES = [
  [17, 18, 19, 20, 21, 24, 25, 27, 28, 29, 30, 31, 32, 32, 33, 34],
  [17, 18, 19, 20, 21, 24, 25, 27, 28, 35, 36, 37, 38, 38, 39, 40],
  [14, 14, 14, 24, 25, 28, 31, 33, 34, 35, 36, 37, 38, 38, 39, 40],
  [14, 14, 14, 24, 25, 28, 31, 33, 34, 34, 36, 37, 37, 37, 38, 39],
  [14, 14, 14, 24, 25, 28, 31, 32, 34, 34, 36, 37, 37, 37, 38, 39],
  [15, 19, 20, 23, 24, 28, 30, 32, 33, 34, 35, 36, 36, 36, 37, 38],
  [15, 19, 22, 23, 24, 27, 30, 31, 32, 33, 34, 35, 36, 36, 37, 38],
  [16, 19, 21, 23, 24, 26, 29, 30, 31, 32, 33, 34, 35, 35, 36, 37],
  [16, 19, 21, 23, 24, 25, 28, 30, 31, 32, 33, 34, 34, 34, 35, 35],
  [16, 20, 21, 23, 24, 25, 28, 29, 30, 31, 32, 33, 33, 33, 34, 34],
  [17, 20, 21, 23, 24, 25, 28, 29, 30, 31, 31, 32, 32, 32, 33, 33],
  [19, 21, 23, 24, 25, 27, 29, 30, 31, 31, 32, 32, 32, 32, 33, 33],
  [20, 22, 24, 26, 27, 29, 31, 32, 32, 32, 33, 33, 33, 33, 34, 34],
  [22, 24, 26, 28, 29, 30, 32, 34, 34, 34, 34, 34, 34, 34, 34, 34],
  [23, 25, 26, 28, 29, 30, 33, 34, 35, 35, 35, 35, 35, 35, 35, 36],
  [22, 26, 26, 28, 29, 30, 32, 34, 34, 34, 34, 34, 34, 35, 34, 35],
];

const BASE_TUNE_AFR_VALUES = [
  [14.7, 14.7, 14.7, 14.7, 15.0, 15.1, 15.1, 14.8, 14.7, 14.7, 14.7, 14.7, 14.7, 14.7, 14.7, 14.7],
  [14.7, 14.7, 14.7, 14.7, 15.0, 15.1, 15.1, 14.8, 14.7, 14.7, 14.7, 14.7, 14.7, 14.0, 14.0, 14.0],
  [14.2, 14.2, 14.2, 14.5, 14.7, 14.7, 14.7, 14.7, 14.7, 14.7, 14.4, 14.0, 14.0, 14.0, 14.0, 14.0],
  [14.2, 14.2, 14.2, 14.5, 14.7, 14.7, 15.0, 15.0, 15.0, 14.7, 14.4, 14.0, 14.0, 14.0, 14.0, 14.0],
  [14.2, 14.2, 14.2, 14.5, 14.7, 14.7, 15.0, 15.0, 15.0, 14.7, 14.4, 14.0, 14.0, 14.0, 14.0, 14.0],
  [14.2, 14.2, 14.2, 14.5, 14.7, 14.7, 15.0, 15.0, 15.0, 14.7, 14.4, 14.0, 14.0, 14.0, 14.0, 14.0],
  [14.2, 14.2, 14.2, 14.5, 14.7, 14.7, 15.0, 15.0, 15.0, 14.7, 14.4, 14.0, 14.0, 14.0, 14.0, 14.0],
  [14.2, 14.2, 14.2, 14.5, 14.7, 14.7, 15.0, 15.0, 15.0, 14.7, 14.4, 14.0, 14.0, 14.0, 14.0, 14.0],
  [14.2, 14.2, 14.2, 14.5, 14.7, 14.7, 14.7, 14.7, 14.7, 14.7, 14.4, 14.0, 14.0, 14.0, 14.0, 14.0],
  [14.2, 14.2, 14.2, 14.5, 14.7, 14.7, 14.7, 14.7, 14.7, 14.7, 14.4, 14.0, 14.0, 14.0, 14.0, 14.0],
  [14.2, 14.2, 14.2, 14.5, 14.6, 14.6, 14.6, 14.6, 14.6, 14.6, 14.4, 14.0, 14.0, 14.0, 14.0, 14.0],
  [14.2, 14.2, 14.2, 14.2, 14.2, 14.2, 14.2, 14.2, 14.2, 14.2, 14.2, 14.2, 14.2, 14.2, 14.2, 14.2],
  [13.9, 13.9, 13.9, 13.9, 13.9, 13.9, 13.9, 13.9, 13.9, 13.9, 13.9, 13.9, 13.9, 13.9, 13.9, 13.9],
  [13.7, 13.7, 13.7, 13.7, 13.7, 13.7, 13.7, 13.7, 13.7, 13.7, 13.7, 13.7, 13.7, 13.7, 13.7, 13.7],
  [13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6],
  [13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6],
];

const BASE_TUNE_TABLES = {
  ve1: {
    values: BASE_TUNE_VE_VALUES,
    rpmAxis: BASE_TUNE_SHARED_RPM_AXIS,
    loadAxis: BASE_TUNE_SHARED_LOAD_AXIS,
  },
  spark1: {
    values: BASE_TUNE_SPARK_VALUES,
    rpmAxis: BASE_TUNE_SPARK_RPM_AXIS,
    loadAxis: BASE_TUNE_SPARK_LOAD_AXIS,
  },
  afr1: {
    values: BASE_TUNE_AFR_VALUES,
    rpmAxis: BASE_TUNE_SHARED_RPM_AXIS,
    loadAxis: BASE_TUNE_SHARED_LOAD_AXIS,
  },
};

function createResult(initBaseTune) {
  return {
    pages: {},
    appliedFields: [],
    baseTuneFields: [],
    warnings: [],
    metadata: {
      providerId: initBaseTune ? GENERIC_BASE_TUNE_PROVIDER.id : null,
      providerOwner: initBaseTune ? GENERIC_BASE_TUNE_PROVIDER.owner : null,
      requested: !!initBaseTune,
      applied: false,
    },
  };
}

function ensurePage(result, pageId) {
  const key = String(pageId);
  if (!result.pages[key]) result.pages[key] = {};
  return result.pages[key];
}

function addWarning(result, message) {
  result.warnings.push(message);
}

function setFieldValue(result, parsedIni, fieldName, value, asBaseTune = false) {
  const meta = getVarMetadata(parsedIni, fieldName);
  if (!meta) {
    addWarning(result, `Field '${fieldName}' is not available in this INI`);
    return false;
  }

  const values = Array.isArray(value) ? value : [value];
  const bits = meta.type === "bits" ? meta.bitRange[1] - meta.bitRange[0] + 1 : Number(meta.dataType?.slice(1));
  const signed = meta.dataType?.startsWith("S") && meta.type !== "bits";
  const low = signed ? -(2 ** (bits - 1)) : 0;
  const high = signed ? 2 ** (bits - 1) - 1 : 2 ** bits - 1;
  if (values.some(v => !Number.isFinite(v) || !Number.isInteger(v) || v < low || v > high)) throw new Error(`Initialization field '${fieldName}' exceeds its INI storage range`);
  if (meta.shape && values.length !== meta.shape.reduce((total, size) => total * size, 1)) throw new Error(`Initialization field '${fieldName}' has invalid dimensions`);
  ensurePage(result, meta.page)[fieldName] = value;
  result.appliedFields.push(fieldName);
  if (asBaseTune) result.baseTuneFields.push(fieldName);
  return true;
}

function setDisplayFieldValue(result, parsedIni, fieldName, value, asBaseTune = false) {
  const meta = getVarMetadata(parsedIni, fieldName);
  if (!meta) {
    addWarning(result, `Field '${fieldName}' is not available in this INI`);
    return false;
  }

  if (!Number.isFinite(value) || (Number.isFinite(meta.lo) && value < meta.lo) || (Number.isFinite(meta.hi) && value > meta.hi)) throw new Error(`Initialization field '${fieldName}' is outside its INI range`);
  return setFieldValue(result, parsedIni, fieldName, toRaw(value, meta), asBaseTune);
}

function findOptionIndex(meta, matchers = []) {
  const options = Array.isArray(meta?.options) ? meta.options : [];
  if (!options.length) return null;

  for (const matcher of matchers) {
    const index = options.findIndex((option) => matcher.test(String(option).trim()));
    if (index >= 0) return index;
  }

  return null;
}

function setEnumByMatchers(result, parsedIni, fieldName, matchers, warningLabel) {
  const meta = getVarMetadata(parsedIni, fieldName);
  if (!meta) {
    addWarning(result, `Field '${fieldName}' is not available in this INI`);
    return false;
  }

  const index = findOptionIndex(meta, matchers);
  if (index === null) {
    addWarning(
      result,
      `No compatible option found for ${warningLabel || fieldName}`,
    );
    return false;
  }

  return setFieldValue(result, parsedIni, fieldName, index, true);
}

function flattenMatrix(matrix = []) {
  return matrix.flatMap((row) => Array.from(row || []));
}

function applyBaseMap(result, parsedIni, logicalName, tableSeed) {
  if (!tableSeed) {
    addWarning(result, `Base map seed for '${logicalName}' is not available`);
    return false;
  }

  let tableDef;
  try {
    tableDef = resolveRuntimeTable(parsedIni, logicalName);
  } catch (error) {
    addWarning(result, error.message);
    return false;
  }

  let applied = false;

  if (tableDef.xBinsVar && Array.isArray(tableSeed.rpmAxis)) {
    applied =
      setFieldValue(
        result,
        parsedIni,
        tableDef.xBinsVar,
        toRaw(tableSeed.rpmAxis, resolveNumericMetadata(tableDef.xMeta, parsedIni, result.pages)),
        true,
      ) ||
      applied;
  }

  if (tableDef.yBinsVar && Array.isArray(tableSeed.loadAxis)) {
    applied =
      setFieldValue(
        result,
        parsedIni,
        tableDef.yBinsVar,
        toRaw(tableSeed.loadAxis, resolveNumericMetadata(tableDef.yMeta, parsedIni, result.pages)),
        true,
      ) ||
      applied;
  }

  if (tableDef.zBinsVar && Array.isArray(tableSeed.values)) {
    applied =
      setFieldValue(
        result,
        parsedIni,
        tableDef.zBinsVar,
        toRaw(flattenMatrix(tableSeed.values), tableDef.zMeta),
        true,
      ) || applied;
  }

  return applied;
}

export function getBoardLayoutChoices(parsedIni) {
  return getSupportedBoardChoices(parsedIni, 'mega2560');
}

export function buildProjectInitialization({
  parsedIni,
  selectedBoardLayout,
  engine = {},
  initBaseTune = false,
}) {
  if (!parsedIni?.constants?.pages) throw new Error("Select a valid firmware INI first");
  const result = createResult(initBaseTune);
  const finish = () => {
    // No sensor readings are invented: TPS endpoints stay uncalibrated. These
    // operational defaults prevent a zero-time ignition cut or flood-clear.
    for (const [name, display] of Object.entries({ dwellLim: 6, tpsflood: 80, SoftRevLim: 6000, hardRevLim: 6500 })) {
      if (getVarMetadata(parsedIni, name)) setDisplayFieldValue(result, parsedIni, name, display, initBaseTune);
    }
    // Curve geometry and neutral/reference values are part of every new project,
    // including manual setup. Starter maps remain an independent choice.
    result.metadata.curves = [];
    for (const definition of CURVE_PRESETS) {
      if (!getVarMetadata(parsedIni, definition.xName) || !getVarMetadata(parsedIni, definition.yName)) continue;
      const curve = buildCurvePreset(parsedIni, definition.yName, result.pages);
      setFieldValue(result, parsedIni, curve.xName, curve.xRaw, initBaseTune);
      setFieldValue(result, parsedIni, curve.yName, curve.yRaw, initBaseTune);
      result.metadata.curves.push({ xName: curve.xName, yName: curve.yName, baseline: curve.kind, calibrationRequired: true, note: curve.note });
    }
    result.metadata.calibrationRequired = true;
    const complete = createInitializationPages(parsedIni, result.pages);
    if (getVarMetadata(parsedIni, 'driveMagicD')) {
      const page = complete.constants.pages[15]
      const buffer = Buffer.from(page.rawData, 'base64')
      encodeDriveConfig().copy(buffer, 106)
      complete.constants.pages[15] = createPageSnapshot({ pageId: 15, size: 256, buffer, source: 'generated', syncState: 'dirty-local' })
      complete.constants.decodedPages[15] = parsePage(buffer, parsedIni.constants.pages[15])
    }
    result.constants = complete.constants;
    result.pages = complete.constants.decodedPages;
    result.metadata.templateVersion = 5;
    result.metadata.operatingSettingsReviewRequired = true;
    result.metadata.contract = compactTemplate({ contract: metadataContract(parsedIni) }).contract;
    result.metadata.defaultFieldCount = complete.defaultCount;
    result.metadata.completePages = Object.keys(complete.constants.pages).map(Number);
    result.metadata.assumptions = initBaseTune ? { trigger: "12-1", spark: "Wasted Spark", polarity: "Going Low", strokes: 4, squirts: 2 } : null;
    return result;
  };
  const boardLayoutMeta = getVarMetadata(parsedIni, "pinLayout");
  const cylinderCountRaw = Number(engine?.cylinders);
  const cylinderCount =
    Number.isFinite(cylinderCountRaw) && cylinderCountRaw > 0
      ? cylinderCountRaw
      : null;
  const boardLayoutValue =
    selectedBoardLayout === "" || selectedBoardLayout === null || selectedBoardLayout === undefined
      ? null
      : Number(selectedBoardLayout);

  if (boardLayoutMeta && Number.isFinite(boardLayoutValue)) {
    setFieldValue(result, parsedIni, "pinLayout", boardLayoutValue);
    result.metadata.boardLayout = {
      value: boardLayoutValue,
      label:
        boardLayoutMeta.options?.[boardLayoutValue] || `Layout ${boardLayoutValue}`,
    };
  } else if (boardLayoutMeta) {
    addWarning(result, "Board layout selection was not applied");
  } else {
    result.metadata.boardLayout = null;
  }

  if (boardLayoutMeta) {
    const error = validateBoardSelection(parsedIni, boardLayoutValue, 'mega2560');
    if (error) throw new Error('Choose a valid board layout. ' + error);
  }

  if (!initBaseTune) {
    result.metadata.applied = false;
    result.metadata.appliedFields = [];
    result.metadata.warningCount = result.warnings.length;
    return finish();
  }

  if (![2, 4, 6, 8].includes(cylinderCount)) throw new Error("RYN wasted spark template supports 2, 4, 6 or 8 cylinders");
  const reqFuel = calculateRequiredFuel({ ...engine, cylinders: cylinderCount });
  const reqMeta = getVarMetadata(parsedIni, "reqFuel");
  if (!reqMeta || reqFuel < 0.1 || reqFuel > (reqMeta.hi ?? 25.5)) throw new Error("Calculated Required Fuel is outside the INI range; check engine and injector inputs");
  setDisplayFieldValue(result, parsedIni, "reqFuel", reqFuel, true);
  setDisplayFieldValue(result, parsedIni, "stoich", Number(engine.stoich ?? 14.7), true);
  setFieldValue(result, parsedIni, "divider", injectionDivider(cylinderCount, 2), true);
  const openingTime = Number(engine.injectorOpenTime);
  if (!Number.isFinite(openingTime) || openingTime < 0.1 || openingTime > 25.5) throw new Error("Provide injector opening time between 0.1 and 25.5 ms");
  setDisplayFieldValue(result, parsedIni, "injOpen", openingTime, true);
  // A neutral placeholder avoids a zero fuel/dead-time multiplier. Injector
  // manufacturer voltage compensation must be supplied during calibration.
  const voltageMeta = getVarMetadata(parsedIni, 'brvBins');
  const correctionMeta = getVarMetadata(parsedIni, 'injBatRates');
  if (!voltageMeta || !correctionMeta) throw new Error('INI is missing injector voltage compensation');
  const voltageCount = voltageMeta.shape?.reduce((a, b) => a * b, 1);
  if (!(voltageCount > 1) || correctionMeta.shape?.reduce((a, b) => a * b, 1) !== voltageCount) throw new Error('INI injector voltage curve dimensions do not match');
  if (!Number.isFinite(voltageMeta.lo) || !Number.isFinite(voltageMeta.hi) || voltageMeta.hi <= voltageMeta.lo ||
    100 < (correctionMeta.lo ?? 0) || 100 > (correctionMeta.hi ?? 255)) throw new Error('INI does not support a neutral injector voltage baseline');
  const voltageAxis = Array.from({ length: voltageCount }, (_, index) => voltageMeta.lo +
    (voltageMeta.hi - voltageMeta.lo) * index / (voltageCount - 1));
  setFieldValue(result, parsedIni, 'brvBins', toRaw(voltageAxis, voltageMeta), true);
  setFieldValue(result, parsedIni, 'injBatRates', toRaw(Array(voltageCount).fill(100), correctionMeta), true);
  result.metadata.injectorVoltageCorrection = 'Neutral 100%; replace with injector calibration data';
  result.metadata.requiredFuelMs = Math.round(reqFuel * 10) / 10;
  setEnumByMatchers(result, parsedIni, "TrigSpeed", [/crank/i], "crank speed trigger");
  setEnumByMatchers(result, parsedIni, "engineType", [/even fire/i], "even fire engine");
  setEnumByMatchers(result, parsedIni, "twoStroke", [/four/i], "four stroke engine");
  if (cylinderCount !== null) {
    setFieldValue(result, parsedIni, "nCylinders", cylinderCount, true);
    setFieldValue(result, parsedIni, "nInjectors", cylinderCount, true);
  } else {
    addWarning(
      result,
      "Cylinder count was not provided, so matching ECU counts were skipped",
    );
  }

  setEnumByMatchers(
    result,
    parsedIni,
    "algorithm",
    [/^map$/i, /speed density/i],
    "fuel algorithm",
  );
  setEnumByMatchers(
    result,
    parsedIni,
    "ignAlgorithm",
    [/^map$/i, /speed density/i],
    "ignition load algorithm",
  );

  setEnumByMatchers(
    result,
    parsedIni,
    "injLayout",
    [/^paired$/i, /^simultaneous$/i, /^batch$/i, /paired/i, /simultaneous/i, /batch/i],
    "injector layout",
  );
  setEnumByMatchers(
    result,
    parsedIni,
    "injType",
    [/^port$/i, /port injector/i, /port/i],
    "injection type",
  );

  setEnumByMatchers(
    result,
    parsedIni,
    "TrigPattern",
    [/^Missing Tooth$/i],
    "trigger pattern",
  );
  setEnumByMatchers(
    result,
    parsedIni,
    "trigPatternSec",
    [/^Single tooth cam$/i],
    "secondary trigger pattern",
  );
  setEnumByMatchers(
    result,
    parsedIni,
    "PollLevelPol",
    [/^Low$/i],
    "poll level polarity",
  );
  setEnumByMatchers(
    result,
    parsedIni,
    "sparkMode",
    [/^Wasted Spark$/i],
    "spark mode",
  );
  setEnumByMatchers(
    result,
    parsedIni,
    "TrigFilter",
    [/^Weak$/i],
    "trigger filter",
  );
  setEnumByMatchers(
    result,
    parsedIni,
    "perToothIgn",
    [/^Yes$/i],
    "per tooth ignition",
  );
  setEnumByMatchers(
    result,
    parsedIni,
    "useDwellLim",
    [/^On$/i],
    "overdwell protection",
  );
  setEnumByMatchers(
    result,
    parsedIni,
    "IgInv",
    [/^Going Low$/i],
    "spark output trigger",
  );

  setFieldValue(result, parsedIni, "numTeeth", 12, true);
  setFieldValue(result, parsedIni, "missingTeeth", 1, true);
  setDisplayFieldValue(result, parsedIni, "crankRPM", 400, true);
  setDisplayFieldValue(result, parsedIni, "dwellcrank", 4.5, true);
  setDisplayFieldValue(result, parsedIni, "dwellrun", 3.0, true);

  applyBaseMap(result, parsedIni, "ve1", BASE_TUNE_TABLES.ve1 || INITIAL_TABLES.ve);
  applyBaseMap(result, parsedIni, "spark1", BASE_TUNE_TABLES.spark1 || INITIAL_TABLES.ign);
  const stoich = Number(engine.stoich ?? 14.7);
  applyBaseMap(result, parsedIni, "afr1", { ...BASE_TUNE_TABLES.afr1, values: BASE_TUNE_AFR_VALUES.map(row => row.map(value => value * stoich / 14.7)) });
  applyBaseMap(result, parsedIni, "ve2", { ...BASE_TUNE_TABLES.ve1, values: Array.from({ length: 16 }, () => Array(16).fill(100)) });
  applyBaseMap(result, parsedIni, "spark2", { ...BASE_TUNE_TABLES.spark1, values: Array.from({ length: 16 }, () => Array(16).fill(0)) });
  for (const name of ["fuel2Mode", "spark2Mode", "rumbleIdleEnabled", "alsEnabled", "rollingPopBangEnabled", "pitLimiterEnabled"]) {
    setFieldValue(result, parsedIni, name, 0, true);
  }


  result.metadata.applied = result.baseTuneFields.length > 0;
  result.metadata.appliedFields = result.baseTuneFields;
  result.metadata.warningCount = result.warnings.length;
  return finish();
}
