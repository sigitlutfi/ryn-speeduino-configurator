import React from "react";
import { Activity, Zap, RotateCw, ShieldAlert } from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { SelectField } from "../shared/components/SelectField";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const TACHO_FIELDS = [
  "tachoPin",
  "tachoMode",
  "tachoDiv",
  "tachoDuration",
  "useTachoSweep",
  "tachoSweepMaxRPM"
];

export default function TachoOutput() {
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
  } = useTuningModule(TACHO_FIELDS);

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
        <div className="text-[10px] font-black text-white/40 uppercase tracking-widest animate-pulse">Syncing RPM Logic...</div>
      </div>
    );
  }

  const isSweepEnabled = getFieldValue("useTachoSweep") === 1;
  const isFixedDuration = getFieldValue("tachoMode") === 0;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700">
      <TuningHeader
        title="Tacho Output"
        subtitle="Electronic RPM signal generation for instrument clusters"
        icon={Activity}
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        onSave={() => handleSave()}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        isConnected={isConnected}
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 pb-20">
          
          {/* Signal Configuration */}
          <div className="p-10 rounded-[40px] glass-card border border-white/5 space-y-10 relative overflow-hidden h-fit">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-[60px] pointer-events-none" />
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20 shadow-glow-cyan/10">
                <Zap className="text-neon-cyan" size={24} />
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">Signal Profile</h3>
                <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tight font-black">Waveform characteristics</p>
              </div>
            </div>

            <div className="space-y-4">
              <SelectField
                name="tachoPin"
                label="Output Pin"
                getValue={getValue}
                getFieldInfo={getFieldInfo}
                updateValue={updateValue}
              />

              <SelectField
                name="tachoMode"
                label="Pulse Mode"
                getValue={getValue}
                getFieldInfo={getFieldInfo}
                updateValue={updateValue}
              />

              <SelectField
                name="tachoDiv"
                label="Output Speed"
                getValue={getValue}
                getFieldInfo={getFieldInfo}
                updateValue={updateValue}
              />

              {/* Pulse Duration (Conditional) */}
              <div className={`p-6 rounded-3xl glass-card border border-white/5 transition-all ${!isFixedDuration ? 'opacity-20 pointer-events-none grayscale' : 'hover:border-white/10 opacity-100'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-black text-white uppercase tracking-wider">Pulse Duration</span>
                    <span className="text-[9px] text-white/40 uppercase tracking-tight italic font-black">Active width in ms</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <input
                      type="number"
                      step="0.1"
                      value={getValue("tachoDuration")}
                      onChange={(e) => updateValue("tachoDuration", parseFloat(e.target.value))}
                      className="bg-transparent text-xl font-mono font-black text-white outline-none w-16 text-right"
                    />
                    <span className="text-[10px] text-white/20 font-black">ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="p-10 rounded-[40px] glass-card border border-white/5 space-y-10 relative overflow-hidden h-fit">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-neon-purple/10 flex items-center justify-center border border-neon-purple/20 shadow-glow-purple/10">
                  <RotateCw className="text-neon-purple" size={24} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">Initialization</h3>
                  <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tight font-black">Boot-up behavior</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-black text-white uppercase tracking-wider">Startup Sweep</span>
                    <span className="text-[9px] text-white/40 uppercase tracking-tight italic font-black">Needle check</span>
                  </div>
                  <button 
                    onClick={() => updateValue("useTachoSweep", isSweepEnabled ? 0 : 1)}
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 ${isSweepEnabled ? 'bg-neon-purple shadow-glow-purple' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-all duration-300 transform ${isSweepEnabled ? 'translate-x-7' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className={`p-6 rounded-3xl bg-white/5 border border-white/5 transition-all ${!isSweepEnabled ? 'opacity-20 pointer-events-none grayscale' : 'hover:border-white/10 opacity-100'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-black text-white uppercase tracking-wider">Max Sweep RPM</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <input
                        type="number"
                        step="100"
                        value={getValue("tachoSweepMaxRPM")}
                        onChange={(e) => updateValue("tachoSweepMaxRPM", parseInt(e.target.value))}
                        className="bg-transparent text-xl font-mono font-black text-white outline-none w-20 text-right"
                      />
                      <span className="text-[9px] text-white/20 font-black">RPM</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-[40px] bg-white/[0.03] border border-white/5 space-y-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="text-white/20" size={18} />
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Technician Note</span>
              </div>
              <p className="text-[9px] text-white/20 uppercase font-black leading-relaxed tracking-tight">
                Tacho sweep utilizes the primary frequency output during the first 2 seconds of ignition cycle.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
