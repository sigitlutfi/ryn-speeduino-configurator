import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../../core/store.js";
import TuningGrid from "../shared/TuningGrid/TuningGrid.jsx";
import { getTableMetadata, getConstant } from "../../../shared/ini-parser";
import TuningHeader from "../shared/components/TuningHeader";
import { Fuel } from "lucide-react";

export default function VETable2() {
  const parsedIni = useStore((s) => s.parsedIni);
  const currentProject = useStore((s) => s.currentProject);
  const constants = currentProject?.constants;
  const connection = useStore((s) => s.connection);
  const { values, rpmAxis, loadAxis } = useStore((s) => s.tables.ve2);
  const secondaryValues = useStore((s) => s.tables.ve.values);
  const updateTable = useStore((s) => s.updateTable);
  const updateConstants = useStore((s) => s.updateConstants);
  const saveProject = useStore((s) => s.saveProject);
  const notify = useStore((s) => s.notify);

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // 1. Get dynamic metadata from INI (fuelTable2Tbl is the correct [TableEditor] ID)
  const meta = useMemo(
    () => getTableMetadata(parsedIni, "fuelTable2Tbl"),
    [parsedIni],
  );

  // Determine actual Y-Axis label based on active Secondary Control Algorithm (Page 10)
  const algorithmId = useMemo(() => {
    if (!constants) return 0;
    const pages = constants.pages || {};
    const p10 = pages[10] || pages["10"];
    return p10?.fuel2Algorithm ?? 0;
  }, [constants]);

  const dynamicYLabel = useMemo(() => {
    if (!meta) return "Secondary Load";
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

  // 2. Perform Data Sync (Constants -> Table Store)
  useEffect(() => {
    if (!meta || !constants) return;

    const pageData =
      constants.pages?.[meta.page] || constants.pages?.[String(meta.page)];
    if (!pageData) return;

    const rpmData = pageData[meta.xBinsVar];
    const loadData = pageData[meta.yBinsVar];
    const veData = pageData[meta.zBinsVar];

    if (rpmData && loadData && veData) {
      let matrix = veData;
      if (!Array.isArray(veData[0])) {
        matrix = [];
        for (let i = 0; i < 16; i++) {
          matrix.push(veData.slice(i * 16, i * 16 + 16));
        }
      }

      updateTable("ve2", {
        values: matrix,
        rpmAxis: rpmData,
        loadAxis: loadData,
      });
    }
  }, [meta, constants, parsedIni, updateTable]);

  const handleSave = async (isBurn = false) => {
    if (!meta) return;
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const flatValues = values.flat();
      const pageData =
        constants.pages?.[meta.page] ||
        constants.pages?.[String(meta.page)] ||
        {};

      updateConstants({
        pages: {
          ...(constants?.pages || {}),
          [meta.page]: {
            ...pageData,
            [meta.zBinsVar]: flatValues,
          },
        },
      });

      const result = await saveProject();
      if (result.ok) {
        setSaveStatus("success");
        notify(
          isBurn ? "Burn & Save Successful" : "Local Save Successful",
          "success",
        );
      } else {
        setSaveStatus("error");
        notify(`Save Failed: ${result.error}`, "error");
      }
    } catch (err) {
      setSaveStatus("error");
      notify(`System Error: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const isDirty = useMemo(() => {
    if (!meta || !constants) return false;
    const original = constants.pages?.[meta.page]?.[meta.zBinsVar];
    if (!original) return false;
    const current = values.flat();
    return JSON.stringify(current) !== JSON.stringify(original);
  }, [values, constants, meta]);

  if (!meta)
    return (
      <div className="p-8 text-white/40 font-orbitron text-center mt-20 italic">
        Loading Secondary Table Metadata...
      </div>
    );

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

  return (
    <div className="p-0 h-full flex flex-col gap-0 overflow-hidden bg-transparent rounded-3xl">
      <TuningHeader
        title={meta.title}
        icon={Fuel}
        description={`Secondary VE Table — ${meta.xLabel} vs ${dynamicYLabel}`}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={connection.status === "connected"}
        isDirty={isDirty}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={() => window.location.reload()}
      />

      <div className="flex-1 p-6 flex flex-col min-h-0 bg-[#0a0b10] overflow-y-auto custom-scrollbar">
        <div className="min-h-[500px] flex-shrink-0">
          <TuningGrid
            values={values}
            secondaryValues={secondaryValues}
            rpmAxis={rpmAxis}
            loadAxis={loadAxis}
            onUpdate={(newValues) => updateTable("ve2", newValues)}
            minVal={tableMin}
            maxVal={tableMax}
            theme="cyan"
            xAxisLabel={meta.xLabel}
            yAxisLabel={dynamicYLabel}
            unitLabel={meta.unitLabel || "%"}
            activePoint={null}
          />
        </div>
        
        <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-2xl">
            <h3 className="text-neon-cyan font-orbitron font-black text-sm uppercase mb-4">Secondary Fuel Mode</h3>
            <p className="text-white/60 text-xs mb-4 italic">Note: These settings determine how this table interact with VE Table 1.</p>
            {/* Future: Add select inputs here for fuel2Mode etc */}
        </div>
      </div>
    </div>
  );
}
