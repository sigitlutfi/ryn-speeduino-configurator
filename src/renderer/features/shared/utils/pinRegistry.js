const FIELD_POLICIES = {
  emappin: {
    activationField: "useEMAP",
    activationMode: "truthy",
    allowZeroPin: true,
  },
  fuelpressurepin: {
    activationField: "fuelPressureEnable",
    activationMode: "truthy",
    allowZeroPin: true,
  },
  oilpressurepin: {
    activationField: "oilPressureEnable",
    activationMode: "truthy",
    allowZeroPin: true,
  },
  baropin: {
    allowZeroPin: true,
  },
  rollingpopbangpin: {
    activationField: "rollingPopBangEnabled",
    activationMode: "truthy",
  },
  alsswitchpin: {
    activationField: "alsEnabled",
    activationMode: "truthy",
  },
  pitlimiterpin: {
    activationField: "pitLimiterEnabled",
    activationMode: "truthy",
  },
  launchpin: {
    activationField: "launchEnable",
    activationMode: "truthy",
  },
  rumbleidlepin: {
    activationField: "rumbleIdleEnabled",
    activationMode: "truthy",
  },
  fuel2inputpin: {
    activationField: "fuel2Mode",
    activationMode: "truthy",
  },
  spark2inputpin: {
    activationField: "spark2Mode",
    activationMode: "truthy",
  },
  n2o_arming_pin: {
    activationField: "n2o_enable",
    activationMode: "truthy",
  },
  n2o_stage1_pin: {
    activationField: "n2o_enable",
    activationMode: "truthy",
  },
  n2o_stage2_pin: {
    activationField: "n2o_enable",
    activationMode: "gt1",
  },
  knock_pin: {
    activationField: "knock_mode",
    activationMode: "truthy",
  },
  airconreqpin: {
    activationField: "airConEnable",
    activationMode: "truthy",
  },
  airconcomppin: {
    activationField: "airConEnable",
    activationMode: "truthy",
  },
  resetcontrolpin: {
    activationField: "resetControl",
    activationMode: "truthy",
  },
  ignbypasspin: {
    activationField: "ignBypassEnable",
    activationMode: "truthy",
  },
  wmienabledpin: {
    activationField: "wmiEnabled",
    activationMode: "truthy",
  },
  wmiemptypin: {
    activationField: "wmiEnabled",
    activationMode: "truthy",
  },
  wmiindicatorpin: {
    activationField: "wmiEnabled",
    activationMode: "truthy",
  },
};

function getPageData(decodedPages, pageId) {
  return decodedPages?.[pageId] || decodedPages?.[String(pageId)] || {};
}

function buildFieldIndex(parsedIni) {
  const index = {};
  const pages = parsedIni?.constants?.pages || {};

  Object.entries(pages).forEach(([pageId, pageVars]) => {
    Object.entries(pageVars || {}).forEach(([name, meta]) => {
      index[name] = { pageId, meta };
    });
  });

  return index;
}

function getOptionLabel(meta, value) {
  if (!Array.isArray(meta?.options)) return null;
  const option = meta.options?.[Number(value)];
  return typeof option === "string" ? option : null;
}

function isPinLikeOption(label) {
  if (typeof label !== "string") return false;
  const normalized = label.trim();
  if (!normalized) return false;

  return (
    /board\s*default/i.test(normalized) ||
    /^a\d+$/i.test(normalized) ||
    /^\d+$/.test(normalized) ||
    /^virtual$/i.test(normalized)
  );
}

