import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// Extract only the straight-line CORE_AVR branch. Fail instead of inventing
// pin numbers if the upstream mapping gains unsupported expressions.
export function extractAvrPinMappings(source) {
  const macros = new Set(['CORE_AVR'])
  const stack = []
  let active = true
  const lines = []
  const evaluate = expression => {
    const value = expression.replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, name) => macros.has(name) ? '1' : '0')
    if (!/^[\s01!&|()]+$/.test(value)) throw new Error(`Unsupported condition: ${expression}`)
    return !!Function(`return (${value})`)()
  }
  for (const line of source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').split(/\r?\n/)) {
    const directive = line.match(/^\s*#(\w+)\s*(.*)$/)
    if (!directive) { if (active) lines.push(line); continue }
    const [, kind, expression] = directive
    if (['if', 'ifdef', 'ifndef'].includes(kind)) {
      const condition = kind === 'if' ? evaluate(expression) : macros.has(expression.trim()) === (kind === 'ifdef')
      stack.push({ parent: active, matched: condition })
      active = active && condition
    } else if (kind === 'elif' || kind === 'else') {
      const frame = stack.at(-1)
      const condition = kind === 'else' || evaluate(expression)
      active = frame.parent && !frame.matched && condition
      frame.matched ||= condition
    } else if (kind === 'endif') active = stack.pop().parent
    else if (kind === 'define' && active) macros.add(expression.trim())
  }
  if (stack.length) throw new Error('Unclosed preprocessor block')
  const text = lines.join('\n')
  const functions = {}
  for (const match of text.matchAll(/pinNumbers_t\s+(get\w+Mapping)\(void\)\s*\{([\s\S]*?)\n\}/g)) {
    const pins = {}
    const body = match[2]
    for (const assignment of body.matchAll(/pins\.(?:(setInjectorPin|setCoilPin)\((\d+),\s*([^);]+)\)|(pin\w+)\s*=\s*([^;]+));/g)) {
      const [, method, index, arrayValue, field, fieldValue] = assignment
      const value = (arrayValue || fieldValue).trim()
      const pin = /^\d+$/.test(value) ? Number(value) : /^A\d+$/.test(value) ? 54 + Number(value.slice(1)) : pins[value.replace(/^pins\./, '')]
      if (!Number.isInteger(pin) || pin < 0 || pin > 69) throw new Error(`Unsupported AVR pin: ${value}`)
      pins[field || `${method === 'setInjectorPin' ? 'injector' : 'coil'}${Number(index) + 1}`] = pin
    }
    if (body.includes('return getV02ShieldMapping()')) functions[match[1]] = functions.getV02ShieldMapping
    else functions[match[1]] = pins
    const rest = body.replace(/pinNumbers_t pins;|return pins;|return getV02ShieldMapping\(\);/g, '').replace(/pins\.(?:set(?:Injector|Coil)Pin\([^;]+|pin\w+\s*=\s*[^;]+);/g, '').trim()
    if (rest) throw new Error(`Unparsed mapping ${match[1]}: ${rest}`)
  }
  const layouts = {}
  for (const match of text.matchAll(/case (\d+): return (get\w+Mapping)\(\);/g)) {
    if (!functions[match[2]]) throw new Error(`Missing mapping: ${match[2]}`)
    layouts[match[1]] = functions[match[2]]
  }
  return { platform: 'mega2560', sourceSha256: createHash('sha256').update(source).digest('hex'), layouts }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/avr-pin-mapping.mjs /path/to/speeduino/src/pins/pinMapping.cpp')
  const mapping = extractAvrPinMappings(readFileSync(process.argv[2], 'utf8'))
  writeFileSync(new URL('../src/shared/protocol/avr-pin-mapping.js', import.meta.url), `// Generated from firmware pinMapping.cpp by scripts/avr-pin-mapping.mjs.\nexport default ${JSON.stringify(mapping, null, 2)}\n`)
  console.log(`Generated ${Object.keys(mapping.layouts).length} AVR layouts`)
}
