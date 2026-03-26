import React, { useState, useEffect } from "react";
import { useStore } from "../../../core/store.js";
import CurveEditor from "../../../ui/CurveEditor";
import { Activity } from "lucide-react";

export default function DwellVoltageCurve() {
  const currentProject = useStore((s) => s.currentProject);
  const updateConstants = useStore((s) => s.updateConstants);
  const constants = currentProject?.constants;

  const pages = constants?.pages || {};
  let pageId = null;
  let pData = null;
  if (pages[1]?.brvBins) {
    pageId = 1;
    pData = pages[1];
  } else if (pages[2]?.brvBins) {
    pageId = 2;
    pData = pages[2];
  } else {
    pageId = 1;
    pData = pages[1] || {};
  }

  // brvBins stored as V*10 (e.g. 60=6.0V), dwellRates as percent (0-255)
  const rawX = pData?.brvBins || [60, 92, 124, 156, 188, 220];
  const rawY = pData?.dwellRates || [102, 102, 100, 100, 95, 80];

  // Local display state (scaled for human readability)
  const [xValues, setXValues] = useState(() => rawX.map((v) => v / 10));
  const [yValues, setYValues] = useState(() => [...rawY]);

  // Sync from store when project loads/changes
  useEffect(() => {
    setXValues(rawX.map((v) => v / 10));
    setYValues([...rawY]);
  }, [currentProject]);

  const [hoverIdx, setHoverIdx] = useState(null);

  // CurveEditor calls onChange(fullXArray, fullYArray) -- NOT (idx, x, y)
  const handleCurveChange = (newX, newY) => {
    setXValues(newX);
    setYValues(newY);
    if (!pageId) return;
    updateConstants({
      pages: {
        ...(constants?.pages || {}),
        [pageId]: {
          ...pData,
          brvBins: newX.map((v) => Math.round(v * 10)),
          dwellRates: newY.map((v) => Math.round(v)),
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
            <Activity size={16} />
          </div>
          <div>
            <h3 className="text-[12px] font-black text-white/80 uppercase tracking-widest">
              Dwell Voltage Correction
            </h3>
            <p className="text-[10px] text-white/30 font-inter">
              Adjust nominal dwell time based on system voltage.
            </p>
          </div>
        </div>
      </div>
      <div className="bg-black/40 border border-white/5 rounded-xl p-4">
        <CurveEditor
          xValues={xValues}
          yValues={yValues}
          theme="purple"
          xLabel="Battery Voltage (V)"
          yLabel="Dwell (%)"
          xRange={{ min: 6, max: 22 }}
          yRange={{ min: 0, max: 255 }}
          precision={1}
          activeIdx={hoverIdx}
          onHoverPoint={setHoverIdx}
          onChange={handleCurveChange}
        />
      </div>
      <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-medium text-white/50 leading-relaxed font-inter">
        Adjust the nominal dwell time based on the system voltage. Values less
        than 100 remove dwell time and values greater than 100 add dwell time.
      </div>
    </div>
  );
}