function isPinAssignmentField(name, meta) {
  const lowerName = name.toLowerCase();
  if (meta?.type !== "bits") return false;
  if (!Array.isArray(meta?.options) || meta.options.length === 0) return false;

  const explicitNonPinNames = new Set([
    "ncylinders",
    "ninjectors",
    "nfuelchannels",
    "nignchannels",
    "injlayout",
    "inj4cylpairing",
    "pinlayout",
  ]);

  if (explicitNonPinNames.has(lowerName)) {
    return false;
  }

  const excludedPatterns = [
    /mode$/,
    /polarity$/,
    /pull/,
    /layout/,
    /count/,
    /^n[a-z]/,
    /channels?$/,
    /cylinders?$/,
    /injectors?$/,
    /outputs?$/,
    /settings/,
    /algorithm/,
    /status/,
    /source/,
    /type$/,
    /bits$/,
    /flag/,
    /cuttype$/,
  ];

  if (excludedPatterns.some((pattern) => pattern.test(lowerName))) {
    return false;
  }

  const pinNamePatterns = [/pin$/, /pin\d+$/, /^outputpin\d+$/];
  if (pinNamePatterns.some((pattern) => pattern.test(lowerName))) {
    return true;
  }

  const usefulOptions = meta.options.filter(
    (option) => typeof option === "string" && option.trim() && option.toUpperCase() !== "INVALID",
  );
  const pinLikeCount = usefulOptions.filter(isPinLikeOption).length;

  return usefulOptions.length > 4 && pinLikeCount / usefulOptions.length >= 0.6;
}

