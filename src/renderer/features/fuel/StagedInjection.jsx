import React, { useEffect, useMemo } from "react";
import { 
  Activity, 
  Settings, 
  Droplets,
  Layers,
  ShieldAlert
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import { useStore } from "../../core/store.js";
import TuningHeader from "../shared/components/TuningHeader";
import { SelectField } from "../shared/components/SelectField";
import TuningGrid from "../shared/TuningGrid/TuningGrid.jsx";
import { toDisplay, toRaw } from "../shared/utils/normalization";
import { getTableMetadata } from "../../../shared/ini-parser";

const STAGING_FIELDS = [
  "stagingEnabled",
  "stagingMode",
  "stagedInjSizePri",
  "stagedInjSizeSec",
  "stagingTable",    // 8x8 Map (flat array in constants)
  "rpmBinsStaging",  // X-Axis
  "loadBinsStaging"  // Y-Axis
];

export default function StagedInjection() {
  const parsedIni = useStore((s) => s.parsedIni);
  const updateTable = useStore((s) => s.updateTable);
  const { values: stagingMatrix, rpmAxis, loadAxis } = useStore((s) => s.tables.staging);

  const {
    getFieldValue,
    setFieldValue,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isDirty,
    isReady,
    isConnected,
    getFieldInfo
  } = useTuningModule(STAGING_FIELDS);

  // Get table metadata for axes labels and scaling
  // Using "stagingTbl" ID from [TableEditor] section for correct axis mapping
  const tableMeta = useMemo(() => 
    getTableMetadata(parsedIni, "stagingTbl"), 
  [parsedIni]);

  // Bi-directional Sync: Constants (Flat) <-> Store (Matrix/Axes)
  const flatValue = getFieldValue("stagingTable");
  const xBins = getFieldValue("rpmBinsStaging");
  const yBins = getFieldValue("loadBinsStaging");
  
  useEffect(() => {
    if (Array.isArray(flatValue) && flatValue.length === 64) {
      const matrix = [];
      for (let i = 0; i < 8; i++) {
        matrix.push(flatValue.slice(i * 8, i * 8 + 8));
      }

      const updates = {};
      if (JSON.stringify(matrix) !== JSON.stringify(stagingMatrix)) {
        updates.values = matrix;
      }
      const displayX = toDisplay(xBins, getFieldInfo('rpmBinsStaging')?.meta);
      const displayY = toDisplay(yBins, getFieldInfo('loadBinsStaging')?.meta);
      if (Array.isArray(displayX) && JSON.stringify(displayX) !== JSON.stringify(rpmAxis)) {
        updates.rpmAxis = displayX;
      }
      if (Array.isArray(displayY) && JSON.stringify(displayY) !== JSON.stringify(loadAxis)) {
        updates.loadAxis = displayY;
      }

      if (Object.keys(updates).length > 0) {
        updateTable("staging", updates);
      }
    }
  }, [flatValue, xBins, yBins, updateTable]);

  const onGridUpdate = (newMatrix, newXAxis, newYAxis) => {
    const updates = { values: newMatrix };
    if (newXAxis) updates.rpmAxis = newXAxis;
    if (newYAxis) updates.loadAxis = newYAxis;
    
    updateTable("staging", updates, true);
    
    // Push back to constants for dirty tracking and saving
    setFieldValue("stagingTable", newMatrix.flat());
    if (newXAxis) setFieldValue("rpmBinsStaging", toRaw(newXAxis, getFieldInfo('rpmBinsStaging')?.meta));
    if (newYAxis) setFieldValue("loadBinsStaging", toRaw(newYAxis, getFieldInfo('loadBinsStaging')?.meta));
  };

  const getValue = (name) => {
    const info = getFieldInfo(name);
    return toDisplay(getFieldValue(name), info?.meta) ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-8 h-8 border-2 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin" />
        <div className="text-[10px] font-black text-white/40 uppercase tracking-widest animate-pulse">Syncing Staging Logic...</div>
      </div>
    );
  }

  const isEnabled = getFieldValue("stagingEnabled") === 1;
  const isAutomatic = getFieldValue("stagingMode") === 1;

  return (
    <div className="flex flex-col h-full bg-black select-none animate-in fade-in duration-700">
      <TuningHeader
        title="Staged Injection"
        subtitle="Manage secondary injector banks for high-power demands"
        icon={Layers}
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        onSave={() => handleSave()}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        isConnected={isConnected}
        themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-[1200px] mx-auto space-y-8 pb-20">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Activation Strategy */}
            <div className="p-10 rounded-[40px] glass-card border border-white/5 space-y-10 relative h-fit overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-[60px] pointer-events-none" />
               
               <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20 shadow-glow-cyan/10">
                  <Settings className="text-neon-cyan" size={24} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">Activation Logic</h3>
                  <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tight font-black">Transition control</p>
                </div>
              </div>

              <div className="space-y-4">
                 {/* Master Enable */}
                 <div className="flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-black text-white uppercase tracking-wider">Secondary Bank</span>
                    <span className="text-[9px] text-white/40 uppercase tracking-tight italic font-black">Master staged state</span>
                  </div>
                  <button 
                    onClick={() => updateValue("stagingEnabled", isEnabled ? 0 : 1)}
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 ${isEnabled ? 'bg-neon-cyan shadow-glow-cyan' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-all duration-300 transform ${isEnabled ? 'translate-x-7' : 'translate-x-0'}`} />
                  </button>
                </div>

                <SelectField
                  name="stagingMode"
                  label="Staging Strategy"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
              </div>

              {/* Mode-specific Logic Description */}
              <div className="pt-6 border-t border-white/5">
                {isAutomatic ? (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 text-neon-cyan">
                    <div className="flex items-center gap-2">
                      <Activity size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Automatic Overflow</span>
                    </div>
                    <p className="text-[11px] text-white/60 leading-relaxed font-medium">
                      Primary injectors are used until they reach the <span className="text-white font-bold">Duty Cycle Limit</span>. Extra fuel is then passed to the secondary bank.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 text-neon-cyan">
                    <div className="flex items-center gap-2">
                      <Layers size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Table-Driven Split</span>
                    </div>
                    <p className="text-[11px] text-white/60 leading-relaxed font-medium">
                      Secondary injector percentage is determined by the <span className="text-white font-bold">Staging Table</span> below based on RPM and Load.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Injector Capacities */}
            <div className="space-y-8">
              <div className={`p-10 rounded-[40px] glass-card border border-white/5 space-y-10 relative h-fit transition-all ${!isEnabled ? 'opacity-20 pointer-events-none grayscale' : 'opacity-100'}`}>
                 <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20 shadow-glow-cyan/10">
                    <Droplets className="text-neon-cyan" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">Injector Sizing</h3>
                    <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tight font-black">Capacity calibration</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { id: "stagedInjSizePri", label: "Primary Flow Rate", unit: "cc/min" },
                    { id: "stagedInjSizeSec", label: "Secondary Flow Rate", unit: "cc/min" }
                  ].map(field => (
                    <div key={field.id} className="p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-neon-cyan/30 transition-all">
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-2">{field.label}</span>
                      <div className="flex items-baseline gap-2">
                         <input
                          type="number"
                          value={getValue(field.id)}
                          onChange={(e) => updateValue(field.id, parseFloat(e.target.value))}
                          className="bg-transparent text-xl font-mono font-black text-white outline-none w-full"
                        />
                        <span className="text-[9px] text-white/20 font-black">{field.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-8 rounded-[40px] bg-white/[0.03] border border-white/5 space-y-4">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="text-white/20" size={18} />
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Technician Note</span>
                </div>
                <p className="text-[9px] text-white/20 uppercase font-black leading-relaxed tracking-tight">
                  Staged transitions depend on stable pressure and accurate dead-time mapping. Incorrect flow rates cause significant AFR swings.
                </p>
              </div>
            </div>
          </div>

          {/* Integrated Staging Table */}
          {!isAutomatic && isEnabled && (
            <div className="animate-in fade-in zoom-in-95 duration-700">
               <div className="p-10 rounded-[10px] glass-card border border-white/5 space-y-8">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20 shadow-glow-cyan/10">
                        <Layers className="text-neon-cyan" size={24} />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">Staging Table</h3>
                        <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tight font-black">Transition map (8x8)</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <span className="px-3 py-1 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 text-[9px] font-black text-neon-cyan uppercase tracking-widest">Z: % Secondary</span>
                    </div>
                 </div>

                 <div className="min-h-[400px]">
                    <TuningGrid
                      values={stagingMatrix}
                      rpmAxis={rpmAxis}
                      loadAxis={loadAxis}
                      onUpdate={onGridUpdate}
                      minVal={0}
                      maxVal={100}
                      theme="cyan"
                      xAxisLabel={tableMeta?.xLabel || "RPM"}
                      yAxisLabel={tableMeta?.yLabel || "Load"}
                      unitLabel="%"
                    />
                 </div>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
