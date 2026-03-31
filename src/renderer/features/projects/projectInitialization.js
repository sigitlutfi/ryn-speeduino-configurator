import { getVarMetadata } from "../../../shared/ini-parser.js";

export const GENERIC_BASE_TUNE_PROVIDER = {
  id: "speeduino-generic-minimal-v1",
  label: "Speeduino Generic Minimal Base Tune",
  owner: "base-tune/core",
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

  ensurePage(result, meta.page)[fieldName] = value;
  result.appliedFields.push(fieldName);
  if (asBaseTune) result.baseTuneFields.push(fieldName);
  return true;
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

export function getBoardLayoutChoices(parsedIni) {
  const meta = getVarMetadata(parsedIni, "pinLayout");
  const options = Array.isArray(meta?.options) ? meta.options : [];

  return options
    .map((label, index) => ({
      value: index,
      label,
    }))
    .filter(
      (choice) =>
        choice.label &&
        !/^invalid$/i.test(String(choice.label).trim()) &&
        !/^unused$/i.test(String(choice.label).trim()),
    );
}

export function buildProjectInitialization({
  parsedIni,
  selectedBoardLayout,
  engine = {},
  initBaseTune = false,
}) {
  const result = createResult(initBaseTune);
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

  if (!initBaseTune) {
    result.metadata.applied = false;
    result.metadata.appliedFields = [];
    result.metadata.warningCount = result.warnings.length;
    return result;
  }

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

  if (cylinderCount === 1) {
    setEnumByMatchers(
      result,
      parsedIni,
      "sparkMode",
      [/^single$/i, /^single coil$/i, /single/i],
      "spark mode",
    );
  } else if (cylinderCount !== null) {
    setEnumByMatchers(
      result,
      parsedIni,
      "sparkMode",
      [/^wasted spark$/i, /^wasted$/i, /wasted spark/i, /wasted/i],
      "spark mode",
    );
  } else {
    addWarning(
      result,
      "Cylinder count was not provided, so spark mode was left unchanged",
    );
  }

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

  result.metadata.applied = result.baseTuneFields.length > 0;
  result.metadata.appliedFields = result.baseTuneFields;
  result.metadata.warningCount = result.warnings.length;
  return result;
}
