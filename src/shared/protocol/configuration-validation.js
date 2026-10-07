export function validateConfigurationValues(parsedIni, pages) {
  for (const [page, values] of Object.entries(pages)) {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined || value === null) continue
      const meta = parsedIni?.constants?.pages?.[page]?.[name]
      if (!meta || !['scalar', 'array', 'bits'].includes(meta.type)) continue
      const width = Number(meta.dataType?.substring(1))
      const signed = meta.dataType?.startsWith('S')
      const rawMin = signed ? -(2 ** (width - 1)) : 0
      const rawMax = meta.type === 'bits'
        ? 2 ** (meta.bitRange[1] - meta.bitRange[0] + 1) - 1
        : signed ? 2 ** (width - 1) - 1 : 2 ** width - 1
      for (const raw of Array.isArray(value) ? value.flat(Infinity) : [value]) {
        const number = Number(raw)
        const display = (number + (meta.translate ?? 0)) * (meta.scale ?? 1)
        if (meta.type === 'bits' && meta.options?.[number]?.trim().toUpperCase() === 'INVALID') {
          return `${name} has an invalid option in this INI.`
        }
        if (!Number.isFinite(number) || !Number.isInteger(number) || number < rawMin || number > rawMax ||
            (meta.type !== 'bits' && ((Number.isFinite(meta.lo) && display < meta.lo - 0.01) ||
            (Number.isFinite(meta.hi) && display > meta.hi + 0.01)))) {
          return `${name} is outside the range supported by this INI.`
        }
      }
    }
  }
  return null
}
