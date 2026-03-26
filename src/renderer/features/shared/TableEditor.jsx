import { useCallback, useState } from "react";

// Color from deep blue (low) to neon cyan (mid) to neon red (high)
function heatColor(value, min, max) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  // Custom neon gradient: Deep Blue -> Cyan -> Green -> Orange -> Red
  if (pct < 0.25) return `rgba(0, 70, 255, ${0.3 + pct})`; // Deep Blue
  if (pct < 0.5) return `rgba(0, 212, 255, ${0.4 + pct})`; // Neon Cyan
  if (pct < 0.75) return `rgba(0, 255, 180, ${0.4 + pct})`; // Neon Green
  return `rgba(244, 63, 94, ${0.4 + pct})`; // Neon Red
}

export default function TableEditor({
  tableName,
  values,
  rpmAxis,
  loadAxis,
  onCellChange,
  minVal = 0,
  maxVal = 100,
}) {
  const [editing, setEditing] = useState(null); // { row, col }
  const [editVal, setEditVal] = useState("");

  const startEdit = useCallback(
    (row, col) => {
      setEditing({ row, col });
      setEditVal(String(values[row][col]));
    },
    [values],
  );

  const commitEdit = useCallback(
    (row, col) => {
      const num = parseFloat(editVal);
      if (!isNaN(num) && onCellChange) {
        onCellChange(row, col, Math.round(num));
      }
      setEditing(null);
    },
    [editVal, onCellChange],
  );

  const handleKeyDown = useCallback(
    (e, row, col) => {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        commitEdit(row, col);
      } else if (e.key === "Escape") {
        setEditing(null);
      }
    },
    [commitEdit],
  );

  if (!values || !rpmAxis || !loadAxis) return null;

  const numRows = values.length;
  const numCols = values[0]?.length ?? 0;

  return (
    <div className="overflow-auto w-full h-full custom-scrollbar glass rounded-xl border-white/5 relative">
      <table className="border-collapse text-[10px] font-mono w-full min-w-max">
        <thead>
          <tr className="bg-bg-primary/80 backdrop-blur-sm sticky top-0 z-20">
            <th className="sticky left-0 bg-bg-primary text-gray-400 p-2 text-right border-b border-r border-white/10 font-orbitron uppercase tracking-tighter w-20">
              Load\RPM
            </th>
            {rpmAxis.slice(0, numCols).map((r) => (
              <th
                key={r}
                className="text-gray-400 p-2 text-center border-b border-white/10 font-mono font-bold w-12 tracking-tighter"
              >
                {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {values.map((row, ri) => (
            <tr key={ri} className="group">
              <td className="sticky left-0 bg-bg-primary/95 text-gray-500 p-2 text-right font-bold border-r border-white/5 font-mono group-hover:text-neon-cyan transition-colors z-10 w-20">
                {loadAxis[ri] ?? ri}
              </td>
              {row.map((cell, ci) => {
                const isEditing = editing?.row === ri && editing?.col === ci;
                const bg = heatColor(cell, minVal, maxVal);
                return (
                  <td
                    key={ci}
                    style={{ backgroundColor: bg }}
                    className="text-center cursor-pointer border-b border-white/5 hover:border-white/20 transition-all select-none relative group/cell"
                    onDoubleClick={() => startEdit(ri, ci)}
                    title={`RPM: ${rpmAxis[ci]} | Load: ${loadAxis[ri]} | Val: ${cell}`}
                  >
                    <div className="absolute inset-0 bg-white/0 group-hover/cell:bg-white/10 transition-colors pointer-events-none" />
                    {isEditing ? (
                      <div className="relative z-30 p-0.5">
                        <input
                          autoFocus
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onBlur={() => commitEdit(ri, ci)}
                          onKeyDown={(e) => handleKeyDown(e, ri, ci)}
                          className="w-full bg-white/90 text-bg-deep text-center outline-none rounded shadow-2xl font-bold py-1 ring-2 ring-neon-cyan"
                        />
                      </div>
                    ) : (
                      <span className="text-white font-bold opacity-90 drop-shadow-sm inline-block w-12 py-2">
                        {cell}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sticky bottom-0 left-0 bg-bg-deep/80 backdrop-blur-md p-2 border-t border-white/5 flex gap-4 items-center">
        <span className="text-[9px] text-gray-500 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan glow-cyan" />{" "}
          Double-click to edit
        </span>
        <span className="text-[9px] text-gray-500 uppercase tracking-widest font-orbitron opacity-40">
          Speeduino 3D Map
        </span>
      </div>
    </div>
  );
}
