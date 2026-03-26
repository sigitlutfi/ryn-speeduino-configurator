import React, { useMemo, useState } from "react";
import { useStore } from "../../core/store.js";
import TuningGrid from "../shared/TuningGrid/TuningGrid.jsx";
import { useTableSync } from "../shared/hooks/useTableSync.js";
import TuningHeader from "../shared/components/TuningHeader";
import { Activity } from "lucide-react";

export default function LambdaTable() {
  const currentProject = useStore((s) => s.currentProject);
  const constants = currentProject?.constants;
  const connection = useStore((s) => s.connection);
  
  // Stoich constant from Page 1 settings
  const stoich = useMemo(() => {
    if (!constants) return 14.7;
    const pages = constants.pages || {};
    const p1 = pages[1] || pages["1"] || pages[0] || pages["0"];
    return (p1?.stoich || 147) / 10;
  }, [constants]);

  // Transform Logic: AFR Bytes -> Lambda Units
  const lambdaTransform = useMemo(() => ({
    toDisplay: (val) => {
        // Handle unscaled (147) vs already scaled (14.7)
        const afr = val > 40 ? val / 10 : val;
        return parseFloat((afr / stoich).toFixed(3));
    },
    toRaw: (val) => {
        // Lambda -> AFR Bytes (val * stoich * 10)
        return Math.round(val * stoich * 10);
    }
  }), [stoich]);

  // Use the Centralized Normalized Hook with Custom Transform
  const { 
    values, rpmAxis, loadAxis, meta, update, handleSave, isDirty 
  } = useTableSync("lambda", "lambdaTable1Tbl", { transform: lambdaTransform });

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const algorithmId = useMemo(() => {
    if (!constants) return 0;
    const pages = constants.pages || {};
    const p1 = pages[1] || pages["1"] || pages[0] || pages["0"];
    return p1?.algorithm ?? 0;
  }, [constants]);

  const dynamicYLabel = useMemo(() => {
    if (!meta) return "Load";
    switch (algorithmId) {
      case 0: return "Fuel Load (MAP kPa)";
      case 1: return "Fuel Load (TPS %)";
      case 2: return "Fuel Load (MAP/BARO %)";
      case 3: return "Fuel Load (IMAP/EMAP %)";
      default: return meta.yLabel || "Load";
    }
  }, [meta, algorithmId]);

  const onSaveAction = async (isBurn = false) => {
    setIsSaving(true);
    setSaveStatus(null);
    const res = await handleSave(isBurn);
    setSaveStatus(res.ok ? "success" : "error");
    setIsSaving(false);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  if (!meta) return <div className="p-8 text-white/40 font-orbitron text-center mt-20 italic animate-pulse">Loading Lambda Table Metadata...</div>;

  return (
    <div className="p-0 h-full flex flex-col gap-0 overflow-hidden bg-transparent rounded-3xl">
      <TuningHeader
        title="Lambda Target Table"
        icon={Activity}
        description={`Lambda Targets — Stoich Core: ${stoich.toFixed(1)}`}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={connection.status === "connected"}
        isDirty={isDirty}
        onSave={() => onSaveAction(false)}
        onBurn={() => onSaveAction(true)}
        themeColor="cyan"
      />

      <div className="flex-1 p-6 flex flex-col min-h-0 bg-[#0a0b10] overflow-y-auto custom-scrollbar">
        <div className="min-h-[500px] flex-shrink-0">
          <TuningGrid
            values={values}
            rpmAxis={rpmAxis}
            loadAxis={loadAxis}
            onUpdate={update}
            minVal={0.5}
            maxVal={1.5}
            theme="cyan"
            xAxisLabel={meta.xLabel || "RPM"}
            yAxisLabel={dynamicYLabel}
            unitLabel="λ"
            precision={3}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Lambda 1.0</span>
            <span className="text-lg font-black text-neon-cyan">Perfect Balance</span>
            <span className="text-[9px] text-white/30 font-inter">Equivalent to {stoich.toFixed(1)} AFR</span>
          </div>
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Lambda &lt; 1.0</span>
            <span className="text-lg font-black text-amber-400">Rich Mixture</span>
            <span className="text-[9px] text-white/30 font-inter">Max power and cooling</span>
          </div>
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Lambda &gt; 1.0</span>
            <span className="text-lg font-black text-sky-400">Lean Mixture</span>
            <span className="text-[9px] text-white/30 font-inter">Fuel economy at cruise</span>
          </div>
        </div>
      </div>
    </div>
  );
}
