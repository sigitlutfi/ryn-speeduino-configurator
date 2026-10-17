export function validateConfigurationValues(parsedIni, pages, contextPages = pages, previousPages = null) {
  const fields = Object.assign({}, ...Object.values(parsedIni?.constants?.pages || {}));
  const values = Object.assign({}, ...Object.values(contextPages || {}));
  const numeric = (meta, name, fallback) => {
    const expression = meta[`${name}Expression`];
    if (!expression) return meta[name] ?? fallback;
    // The AFR/Lambda aliases use a stoichiometric divisor. Resolve it from the
    // effective configuration, while never executing arbitrary INI JavaScript.
    const division = expression.match(/^\{\s*([\d.]+)\s*\/\s*(\w+)\s*\}$/);
    if (division) {
      const field = fields[division[2]];
      const raw = values[division[2]] ?? field?.defaultValue;
      const divisor = (raw + (field?.translate ?? 0)) * (field?.scale ?? 1);
      return divisor > 0 ? Number(division[1]) / divisor : null;
    }
    // An unresolved expression has no reliable display-unit bound. Raw type
    // limits still apply, and the expression is guarded by the INI contract.
    return null;
  };
  for (const [page, values] of Object.entries(pages)) {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined || value === null) continue
      const meta = parsedIni?.constants?.pages?.[page]?.[name]
      if (!meta || !['scalar', 'array', 'bits'].includes(meta.type)) continue
      if (meta.type === 'array' && (!Array.isArray(value) || value.flat(Infinity).length !== meta.shape?.reduce((count, size) => count * size, 1))) {
        return `${name} has the wrong array shape for this INI.`;
      }
      const width = Number(meta.dataType?.substring(1))
      const signed = meta.dataType?.startsWith('S')
      const rawMin = signed ? -(2 ** (width - 1)) : 0
      const rawMax = meta.type === 'bits'
        ? 2 ** (meta.bitRange[1] - meta.bitRange[0] + 1) - 1
        : signed ? 2 ** (width - 1) - 1 : 2 ** width - 1
      const prior = previousPages?.[page]?.[name];
      const priorValues = Array.isArray(prior) ? prior.flat(Infinity) : [prior];
      for (const [index, raw] of (Array.isArray(value) ? value.flat(Infinity) : [value]).entries()) {
        if (previousPages && raw === priorValues[index]) continue;
        const number = Number(raw)
        const scale = numeric(meta, 'scale', 1), translate = numeric(meta, 'translate', 0);
        const display = scale === null || translate === null ? null : (number + translate) * scale;
        const lo = numeric(meta, 'lo', null), hi = numeric(meta, 'hi', null);
        if (meta.type === 'bits' && meta.options?.[number]?.trim().toUpperCase() === 'INVALID') {
          return `${name} has an invalid option in this INI.`
        }
        if (!Number.isFinite(number) || !Number.isInteger(number) || number < rawMin || number > rawMax ||
            (meta.type !== 'bits' && display !== null && ((Number.isFinite(lo) && display < lo - 0.01) ||
            (Number.isFinite(hi) && display > hi + 0.01)))) {
          return `${name} is outside the range supported by this INI.`
        }
      }
    }
  }
  return null
}
