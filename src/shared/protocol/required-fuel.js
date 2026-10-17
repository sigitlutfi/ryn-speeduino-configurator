// reqFuel is the full-cycle quantity. The firmware divides it for batch injection.
export function calculateRequiredFuel({ displacement, cylinders, injectorFlow, stoich = 14.7 }) {
  const values = [displacement, cylinders, injectorFlow, stoich].map(Number)
  if (values.some(value => !Number.isFinite(value) || value <= 0) || !Number.isInteger(values[1])) {
    throw new Error('Displacement, cylinder count, injector flow and stoichiometric AFR must be positive')
  }
  // Gasoline reference: https://www.vems.hu/manual/html/ch10.html
  return 6.49 * values[0] / (values[1] * values[2]) * 14.7 / values[3]
}

export function injectionDivider(cylinders, squirts) {
  if (!Number.isInteger(cylinders) || !Number.isInteger(squirts) || squirts <= 0 || cylinders % squirts !== 0) {
    throw new Error('Squirts must divide the cylinder count exactly')
  }
  return cylinders / squirts
}

export function injectionSquirts(cylinders, divider, layout = 0, strokes = 0, injectionType = 0) {
  if (!Number.isInteger(cylinders) || cylinders <= 0 || !Number.isInteger(divider) || divider <= 0 || cylinders % divider !== 0) {
    throw new Error('Injection divider must be positive and divide the cylinder count exactly.')
  }
  if (layout === 3 && strokes === 0) return 1
  if (cylinders === 3 && injectionType === 0 && [0, 1].includes(layout)) return 2
  return cylinders / divider
}
