import React, { useState, useMemo } from "react";
import {
  Zap,
  Settings,
  Activity,
  Clock,
  ShieldAlert,
  Maximize2,
  Sliders,
  Flame,
  Gauge,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { SelectField } from "../shared/components/SelectField";
import { useTableSync } from "../shared/hooks/useTableSync.js";
import TuningGrid from "../shared/TuningGrid/TuningGrid.jsx";
import { Table, LayoutGrid } from "lucide-react";

const BOOST_FIELDS = [
  "boostEnabled",
  "boostType",
  "boostMode",
  "boostFreq",
  "boostKP",
  "boostKI",
  "boostKD",
  "boostCutEnabled",
  "boostTbl",
];

const BoostControl = () => {
  const [activeTab, setActiveTab] = useState("primary");
  const [isTableSaving, setIsTableSaving] = useState(false);
  const [tableSaveStatus, setTableSaveStatus] = useState(null);

  const {
    getFieldValue,
    setFieldValue,
    getFieldInfo,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isDirty,
    isReady,
    isConnected,
  } = useTuningModule(BOOST_FIELDS);

  // Primary Table (Target or Duty)
  const primaryTable = useTableSync("boostTbl", "boostTbl");

  // Closed Loop Base Duty Table
  const clTable = useTableSync("boostDCLupTbl", "boostDCLupTbl");

  const getValue = (name) => getFieldValue(name);
  const updateValue = (name, val) => setFieldValue(name, val);

  const onTableSaveAction = async (isBurn = false) => {
    setIsTableSaving(true);
    setTableSaveStatus(null);
    const res1 = await primaryTable.handleSave(isBurn);
    const res2 = await clTable.handleSave(isBurn);
    setTableSaveStatus(res1.ok && res2.ok ? "success" : "error");
    setIsTableSaving(false);
    setTimeout(() => setTableSaveStatus(null), 3000);
  };

  if (!isReady || !primaryTable.meta || !clTable.meta) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-8 h-8 border-2 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin" />
        <div className="text-[10px] font-black text-white/40 uppercase tracking-widest animate-pulse">
          Syncing Boost Definitions...
        </div>
      </div>
    );
  }

  const isEnabled = getFieldValue("boostEnabled") === 1;
  const isClosedLoop = getFieldValue("boostType") === 1;

  return (
    <div className="flex flex-col h-full  select-none animate-in fade-in duration-700">
      <TuningHeader
        title="Boost Control"
        icon={Zap}
        description="Turbocharger wastegate control and safety limits"
        isDirty={isDirty || primaryTable.isDirty || clTable.isDirty}
        isSaving={isSaving || isTableSaving}
        saveStatus={saveStatus || tableSaveStatus}
        isConnected={isConnected}
        onSave={() => {
          handleSave();
          onTableSaveAction(false);
        }}
        onBurn={() => {
          handleSave(true);
          onTableSaveAction(true);
        }}
        onDiscard={discardChanges}
        themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-[1400px] mx-auto space-y-10 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-10 rounded-[40px] glass-card border border-white/5 bg-gradient-to-br from-bg-deep to-black">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20 shadow-glow-cyan/10">
                  <Settings className="text-neon-cyan" size={24} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">
                    System Logic
                  </h3>
                  <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tight font-black">
                    Wastegate strategy
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-black text-white uppercase tracking-wider">
                      Boost System
                    </span>
                    <span className="text-[9px] text-white/40 uppercase tracking-tight italic font-black">
                      Master switch
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      updateValue("boostEnabled", isEnabled ? 0 : 1)
                    }
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 ${isEnabled ? "bg-neon-cyan shadow-glow-cyan" : "bg-white/10"}`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-all duration-300 transform ${isEnabled ? "translate-x-7" : "translate-x-0"}`}
                    />
                  </button>
                </div>

                <SelectField
                  name="boostType"
                  label="Control Strategy"
                  theme="cyan"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />

                <SelectField
                  name="boostMode"
                  label="Axis Scaling"
                  theme="cyan"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />

                <div className="p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-white uppercase tracking-wider">
                      Solenoid Freq
                    </span>
                    <div className="flex items-baseline gap-2">
                      <input
                        type="number"
                        value={getFieldValue("boostFreq")}
                        onChange={(e) =>
                          updateValue("boostFreq", parseInt(e.target.value))
                        }
                        className="bg-transparent text-xl font-mono font-black text-white outline-none w-20 text-right"
                      />
                      <span className="text-[9px] text-white/20 font-black">
                        Hz
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-10 rounded-[40px] glass-card border border-white/5 bg-gradient-to-br from-bg-deep to-black">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20 shadow-glow-cyan/10">
                  <Sliders className="text-neon-cyan" size={24} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">
                    PID Loop
                  </h3>
                  <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tight font-black">
                    Response damping
                  </p>
                </div>
              </div>

              <div
                className={`grid grid-cols-1 md:grid-cols-3 gap-4 transition-opacity ${!isClosedLoop ? "opacity-20 pointer-events-none grayscale" : "opacity-100"}`}
              >
                {["boostKP", "boostKI", "boostKD"].map((pid) => (
                  <div
                    key={pid}
                    className="p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-neon-cyan/30 transition-all"
                  >
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                      {pid.slice(-2)}
                    </span>
                    <input
                      type="number"
                      value={getFieldValue(pid)}
                      onChange={(e) =>
                        updateValue(pid, parseInt(e.target.value))
                      }
                      className="w-full bg-transparent text-xl font-mono font-black text-white outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-8 p-6 rounded-3xl bg-neon-red/5 border border-neon-red/20 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-black text-neon-red uppercase tracking-wider">
                    Over-Boost Cut
                  </span>
                  <span className="text-[9px] text-neon-red/40 uppercase tracking-tight italic font-black">
                    Engine safety protection
                  </span>
                </div>
                <button
                  onClick={() =>
                    updateValue(
                      "boostCutEnabled",
                      getFieldValue("boostCutEnabled") === 1 ? 0 : 1,
                    )
                  }
                  className={`relative w-14 h-7 rounded-full transition-all duration-300 ${getFieldValue("boostCutEnabled") === 1 ? "bg-neon-red shadow-glow-red" : "bg-white/10"}`}
                >
                  <div
                    className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-all duration-300 transform ${getFieldValue("boostCutEnabled") === 1 ? "translate-x-7" : "translate-x-0"}`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="p-0 rounded-[40px] glass-card border border-white/10 relative overflow-hidden">
            {isClosedLoop && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex p-1 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-xl">
                <button
                  onClick={() => setActiveTab("primary")}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === "primary"
                      ? "bg-neon-cyan text-black shadow-glow-cyan"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  <Table size={14} />
                  {primaryTable.meta.title}
                </button>
                <button
                  onClick={() => setActiveTab("cl")}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === "cl"
                      ? "bg-neon-cyan text-black shadow-glow-cyan"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  <LayoutGrid size={14} />
                  {clTable.meta.title}
                </button>
              </div>
            )}

            <TuningGrid
              values={activeTab === "primary" ? primaryTable.values : clTable.values}
              rpmAxis={activeTab === "primary" ? primaryTable.rpmAxis : clTable.rpmAxis}
              loadAxis={activeTab === "primary" ? primaryTable.loadAxis : clTable.loadAxis}
              onUpdate={activeTab === "primary" ? primaryTable.update : clTable.update}
              theme="cyan"
              xAxisLabel={activeTab === "primary" ? primaryTable.meta.xLabel : clTable.meta.xLabel}
              yAxisLabel={activeTab === "primary" ? primaryTable.meta.yLabel : clTable.meta.yLabel}
              unitLabel="%"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoostControl;
