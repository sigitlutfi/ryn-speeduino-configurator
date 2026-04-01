import React, { useState, useMemo } from "react";
import {
  Zap,
  Settings,
  Activity,
  Clock,
  ShieldAlert,
  RotateCw,
  Sliders,
  Maximize2,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { SelectField } from "../shared/components/SelectField";
import { useTableSync } from "../shared/hooks/useTableSync.js";
import TuningGrid from "../shared/TuningGrid/TuningGrid.jsx";
import { Table, LayoutGrid } from "lucide-react";
import { useStore } from "../../core/store";

const VVT_FIELDS = [
  "vvtEnabled",
  "vvtMode",
  "vvtFreq",
  "vvtKP",
  "vvtKI",
  "vvtKD",
  "vvtTbl",
];

const VVTControl = () => {
  const { notify } = useStore();
  const [activeCam, setActiveCam] = useState(1);
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
  } = useTuningModule(VVT_FIELDS);

  // VVT 1 Table
  const vvt1Table = useTableSync("vvtTbl", "vvtTbl");

  // VVT 2 Table
  const vvt2Table = useTableSync("vvt2Tbl", "vvt2Tbl");

  const getValue = (name) => getFieldValue(name);
  const updateValue = (name, val) => setFieldValue(name, val);

  const onTableSaveAction = async (isBurn = false) => {
    setIsTableSaving(true);
    setTableSaveStatus(null);
    const res1 = await vvt1Table.handleSave(isBurn);
    const res2 = await vvt2Table.handleSave(isBurn);
    setTableSaveStatus(res1.ok && res2.ok ? "success" : "error");
    setIsTableSaving(false);
    setTimeout(() => setTableSaveStatus(null), 3000);
  };

  if (!isReady || !vvt1Table.meta || !vvt2Table.meta) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-8 h-8 border-2 border-neon-orange/20 border-t-neon-orange rounded-full animate-spin" />
        <div className="text-[10px] font-black text-white/40 uppercase tracking-widest animate-pulse">
          Syncing VVT Definitions...
        </div>
      </div>
    );
  }

  const isEnabled = getFieldValue("vvtEnabled") === 1;

  return (
    <div className="flex flex-col h-full  select-none animate-in fade-in duration-700">
      <TuningHeader
        title="VVT Control"
        icon={RotateCw}
        description="Variable Valve Timing strategy and PID loop"
        isDirty={isDirty || vvt1Table.isDirty || vvt2Table.isDirty}
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
        onDiscard={() => {
          discardChanges();
        }}
        themeColor="orange"
      />

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-[1400px] mx-auto space-y-10 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-8 rounded-[40px] glass-card border border-white/5 bg-gradient-to-br from-bg-deep to-black">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-neon-orange/10 flex items-center justify-center border border-neon-orange/20 shadow-glow-orange/10">
                  <Settings className="text-neon-orange" size={24} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">
                    VVT Config
                  </h3>
                  <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tight font-black">
                    Valve angle logic
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-black text-white uppercase tracking-wider">
                      VVT System
                    </span>
                    <span className="text-[9px] text-white/40 uppercase tracking-tight italic font-black">
                      Master state
                    </span>
                  </div>
                  <button
                    onClick={() => updateValue("vvtEnabled", isEnabled ? 0 : 1)}
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 ${isEnabled ? "bg-neon-orange shadow-glow-orange" : "bg-white/10"}`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-all duration-300 transform ${isEnabled ? "translate-x-7" : "translate-x-0"}`}
                    />
                  </button>
                </div>

                <SelectField
                  name="vvtMode"
                  label="Control Mode"
                  theme="orange"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />

                <div className="p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-white uppercase tracking-wider">
                      Frequency
                    </span>
                    <div className="flex items-baseline gap-2">
                      <input
                        type="number"
                        value={getFieldValue("vvtFreq")}
                        onChange={(e) =>
                          updateValue("vvtFreq", parseInt(e.target.value))
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

            <div className="p-8 rounded-[40px] glass-card border border-white/5 bg-gradient-to-br from-bg-deep to-black">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-neon-orange/10 flex items-center justify-center border border-neon-orange/20 shadow-glow-orange/10">
                  <Sliders className="text-neon-orange" size={24} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">
                    PID Tuning
                  </h3>
                  <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tight font-black">
                    Closed loop response
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {["vvtKP", "vvtKI", "vvtKD"].map((pid) => (
                  <div
                    key={pid}
                    className="p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-neon-orange/30 transition-all"
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
            </div>
          </div>

          <div className="p-0 rounded-[40px] glass-card border border-white/10 relative overflow-hidden">
            {isEnabled && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex p-1 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-xl">
                <button
                  onClick={() => setActiveCam(1)}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeCam === 1
                      ? "bg-neon-orange text-black shadow-glow-orange"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  <Table size={14} />
                  Cam 1
                </button>
                <button
                  onClick={() => setActiveCam(2)}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeCam === 2
                      ? "bg-neon-orange text-black shadow-glow-orange"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  <LayoutGrid size={14} />
                  Cam 2
                </button>
              </div>
            )}

            <TuningGrid
              values={activeCam === 1 ? vvt1Table.values : vvt2Table.values}
              rpmAxis={activeCam === 1 ? vvt1Table.rpmAxis : vvt2Table.rpmAxis}
              loadAxis={
                activeCam === 1 ? vvt1Table.loadAxis : vvt2Table.loadAxis
              }
              onUpdate={activeCam === 1 ? vvt1Table.update : vvt2Table.update}
              theme="orange"
              xAxisLabel={
                activeCam === 1 ? vvt1Table.meta.xLabel : vvt2Table.meta.xLabel
              }
              yAxisLabel={
                activeCam === 1 ? vvt1Table.meta.yLabel : vvt2Table.meta.yLabel
              }
              unitLabel="°"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VVTControl;
