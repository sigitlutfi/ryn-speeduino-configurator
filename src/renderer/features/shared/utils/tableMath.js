/**
 * Advanced Tuning Math for 2D Maps
 */

/**
 * Apply linear interpolation across a selected block of cells.
 * Supported modes:
 * - 4 corners (2D bilinear)
 * - Row-wise
 * - Column-wise
 * 
 * @param {number[][]} values - The current 2D table grid
 * @param {object} selection - { startRow, startCol, endRow, endCol }
 */
export const interpolateBlock = (values, selection) => {
  const { startRow, startCol, endRow, endCol } = selection;
  const newValues = values.map(row => [...row]);

  const rowCount = endRow - startRow + 1;
  const colCount = endCol - startCol + 1;

  if (rowCount < 2 && colCount < 2) return values; // Nothing to interpolate

  // 1D Horizontal (Row)
  if (rowCount === 1) {
    const leftVal = values[startRow][startCol];
    const rightVal = values[startRow][endCol];
    for (let c = startCol; c <= endCol; c++) {
      const step = (c - startCol) / (endCol - startCol);
      newValues[startRow][c] = Math.round(leftVal + step * (rightVal - leftVal));
    }
  }
  // 1D Vertical (Column)
  else if (colCount === 1) {
    const topVal = values[startRow][startCol];
    const bottomVal = values[endRow][startCol];
    for (let r = startRow; r <= endRow; r++) {
      const step = (r - startRow) / (endRow - startRow);
      newValues[r][startCol] = Math.round(topVal + step * (bottomVal - topVal));
    }
  }
  // 2D Bilinear
  else {
    const vTL = values[startRow][startCol];
    const vTR = values[startRow][endCol];
    const vBL = values[endRow][startCol];
    const vBR = values[endRow][endCol];

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const tr = (r - startRow) / (rowCount - 1);
        const tc = (c - startCol) / (colCount - 1);

        // Linear along top and bottom
        const top = vTL + tc * (vTR - vTL);
        const bottom = vBL + tc * (vBR - vBL);

        // Linear between top and bottom
        newValues[r][c] = Math.round(top + tr * (bottom - top));
      }
    }
  }

  return newValues;
};

/**
 * Apply a math operation to a selected block
 * @param {string} op - 'add' | 'multiply' | 'fill'
 */
export const applyMathOp = (values, selection, op, amount) => {
  const { startRow, startCol, endRow, endCol } = selection;
  const newValues = values.map(row => [...row]);

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      let val = newValues[r][c];
      if (op === 'add') val += amount;
      if (op === 'multiply') val *= amount;
      if (op === 'fill') val = amount;
      
      newValues[r][c] = Math.round(val);
    }
  }
  return newValues;
};

/**
 * Smoothing function (Gaussian-like average)
 */
export const smoothBlock = (values, selection) => {
    const { startRow, startCol, endRow, endCol } = selection;
    const newValues = values.map(row => [...row]);
    const original = values.map(row => [...row]);

    for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
            // Simple 3x3 box average if within bounds
            let sum = 0;
            let count = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (original[nr] && original[nr][nc] !== undefined) {
                        sum += original[nr][nc];
                        count++;
                    }
                }
            }
            newValues[r][c] = Math.round(sum / count);
        }
    }
    return newValues;
}
