import React from "react";
import { Snail, ShieldAlert, Zap, Target, Gauge } from "lucide-react";
import { useStore } from "../../core/store.js";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { toDisplay, toRaw } from "../shared/utils/normalization";
import { SelectRow, InputField, ToggleRow, InfoCard } from "../shared/components/TuningComponents";

const PIT_LIMITER_FIELDS = [
  "pitLimiterEnabled",
  "pitLimiterPin",
  "pitLimiterPinMode",
  "pitLimiterRPM",
  "pitLimiterSpeed",
  "pitLimiterCutType",
  "pitLimiterSoftWindow"
];

export default function PitLimiter() {
  const {
    getFieldValue, setFieldValue, getFieldInfo, handleSave, discardChanges,
    isSaving, saveStatus, isConnected, isDirty, isReady
  } = useTuningModule(PIT_LIMITER_FIELDS);

  const { realtime } = useStore();
  const isActive = realtime?.performance?.pitLimiterActive;
  const switchState = realtime?.performance?.pitLimiterSwitch;

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  if (!isReady) return null;

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden animate-in fade-in duration-700">
      <TuningHeader
        title="Pit Speed Limiter"
        icon={Snail}
        description="Precision speed control for pit lane compliance and staging safety"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
          
          {/* Status Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className={`p-4 rounded-3xl border transition-all duration-500 flex items-center justify-between ${isActive ? 'bg-neon-cyan/10 border-neon-cyan/40 shadow-glow-cyan' : 'bg-white/5 border-white/10'}`}>
                <div className="flex flex-col">
                   <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Logic Status</span>
                   <span className={`text-xs font-orbitron font-black uppercase ${isActive ? 'text-neon-cyan' : 'text-white/20'}`}>
                      {isActive ? 'LIMITER ACTIVE' : 'STANDBY'}
                   </span>
                </div>
                <Zap size={18} className={isActive ? 'text-neon-cyan animate-pulse' : 'text-white/10'} />
             </div>

             <div className={`p-4 rounded-3xl border transition-all duration-500 flex items-center justify-between ${switchState ? 'bg-neon-white/10 border-white/40' : 'bg-white/5 border-white/10'}`}>
                <div className="flex flex-col">
                   <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Switch Input</span>
                   <span className={`text-xs font-orbitron font-black uppercase ${switchState ? 'text-white' : 'text-white/20'}`}>
                      {switchState ? 'SIGNAL HIGH' : 'SIGNAL LOW'}
                   </span>
                </div>
                <Target size={18} className={switchState ? 'text-white' : 'text-white/10'} />
             </div>

             <div className="p-4 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex flex-col">
                   <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Current Speed</span>
                   <span className="text-xs font-orbitron font-black text-white uppercase italic">
                      {realtime?.vss ?? 0} <span className="text-[8px] opacity-40">KM/H</span>
                   </span>
                </div>
                <Gauge size={18} className="text-white/20" />
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Master Control */}
            <div className="lg:col-span-12">
               <ToggleRow 
                  label="Pit Limiter Master"
                  value={getValue("pitLimiterEnabled")}
                  onChange={(val) => updateValue("pitLimiterEnabled", val)}
                  description="Enable global pit lane speed and RPM limiting logic"
               />
            </div>

            {/* Hardware IO */}
            <div className="lg:col-span-5 space-y-4">
               <div className="p-1 rounded-[40px] bg-gradient-to-b from-white/10 to-transparent">
                  <div className="p-6 rounded-[38px] bg-bg-deep/90 backdrop-blur-3xl space-y-4">
                     <h3 className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] pl-4 mb-6 border-l-2 border-neon-cyan/50">Hardware Interface</h3>
                     <SelectRow 
                        label="Activation Pin"
                        value={getValue("pitLimiterPin")}
                        onChange={(val) => updateValue("pitLimiterPin", val)}
                        options={getFieldInfo("pitLimiterPin")?.meta?.options}
                        icon={Zap}
                     />
                     <SelectRow 
                        label="Pin Polarity"
                        value={getValue("pitLimiterPinMode")}
                        onChange={(val) => updateValue("pitLimiterPinMode", val)}
                        options={getFieldInfo("pitLimiterPinMode")?.meta?.options}
                     />
                  </div>
               </div>
               
               <InfoCard title="Activation Guide" theme="cyan">
                  Limiter engages only when the switch is CLOSED and EITHER RPM or Speed thresholds are exceeded.
               </InfoCard>
            </div>

            {/* Setpoints & Cut Strategy */}
            <div className="lg:col-span-7 space-y-4">
               <div className="p-6 rounded-[40px] bg-white/5 border border-white/5 backdrop-blur-xl space-y-4">
                  <h3 className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] pl-4 mb-6 border-l-2 border-neon-cyan/50">Speed & RPM Limits</h3>
                  <div className="grid grid-cols-2 gap-4">
                     <InputField 
                        label="RPM Limit"
                        value={getValue("pitLimiterRPM")}
                        onChange={(val) => updateValue("pitLimiterRPM", val)}
                        units="RPM"
                     />
                     <InputField 
                        label="Speed Limit"
                        value={getValue("pitLimiterSpeed")}
                        onChange={(val) => updateValue("pitLimiterSpeed", val)}
                        units="KM/H"
                     />
                  </div>
                  <SelectRow 
                     label="Cut Strategy"
                     value={getValue("pitLimiterCutType")}
                     onChange={(val) => updateValue("pitLimiterCutType", val)}
                     options={getFieldInfo("pitLimiterCutType")?.meta?.options}
                  />
                  <div className={`transition-all duration-500 overflow-hidden ${getValue("pitLimiterCutType") > 0 ? 'max-h-32 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                     <InputField 
                        label="Soft Cut Window"
                        value={getValue("pitLimiterSoftWindow")}
                        onChange={(val) => updateValue("pitLimiterSoftWindow", val)}
                        units="RPM"
                        description="RPM range below limit where timing retard begins"
                     />
                  </div>
               </div>

               <div className="p-4 rounded-2xl bg-neon-red/10 border border-neon-red/20 flex items-center gap-4">
                  <ShieldAlert size={18} className="text-neon-red shrink-0" />
                  <p className="text-[8px] font-black text-neon-red uppercase tracking-widest leading-loose">
                     Hard cut strategy is recommended for high-load applications to prevent exhaust manifold melting.
                  </p>
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
