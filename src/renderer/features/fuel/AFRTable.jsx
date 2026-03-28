import React, { useMemo, useState } from "react";
import { useStore } from "../../core/store.js";
import TuningGrid from "../shared/TuningGrid/TuningGrid.jsx";
import { useTableSync } from "../shared/hooks/useTableSync.js";
import TuningHeader from "../shared/components/TuningHeader";
import { Target } from "lucide-react";
import { getDecodedPage } from "../shared/utils/projectConstants";

export default function AFRTable() {
  const connection = useStore((s) => s.connection);
  const currentProject = useStore((s) => s.currentProject);
  const constants = currentProject?.constants;

  // Use Centralized Normalization Hook
  const { 
    values, rpmAxis, loadAxis, meta, scaling, update, handleSave, isDirty 
  } = useTableSync("afr", "afrTable1Tbl");

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const algorithmId = useMemo(() => {
    if (!constants) return 0;
    const p1 = getDecodedPage(constants, 1) || getDecodedPage(constants, 0);
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

  if (!meta) return <div className="p-8 text-white/40 font-orbitron text-center mt-20 italic animate-pulse">Loading AFR Table Metadata...</div>;

  return (
    <div className="p-0 h-full flex flex-col gap-0 overflow-hidden bg-transparent rounded-3xl">
      <TuningHeader
        title={meta.title || "AFR Target Table"}
        icon={Target}
        description={`AFR Target — Units: ${scaling.scale === 0.1 ? "0.1 Scale" : "Standard"}`}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={connection.status === "connected"}
        isDirty={isDirty}
        onSave={() => onSaveAction(false)}
        onBurn={() => onSaveAction(true)}
        themeColor="green"
      />

      <div className="flex-1 p-6 flex flex-col min-h-0 bg-[#0a0b10] overflow-y-auto custom-scrollbar">
        <div className="min-h-[500px] flex-shrink-0">
          <TuningGrid
            values={values}
            rpmAxis={rpmAxis}
            loadAxis={loadAxis}
            onUpdate={update}
            minVal={7.0}
            maxVal={20.0}
            theme="green"
            xAxisLabel={meta.xLabel || "RPM"}
            yAxisLabel={dynamicYLabel}
            unitLabel="AFR"
            precision={1}
            activePoint={null}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Stoichiometric AFR</span>
            <span className="text-lg font-black text-neon-green">14.7 : 1</span>
          </div>
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Rich (Max Power)</span>
            <span className="text-lg font-black text-amber-400">12.5–13.0 : 1</span>
          </div>
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Lean (Economy)</span>
            <span className="text-lg font-black text-sky-400">15.0–16.0 : 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
