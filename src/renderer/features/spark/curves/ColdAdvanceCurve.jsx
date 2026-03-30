import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../../../core/store.js";
import CurveEditor from "../../../ui/CurveEditor";
import { Thermometer } from "lucide-react";
import { getDecodedPage } from "../../shared/utils/projectConstants.js";
import { getVarMetadata } from "../../../../shared/ini-parser.js";
import { toDisplay, toRaw } from "../../shared/utils/normalization";

function normalizeCurveArray(value, fallback) {
  if (Array.isArray(value)) return value;
  return fallback;
}

export default function ColdAdvanceCurve() {
  const currentProject = useStore((s) => s.currentProject);
  const parsedIni = useStore((s) => s.parsedIni);
  const updateConstants = useStore((s) => s.updateConstants);
  const constants = currentProject?.constants;
  const xMeta = useMemo(() => getVarMetadata(parsedIni, "cltAdvBins"), [parsedIni]);
  const yMeta = useMemo(() => getVarMetadata(parsedIni, "cltAdvValues"), [parsedIni]);
  const pageId = xMeta?.page ?? yMeta?.page ?? 1;
  const pData = getDecodedPage(constants, pageId) || {};

  const rawX = useMemo(
    () => normalizeCurveArray(
      pData?.cltAdvBins,
      toRaw([-20, 0, 20, 40, 60, 80], xMeta),
    ),
    [pData?.cltAdvBins, xMeta],
  );
  const rawY = useMemo(
    () => normalizeCurveArray(
      pData?.cltAdvValues,
      toRaw([5, 4, 2, 0, 0, 0], yMeta),
    ),
    [pData?.cltAdvValues, yMeta],
  );
  const displayX = useMemo(() => toDisplay(rawX, xMeta) ?? [], [rawX, xMeta]);
  const displayY = useMemo(() => toDisplay(rawY, yMeta) ?? [], [rawY, yMeta]);

  const [xValues, setXValues] = useState(() => displayX);
  const [yValues, setYValues] = useState(() => displayY);

  useEffect(() => {
    setXValues(displayX);
    setYValues(displayY);
  }, [currentProject, displayX, displayY]);

  const [hoverIdx, setHoverIdx] = useState(null);

  const handleCurveChange = (newX, newY) => {
    setXValues(newX);
    setYValues(newY);
  };

  const handleCurveCommit = (newX, newY) => {
    if (!pageId) return;
    updateConstants({
      pages: {
        [pageId]: {
          ...pData,
          cltAdvBins: toRaw(newX, xMeta),
          cltAdvValues: toRaw(newY, yMeta),
        },
      },
    });
  };

  return (
    <div className="glass-card border border-white/5 rounded-2xl p-6 bg-black/20 flex flex-col gap-6 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-neon-purple/40" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-neon-purple/20 text-neon-purple">
            <Thermometer size={16} />
          </div>
          <div>
            <h3 className="text-[12px] font-black text-white/80 uppercase tracking-widest">
              Cold Advance Curve
            </h3>
            <p className="text-[10px] text-white/30 font-inter">
              Add extra timing to improve combustion stability during engine
              warm-up.
            </p>
          </div>
        </div>
      </div>
      <div className="bg-black/40 border border-white/5 rounded-xl p-4">
        <CurveEditor
          xValues={xValues}
          yValues={yValues}
          theme="purple"
          xLabel="Coolant Temp (°C)"
          yLabel="Advance (Deg)"
          xRange={{ min: -40, max: 120 }}
          yRange={{ min: -20, max: 20 }}
          precision={0}
          activeIdx={hoverIdx}
          onHoverPoint={setHoverIdx}
          onChange={handleCurveChange}
          onCommit={handleCurveCommit}
        />
      </div>
      <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-medium text-white/50 leading-relaxed font-inter">
        Used to advance ignition timing when the engine is warming up, improving
        low-temperature combustion stability.
      </div>
    </div>
  );
}
