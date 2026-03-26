/**
 * INI Expression Evaluator
 * Evaluates TunerStudio-style condition strings against a local data context.
 * 
 * Example condition: "(TrigPattern == 0) && (TrigSpeed == 0)"
 */

export const evaluateCondition = (condition, context) => {
  if (!condition) return true;

  try {
    // 1. Basic sanitization: Only allow known characters to prevent code injection
    // Allows: alphanumeric, underscore, parentheses, whitespace, operators: == != < > <= >= && || !
    // Also allows numbers like 0.5, 10
    const safePattern = /^[a-zA-Z0-9_\s\(\)\!\=\&\>\<\|\.\-\+]*$/;
    if (!safePattern.test(condition)) {
      console.warn('[evaluator] Blocked unsafe condition string:', condition);
      return true; // Fail-safe: show the field
    }

    // 2. Prepare the environment by injecting context variables
    // Replace variable names with context lookups, but avoid replacing operators or numbers.
    // We look for parts that start with a letter and contain letters/numbers/underscores.
    let expr = condition.replace(/\b([a-zA-Z][a-zA-Z0-9_]*)\b/g, (match) => {
      // Don't replace keywords or operators like 'true', 'false'
      if (['true', 'false', 'AND', 'OR'].includes(match)) return match;
      
      const val = context[match];
      // If variable doesn't exist in context, assume 0 (frequent in INIs)
      return val !== undefined ? val : 0;
    });

    // 3. Translate legacy operators if present
    expr = expr.replace(/\bAND\b/g, '&&');
    expr = expr.replace(/\bOR\b/g, '||');

    // 4. evaluate using Function constructor (scoped eval)
    // eslint-disable-next-line no-new-func
    const result = new Function(`return !!(${expr});`)();
    return result;
  } catch (err) {
    console.error('[evaluator] Failed to evaluate:', condition, err);
    return true; // Fail-safe
  }
};
