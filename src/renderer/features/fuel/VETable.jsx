import React, { useMemo, useState } from "react";
import { useStore } from "../../core/store.js";
import TuningGrid from "../shared/TuningGrid/TuningGrid.jsx";
import { useTableSync } from "../shared/hooks/useTableSync.js";
import TuningHeader from "../shared/components/TuningHeader";
import { Fuel } from "lucide-react";
import { getDecodedPage } from "../shared/utils/projectConstants";

export default function VETable() {
  const currentProject = useStore((s) => s.currentProject);
  const constants = currentProject?.constants;
  const connection = useStore((s) => s.connection);
  const secondaryValues = useStore((s) => s.tables.ve2.values);

  // useTableSync handles all the metadata, constants sync and normalization
  const { values, rpmAxis, loadAxis, meta, update, handleSave, isDirty } =
    useTableSync("ve", "veTable1Tbl");

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
      case 0:
        return "Fuel Load (MAP kPa)";
      case 1:
        return "Fuel Load (TPS %)";
      case 2:
        return "Fuel Load (MAP/BARO %)";
      case 3:
        return "Fuel Load (IMAP/EMAP %)";
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
    if (!values || !values.flat) return { tableMin: 0, tableMax: 100 };
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

  if (!meta)
    return (
      <div className="p-8 text-white/40 font-orbitron text-center mt-20 italic">
        Loading Table Metadata...
      </div>
    );

  return (
    <div className="p-0 h-full flex flex-col gap-0 overflow-hidden bg-transparent rounded-3xl">
      <TuningHeader
        title={meta.title}
        icon={Fuel}
        description={`VE Table — ${meta.xLabel} vs ${dynamicYLabel}`}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={connection.status === "connected"}
        isDirty={isDirty}
        onSave={() => onSaveAction(false)}
        onBurn={() => onSaveAction(true)}
      />

      <div className="flex-1 p-6 flex flex-col min-h-0  overflow-y-auto custom-scrollbar">
        <div className="min-h-[500px] flex-shrink-0">
          <TuningGrid
            values={values}
            secondaryValues={secondaryValues}
            rpmAxis={rpmAxis}
            loadAxis={loadAxis}
            onUpdate={update}
            minVal={tableMin}
            maxVal={tableMax}
            theme="cyan"
            xAxisLabel={meta.xLabel}
            yAxisLabel={dynamicYLabel}
            unitLabel="VE"
            activePoint={null}
          />
        </div>
      </div>
    </div>
  );
}
