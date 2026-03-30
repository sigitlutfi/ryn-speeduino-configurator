import React, { useState, useEffect } from "react";
import { useStore } from "../../../core/store.js";
import CurveEditor from "../../../ui/CurveEditor";
import { Thermometer } from "lucide-react";
import { getDecodedPage } from "../../shared/utils/projectConstants.js";
import { getVarMetadata } from "../../../../shared/ini-parser.js";

function normalizeCurveArray(value, fallback) {
  if (Array.isArray(value)) return value;
  return fallback;
}

export default function IATRetardCurve() {
  const currentProject = useStore((s) => s.currentProject);
  const parsedIni = useStore((s) => s.parsedIni);
  const updateConstants = useStore((s) => s.updateConstants);
  const constants = currentProject?.constants;
  const pageId = getVarMetadata(parsedIni, "iatRetBins")?.page ?? 1;
  const pData = getDecodedPage(constants, pageId) || {};

  const rawX = normalizeCurveArray(pData?.iatRetBins, [20, 40, 60, 80, 100, 120]);
  const rawY = normalizeCurveArray(pData?.iatRetRates, [0, 0, 2, 4, 6, 10]);

  const [xValues, setXValues] = useState(() => [...rawX]);
  const [yValues, setYValues] = useState(() => [...rawY]);

  useEffect(() => {
    setXValues([...rawX]);
    setYValues([...rawY]);
  }, [currentProject]);

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
          iatRetBins: newX.map((v) => Math.round(v)),
          iatRetRates: newY.map((v) => Math.round(v)),
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
              IAT Retard Curve
            </h3>
            <p className="text-[10px] text-white/30 font-inter">
              Pull ignition timing when intake air temperature becomes
              dangerously high.
            </p>
          </div>
        </div>
      </div>
      <div className="bg-black/40 border border-white/5 rounded-xl p-4">
        <CurveEditor
          xValues={xValues}
          yValues={yValues}
          theme="purple"
          xLabel="Intake Air Temp (°C)"
          yLabel="Retard (Deg)"
          xRange={{ min: 0, max: 125 }}
          yRange={{ min: 0, max: 30 }}
          precision={0}
          activeIdx={hoverIdx}
          onHoverPoint={setHoverIdx}
          onChange={handleCurveChange}
          onCommit={handleCurveCommit}
        />
      </div>
      <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-medium text-white/50 leading-relaxed font-inter">
        Removes ignition timing based on intake air temperature to prevent
        detonation. Any number greater than 0 removes ignition timing.
      </div>
    </div>
  );
}
