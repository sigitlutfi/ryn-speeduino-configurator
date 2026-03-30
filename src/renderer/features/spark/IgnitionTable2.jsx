import React, { useMemo, useState } from "react";
import { useStore } from "../../core/store.js";
import TuningGrid from "../shared/TuningGrid/TuningGrid.jsx";
import { useTableSync } from "../shared/hooks/useTableSync.js";
import TuningHeader from "../shared/components/TuningHeader";
import { Flame } from "lucide-react";
import { getDecodedPage } from "../shared/utils/projectConstants";

export default function IgnitionTable2() {
  const currentProject = useStore((s) => s.currentProject);
  const constants = currentProject?.constants;
  const connection = useStore((s) => s.connection);
  const secondaryValues = useStore((s) => s.tables.ign.values);

  const {
    values,
    rpmAxis,
    loadAxis,
    meta,
    update,
    handleSave,
    isDirty,
  } = useTableSync("ign2", "spark2Tbl");

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const algorithmId = useMemo(() => {
    if (!constants) return 0;
    const p10 = getDecodedPage(constants, 10);
    return p10?.spark2Algorithm ?? 0;
  }, [constants]);

  const dynamicYLabel = useMemo(() => {
    if (!meta) return "Secondary Ign Load";
    switch (algorithmId) {
      case 0:
        return "IgnLoad (MAP kPa)";
      case 1:
        return "IgnLoad (TPS %)";
      case 2:
        return "IgnLoad (IMAP/EMAP %)";
      default:
        return meta.yLabel;
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

  if (!meta) {
    return (
      <div className="p-8 text-white/40 font-orbitron text-center mt-20 italic">
        Loading Secondary Ignition Metadata...
      </div>
    );
  }

  return (
    <div className="p-0 h-full flex flex-col gap-0 overflow-hidden bg-transparent rounded-3xl">
      <TuningHeader
        title="Secondary Ignition Table"
        description="Dual-fuel or switchable ignition advance"
        icon={Flame}
        themeColor="orange"
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={connection.status === "connected"}
        isDirty={isDirty}
        onSave={() => onSaveAction(false)}
        onBurn={() => onSaveAction(true)}
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
            theme="orange"
            xAxisLabel={meta.xLabel}
            yAxisLabel={dynamicYLabel}
            unitLabel={meta.unitLabel || "DEG"}
            activePoint={null}
          />
        </div>
      </div>
    </div>
  );
}
