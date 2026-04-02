import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Minus,
  Percent,
  ChevronRight,
  MousePointer2,
  Maximize2,
  Undo2,
  Redo2,
  Calculator,
  Grid,
  Activity,
  X,
  Box,
  SlidersHorizontal,
  Copy,
} from "lucide-react";
import SurfacePlot3D from "../components/SurfacePlot3D.jsx";
import {
  interpolateBlock,
  applyMathOp,
  smoothBlock,
} from "../../shared/utils/tableMath";
import { useStore } from "../../../core/store/index.js";

const normalizeClipboardText = (text) => text.replace(/\r/g, "").trim();

const parseNumericToken = (token) => {
  const parsed = Number.parseFloat(token.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const parseClipboardMatrix = (text) => {
  const normalized = normalizeClipboardText(text);
  if (!normalized) {
    return { error: "Clipboard is empty." };
  }

  const rows = normalized
    .split("\n")
    .map((line) => line.split("\t").map((part) => part.trim()));

  const columnCount = rows[0]?.length ?? 0;
  if (!columnCount) {
    return { error: "Clipboard does not contain numeric cells." };
  }

  if (rows.some((row) => row.length !== columnCount)) {
    return { error: "Clipboard rows must have the same number of columns." };
  }

  const values = rows.map((row) =>
    row.map((token) => {
      const parsed = parseNumericToken(token);
      if (parsed === null) {
        throw new Error(`Invalid numeric value "${token || "blank"}".`);
      }
      return parsed;
    }),
  );

  return {
    values,
    rows: values.length,
    cols: columnCount,
  };
};

const formatSelectionForClipboard = (values, range, precision) =>
  values
    .slice(range.startRow, range.endRow + 1)
    .map((row) =>
      row
        .slice(range.startCol, range.endCol + 1)
        .map((cell) =>
          typeof cell === "number" && Number.isFinite(cell)
            ? cell.toFixed(precision)
            : `${cell ?? ""}`,
        )
        .join("\t"),
    )
    .join("\n");

const AXIS_SOURCE_LABELS = {
  ve: "VE Table 1",
  ve2: "VE Table 2",
  ign: "Ignition Table 1",
  ign2: "Ignition Table 2",
  afr: "AFR Target Table",
  lambda: "Lambda Target Table",
  staging: "Staged Injection",
  vvtTbl: "VVT Table 1",
  vvt2Tbl: "VVT Table 2",
  boostTbl: "Boost Table",
  boostDCLupTbl: "Boost DC Lookup",
};

const getAxisSourceDisplayName = (tableKey, axisType) =>
  `${AXIS_SOURCE_LABELS[tableKey] || tableKey} ${axisType === "rpm" ? "RPM" : "Load"} Axis`;

const TuningGrid = ({
  values,
  rpmAxis,
  loadAxis,
  onUpdate,
  minVal = 0,
  maxVal = 120,
  theme = "cyan",
  xAxisLabel = "Engine Speed (RPM)",
  yAxisLabel = "Load (MAP/TPS)",
  unitLabel = "UNIT",
  activePoint = null, // { rpm, load }
  secondaryValues = null, // Optional comparison data
  precision = 0, // Decimal places to show
}) => {
  const [selection, setSelection] = useState(null); // { r1, c1, r2, c2 }
  const [isSelecting, setIsSelecting] = useState(false);
  const [editing, setEditing] = useState(null); // { r, c }
  const [axisEditor, setAxisEditor] = useState(null); // { type: 'rpm'|'load', values, sourceKey }
  const [showContextMenu, setShowContextMenu] = useState(null); // { x, y }
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | '3d'
  const [setValueInput, setSetValueInput] = useState("");
  const [addValueInput, setAddValueInput] = useState("1");
  const [multiplyValueInput, setMultiplyValueInput] = useState("100");

  // Undo/Redo state
  const [showSecondary, setShowSecondary] = useState(false);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const notify = useStore((state) => state.notify);
  const storeTables = useStore((state) => state.tables);

  const containerRef = useRef(null);
  const valuesRef = useRef(values);
  const rpmAxisRef = useRef(rpmAxis);
  const loadAxisRef = useRef(loadAxis);
  const drag3DSessionRef = useRef(false);
  const contextMenuSizeRef = useRef({ width: 256, height: 260 });
  const setValueInputRef = useRef(null);
  const addValueInputRef = useRef(null);
  const multiplyValueInputRef = useRef(null);
  const contextMenuRef = useRef(null);

  useEffect(() => {
    valuesRef.current = values;
    rpmAxisRef.current = rpmAxis;
    loadAxisRef.current = loadAxis;
  }, [values, rpmAxis, loadAxis]);

  // Normalize selection bounds (ensure r1 <= r2)
  const normS = useMemo(() => {
    if (!selection) return null;
    return {
      r1: Math.min(selection.r1, selection.r2),
      c1: Math.min(selection.c1, selection.c2),
      r2: Math.max(selection.r1, selection.r2),
      c2: Math.max(selection.c1, selection.c2),
    };
  }, [selection]);

  const isSelected = (r, c) => {
    if (!normS) return false;
    return r >= normS.r1 && r <= normS.r2 && c >= normS.c1 && c <= normS.c2;
  };

  const selectionInfo = useMemo(() => {
    if (!normS) return null;

    const rows = normS.r2 - normS.r1 + 1;
    const cols = normS.c2 - normS.c1 + 1;
    const selectedValues = [];
    for (let r = normS.r1; r <= normS.r2; r += 1) {
      for (let c = normS.c1; c <= normS.c2; c += 1) {
        const value = values?.[r]?.[c];
        if (typeof value === "number" && Number.isFinite(value)) {
          selectedValues.push(value);
        }
      }
    }

    const sum = selectedValues.reduce((acc, value) => acc + value, 0);
    return {
      rows,
      cols,
      cells: rows * cols,
      min: selectedValues.length > 0 ? Math.min(...selectedValues) : null,
      max: selectedValues.length > 0 ? Math.max(...selectedValues) : null,
      average: selectedValues.length > 0 ? sum / selectedValues.length : null,
    };
  }, [normS, values]);

  const selectionRange = useCallback(() => {
    if (!normS) return null;
    return {
      startRow: normS.r1,
      startCol: normS.c1,
      endRow: normS.r2,
      endCol: normS.c2,
    };
  }, [normS]);

  const copySelectionToClipboard = useCallback(async () => {
    const range = selectionRange();
    if (!range) return;

    try {
      const text = formatSelectionForClipboard(values, range, precision);
      await navigator.clipboard.writeText(text);
      notify(
        `Copied ${range.endRow - range.startRow + 1}x${range.endCol - range.startCol + 1} block.`,
        "success",
        2500,
      );
    } catch {
      notify("Clipboard copy failed.", "error", 3000);
    }
  }, [selectionRange, values, precision, notify]);

  const pasteCellsFromClipboard = useCallback(
    async () => {
      const range = selectionRange();
      if (!range) return;

      let clipboardText = "";
      try {
        clipboardText = await navigator.clipboard.readText();
      } catch {
        notify("Clipboard paste failed.", "error", 3000);
        return;
      }

      let parsed;
      try {
        parsed = parseClipboardMatrix(clipboardText);
      } catch (error) {
        notify(error.message, "warning", 3500);
        return;
      }

      if (parsed.error) {
        notify(parsed.error, "warning", 3500);
        return;
      }

      const selectionRows = range.endRow - range.startRow + 1;
      const selectionCols = range.endCol - range.startCol + 1;
      const isSingleValue = parsed.rows === 1 && parsed.cols === 1;
      const isSingleCellSelection = selectionRows === 1 && selectionCols === 1;

      const targetRowLimit = isSingleCellSelection
        ? values.length - range.startRow
        : selectionRows;
      const targetColLimit = isSingleCellSelection
        ? (values[range.startRow]?.length ?? 0) - range.startCol
        : selectionCols;

      const newValues = values.map((row) => [...row]);
      let appliedRows = 0;
      let appliedCols = 0;

      if (isSingleValue && !isSingleCellSelection) {
        const fillValue = parsed.values[0][0];
        for (let row = range.startRow; row <= range.endRow; row += 1) {
          for (let col = range.startCol; col <= range.endCol; col += 1) {
            newValues[row][col] = fillValue;
          }
        }
        appliedRows = selectionRows;
        appliedCols = selectionCols;
      } else {
        appliedRows = Math.min(parsed.rows, targetRowLimit);
        appliedCols = Math.min(parsed.cols, targetColLimit);

        for (let rowOffset = 0; rowOffset < appliedRows; rowOffset += 1) {
          for (let colOffset = 0; colOffset < appliedCols; colOffset += 1) {
            newValues[range.startRow + rowOffset][range.startCol + colOffset] =
              parsed.values[rowOffset][colOffset];
          }
        }
      }

      if (!appliedRows || !appliedCols) {
        notify("Clipboard data does not fit the current table.", "warning", 3500);
        return;
      }

      updateWithHistory({ values: newValues });

      if (isSingleValue && !isSingleCellSelection) {
        notify(
          `Filled ${selectionRows}x${selectionCols} selection from one value.`,
          "success",
          2600,
        );
        return;
      }

      const clippedRows = parsed.rows > appliedRows;
      const clippedCols = parsed.cols > appliedCols;
      const partialRows =
        !clippedRows && parsed.rows < selectionRows && !isSingleCellSelection;
      const partialCols =
        !clippedCols && parsed.cols < selectionCols && !isSingleCellSelection;

      if (clippedRows || clippedCols) {
        notify(
          `Pasted ${appliedRows}x${appliedCols}. Extra cells were ignored.`,
          "warning",
          3200,
        );
        return;
      }

      if (partialRows || partialCols) {
        notify(
          `Pasted ${parsed.rows}x${parsed.cols}. Remaining cells were unchanged.`,
          "info",
          3000,
        );
        return;
      }

      notify(`Pasted ${appliedRows}x${appliedCols} block.`, "success", 2600);
    },
    [selectionRange, values, notify],
  );

  const clearSelection = useCallback(() => {
    setSelection(null);
    setShowContextMenu(null);
  }, []);

  const openAxisEditor = useCallback(
    (axisType) => {
      const sourceAxis = axisType === "rpm" ? rpmAxis : loadAxis;
      setAxisEditor({
        type: axisType,
        values: Array.from(sourceAxis || []),
        sourceKey: "",
      });
    },
    [rpmAxis, loadAxis],
  );

  const axisSourceOptions = useMemo(() => {
    if (!axisEditor?.type) return [];

    const expectedLength = axisEditor.values.length;
    return Object.entries(storeTables || {})
      .map(([tableKey, tableData]) => {
        const axisValues =
          axisEditor.type === "rpm" ? tableData?.rpmAxis : tableData?.loadAxis;
        if (!Array.isArray(axisValues) || axisValues.length !== expectedLength) {
          return null;
        }

        const currentAxis = axisEditor.type === "rpm" ? rpmAxis : loadAxis;
        const isCurrentAxis =
          axisValues.length === currentAxis.length &&
          axisValues.every((value, index) => value === currentAxis[index]);

        return {
          key: `${tableKey}:${axisEditor.type}`,
          tableKey,
          label: getAxisSourceDisplayName(tableKey, axisEditor.type),
          values: Array.from(axisValues),
          isCurrentAxis,
        };
      })
      .filter(Boolean);
  }, [axisEditor, storeTables, rpmAxis, loadAxis]);

  const updateAxisEditorValue = useCallback((index, nextValue) => {
    setAxisEditor((prev) => {
      if (!prev) return prev;
      const values = [...prev.values];
      values[index] = nextValue;
      return { ...prev, values, sourceKey: "" };
    });
  }, []);

  const applyAxisSource = useCallback(
    (sourceKey) => {
      const nextSource = axisSourceOptions.find((option) => option.key === sourceKey);
      if (!nextSource) return;

      setAxisEditor((prev) =>
        prev
          ? {
              ...prev,
              values: Array.from(nextSource.values),
              sourceKey,
            }
          : prev,
      );
      notify(`Loaded ${nextSource.label}.`, "info", 2400);
    },
    [axisSourceOptions, notify],
  );

  const saveAxisEditor = useCallback(() => {
    if (!axisEditor) return;

    const invalidIndex = axisEditor.values.findIndex((value) => {
      const parsed = Number.parseFloat(`${value}`.trim());
      return !Number.isFinite(parsed);
    });

    if (invalidIndex >= 0) {
      notify(`Breakpoint ${invalidIndex + 1} is invalid.`, "warning", 3200);
      return;
    }

    const nextAxis = axisEditor.values.map((value) => Number.parseFloat(`${value}`));
    updateWithHistory(
      axisEditor.type === "rpm" ? { rpmAxis: nextAxis } : { loadAxis: nextAxis },
    );
    notify(
      `${axisEditor.type === "rpm" ? "RPM" : "Load"} axis updated.`,
      "success",
      2500,
    );
    setAxisEditor(null);
  }, [axisEditor, notify]);

  const handleEmptyAreaMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      if (e.target !== e.currentTarget) return;
      clearSelection();
    },
    [clearSelection],
  );

  const handleMouseDown = (r, c, e) => {
    if (e.button !== 0) return; // Left click only
    setEditing(null);
    setIsSelecting(true);
    setSelection({ r1: r, c1: c, r2: r, c2: c });
  };

  const handleMouseEnter = (r, c) => {
    if (isSelecting) {
      setSelection((prev) => ({ ...prev, r2: r, c2: c }));
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  useEffect(() => {
    if (!showContextMenu) return undefined;

    const handlePointerDown = (event) => {
      if (contextMenuRef.current?.contains(event.target)) return;
      setShowContextMenu(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showContextMenu]);

  const heatColor = (val) => {
    if (val === undefined) return "transparent";
    const pct = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));

    // 7-Stop Smooth Rainbow (Violet -> Blue -> Cyan -> Green -> Yellow -> Orange -> Red)
    // Less contrasty, more uniform lightness
    const stops = [
      { pct: 0.0, h: 280 }, // Violet
      { pct: 0.16, h: 240 }, // Blue
      { pct: 0.33, h: 180 }, // Cyan
      { pct: 0.5, h: 120 }, // Green
      { pct: 0.66, h: 60 }, // Yellow
      { pct: 0.83, h: 30 }, // Orange
      { pct: 1.0, h: 0 }, // Red
    ];

    let hue;
    for (let i = 0; i < stops.length - 1; i++) {
      const s1 = stops[i];
      const s2 = stops[i + 1];
      if (pct >= s1.pct && pct <= s2.pct) {
        const ratio = (pct - s1.pct) / (s2.pct - s1.pct);
        hue = s1.h + ratio * (s2.h - s1.h);
        break;
      }
    }
    if (hue === undefined) hue = stops[stops.length - 1].h;

    // Use uniform lightness to avoid "Too Contrasty" feel
    const lightness = 32 + pct * 15; // Smooth 32% to 47%

    return {
      bg: `hsl(${hue}, 100%, ${lightness}%)`,
      text: pct > 0.45 && pct < 0.75 ? "#000" : "#fff",
    };
  };

  const handleInterpolate = () => {
    const range = selectionRange();
    if (!range) return;
    const newValues = interpolateBlock(values, range);
    updateWithHistory({ values: newValues });
    setShowContextMenu(null);
  };

  const handleMath = (op, amount) => {
    const range = selectionRange();
    if (!range) return;
    const newValues = applyMathOp(values, range, op, amount);
    updateWithHistory({ values: newValues });
    setShowContextMenu(null);
  };

  const handleSmooth = () => {
    const range = selectionRange();
    if (!range) return;
    const newValues = smoothBlock(values, range);
    updateWithHistory({ values: newValues });
    setShowContextMenu(null);
  };

  const handleSetValue = () => {
    const range = selectionRange();
    if (!range) return;
    const nextValue = Number.parseFloat(setValueInput);
    if (!Number.isFinite(nextValue)) return;
    const newValues = values.map((row, ri) =>
      row.map((cell, ci) =>
        ri >= range.startRow &&
        ri <= range.endRow &&
        ci >= range.startCol &&
        ci <= range.endCol
          ? nextValue
          : cell,
      ),
    );
    updateWithHistory({ values: newValues });
    setShowContextMenu(null);
  };

  const openSetValueEditor = useCallback(() => {
    setShowContextMenu(null);
    window.requestAnimationFrame(() => {
      setValueInputRef.current?.focus();
      setValueInputRef.current?.select?.();
      setValueInputRef.current?.scrollIntoView?.({
        block: "nearest",
        behavior: "smooth",
      });
    });
  }, []);

  const focusSelectionInput = useCallback((target) => {
    const refMap = {
      set: setValueInputRef,
      add: addValueInputRef,
      multiply: multiplyValueInputRef,
    };

    setShowContextMenu(null);
    window.requestAnimationFrame(() => {
      refMap[target]?.current?.focus();
      refMap[target]?.current?.select?.();
      refMap[target]?.current?.scrollIntoView?.({
        block: "nearest",
        behavior: "smooth",
      });
    });
  }, []);

  const handleContextSetValue = useCallback(() => {
    const nextValue = Number.parseFloat(setValueInput);
    if (Number.isFinite(nextValue)) {
      handleSetValue();
      return;
    }
    openSetValueEditor();
  }, [setValueInput, openSetValueEditor]);

  const clampContextMenuPosition = useCallback((x, y) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = contextMenuSizeRef.current.width;
    const menuHeight = contextMenuSizeRef.current.height;
    const gutter = 12;

    return {
      x: Math.max(gutter, Math.min(x, viewportWidth - menuWidth - gutter)),
      y: Math.max(gutter, Math.min(y, viewportHeight - menuHeight - gutter)),
    };
  }, []);

  // History wrappers
  const updateWithHistory = (newPartial) => {
    // Current state is values, rpmAxis, loadAxis
    setHistory((prev) => [{ values, rpmAxis, loadAxis }, ...prev.slice(0, 49)]); // Cap at 50
    setFuture([]);
    onUpdate(newPartial);
  };

  const begin3DChange = useCallback(() => {
    if (drag3DSessionRef.current) return;
    drag3DSessionRef.current = true;
    setHistory((prev) => [
      {
        values: valuesRef.current,
        rpmAxis: rpmAxisRef.current,
        loadAxis: loadAxisRef.current,
      },
      ...prev.slice(0, 49),
    ]);
    setFuture([]);
  }, []);

  const end3DChange = useCallback(() => {
    drag3DSessionRef.current = false;
  }, []);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const [last, ...remaining] = history;
    setFuture((prev) => [{ values, rpmAxis, loadAxis }, ...prev]);
    onUpdate(last);
    setHistory(remaining);
  }, [history, values, rpmAxis, loadAxis, onUpdate]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const [next, ...remaining] = future;
    setHistory((prev) => [{ values, rpmAxis, loadAxis }, ...prev]);
    onUpdate(next);
    setFuture(remaining);
  }, [future, values, rpmAxis, loadAxis, onUpdate]);

  // Helper to find interpolated pixel position of a coordinate
  const getPointPosition = useCallback(
    (rpm, load) => {
      if (!rpmAxis.length || !loadAxis.length) return null;

      // Find neighbors in axes
      const findIdx = (axis, val) => {
        for (let i = 0; i < axis.length - 1; i++) {
          if (val >= axis[i] && val <= axis[i + 1]) {
            const pct = (val - axis[i]) / (axis[i + 1] - axis[i]);
            return i + pct;
          }
        }
        if (val < axis[0]) return 0;
        return axis.length - 1;
      };

      const colIdx = findIdx(rpmAxis, rpm);
      const rowIdx = findIdx(loadAxis, load);

      return { r: rowIdx, c: colIdx };
    },
    [rpmAxis, loadAxis],
  );

  const activePos = useMemo(() => {
    if (!activePoint) return null;
    return getPointPosition(activePoint.rpm, activePoint.load);
  }, [activePoint, getPointPosition]);

  // Handle Hotkeys
  useEffect(() => {
    const onKeyDown = (e) => {
      const target = e.target;
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // 1. History
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.altKey && e.key === "1") {
        e.preventDefault();
        focusSelectionInput("set");
        return;
      }
      if (e.altKey && e.key === "2") {
        e.preventDefault();
        focusSelectionInput("add");
        return;
      }
      if (e.altKey && e.key === "3") {
        e.preventDefault();
        focusSelectionInput("multiply");
        return;
      }

      if (!isTypingTarget && e.ctrlKey && e.key.toLowerCase() === "c") {
        if (normS) {
          e.preventDefault();
          copySelectionToClipboard();
        }
        return;
      }

      if (!isTypingTarget && e.ctrlKey && e.key.toLowerCase() === "v") {
        if (normS) {
          e.preventDefault();
          pasteCellsFromClipboard();
        }
        return;
      }

      if (editing || isTypingTarget) return;

      if (e.key === "Escape") {
        e.preventDefault();
        clearSelection();
        setEditing(null);
        setAxisEditor(null);
        return;
      }

      if (!normS) return;

      // 2. Map Ops
      if (e.key === "i" || e.key === "I") handleInterpolate();
      if (e.key === "s" || e.key === "S") handleSmooth();
      if (e.key === "+")
        updateWithHistory({
          values: applyMathOp(
            values,
            {
              startRow: normS.r1,
              startCol: normS.c1,
              endRow: normS.r2,
              endCol: normS.c2,
            },
            "add",
            1,
          ),
        });
      if (e.key === "-")
        updateWithHistory({
          values: applyMathOp(
            values,
            {
              startRow: normS.r1,
              startCol: normS.c1,
              endRow: normS.r2,
              endCol: normS.c2,
            },
            "add",
            -1,
          ),
        });
      if (e.key === "p" || e.key === "P")
        updateWithHistory({
          values: applyMathOp(
            values,
            {
              startRow: normS.r1,
              startCol: normS.c1,
              endRow: normS.r2,
              endCol: normS.c2,
            },
            "multiply",
            1.05,
          ),
        });
      if (e.key === "m" || e.key === "M")
        updateWithHistory({
          values: applyMathOp(
            values,
            {
              startRow: normS.r1,
              startCol: normS.c1,
              endRow: normS.r2,
              endCol: normS.c2,
            },
            "multiply",
            0.95,
          ),
        });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    normS,
    editing,
    values,
    history,
    future,
    handleUndo,
    handleRedo,
    clearSelection,
    focusSelectionInput,
    copySelectionToClipboard,
    pasteCellsFromClipboard,
  ]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (!normS) return;
    setShowContextMenu(clampContextMenuPosition(e.clientX, e.clientY));
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full bg-[#0d0e12] rounded-3xl border border-white/5 overflow-hidden flex flex-col shadow-2xl"
      onContextMenu={handleContextMenu}
    >
      {/* Table Metadata / Legend */}
      <div className="flex items-center justify-between p-4 bg-black/40 border-b border-white/5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <MousePointer2 size={12} className="text-neon-cyan" />
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              Select Block
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Grid size={12} className="text-white/40" />
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              16x16 Grid
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === "grid" ? "bg-neon-cyan text-black" : "text-white/40 hover:text-white"}`}
            >
              <Grid size={12} />
              Grid
            </button>
            <button
              onClick={() => setViewMode("3d")}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === "3d" ? "bg-neon-cyan text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]" : "text-white/40 hover:text-white"}`}
            >
              <Box size={12} />
              3D View
            </button>
            {secondaryValues && viewMode === "3d" && (
              <button
                onClick={() => setShowSecondary(!showSecondary)}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${showSecondary ? "bg-neon-magenta text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]" : "text-white/40 hover:text-white"}`}
              >
                <Activity size={12} />
                Ghost Mode
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-2 flex flex-col min-h-0 bg-[#0a0b10]">
        <AnimatePresence mode="wait">
          {viewMode === "grid" ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* Axis Label Header */}
              <div
                className="flex items-center mb-1 pl-20 pr-4"
                onMouseDown={handleEmptyAreaMouseDown}
              >
                <div className="h-px flex-1 bg-white/5" />
                <span className="px-4 text-[9px] font-orbitron font-black text-neon-cyan uppercase tracking-[0.3em] opacity-80">
                  {xAxisLabel}
                </span>
                <div className="h-px flex-1 bg-white/5" />
              </div>

              <div className="flex flex-1 min-h-0 overflow-hidden relative">
                {/* Vertical Axis Label */}
                <div
                  className="w-6 flex flex-col items-center justify-center sticky left-0 z-40 py-8"
                  onMouseDown={handleEmptyAreaMouseDown}
                >
                  <div className="h-full w-px bg-white/5 absolute left-1/2 -translate-x-1/2" />
                  <span className="text-[9px] font-orbitron font-black text-neon-cyan uppercase tracking-[0.3em] whitespace-nowrap rotate-[-90deg] bg-[#0a0b10] py-2 z-10 opacity-80">
                    {yAxisLabel}
                  </span>
                </div>

                <div
                  className="flex-1 overflow-auto custom-scrollbar select-none relative"
                  onMouseDown={handleEmptyAreaMouseDown}
                >
                  {/* Realtime Cursor Layer */}
                  <AnimatePresence>
                    {activePos && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                          scale: 1,
                          opacity: 1,
                          top: `${(activePos.r * 100) / (loadAxis.length - 1)}%`,
                          left: `${(activePos.c * 100) / (rpmAxis.length - 1)}%`,
                        }}
                        className="absolute z-50 pointer-events-none"
                        style={{
                          transform: "translate(-50%, -50%)",
                          marginTop: "38px",
                          marginLeft: "80px",
                        }}
                      >
                        <div className="w-8 h-8 rounded-full bg-neon-magenta/20 border-2 border-neon-magenta shadow-[0_0_20px_rgba(236,72,153,0.8)] flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white shadow-glow-white" />
                          <div className="absolute inset-x-[-15px] h-px bg-neon-magenta/40" />
                          <div className="absolute inset-y-[-15px] w-px bg-neon-magenta/40" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="inline-block min-w-full">
                    <table className="border-separate border-spacing-[2px] w-full table-fixed">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-30 bg-[#161821] p-2 text-right border-b border-r border-white/10 w-20 shadow-[5px_0_10px_rgba(0,0,0,0.5)]">
                            <span className="text-[8px] font-orbitron font-black text-white/20 uppercase tracking-widest leading-none block transform -translate-y-0.5">
                              {unitLabel}
                            </span>
                          </th>
                          {rpmAxis.map((r, i) => (
                            <th
                              key={i}
                              onClick={() => openAxisEditor("rpm")}
                              className="p-2 bg-[#11131a] text-[9px] font-mono font-black text-gray-400 border-b border-white/10 min-w-[42px] cursor-pointer group/th hover:bg-white/5 transition-all"
                            >
                              <span className="group-hover/th:text-neon-cyan transition-colors">
                                {r}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {values.map((row, ri) => (
                          <tr key={ri} className="h-9 group/tr">
                            <td
                              onClick={() => openAxisEditor("load")}
                              className="sticky left-0 z-20 bg-[#11131a] p-2 text-right text-[9px] font-mono font-black border-r border-white/5 text-gray-400 group-hover/tr:bg-white/5 transition-all cursor-pointer"
                            >
                              <span className="group-hover/tr:text-neon-cyan transition-colors">
                                {loadAxis[ri]}
                              </span>
                            </td>
                            {row.map((cell, ci) => {
                              const active = isSelected(ri, ci);
                              const isEd =
                                editing?.r === ri && editing?.c === ci;

                              return (
                                <td
                                  key={ci}
                                  onMouseDown={(e) =>
                                    handleMouseDown(ri, ci, e)
                                  }
                                  onMouseEnter={() => handleMouseEnter(ri, ci)}
                                  onDoubleClick={() =>
                                    setEditing({ r: ri, c: ci })
                                  }
                                  style={{
                                    backgroundColor: heatColor(cell).bg,
                                    color: heatColor(cell).text,
                                    boxShadow: active
                                      ? "0 0 0 1px rgba(0, 0, 0, 0.58)"
                                      : "none",
                                    borderRadius: "4px",
                                  }}
                                  className={`
                                          relative transition-all duration-75 text-center
                                          ${active ? "z-10 scale-[1.05]" : "z-0 opacity-90"}
                                          group/cell
                                      `}
                                >
                                  <div className="absolute inset-0 bg-white/0 group-hover/cell:bg-white/10 pointer-events-none transition-colors rounded-[4px]" />
                                  {active ? (
                                    <>
                                      <div className="absolute inset-0 rounded-[4px] bg-black/30 pointer-events-none z-[1]" />
                                      <div className="absolute inset-[2px] rounded-[3px] border border-dashed border-white pointer-events-none z-[2]" />
                                    </>
                                  ) : null}
                                  {isEd ? (
                                    <input
                                      autoFocus
                                      type="number"
                                      defaultValue={cell}
                                      onBlur={(e) => {
                                        const v = [
                                          ...values.map((r) => [...r]),
                                        ];
                                        v[ri][ci] = parseFloat(e.target.value);
                                        updateWithHistory({ values: v });
                                        setEditing(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") e.target.blur();
                                        if (e.key === "Escape")
                                          setEditing(null);
                                      }}
                                      className="absolute inset-0 w-full h-full bg-white text-black font-mono font-black text-[11px] text-center outline-none ring-4 ring-neon-cyan z-50 rounded-sm"
                                    />
                                  ) : (
                                    <div className="relative z-[3] flex items-center justify-center h-full">
                                      <span
                                        style={{
                                          textShadow:
                                            "0 1px 3px rgba(0,0,0,0.8)",
                                        }}
                                        className="text-[10px] font-mono font-black text-white/90"
                                      >
                                        {typeof cell === "number"
                                          ? cell.toFixed(precision)
                                          : cell}
                                      </span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="3d"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <SurfacePlot3D
                values={values}
                rpmAxis={rpmAxis}
                loadAxis={loadAxis}
                minVal={minVal}
                maxVal={maxVal}
                xAxisLabel={xAxisLabel}
                yAxisLabel={yAxisLabel}
                unitLabel={unitLabel}
                activePoint={
                  activePoint
                    ? {
                        ...activePoint,
                        value:
                          values[Math.floor(activePos?.r || 0)][
                            Math.floor(activePos?.c || 0)
                          ],
                      }
                    : null
                }
                secondaryValues={showSecondary ? secondaryValues : null}
                selection={normS}
                onSelect={(r, c) => {
                  setEditing(null);
                  setIsSelecting(false);
                  setSelection({ r1: r, c1: c, r2: r, c2: c });
                }}
                onEditStart={begin3DChange}
                onEditEnd={end3DChange}
                onUpdateValue={(r, c, val) => {
                  const newValues = values.map((row, ri) =>
                    ri === r
                      ? row.map((cell, ci) => (ci === c ? val : cell))
                      : [...row],
                  );
                  onUpdate({ values: newValues });
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-white/5 bg-black/30 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <Maximize2 size={13} className="text-neon-cyan" />
            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">
              Selection Tools
            </span>
            <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white/25">
              Esc Deselect
            </span>
            <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white/25">
              Ctrl+C Copy
            </span>
            <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white/25">
              Ctrl+V Paste
            </span>
            <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white/25">
              Click Axis Edit
            </span>
          </div>
          {selectionInfo ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-black uppercase tracking-widest text-white/35">
              <span>
                {selectionInfo.rows} x {selectionInfo.cols}
              </span>
              <span>{selectionInfo.cells} cells</span>
              {selectionInfo.min !== null && (
                <span>min {selectionInfo.min.toFixed(precision)}</span>
              )}
              {selectionInfo.max !== null && (
                <span>max {selectionInfo.max.toFixed(precision)}</span>
              )}
              {selectionInfo.average !== null && (
                <span>
                  avg {selectionInfo.average.toFixed(Math.max(precision, 1))}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[9px] font-black uppercase tracking-widest text-white/20">
              Select a block to enable tools
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <SelectionInputCard
              icon={Calculator}
              label="Set Value"
              hotkey="Alt+1"
              value={setValueInput}
              setValue={setSetValueInput}
              placeholder="95"
              suffix={unitLabel}
              disabled={!normS}
              actionLabel="Apply"
              onAction={handleSetValue}
              inputRef={setValueInputRef}
            />
            <SelectionInputCard
              icon={Plus}
              label="Add"
              hotkey="Alt+2"
              value={addValueInput}
              setValue={setAddValueInput}
              placeholder="1"
              suffix={unitLabel}
              disabled={!normS}
              actionLabel="Apply"
              onAction={() => {
                const amount = Number.parseFloat(addValueInput);
                if (!Number.isFinite(amount)) return;
                handleMath("add", amount);
              }}
              inputRef={addValueInputRef}
            />
            <SelectionInputCard
              icon={Percent}
              label="Multiply %"
              hotkey="Alt+3"
              value={multiplyValueInput}
              setValue={setMultiplyValueInput}
              placeholder="100"
              suffix="%"
              disabled={!normS}
              actionLabel="Apply"
              onAction={() => {
                const amount = Number.parseFloat(multiplyValueInput);
                if (!Number.isFinite(amount)) return;
                handleMath("multiply", amount / 100);
              }}
              inputRef={multiplyValueInputRef}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-2">
            <ActionButton
              icon={Undo2}
              label="Undo"
              hotkey="Ctrl+Z"
              onClick={handleUndo}
              disabled={history.length === 0}
            />
            <ActionButton
              icon={Redo2}
              label="Redo"
              hotkey="Ctrl+Y"
              onClick={handleRedo}
              disabled={future.length === 0}
            />
            <ActionButton
              icon={Calculator}
              label="Interpolate"
              hotkey="I"
              onClick={handleInterpolate}
              disabled={!normS}
            />
            <ActionButton
              icon={Activity}
              label="Smooth"
              hotkey="S"
              onClick={handleSmooth}
              disabled={!normS}
            />
            <ActionButton
              icon={Plus}
              label="+10%"
              hotkey="P"
              onClick={() => handleMath("multiply", 1.1)}
              disabled={!normS}
            />
            <ActionButton
              icon={Minus}
              label="-10%"
              hotkey="M"
              onClick={() => handleMath("multiply", 0.9)}
              disabled={!normS}
            />
            <ActionButton
              icon={Plus}
              label="+1"
              hotkey="+"
              onClick={() => handleMath("add", 1)}
              disabled={!normS}
            />
            <ActionButton
              icon={Minus}
              label="-1"
              hotkey="-"
              onClick={() => handleMath("add", -1)}
              disabled={!normS}
            />
          </div>
        </div>
      </div>

      {/* Context Menu Portal */}
      <AnimatePresence>
        {axisEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="w-full max-w-3xl rounded-[28px] border border-white/8 bg-[#0d1017]/95 shadow-2xl overflow-hidden"
            >
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/6 bg-white/[0.03]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan">
                      <SlidersHorizontal size={14} />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-black uppercase tracking-[0.18em] text-white">
                        Edit {axisEditor.type === "rpm" ? xAxisLabel : yAxisLabel}
                      </h3>
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/35">
                        {axisEditor.values.length} breakpoints
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-white/40 max-w-xl leading-relaxed">
                    Set each breakpoint directly, then save the full axis back into the table.
                  </p>
                </div>
                <button
                  onClick={() => setAxisEditor(null)}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-white/40 transition-colors hover:text-white hover:border-white/20"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3.5">
                  <div className="flex flex-wrap items-end gap-2.5">
                    <div className="flex-1 min-w-[220px]">
                      <label className="block text-[8px] font-black uppercase tracking-widest text-white/35 mb-2">
                        Copy From Existing Axis
                      </label>
                      <select
                        value={axisEditor.sourceKey}
                        onChange={(e) => applyAxisSource(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[11px] font-bold text-white outline-none focus:border-neon-cyan"
                      >
                        <option value="">Select axis source</option>
                        {axisSourceOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}{option.isCurrentAxis ? " (Current Match)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 min-w-[160px]">
                      <div className="flex items-center gap-2 text-neon-cyan mb-1">
                        <Copy size={12} />
                        <span className="text-[8px] font-black uppercase tracking-widest">
                          Modal Hint
                        </span>
                      </div>
                      <p className="text-[9px] font-bold text-white/40 leading-relaxed">
                        Only axes with the same breakpoint count are listed here.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/25 p-3.5">
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {axisEditor.values.map((value, index) => (
                      <label key={index} className="space-y-1.5">
                        <span className="block text-[8px] font-black uppercase tracking-widest text-white/28">
                          Bin {index + 1}
                        </span>
                        <input
                          type="number"
                          value={value}
                          onChange={(e) =>
                            updateAxisEditorValue(index, e.target.value)
                          }
                          className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-[11px] font-mono font-black text-white outline-none focus:border-neon-cyan"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-white/6 bg-white/[0.02]">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/28">
                  Axis updates affect table structure immediately after save
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAxisEditor(null)}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[9px] font-black uppercase tracking-widest text-white/45 transition-colors hover:text-white hover:border-white/20"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAxisEditor}
                    className="rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 px-3.5 py-2.5 text-[9px] font-black uppercase tracking-widest text-neon-cyan transition-all hover:bg-neon-cyan hover:text-black"
                  >
                    Save Axis
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showContextMenu && (
          <motion.div
            ref={contextMenuRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            style={{ left: showContextMenu.x, top: showContextMenu.y }}
            className="fixed z-[100] w-64 glass-card border border-white/10 rounded-2xl p-2 shadow-3xl shadow-black/50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 mb-2">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                Map Operations
              </span>
              <button
                onClick={() => setShowContextMenu(null)}
                className="text-white/20 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-1">
              <MenuButton
                icon={Grid}
                label="Copy Selection"
                sub="Ctrl+C"
                onClick={() => {
                  copySelectionToClipboard();
                  setShowContextMenu(null);
                }}
              />
              <MenuButton
                icon={ChevronRight}
                label="Paste Selection"
                sub="Ctrl+V"
                onClick={() => {
                  pasteCellsFromClipboard();
                  setShowContextMenu(null);
                }}
              />
              <div className="h-px bg-white/5 my-1" />
              <MenuButton
                icon={Calculator}
                label="Interpolate"
                sub="Key: I"
                onClick={handleInterpolate}
              />
              <MenuButton
                icon={Activity}
                label="Smooth Selection"
                sub="Key: S"
                onClick={handleSmooth}
              />
              <MenuButton
                icon={Maximize2}
                label="Set Value"
                sub={
                  setValueInput
                    ? `Apply ${setValueInput} ${unitLabel}`
                    : "Focus editor below"
                }
                onClick={handleContextSetValue}
              />
              <div className="h-px bg-white/5 my-1" />
              <div className="grid grid-cols-2 gap-1 px-1">
                <ActionButton
                  icon={Plus}
                  label="+10%"
                  onClick={() => handleMath("multiply", 1.1)}
                />
                <ActionButton
                  icon={Minus}
                  label="-10%"
                  onClick={() => handleMath("multiply", 0.9)}
                />
                <ActionButton
                  icon={Plus}
                  label="+1"
                  onClick={() => handleMath("add", 1)}
                />
                <ActionButton
                  icon={Minus}
                  label="-1"
                  onClick={() => handleMath("add", -1)}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MenuButton = ({ icon: Icon, label, sub, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-white/5 text-left transition-all group"
  >
    <div className="p-1.5 rounded-lg bg-white/5 text-neon-cyan group-hover:bg-neon-cyan group-hover:text-black transition-all">
      {Icon && <Icon size={14} />}
    </div>
    <div className="flex-1">
      <div className="text-[11px] font-black text-white uppercase tracking-wider">
        {label}
      </div>
      <div className="text-[9px] text-white/20 font-black uppercase">{sub}</div>
    </div>
    <ChevronRight
      size={14}
      className="opacity-10 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
    />
  </button>
);

const ActionButton = ({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  hotkey = null,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="px-2 py-2 rounded-lg bg-white/5 border border-white/5 hover:border-neon-cyan/50 hover:bg-neon-cyan/10 transition-all text-center disabled:opacity-30 disabled:hover:border-white/5 disabled:hover:bg-white/5"
  >
    <div className="flex items-center justify-center gap-2">
      {Icon && <Icon size={12} className="text-neon-cyan" />}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-black text-white/60 uppercase">
          {label}
        </span>
        {hotkey ? (
          <span className="rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[8px] font-black uppercase tracking-widest text-white/25">
            {hotkey}
          </span>
        ) : null}
      </div>
    </div>
  </button>
);

const SelectionInputCard = ({
  icon: Icon,
  label,
  hotkey,
  value,
  setValue,
  placeholder,
  suffix,
  disabled,
  actionLabel,
  onAction,
  inputRef,
}) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="flex items-center gap-2">
        {Icon ? <Icon size={13} className="text-neon-cyan" /> : null}
        <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">
          {label}
        </span>
      </div>
      {hotkey ? (
        <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white/25">
          {hotkey}
        </span>
      ) : null}
    </div>
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAction();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] font-mono font-black text-white outline-none focus:border-neon-cyan disabled:opacity-40"
      />
      <span className="text-[9px] font-black uppercase tracking-widest text-white/25 min-w-7 text-center">
        {suffix}
      </span>
      <button
        onClick={onAction}
        disabled={disabled}
        className="rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 px-2.5 py-2 text-[9px] font-black uppercase tracking-widest text-neon-cyan transition-all hover:bg-neon-cyan hover:text-black disabled:opacity-30 disabled:hover:bg-neon-cyan/10 disabled:hover:text-neon-cyan"
      >
        {actionLabel}
      </button>
    </div>
  </div>
);

export default TuningGrid;
