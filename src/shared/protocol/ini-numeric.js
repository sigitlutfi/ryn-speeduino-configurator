// Evaluate the numeric subset used by INI axis scales. No JavaScript execution,
// function calls, property access or assignment is permitted.
export function evaluateIniNumber(expression, context = {}, channels = {}, depth = 0) {
  if (depth > 8 || typeof expression !== 'string' || expression.length > 512) return undefined
  const source = expression.trim().replace(/^\{([\s\S]*)\}$/, '$1')
  const tokens = source.match(/\d+(?:\.\d+)?|[A-Za-z_]\w*|===|!==|==|!=|<=|>=|&&|\|\||[()+*/%<>!?:-]/g) || []
  if (tokens.join('') !== source.replace(/\s/g, '')) return undefined
  let position = 0
  const precedence = { '||': 1, '&&': 2, '==': 3, '!=': 3, '===': 3, '!==': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 }
  const operations = {
    '||': (a, b) => Number(!!a || !!b), '&&': (a, b) => Number(!!a && !!b),
    '==': (a, b) => Number(a === b), '===': (a, b) => Number(a === b),
    '!=': (a, b) => Number(a !== b), '!==': (a, b) => Number(a !== b),
    '<': (a, b) => Number(a < b), '>': (a, b) => Number(a > b),
    '<=': (a, b) => Number(a <= b), '>=': (a, b) => Number(a >= b),
    '+': (a, b) => a + b, '-': (a, b) => a - b,
    '*': (a, b) => a * b, '/': (a, b) => a / b, '%': (a, b) => a % b,
  }
  function atom() {
    const token = tokens[position++]
    if (token === '(') {
      const result = conditional()
      if (tokens[position++] !== ')') throw new Error('Unclosed expression')
      return result
    }
    if (token === '!') return Number(!atom())
    if (token === '-') return -atom()
    if (token === '+') return atom()
    if (/^\d/.test(token || '')) return Number(token)
    if (!/^[A-Za-z_]\w*$/.test(token || '')) throw new Error('Expected numeric value')
    const value = Object.hasOwn(context, token) ? context[token]
      : evaluateIniNumber(channels[token]?.raw?.[0], context, channels, depth + 1)
    if (!Number.isFinite(value)) throw new Error('Unresolved INI symbol')
    return value
  }
  function binary(minimum = 1) {
    let left = atom()
    while ((precedence[tokens[position]] || 0) >= minimum) {
      const operator = tokens[position++]
      left = operations[operator](left, binary(precedence[operator] + 1))
    }
    return left
  }
  function conditional() {
    const condition = binary()
    if (tokens[position] !== '?') return condition
    position++
    const yes = conditional()
    if (tokens[position++] !== ':') throw new Error('Expected conditional alternative')
    const no = conditional()
    return condition ? yes : no
  }
  try {
    const value = conditional()
    return position === tokens.length && Number.isFinite(value) ? value : undefined
  } catch {
    return undefined
  }
}

export function resolveNumericMetadata(meta, ini, decodedPages = {}) {
  if (!meta) return meta
  const context = Object.assign({}, ...Object.values(decodedPages).filter(Boolean))
  const resolved = { ...meta }
  for (const key of ['scale', 'translate', 'lo', 'hi', 'digits']) {
    if (!meta[`${key}Expression`]) continue
    const value = evaluateIniNumber(meta[`${key}Expression`], context, ini?.outputChannels?.channels)
    if (value !== undefined && (key !== 'scale' || value !== 0) &&
      (key !== 'digits' || (Number.isInteger(value) && value >= 0 && value <= 8))) resolved[key] = value
  }
  return resolved
}
