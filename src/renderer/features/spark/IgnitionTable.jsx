import React, { useMemo, useState } from "react";
import { useStore } from "../../core/store.js";
import TuningGrid from "../shared/TuningGrid/TuningGrid.jsx";
import { useTableSync } from "../shared/hooks/useTableSync.js";
import TuningHeader from "../shared/components/TuningHeader";
import { Activity } from "lucide-react";

export default function IgnitionTable() {
  const currentProject = useStore((s) => s.currentProject);
  const constants = currentProject?.constants;
  const connection = useStore((s) => s.connection);
  const secondaryValues = useStore((s) => s.tables.ign2?.values);

  // useTableSync makes the component incredibly clean
  const { 
    values, rpmAxis, loadAxis, meta, update, handleSave, isDirty 
  } = useTableSync("ign", "sparkTbl");

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const ignAlgorithmId = useMemo(() => {
    if (!constants) return 0;
    const pages = constants.pages || {};
    const p1 = pages[1] || pages["1"] || pages[0] || pages["0"];
    return p1?.ignAlgorithm ?? 0;
  }, [constants]);

  const dynamicYLabel = useMemo(() => {
    if (!meta) return "Ignition Load";
    switch (ignAlgorithmId) {
      case 0: return "IgnLoad (MAP kPa)";
      case 1: return "IgnLoad (TPS %)";
      case 2: return "IgnLoad (IMAP/EMAP %)";
      default: return meta.yLabel;
    }
  }, [meta, ignAlgorithmId]);

  const onSaveAction = async (isBurn = false) => {
    setIsSaving(true);
    setSaveStatus(null);
    const res = await handleSave(isBurn);
    setSaveStatus(res.ok ? "success" : "error");
    setIsSaving(false);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const { tableMin, tableMax } = useMemo(() => {
    if (!values || !values.flat) return { tableMin: 0, tableMax: 50 };
    const flat = values.flat();
    let min = Math.min(...flat);
    let max = Math.max(...flat);
    if (max - min < 40) {
      const mid = (max + min) / 2;
      min = mid - 20;
      max = mid + 20;
    }
    return { tableMin: Math.floor(min), tableMax: Math.ceil(max) };
  }, [values]);

  if (!meta) return <div className="p-8 text-white/40 font-orbitron text-center mt-20 italic">Loading Ignition Metadata...</div>;

  return (
    <div className="p-0 h-full flex flex-col gap-0 overflow-hidden bg-transparent rounded-3xl">
      <TuningHeader
        title={meta.title}
        icon={Activity}
        description={`Ignition Table — ${meta.xLabel} vs ${dynamicYLabel}`}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={connection.status === "connected"}
        isDirty={isDirty}
        onSave={() => onSaveAction(false)}
        onBurn={() => onSaveAction(true)}
        themeColor="purple"
      />

      <div className="flex-1 p-6 flex flex-col min-h-0 bg-[#0a0b10] overflow-y-auto custom-scrollbar">
        <div className="min-h-[500px] flex-shrink-0">
          <TuningGrid
            values={values}
            secondaryValues={secondaryValues}
            rpmAxis={rpmAxis}
            loadAxis={loadAxis}
            onUpdate={update}
            minVal={tableMin}
            maxVal={tableMax}
            theme="purple"
            xAxisLabel={meta.xLabel}
            yAxisLabel={dynamicYLabel}
            unitLabel="DEG"
            activePoint={null}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-4 px-2">
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/30 font-black uppercase font-orbitron">Hotkeys:</span>
                <kbd className="px-2 py-0.5 bg-black border border-white/20 rounded text-[9px] text-neon-purple font-black">Shift + &</kbd>
                <span className="text-[9px] text-white/40 uppercase">Inc/Dec 10%</span>
                <kbd className="px-2 py-0.5 bg-black border border-white/20 rounded text-[9px] text-neon-purple font-black">I</kbd>
                <span className="text-[9px] text-white/40 uppercase">Interpolate</span>
            </div>
        </div>
      </div>
    </div>
  );
}
