/**
 * TunerStudio / Speeduino INI file parser.
 *
 * Parses [MegaTune], [TunerStudio], [Constants], [OutputChannels],
 * [TableEditor], and [CurveEditor] sections.
 *
 * Preprocessor directives (#if/#else/#endif/#define/#set/#unset) are handled;
 * #define macros are tracked and resolved within entries.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip an inline semicolon comment, respecting quoted strings.
 */
function stripComment(line) {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    if (ch === ";" && !inQuote) return line.slice(0, i);
  }
  return line;
}

/**
 * Split a comma-separated string into tokens, respecting quoted strings
 * and { expr } blocks (used for lambda scaling in some entries).
 */
function splitTokens(str) {
  const tokens = [];
  let current = "";
  let inQuote = false;
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
      continue;
    }
    if (!inQuote && ch === "{") {
      depth++;
      current += ch;
      continue;
    }
    if (!inQuote && ch === "}") {
      depth--;
      current += ch;
      continue;
    }
    if (!inQuote && depth === 0 && ch === ",") {
      tokens.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

/**
 * Unquote a token: remove surrounding double-quotes if present.
 */
function unquote(s) {
  s = s.trim();
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return s;
}

/**
 * Parse a [hi:lo] or [lo:hi] bit-range token → [lo, hi] (integers).
 * Returns null if not a bit range.
 */
function parseBitRange(token) {
  const m = token.trim().match(/^\[(\d+):(\d+)\]$/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

/**
 * Parse an array shape token like [16] or [16x16] → [rows] or [rows, cols].
 * Returns null if not a shape.
 */
function parseShape(token) {
  const m = token.trim().match(/^\[(\d+)(?:x(\d+))?\]$/i);
  if (!m) return null;
  return m[2] ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [parseInt(m[1], 10)];
}

/**
 * Parse a variable entry (the part after the `=`).
 */
function parseVarEntry(tokens) {
  const type = tokens[0]?.toLowerCase();

  if (type === "scalar") {
    return {
      type: "scalar",
      dataType: tokens[1]?.trim() ?? "",
      offset: parseInt(tokens[2], 10) || 0,
      units: unquote(tokens[3] ?? ""),
      scale: parseFloat(tokens[4]) || 1,
      translate: parseFloat(tokens[5]) || 0,
      lo: tokens[6] !== undefined ? parseFloat(tokens[6]) : null,
      hi: tokens[7] !== undefined ? parseFloat(tokens[7]) : null,
      digits: tokens[8] !== undefined ? parseInt(tokens[8], 10) : 0,
    };
  }

  if (type === "array") {
    return {
      type: "array",
      dataType: tokens[1]?.trim() ?? "",
      offset: parseInt(tokens[2], 10) || 0,
      shape: parseShape(tokens[3]),
      units: unquote(tokens[4] ?? ""),
      scale: parseFloat(tokens[5]) || 1,
      translate: parseFloat(tokens[6]) || 0,
      lo: tokens[7] !== undefined ? parseFloat(tokens[7]) : null,
      hi: tokens[8] !== undefined ? parseFloat(tokens[8]) : null,
      digits: tokens[9] !== undefined ? parseInt(tokens[9], 10) : 0,
    };
  }

  if (type === "bits") {
    const dataType = tokens[1]?.trim() ?? "";
    const offsetOrBitRange = tokens[2]?.trim();
    let offset = null;
    let bitRange = null;
    let labelStart = 3;

    const asBitRange = parseBitRange(offsetOrBitRange);
    if (asBitRange) {
      bitRange = asBitRange;
      offset = 0;
      labelStart = 3;
    } else {
      offset = parseInt(offsetOrBitRange, 10) || 0;
      bitRange = parseBitRange(tokens[3]);
      labelStart = 4;
    }

    const labels = tokens.slice(labelStart).map(unquote).filter(Boolean);
    return { type: "bits", dataType, offset, bitRange, labels, options: labels };
  }

  if (type === "string") {
    return {
      type: "string",
      encoding: tokens[1]?.trim() ?? "ASCII",
      length: parseInt(tokens[2], 10) || 0,
    };
  }

  return { type: "unknown", raw: tokens };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseIni(content, preprocessorSymbols = {}) {
  const result = {
    info: {
      signature: "",
      mtVersion: "",
      queryCommand: "",
      versionInfo: "",
      iniSpecVersion: "",
    },
    constants: { endianness: "little", nPages: 0, pageSizes: [], pages: {} },
    outputChannels: { ochBlockSize: 0, ochGetCommand: "", channels: {} },
    tables: {},
    curves: {},
    dialogs: {},
  };

  const macros = {};
  let currentSection = "";
  let currentPage = null;
  let currentTable = null;
  let currentCurve = null;
  let currentDialog = null;
  const lastOffsetMap = {}; 

  const lines = content.split(/\r?\n/);

  // Preprocessor stack: elements are boolean (true if current branch should be processed)
  const branchStack = [true];
  // Track if a branch in the current level has already been executed (for #else)
  const executedStack = [false];

  const shouldProcess = () => branchStack[branchStack.length - 1];

  const resolveMacros = (val) => {
    let resolved = val;
    let iterations = 0;
    while (resolved.includes("$") && iterations < 10) {
      let changed = false;
      for (const [key, replacement] of Object.entries(macros)) {
        const macroRef = `$${key}`;
        if (resolved.includes(macroRef)) {
          resolved = resolved.split(macroRef).join(replacement);
          changed = true;
        }
      }
      if (!changed) break;
      iterations++;
    }
    return resolved;
  };

  for (let rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Handle Preprocessor Directives
    if (trimmed.startsWith("#")) {
      const parts = trimmed.split(/\s+/);
      const directive = parts[0].toLowerCase();

      if (directive === "#if") {
        const symbol = parts[1];
        const isTrue = !!preprocessorSymbols[symbol];
        const parentActive = branchStack[branchStack.length - 1];
        
        branchStack.push(parentActive && isTrue);
        executedStack.push(isTrue);
        continue;
      } else if (directive === "#else") {
        const parentActive = branchStack[branchStack.length - 2] ?? true;
        const alreadyExecuted = executedStack[executedStack.length - 1];
        
        branchStack[branchStack.length - 1] = parentActive && !alreadyExecuted;
        continue;
      } else if (directive === "#endif") {
        branchStack.pop();
        executedStack.pop();
        continue;
      }

      if (directive === "#define" && shouldProcess()) {
        const defMatch = trimmed.match(/^#define\s+([^\s=]+)\s*=\s*(.*)/i);
        if (defMatch)
          macros[defMatch[1].trim()] = resolveMacros(defMatch[2].trim());
        continue;
      }
      
      continue; // Skip unknown or other # directives
    }

    if (!shouldProcess()) continue;

    // Strip inline comment
    let line = stripComment(trimmed).trim();
    if (!line) continue;

    // Section header
    const sectionMatch = line.match(/^\[([^\]]+)\]/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].toLowerCase().trim();
      currentCurve = null;
      currentDialog = null;
      continue;
    }

    // Split name = rest
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;

    const name = line.slice(0, eqIdx).trim();
    const restRaw = line.slice(eqIdx + 1).trim();
    const rest = resolveMacros(restRaw);

    if (currentSection === "constants") {
      const pageMatch = line.match(/^page\s*=\s*(\d+)/i);
      if (pageMatch) {
        currentPage = parseInt(pageMatch[1], 10);
        if (!result.constants.pages[currentPage])
          result.constants.pages[currentPage] = {};
        continue;
      }

      if (currentPage === null) {
        if (name === "endianness") result.constants.endianness = rest;
        else if (name === "nPages")
          result.constants.nPages = parseInt(rest, 10);
        else if (name === "pageSize")
          result.constants.pageSizes = rest
            .split(",")
            .map((s) => parseInt(s.trim(), 10));
        continue;
      }

      const tokens = splitTokens(rest);
      if (tokens.length > 0) {
        const parsed = parseVarEntry(tokens);
        // Handle lastOffset support
        if (tokens[2]?.trim().toLowerCase() === "lastoffset") {
          parsed.offset = lastOffsetMap[currentPage] || 0;
        } else if (parsed.offset !== undefined && parsed.offset !== null && !isNaN(parsed.offset)) {
          lastOffsetMap[currentPage] = parsed.offset;
        }
        result.constants.pages[currentPage][name] = parsed;
      }
      continue;
    }

    if (currentSection === "megatune") {
      const val = unquote(rest);
      if (name === "MTversion") result.info.mtVersion = val;
      else if (name === "queryCommand") result.info.queryCommand = val;
      else if (name === "signature") result.info.signature = val;
      else if (name === "versionInfo") result.info.versionInfo = val;
    } else if (currentSection === "tunerstudio") {
      if (name === "iniSpecVersion") result.info.iniSpecVersion = unquote(rest);
    } else if (currentSection === "outputchannels") {
      if (name === "ochBlockSize")
        result.outputChannels.ochBlockSize = parseInt(rest, 10);
      else if (name === "ochGetCommand")
        result.outputChannels.ochGetCommand = unquote(rest);
      else {
        const tokens = splitTokens(rest);
        if (tokens.length > 0)
          result.outputChannels.channels[name] = parseVarEntry(tokens);
      }
    } else if (currentSection === "tableeditor") {
      if (name === "table") {
        const tokens = splitTokens(rest);
        const tableId = tokens[0]?.trim();
        if (tableId) {
          currentTable = {
            id: tableId,
            mapId: tokens[1]?.trim(),
            title: unquote(tokens[2]),
            page: parseInt(tokens[3]),
            xBins: null,
            yBins: null,
            zBins: null,
            xyLabels: [],
            upDownLabel: [],
          };
          result.tables[tableId] = currentTable;
        }
      } else if (currentTable) {
        const tokens = splitTokens(rest);
        if (name === "xBins")
          currentTable.xBins = { varName: tokens[0], channel: tokens[1] };
        else if (name === "yBins")
          currentTable.yBins = { varName: tokens[0], channel: tokens[1] };
        else if (name === "zBins")
          currentTable.zBins = { varName: rest.trim() };
        else if (name === "xyLabels")
          currentTable.xyLabels = tokens.map(unquote);
        else if (name === "upDownLabel")
          currentTable.upDownLabel = tokens.map(unquote);
      }
    } else if (currentSection === "curveeditor") {
      if (name === "curve") {
        const tokens = splitTokens(rest);
        const curveId = tokens[0]?.trim();
        if (curveId) {
          currentCurve = {
            id: curveId,
            title: unquote(tokens[1]),
            xBins: null,
            yBins: null,
          };
          result.curves[curveId] = currentCurve;
        }
      } else if (currentCurve) {
        const tokens = splitTokens(rest);
        if (name === "xBins")
          currentCurve.xBins = { varName: tokens[0], channel: tokens[1] };
        else if (name === "yBins")
          currentCurve.yBins = { varName: tokens[0], channel: tokens[1] };
      }
    } else if (currentSection === "dialog" || currentSection === "dialogs") {
      if (name === "dialog") {
        const tokens = splitTokens(rest);
        currentDialog = tokens[0]?.trim();
      } else if (name === "field") {
        const tokens = splitTokens(rest);
        // Syntax: field = "Label", variable, { condition } or field = "Label", variable
        const label = unquote(tokens[0]);
        const variable = tokens[1]?.trim();
        let condition = null;

        // Find curly brackets if they exist in tokens
        const condIdx = tokens.findIndex((t) => t.startsWith("{"));
        if (condIdx !== -1) {
          condition = tokens[condIdx].trim();
          // Clean up { }
          if (condition.startsWith("{") && condition.endsWith("}")) {
            condition = condition.slice(1, -1).trim();
          }
        }

        if (variable) {
          if (!result.dialogs[variable]) {
            result.dialogs[variable] = {
              label,
              condition,
              dialog: currentDialog,
            };
          }
        }
      }
    }
  }

  return result;
}

export function getTableMetadata(parsedIni, tableId) {
  if (!parsedIni || !parsedIni.tables) return null;
  let table = parsedIni.tables[tableId];
  if (!table) {
    const key = Object.keys(parsedIni.tables).find((k) =>
      k.toLowerCase().includes(tableId.toLowerCase()),
    );
    if (key) table = parsedIni.tables[key];
  }
  if (!table) return null;
  return {
    title: table.title,
    xLabel: table.xyLabels?.[0] ?? "",
    yLabel: table.xyLabels?.[1] ?? "",
    xBinsVar: table.xBins?.varName ?? "",
    yBinsVar: table.yBins?.varName ?? "",
    zBinsVar: table.zBins?.varName ?? "",
    upDownLabel: table.upDownLabel ?? [],
    page: table.page,
  };
}

export function getOutputChannel(parsedIni, channelName) {
  return parsedIni?.outputChannels?.channels?.[channelName] ?? null;
}

export function getConstant(parsedIni, page, varName) {
  return parsedIni?.constants?.pages?.[page]?.[varName] ?? null;
}

/**
 * Global lookup for a variable's metadata across all pages.
 */
export function getVarMetadata(parsedIni, varName) {
  if (!parsedIni || !parsedIni.constants?.pages) return null;
  for (const pageId in parsedIni.constants.pages) {
    const page = parsedIni.constants.pages[pageId];
    if (page[varName]) {
      return { ...page[varName], name: varName, page: parseInt(pageId, 10) };
    }
  }
  return null;
}