function humanizeFieldName(name) {
  return name
    .replace(/^n2o_/i, "N2O ")
    .replace(/^prgm_/i, "Programmable ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\bpin\b/i, "Pin")
    .replace(/\bvss\b/gi, "VSS")
    .replace(/\bals\b/gi, "ALS")
    .replace(/\bwmi\b/gi, "WMI")
    .replace(/\bclt\b/gi, "CLT")
    .replace(/\biat\b/gi, "IAT")
    .replace(/\btps\b/gi, "TPS")
    .replace(/\brpm\b/gi, "RPM")
    .replace(/\binput\b/gi, "Input")
    .replace(/\boutput\b/gi, "Output")
    .replace(/\s+/g, " ")
    .trim();
}

function getAliasCandidates(fieldName) {
  const match = fieldName.match(/^outputPin(\d)$/i);
  if (!match) return [];

  const index = match[1];
  return [
    `prgm_out0${index}Alias`,
    `prgm_out${index}Alias`,
    `prgmOut${index}Alias`,
  ];
}

function resolveDisplayLabel(fieldName, decodedPages, fieldIndex) {
  const aliasCandidates = getAliasCandidates(fieldName);
  for (const candidate of aliasCandidates) {
    const info = fieldIndex[candidate];
    if (!info) continue;
    const value = getPageData(decodedPages, info.pageId)?.[candidate];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return humanizeFieldName(fieldName);
}

function getFieldHelp(parsedIni, fieldName) {
  if (!parsedIni || !fieldName) return "";

  const direct = parsedIni?.fieldHelp?.[fieldName];
  if (typeof direct === "string") return direct;

  const lowerFieldName = fieldName.toLowerCase();
  const key = Object.keys(parsedIni?.fieldHelp || {}).find(
    (entry) => entry.toLowerCase() === lowerFieldName,
  );
  return key ? parsedIni.fieldHelp[key] : "";
}

function getPrimaryDialogEntry(parsedIni, fieldName) {
  const entries = getDialogEntries(parsedIni, fieldName);
  return entries.find((entry) => entry?.label && entry.label !== fieldName) || entries[0] || null;
}

function inferResourceClass(parsedIni, fieldName, meta, basePolicy = {}) {
  if (basePolicy.resourceClass) return basePolicy.resourceClass;

  const lowerName = fieldName.toLowerCase();
  const option0 = getOptionLabel(meta, 0) || meta?.options?.[0] || "";
  const normalizedOption0 = String(option0).trim();
  const helpText = getFieldHelp(parsedIni, fieldName).toLowerCase();
  const dialogEntry = getPrimaryDialogEntry(parsedIni, fieldName);
  const dialogLabel = String(dialogEntry?.label || "").toLowerCase();

  if (/^a\d+$/i.test(normalizedOption0)) {
    return "analog-input";
  }

  if (/\banalog\b/.test(helpText) || /\banalog\b/.test(dialogLabel)) {
    return "analog-input";
  }

  if (
    /\boutput\b/.test(helpText) ||
    /\bwill be output\b/.test(helpText) ||
    /\bsignal is output\b/.test(helpText) ||
    /\bcompressor\b/.test(dialogLabel)
  ) {
    return "digital-output";
  }

  if (
    /\binput\b/.test(helpText) ||
    /\bswitch\b/.test(helpText) ||
    /\brequest\b/.test(helpText) ||
    /\bactivation\b/.test(helpText) ||
    /\bconnected to\b/.test(helpText)
  ) {
    return "digital-input";
  }

  const outputPatterns = [
    /^outputpin\d+$/,
    /boost/,
    /pump/,
    /fan/,
    /tach/,
    /stage\d/,
    /comp/,
    /nitrous/,
    /idleupoutput/,
    /wmi/,
    /vvt/,
  ];

  const inputPatterns = [
    /switch/,
    /launch/,
    /arming/,
    /request/,
    /knock/,
    /baro/,
    /emap/,
    /pressure/,
    /idleup/,
    /resetcontrol/,
    /bypass/,
    /fuel2input/,
    /vss/,
    /pitlimiter/,
    /rollingpopbang/,
    /als/,
    /rumbleidle/,
  ];

  if (outputPatterns.some((pattern) => pattern.test(lowerName))) {
    return "digital-output";
  }

  if (inputPatterns.some((pattern) => pattern.test(lowerName))) {
    return "digital-input";
  }

  return undefined;
}

function inferDirection(fieldName, optionLabel, policy = {}, parsedIni = null) {
  const lowerName = fieldName.toLowerCase();
  const lowerOption = (optionLabel || "").toLowerCase();
  const helpText = getFieldHelp(parsedIni, fieldName).toLowerCase();
  const dialogEntry = getPrimaryDialogEntry(parsedIni, fieldName);
  const dialogLabel = String(dialogEntry?.label || "").toLowerCase();

  if (policy.resourceClass?.includes("input")) return "Input";
  if (policy.resourceClass?.includes("output")) return "Output";

  if (
    /\boutput\b/.test(helpText) ||
    /\bsignal is output\b/.test(helpText) ||
    /\boutput\b/.test(dialogLabel)
  ) {
    return "Output";
  }

  if (
    /\binput\b/.test(helpText) ||
    /\bswitch\b/.test(helpText) ||
    /\brequest\b/.test(helpText) ||
    /\binput\b/.test(dialogLabel)
  ) {
    return "Input";
  }

  const outputPatterns = [
    /^outputpin\d+$/,
    /boost/,
    /pump/,
    /fan/,
    /tach/,
    /stage\d/,
    /comp/,
    /nitrous/,
    /idleupoutput/,
    /wmi/,
    /vvt/,
  ];

  const inputPatterns = [
    /switch/,
    /launch/,
    /arming/,
    /request/,
    /knock/,
    /baro/,
    /emap/,
    /pressure/,
    /idleup/,
    /resetcontrol/,
    /bypass/,
    /fuel2input/,
    /vss/,
    /pitlimiter/,
    /rollingpopbang/,
    /als/,
  ];

  if (outputPatterns.some((pattern) => pattern.test(lowerName))) return "Output";
  if (inputPatterns.some((pattern) => pattern.test(lowerName))) return "Input";
  if (/virtual/.test(lowerOption)) return "Other";
  return "Other";
}

function normalizePinLabel(label) {
  const normalized = String(label || "").trim();
  if (!normalized) return null;
  if (/^(board\s*default|disabled|off|none|not used|invalid|unavailable|not assigned)$/i.test(normalized)) {
    return null;
  }

  return normalized.toLowerCase();
}

function classifySpecialLabel(label) {
  const normalized = String(label || "").trim();
  if (!normalized) return { kind: "unavailable", displayLabel: "Unavailable", claimable: false };

  if (/^board\s*default$/i.test(normalized)) {
    return { kind: "default", displayLabel: "Board Default", claimable: false };
  }

  if (/auto mode/i.test(normalized)) {
    return { kind: "none", displayLabel: "Auto Mode", claimable: false };
  }

  if (/pin required/i.test(normalized)) {
    return { kind: "none", displayLabel: "Pin Required", claimable: false };
  }

  if (/^(unused|disabled|off|none|not used|not assigned)$/i.test(normalized)) {
    return { kind: "none", displayLabel: "No Pin", claimable: false };
  }

  if (normalized.toUpperCase() === "INVALID") {
    return { kind: "none", displayLabel: "No Pin", claimable: false };
  }

  return null;
}

function evaluateActivation(rawValue, mode = "truthy") {
  const value = Number(rawValue ?? 0);
  switch (mode) {
    case "gt1":
      return value > 1;
    case "nonzero":
    case "truthy":
    default:
      return value > 0;
  }
}

function resolveFieldPolicy(parsedIni, fieldName, meta) {
  const lowerName = fieldName.toLowerCase();
  const option0 = getOptionLabel(meta, 0) || meta?.options?.[0] || "";
  const basePolicy = FIELD_POLICIES[lowerName] || {};
  const heuristicPolicy = {
    allowZeroPin: /^a\d+$/i.test(String(option0).trim()),
  };
  const resourceClass = inferResourceClass(parsedIni, fieldName, meta, basePolicy);

  return {
    noClaimLabels: [],
    defaultLabels: [],
    allowZeroPin: false,
    activationMode: "truthy",
    ...heuristicPolicy,
    ...basePolicy,
    resourceClass,
  };
}

function getFieldRawValue(fieldName, decodedPages, fieldIndex) {
  const info = fieldIndex?.[fieldName];
  if (!info) return undefined;
  return getPageData(decodedPages, info.pageId)?.[fieldName];
}

function getDialogEntries(parsedIni, fieldName) {
  if (!parsedIni || !fieldName) return [];

  const directEntries = parsedIni?.dialogFields?.[fieldName];
  if (Array.isArray(directEntries) && directEntries.length > 0) {
    return directEntries;
  }

  const lowerFieldName = fieldName.toLowerCase();
  const dialogMatch = Object.entries(parsedIni?.dialogFields || {}).find(
    ([key]) => key.toLowerCase() === lowerFieldName,
  );
  if (dialogMatch) {
    return dialogMatch[1];
  }

  const legacyMatch = Object.entries(parsedIni?.dialogs || {}).find(
    ([key]) => key.toLowerCase() === lowerFieldName,
  );
  if (!legacyMatch) return [];

  return [legacyMatch[1]];
}

function normalizeConditionFieldName(token, fieldIndex = {}) {
  if (!token) return token;
  if (fieldIndex[token]) return token;

  const indexedMatch = token.match(/^([A-Za-z_][A-Za-z0-9_]*?)\[(\d+)\]$/);
  if (indexedMatch) {
    const collapsed = `${indexedMatch[1]}${indexedMatch[2]}`;
    if (fieldIndex[collapsed]) return collapsed;
  }

  const lowerToken = token.toLowerCase();
  const candidate = Object.keys(fieldIndex).find((key) => key.toLowerCase() === lowerToken);
  if (candidate) return candidate;

  return indexedMatch ? `${indexedMatch[1]}${indexedMatch[2]}` : token;
}

function evaluateIniCondition(expression, decodedPages, fieldIndex) {
  if (!expression || typeof expression !== "string") return null;

  const source = expression.trim();
  if (!source) return null;

  const normalized = source.replace(
    /\b([A-Za-z_][A-Za-z0-9_]*(?:\[\d+\])?)\b/g,
    (token) => {
      if (["true", "false", "null"].includes(token)) return token;
      return `__get("${token}")`;
    },
  );

  try {
    const resolver = (token) => {
      const resolvedField = normalizeConditionFieldName(token, fieldIndex);
      const rawValue = getFieldRawValue(resolvedField, decodedPages, fieldIndex);
      return Number(rawValue ?? 0);
    };

    return Boolean(Function("__get", `return Boolean(${normalized})`)(resolver));
  } catch {
    return null;
  }
}

function getDialogActivity(fieldName, parsedIni, decodedPages, fieldIndex) {
  const entries = getDialogEntries(parsedIni, fieldName);
  if (entries.length === 0) return null;

  const explicitConditions = entries
    .flatMap((entry) => entry?.conditions?.length ? entry.conditions : [entry?.condition])
    .map((condition) => condition?.trim())
    .filter(Boolean);

  if (explicitConditions.length === 0) {
    return {
      active: true,
      reason: "Always visible in embedded INI",
      source: "ini",
    };
  }

  const evaluations = explicitConditions
    .map((condition) => ({
      condition,
      active: evaluateIniCondition(condition, decodedPages, fieldIndex),
    }))
    .filter((entry) => entry.active !== null);

  if (evaluations.length === 0) {
    return null;
  }

  const activeMatch = evaluations.find((entry) => entry.active);
  if (activeMatch) {
    return {
      active: true,
      reason: `INI condition matched: ${activeMatch.condition}`,
      source: "ini",
    };
  }

  return {
    active: false,
    reason: `INI condition inactive: ${evaluations[0].condition}`,
    source: "ini",
  };
}

function getFieldActivity(fieldName, parsedIni, decodedPages, fieldIndex, policy) {
  const dialogActivity = getDialogActivity(fieldName, parsedIni, decodedPages, fieldIndex);
  if (dialogActivity) {
    return dialogActivity;
  }

  if (!policy?.activationField) {
    return { active: true, reason: "No activation gate", source: "fallback" };
  }

  const rawValue = getFieldRawValue(policy.activationField, decodedPages, fieldIndex);
  const active = evaluateActivation(rawValue, policy.activationMode);

  return {
    active,
    rawValue,
    source: "fallback",
    reason: active
      ? `${policy.activationField} is active`
      : `${policy.activationField} is disabled`,
  };
}

function getLabelState(label, policy = {}) {
  const normalized = String(label || "").trim();
  if (!normalized) {
    return { state: "unavailable", displayLabel: "Unavailable", claimable: false };
  }

  const genericMatch = classifySpecialLabel(normalized);
  if (genericMatch) {
    return {
      state: genericMatch.kind,
      displayLabel: genericMatch.displayLabel,
      claimable: genericMatch.claimable,
    };
  }

  if (policy.defaultLabels?.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
    return { state: "default", displayLabel: "Board Default", claimable: false };
  }

  if (policy.noClaimLabels?.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
    return {
      state: "none",
      displayLabel: "No Pin",
      claimable: false,
    };
  }

  return { state: "explicit", displayLabel: normalized, claimable: true };
}

function resolveAssignment(fieldName, meta, rawValue, policy = {}) {
  if (rawValue === undefined || rawValue === null || Number.isNaN(Number(rawValue))) {
    return { state: "unavailable", displayLabel: "Unavailable", claimable: false };
  }

  const optionLabel = getOptionLabel(meta, rawValue);
  if (optionLabel) {
    return getLabelState(optionLabel, policy);
  }

  if (policy.allowZeroPin || rawValue !== 0) {
    return {
      state: "explicit",
      displayLabel: String(rawValue),
      claimable: true,
    };
  }

  return {
    state: "none",
    displayLabel: "Not Assigned",
    claimable: false,
  };
}

function describeOptionState(assignment) {
  switch (assignment?.state) {
    case "default":
      return "Board Default";
    case "none":
      if (/auto mode/i.test(assignment.displayLabel || "")) return "No Pin / Auto Mode";
      if (/pin required/i.test(assignment.displayLabel || "")) return "No Pin / Required";
      if (/unused/i.test(assignment.displayLabel || "")) return "No Pin / Unused";
      return "No Pin";
    case "explicit":
      return "Assigned Pin";
    default:
      return "Unavailable";
  }
}

function getCanonicalNoPinIndex(meta, fieldName) {
  const policy = resolveFieldPolicy(null, fieldName, meta);
  const options = Array.isArray(meta?.options) ? meta.options : [];

  for (let index = 0; index < options.length; index += 1) {
    const assignment = resolveAssignment(fieldName, meta, index, policy);
    if (assignment.state === "none") {
      return index;
    }
  }

  return null;
}

function classifyRowStatus(assignment, activity) {
  if (assignment.state === "unavailable") return "unavailable";
  if (assignment.state === "none") return "unassigned";
  if (assignment.state === "default") return activity.active ? "board-default" : "inactive";
  if (assignment.state === "explicit") return activity.active ? "assigned" : "inactive";
  return "unavailable";
}

function buildRowNote(assignment, activity) {
  if (assignment.state === "unavailable") {
    return "No decoded value is available in this project.";
  }
  if (assignment.state === "none") {
    return "No active pin assignment is configured.";
  }
  if (assignment.state === "default") {
    return activity.active
      ? "Uses the board layout default routing."
      : "Uses a default / auto routing mode while the owning feature is inactive.";
  }
  if (!activity.active) {
    return `Configured pin assignment is present, but ${activity.reason}.`;
  }
  return "Explicit active pin assignment found in project constants.";
}

function discoverIoRows(parsedIni, decodedPages, fieldIndex = buildFieldIndex(parsedIni)) {
  return Object.entries(fieldIndex)
    .filter(([fieldName, info]) => isPinAssignmentField(fieldName, info.meta))
    .map(([fieldName, info]) => {
      const pageData = getPageData(decodedPages, info.pageId);
      const rawValue = pageData?.[fieldName];
      const policy = resolveFieldPolicy(parsedIni, fieldName, info.meta);
      const assignment = resolveAssignment(fieldName, info.meta, rawValue, policy);
      const activity = getFieldActivity(fieldName, parsedIni, decodedPages, fieldIndex, policy);
      const status = classifyRowStatus(assignment, activity);
      const displayLabel = resolveDisplayLabel(fieldName, decodedPages, fieldIndex);
      const direction = inferDirection(fieldName, assignment.displayLabel, policy, parsedIni);
      const normalizedClaimLabel =
        assignment.claimable ? normalizePinLabel(assignment.displayLabel) : null;
      const configuredClaimKey =
        assignment.claimable && normalizedClaimLabel
          ? `${direction}:${policy.resourceClass || "generic"}:${normalizedClaimLabel}`
          : null;
      const claimKey = activity.active ? configuredClaimKey : null;

      return {
        field: fieldName,
        displayLabel,
        direction,
        pageId: info.pageId,
        rawValue,
        resolvedValue: assignment.displayLabel,
        status,
        isActive: activity.active,
        activityReason: activity.reason,
        activitySource: activity.source,
        assignmentState: assignment.state,
        policy,
        configuredClaimKey,
        claimKey,
        note: buildRowNote(assignment, activity),
      };
    })
    .sort((a, b) => {
      if (a.direction !== b.direction) return a.direction.localeCompare(b.direction);
      if (a.displayLabel !== b.displayLabel) return a.displayLabel.localeCompare(b.displayLabel);
      return a.field.localeCompare(b.field);
    });
}

function buildPinRegistry(parsedIni, decodedPages) {
  const fieldIndex = buildFieldIndex(parsedIni);
  const rows = discoverIoRows(parsedIni, decodedPages, fieldIndex);
  const assignedMap = {};
  const configuredMap = {};

  rows.forEach((row) => {
    if (row.configuredClaimKey) {
      configuredMap[row.configuredClaimKey] = [...(configuredMap[row.configuredClaimKey] || []), row];
    }
    if (!row.claimKey) return;
    if (!row.isActive) return;
    assignedMap[row.claimKey] = [...(assignedMap[row.claimKey] || []), row];
  });

  rows.forEach((row) => {
    const related = row.claimKey ? assignedMap[row.claimKey] || [] : [];
    const activeRelated = related.filter((entry) =>
      ["assigned", "conflict"].includes(entry.status),
    );

    if (row.status === "assigned" && activeRelated.length > 1) {
      row.status = "conflict";
      row.note = `Actively shared with ${activeRelated
        .filter((entry) => entry.field !== row.field)
        .map((entry) => entry.displayLabel)
        .join(", ")}`;
      return;
    }

    if (related.length > 1 && ["assigned", "inactive"].includes(row.status)) {
      row.status = "potential";
      row.note = `Shares this resource with ${related
        .filter((entry) => entry.field !== row.field)
        .map((entry) => `${entry.displayLabel} (${entry.isActive ? "active" : "inactive"})`)
        .join(", ")}`;
    }
  });

  return {
    fieldIndex,
    rows,
    assignedMap,
    configuredMap,
  };
}

function formatPinOptionLabel(label, index, currentValue, fieldName, meta) {
  const policy = resolveFieldPolicy(null, fieldName, meta);
  const assignment = resolveAssignment(fieldName, meta, index, policy);

  if (assignment.state === "unavailable") return null;
  if (assignment.state === "none" && Number(index) !== Number(currentValue)) return null;
  return assignment.displayLabel;
}

function getPinOptionsForField(
  fieldName,
  parsedIni,
  decodedPages,
  registry = buildPinRegistry(parsedIni, decodedPages),
  currentValue,
) {
  const info = registry.fieldIndex?.[fieldName];
  const metaOptions = Array.isArray(info?.meta?.options) ? info.meta.options : [];
  const policy = resolveFieldPolicy(parsedIni, fieldName, info?.meta);
  const canonicalNoPinIndex = getCanonicalNoPinIndex(info?.meta, fieldName);

  return metaOptions
    .map((label, index) => {
      const assignment = resolveAssignment(fieldName, info?.meta, index, policy);
      const displayLabel = formatPinOptionLabel(label, index, currentValue, fieldName, info?.meta);
      const claimKey =
        assignment.claimable
          ? `${inferDirection(fieldName, assignment.displayLabel, policy, parsedIni)}:${policy.resourceClass || "generic"}:${normalizePinLabel(assignment.displayLabel)}`
          : null;
      const configuredOwners = claimKey
        ? (registry.configuredMap?.[claimKey] || []).filter((entry) => entry.field !== fieldName)
        : [];
      const activeOwners = claimKey
        ? (registry.assignedMap?.[claimKey] || []).filter((entry) => entry.field !== fieldName)
        : [];
      const disableForConfiguredOwner =
        configuredOwners.length > 0 && policy.resourceClass !== "analog-input";

      return {
        index,
        label: displayLabel,
        stateLabel: describeOptionState(assignment),
        assignmentState: assignment.state,
        claimable: assignment.claimable,
        owners: configuredOwners,
        activeOwners,
        disabled:
          index !== Number(currentValue) &&
          (activeOwners.length > 0 || disableForConfiguredOwner),
      };
    })
    .filter((option) => {
      if (!option.label) return false;
      if (option.assignmentState !== "none") return true;
      return (
        option.index === Number(currentValue) ||
        option.index === canonicalNoPinIndex
      );
    });
}

export {
  buildFieldIndex,
  buildPinRegistry,
  discoverIoRows,
  formatPinOptionLabel,
  getOptionLabel,
  getPageData,
  getPinOptionsForField,
  inferDirection,
  isPinAssignmentField,
  getCanonicalNoPinIndex,
  normalizePinLabel,
  resolveDisplayLabel,
  resolveFieldPolicy,
  describeOptionState,
};
