import { applyTableDrafts, displayTablesFromPages } from './utils/table.drafts.js';

function makeDefaultTable(baseValue) {
  return Array.from({ length: 16 }, (_, row) =>
    Array.from({ length: 16 }, (_, col) =>
      Math.round(baseValue + row * 1.5 + col * 0.5)
    )
  );
}

const VE_RPM_AXIS  = [500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000];
const VE_LOAD_AXIS = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180];

export const INITIAL_TABLES = {
  ve: {
    values: makeDefaultTable(65),
    rpmAxis: VE_RPM_AXIS,
    loadAxis: VE_LOAD_AXIS,
  },
  ve2: {
    values: makeDefaultTable(65),
    rpmAxis: VE_RPM_AXIS,
    loadAxis: VE_LOAD_AXIS,
  },
  ign: {
    values: makeDefaultTable(12),
    rpmAxis: VE_RPM_AXIS,
    loadAxis: VE_LOAD_AXIS,
  },
  ign2: {
    values: makeDefaultTable(12),
    rpmAxis: VE_RPM_AXIS,
    loadAxis: VE_LOAD_AXIS,
  },
  afr: {
    values: Array.from({ length: 16 }, () => Array(16).fill(14.7)),
    rpmAxis: VE_RPM_AXIS,
    loadAxis: VE_LOAD_AXIS,
  },
  lambda: {
    values: Array.from({ length: 16 }, () => Array(16).fill(1.0)),
    rpmAxis: VE_RPM_AXIS,
    loadAxis: VE_LOAD_AXIS,
  },
  staging: {
    values: Array.from({ length: 8 }, () => Array(8).fill(0)),
    rpmAxis: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
    loadAxis: [20, 40, 60, 80, 100, 120, 140, 160],
  },
  vvtTbl: {
    values: Array.from({ length: 8 }, () => Array(8).fill(0)),
    rpmAxis: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
    loadAxis: [20, 40, 60, 80, 100, 120, 140, 160],
  },
  vvt2Tbl: {
    values: Array.from({ length: 8 }, () => Array(8).fill(0)),
    rpmAxis: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
    loadAxis: [20, 40, 60, 80, 100, 120, 140, 160],
  },
  boostTbl: {
    values: Array.from({ length: 8 }, () => Array(8).fill(0)),
    rpmAxis: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
    loadAxis: [0, 20, 40, 60, 80, 100, 120, 140],
  },
  boostDCLupTbl: {
    values: Array.from({ length: 8 }, () => Array(8).fill(0)),
    rpmAxis: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
    loadAxis: [0, 20, 40, 60, 80, 100, 120, 140],
  },
};

function markDraft(state, key, tables) {
  const tableDrafts = { ...state.tableDrafts, [key]: true };
  if (key === 'afr' || key === 'lambda') {
    const alias = key === 'afr' ? 'lambda' : 'afr';
    try {
      const prepared = applyTableDrafts(state.currentProject, tables, state.parsedIni, { [key]: true });
      const views = displayTablesFromPages(state.parsedIni, prepared.constants.decodedPages, tables);
      tables = { ...tables, [alias]: views[alias] };
      delete tableDrafts[alias];
    } catch { /* Keep invalid input editable; Save reports the validation error. */ }
  }
  return { tables, tableDrafts };
}

export const createTableSlice = (set) => ({
  tables: INITIAL_TABLES,
  tableDrafts: {},

  setTableCell: (tableName, row, col, value) =>
    set((s) => {
      const table = s.tables[tableName];
      const newValues = table.values.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r
      );
      return markDraft(s, tableName, { ...s.tables, [tableName]: { ...table, values: newValues } });
    }),

  updateTable: (tableName, tableData, draft = false) =>
    set((s) => {
      const tables = { ...s.tables, [tableName]: { ...s.tables[tableName], ...tableData } };
      return draft ? markDraft(s, tableName, tables) : { tables };
    }),
});
