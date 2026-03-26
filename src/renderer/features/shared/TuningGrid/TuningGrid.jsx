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
  Minimize2,
  Calculator,
  Grid,
  Activity,
  X,
  Box,
} from "lucide-react";
import SurfacePlot3D from "../components/SurfacePlot3D.jsx";
import {
  interpolateBlock,
  applyMathOp,
  smoothBlock,
} from "../../shared/utils/tableMath";

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
  const [editingAxis, setEditingAxis] = useState(null); // { type: 'rpm'|'load', index }
  const [showContextMenu, setShowContextMenu] = useState(null); // { x, y }
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | '3d'

  // Undo/Redo state
  const [showSecondary, setShowSecondary] = useState(false);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  const containerRef = useRef(null);

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
    if (!normS) return;
    const newValues = interpolateBlock(values, {
      startRow: normS.r1,
      startCol: normS.c1,
      endRow: normS.r2,
      endCol: normS.c2,
    });
    updateWithHistory({ values: newValues });
    setShowContextMenu(null);
  };

  const handleMath = (op, amount) => {
    if (!normS) return;
    const newValues = applyMathOp(
      values,
      {
        startRow: normS.r1,
        startCol: normS.c1,
        endRow: normS.r2,
        endCol: normS.c2,
      },
      op,
      amount,
    );
    updateWithHistory({ values: newValues });
    setShowContextMenu(null);
  };

  const handleSmooth = () => {
    if (!normS) return;
    const newValues = smoothBlock(values, {
      startRow: normS.r1,
      startCol: normS.c1,
      endRow: normS.r2,
      endCol: normS.c2,
    });
    updateWithHistory({ values: newValues });
    setShowContextMenu(null);
  };

  // History wrappers
  const updateWithHistory = (newPartial) => {
    // Current state is values, rpmAxis, loadAxis
    setHistory((prev) => [{ values, rpmAxis, loadAxis }, ...prev.slice(0, 49)]); // Cap at 50
    setFuture([]);
    onUpdate(newPartial);
  };

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

      if (editing) return;
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
  }, [normS, editing, values, history, future, handleUndo, handleRedo]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (!normS) return;
    setShowContextMenu({ x: e.clientX, y: e.clientY });
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
              <div className="flex items-center mb-1 pl-20 pr-4">
                <div className="h-px flex-1 bg-white/5" />
                <span className="px-4 text-[9px] font-orbitron font-black text-neon-cyan uppercase tracking-[0.3em] opacity-80">
                  {xAxisLabel}
                </span>
                <div className="h-px flex-1 bg-white/5" />
              </div>

              <div className="flex flex-1 min-h-0 overflow-hidden relative">
                {/* Vertical Axis Label */}
                <div className="w-6 flex flex-col items-center justify-center sticky left-0 z-40 py-8">
                  <div className="h-full w-px bg-white/5 absolute left-1/2 -translate-x-1/2" />
                  <span className="text-[9px] font-orbitron font-black text-neon-cyan uppercase tracking-[0.3em] whitespace-nowrap rotate-[-90deg] bg-[#0a0b10] py-2 z-10 opacity-80">
                    {yAxisLabel}
                  </span>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar select-none relative">
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
                              onDoubleClick={() =>
                                setEditingAxis({ type: "rpm", index: i })
                              }
                              className="p-2 bg-[#11131a] text-[9px] font-mono font-black text-gray-400 border-b border-white/10 min-w-[42px] cursor-ns-resize group/th hover:bg-white/5 transition-all"
                            >
                              {editingAxis?.type === "rpm" &&
                              editingAxis.index === i ? (
                                <input
                                  autoFocus
                                  type="number"
                                  defaultValue={r}
                                  onBlur={(e) => {
                                    const newAxis = [...rpmAxis];
                                    newAxis[i] = parseInt(e.target.value);
                                    onUpdate({ rpmAxis: newAxis });
                                    setEditingAxis(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") e.target.blur();
                                    if (e.key === "Escape")
                                      setEditingAxis(null);
                                  }}
                                  className="w-full bg-white text-black font-mono font-black text-center outline-none ring-2 ring-neon-cyan rounded-sm"
                                />
                              ) : (
                                <span className="group-hover/th:text-neon-cyan transition-colors">
                                  {r}
                                </span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {values.map((row, ri) => (
                          <tr key={ri} className="h-8 group/tr">
                            <td
                              onDoubleClick={() =>
                                setEditingAxis({ type: "load", index: ri })
                              }
                              className="sticky left-0 z-20 bg-[#11131a] p-2 text-right text-[9px] font-mono font-black border-r border-white/5 text-gray-400 group-hover/tr:bg-white/5 transition-all cursor-ew-resize"
                            >
                              {editingAxis?.type === "load" &&
                              editingAxis.index === ri ? (
                                <input
                                  autoFocus
                                  type="number"
                                  defaultValue={loadAxis[ri]}
                                  onBlur={(e) => {
                                    const newAxis = [...loadAxis];
                                    newAxis[ri] = parseInt(e.target.value);
                                    onUpdate({ loadAxis: newAxis });
                                    setEditingAxis(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") e.target.blur();
                                    if (e.key === "Escape")
                                      setEditingAxis(null);
                                  }}
                                  className="w-full bg-white text-black font-mono font-black text-center outline-none ring-2 ring-neon-cyan rounded-sm"
                                />
                              ) : (
                                <span className="group-hover/tr:text-neon-cyan transition-colors">
                                  {loadAxis[ri]}
                                </span>
                              )}
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
                                    backgroundColor: active
                                      ? "rgba(6, 182, 212, 1)"
                                      : heatColor(cell).bg,
                                    color: active
                                      ? "#000"
                                      : heatColor(cell).text,
                                    boxShadow: active
                                      ? "0 0 25px rgba(6, 182, 212, 0.4), inset 0 0 20px rgba(255,255,255,0.2)"
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
                                    <div className="flex items-center justify-center h-full">
                                      <span
                                        style={{
                                          textShadow:
                                            "0 1px 3px rgba(0,0,0,0.8)",
                                        }}
                                        className={`text-[10px] font-mono font-black ${active ? "text-white" : "text-white/90"}`}
                                      >
                                        {typeof cell === "number" ? cell.toFixed(precision) : cell}
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

      {/* Context Menu Portal */}
      <AnimatePresence>
        {showContextMenu && (
          <motion.div
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
                icon={Calculator}
                label="Interpolate (2D)"
                sub="Key: I"
                onClick={handleInterpolate}
              />
              <MenuButton
                icon={Activity}
                label="Smooth Selection"
                sub="Key: S"
                onClick={handleSmooth}
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
    className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white/5 text-left transition-all group"
  >
    <div className="p-2 rounded-lg bg-white/5 text-neon-cyan group-hover:bg-neon-cyan group-hover:text-black transition-all">
      {Icon && <Icon size={16} />}
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

const ActionButton = ({ icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="p-2 rounded-lg bg-white/5 border border-white/5 hover:border-neon-cyan/50 hover:bg-neon-cyan/10 transition-all text-center"
  >
    <div className="flex items-center justify-center gap-2">
      {Icon && <Icon size={12} className="text-neon-cyan" />}
      <span className="text-[9px] font-black text-white/60 uppercase">
        {label}
      </span>
    </div>
  </button>
);

export default TuningGrid;
