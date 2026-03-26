import React from "react";
import {
  Activity,
  Zap,
  Gauge,
  Flag,
  Settings,
  Flame,
  ShieldCheck,
  Orbit,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const LAUNCH_FIELDS = [
  "launchEnable", "launchPin", "launchHiLo", "lnchPullRes", 
  "lnchSoftLim", "lnchRetard", "lnchHardLim", "lnchFuelAdd",
  "lnchCtrlTPS", "lnchCtrlVss"
];

const LaunchControl = () => {
  const {
    getFieldValue, setFieldValue, getFieldInfo, handleSave, discardChanges,
    isSaving, saveStatus, isConnected, isDirty, isReady,
  } = useTuningModule(LAUNCH_FIELDS, {});

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const launchEnable = getValue("launchEnable");

  const SectionHeader = ({ title, icon: Icon, theme = "red" }) => (
    <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
      <div className={`w-1 h-3 bg-neon-${theme} shadow-glow-${theme} rounded-full`} />
      <span className="text-[9px] font-black text-white/80 uppercase tracking-[0.2em]">{title}</span>
      {Icon && <Icon size={12} className={`ml-auto text-neon-${theme} opacity-30`} />}
    </div>
  );

  const FormField = ({ name, label, unit, type = "number", theme = "red", disabled = false, step = 1 }) => {
    const val = getValue(name);
    const info = getFieldInfo(name);

    return (
      <div className={`flex flex-col gap-1.5 p-2.5 rounded-xl transition-all ${disabled ? "opacity-20 select-none cursor-not-allowed grayscale" : "hover:bg-white/5"}`}>
        <label className="text-[7px] font-black text-gray-400 uppercase tracking-widest flex justify-between">
          {label}
          {unit && <span className="text-white/20 italic">{unit}</span>}
        </label>
        
        {type === "select" ? (
          <select
            value={val}
            onChange={(e) => updateValue(name, parseInt(e.target.value))}
            className="bg-black/30 text-[10px] font-bold text-white outline-none border-none cursor-pointer focus:text-neon-red py-1"
          >
            {info?.meta?.options?.map((opt, i) => opt !== "INVALID" && (
              <option key={i} value={i} className="bg-bg-deep text-white">{opt}</option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            step={step}
            value={val}
            onChange={(e) => updateValue(name, parseFloat(e.target.value))}
            className={`bg-transparent text-sm font-mono font-black text-white outline-none border-none focus:text-neon-${theme}`}
          />
        ) }
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden h-screen animate-in fade-in duration-700">
      <TuningHeader
        title="Launch Control"
        icon={Flag}
        description="Drag strip readiness: Initial torque management and rev limiting"
        isDirty={isDirty} isSaving={isSaving} saveStatus={saveStatus}
        isConnected={isConnected} onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)} onDiscard={discardChanges} themeColor="red"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12 p-5 rounded-3xl glass-card border border-white/5 bg-gradient-to-r from-neon-red/[0.02] to-transparent">
              <SectionHeader title="Global Hardware" icon={Settings} theme="red" />
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <FormField name="launchPin" label="Input Pin" type="select" />
                <FormField name="launchHiLo" label="Signal Type" type="select" />
                <FormField name="lnchPullRes" label="Pullup" type="select" />
                <div className="col-span-1 md:col-span-3 flex items-center gap-6 px-6 border-l border-white/5 ml-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[7px] font-bold text-white/30 uppercase tracking-[0.2em]">Launch Status</span>
                    <div className={`px-4 py-1 rounded-full text-[9px] font-black tracking-widest flex items-center gap-2 ${launchEnable > 0 ? 'bg-neon-red/20 text-neon-red shadow-glow-red/20' : 'bg-white/5 text-white/20'}`}>
                      <Orbit size={10} className={launchEnable > 0 ? "animate-spin" : ""} />
                      {launchEnable > 0 ? "ARMED & READY" : "INACTIVE"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-[32px] glass-card border transition-all ${launchEnable > 0 ? 'border-neon-red/30 bg-neon-red/[0.01]' : 'border-white/5 opacity-40 grayscale'}`}>
            <SectionHeader title="Launch Strategy" icon={Flame} theme="red" />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField name="launchEnable" label="System Mode" type="select" />
                  <FormField name="lnchCtrlTPS" label="TPS Activation" unit="%" disabled={launchEnable === 0} />
                  <FormField name="lnchCtrlVss" label="VSS Limit" unit="KPH" disabled={launchEnable === 0} />
                  <FormField name="lnchFuelAdd" label="Fuel Adder" unit="%" theme="orange" disabled={launchEnable === 0} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-black/40 border border-white/5 h-fit">
                <div className="space-y-4">
                  <h4 className="text-[8px] font-black text-neon-red/50 uppercase tracking-widest border-l-2 border-neon-red pl-3">Rev Limits</h4>
                  <FormField name="lnchSoftLim" label="Soft Target" unit="RPM" theme="red" disabled={launchEnable === 0} />
                  <FormField name="lnchRetard" label="Timing Fix" unit="°" theme="red" disabled={launchEnable === 0} />
                </div>
                <div className="space-y-4">
                  <h4 className="text-[8px] font-black text-neon-red/50 uppercase tracking-widest border-l-2 border-neon-red pl-3">Ultimate Cut</h4>
                  <FormField name="lnchHardLim" label="Hard Limit" unit="RPM" theme="red" disabled={launchEnable === 0} />
                  <div className="p-3 rounded-xl bg-neon-red/[0.03] border border-neon-red/10 flex items-center gap-3">
                    <ShieldCheck size={14} className="text-neon-red opacity-50" />
                    <span className="text-[8px] font-bold text-white/30 uppercase leading-tight italic">Antilag-style spark cut enabled</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-dashed border-white/5 flex items-center justify-center">
             <div className="text-[8px] font-black text-white/10 uppercase tracking-[0.4em]">Staging Module Active</div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LaunchControl;
