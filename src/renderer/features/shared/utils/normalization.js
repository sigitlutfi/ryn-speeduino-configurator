/**
 * speeduino.ini formula: 
 * RealValue = (InternalValue * Multiplier) + Offset
 * In our context: Real = (Raw * scale) + translate
 */

export const toDisplay = (raw, meta) => {
  if (raw === null || raw === undefined || !meta) return raw;
  
  const { scale, translate, digits } = meta;
  
  if (Array.isArray(raw)) {
    return raw.map(v => toDisplay(v, meta));
  }
  
  // Standard Formula: Real = (Raw * Scale) + Translate
  const result = (raw * (scale || 1)) + (translate || 0);
  
  // Return formatted number based on precision
  return digits !== undefined ? parseFloat(result.toFixed(digits)) : result;
};

export const toRaw = (display, meta) => {
  if (display === null || display === undefined || !meta) return display;
  
  const { scale, translate } = meta;
  
  if (Array.isArray(display)) {
    return display.map(v => toRaw(v, meta));
  }
  
  // Reverse Formula: Raw = (Real - Translate) / Scale
  // We round to nearest integer because internal values are usually bytes/ints
  const raw = (display - (translate || 0)) / (scale || 1);
  return Math.round(raw);
};
