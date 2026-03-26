import { z } from 'zod';

/**
 * Dynamically generates a Zod schema for a set of tuning constants 
 * based on the metadata provided by the Speeduino INI file.
 * 
 * @param {object} parsedIni - The parsed INI object from the store
 * @param {number} page - The constants page (e.g. 0, 1, 2)
 * @param {string[]} fieldNames - List of constant names to include in the schema
 * @returns {z.ZodObject}
 */
export const createIniSchema = (parsedIni, page, fieldNames) => {
  const schemaShape = {};

  if (!parsedIni || !parsedIni.constants || !parsedIni.constants.pages[page]) {
    // If no INI, fallback to basic number/any
    fieldNames.forEach(name => {
      schemaShape[name] = z.any();
    });
    return z.object(schemaShape);
  }

  const pageDef = parsedIni.constants.pages[page];

  fieldNames.forEach(name => {
    const def = pageDef[name];
    
    if (!def) {
      schemaShape[name] = z.any();
      return;
    }

    if (def.type === 'scalar') {
      let base = z.coerce.number();
      
      // Apply limits from INI metadata (lo/hi)
      if (def.lo !== null && !isNaN(def.lo)) {
        base = base.min(def.lo, { message: `${name} must be >= ${def.lo}${def.units ? ' ' + def.units : ''}` });
      }
      if (def.hi !== null && !isNaN(def.hi)) {
        base = base.max(def.hi, { message: `${name} must be <= ${def.hi}${def.units ? ' ' + def.units : ''}` });
      }
      
      schemaShape[name] = base;
    } 
    else if (def.type === 'bits') {
      const maxVal = def.options ? def.options.length - 1 : 255;
      schemaShape[name] = z.coerce.number().min(0).max(maxVal);
    }
    else if (def.type === 'array') {
      let element = z.coerce.number();
      if (def.lo !== null && !isNaN(def.lo)) element = element.min(def.lo);
      if (def.hi !== null && !isNaN(def.hi)) element = element.max(def.hi);
      
      let arraySchema = z.array(element);
      
      // Ensure specific length if defined (e.g. [16] or [16x16] -> handled as flat/nested depending on shape)
      if (def.shape) {
        const totalSize = def.shape.reduce((a, b) => a * b, 1);
        arraySchema = arraySchema.length(totalSize);
      }

      schemaShape[name] = arraySchema;
    } else {
        schemaShape[name] = z.any();
    }
  });

  return z.object(schemaShape);
};

/**
 * Cross-field validator for monotonic arrays (Increasing/Decreasing)
 */
export const isMonotonic = (arr, increasing = true) => {
  if (!Array.isArray(arr) || arr.length < 2) return true;
  for (let i = 1; i < arr.length; i++) {
    if (increasing && arr[i] < arr[i - 1]) return false;
    if (!increasing && arr[i] > arr[i - 1]) return false;
  }
  return true;
};
