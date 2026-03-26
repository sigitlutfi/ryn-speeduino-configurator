import React from "react";
import {
  Droplets,
  Timer,
  Settings,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const FUEL_PUMP_FIELDS = ["fuelPumpPin", "fpPrime"];

const FuelPump = () => {
  const {
    getFieldValue, setFieldValue, getFieldInfo, handleSave, discardChanges,
    isSaving, saveStatus, isConnected, isDirty, isReady,
  } = useTuningModule(FUEL_PUMP_FIELDS, {});

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const FormField = ({ name, label, unit, type = "number", theme = "white", disabled = false, step = 1 }) => {
    const val = getValue(name);
    const info = getFieldInfo(name);

    return (
      <div className={`flex flex-col gap-1.5 p-4 rounded-2xl transition-all ${disabled ? "opacity-20 select-none cursor-not-allowed grayscale" : "bg-white/[0.02] hover:bg-white/[0.05] border border-white/5"}`}>
        <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest flex justify-between">
          {label}
          {unit && <span className="text-white/20 italic">{unit}</span>}
        </label>
        
        {type === "select" ? (
          <select
            value={val}
            onChange={(e) => updateValue(name, parseInt(e.target.value))}
            className="bg-transparent text-[11px] font-bold text-white outline-none border-none cursor-pointer focus:text-neon-cyan py-1"
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
            className={`bg-transparent text-lg font-mono font-black text-white outline-none border-none focus:text-neon-cyan`}
          />
        ) }
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden h-screen animate-in fade-in duration-700">
      <TuningHeader
        title="Fuel Pump Settings"
        icon={Droplets}
        description="Configure pump engagement and priming cycle"
        isDirty={isDirty} isSaving={isSaving} saveStatus={saveStatus}
        isConnected={isConnected} onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)} onDiscard={discardChanges} themeColor="white"
      />

      <div className="flex-1 flex items-center justify-center p-6 pb-20">
        <div className="max-w-[800px] w-full grid grid-cols-1 md:grid-cols-2 gap-8">
           
           <div className="p-8 rounded-[40px] glass-card border border-white/10 bg-gradient-to-br from-white/[0.02] to-transparent space-y-8">
              <div className="flex items-center gap-3">
                 <div className="w-1 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
                 <span className="text-[9px] font-black text-white/80 uppercase tracking-[0.3em]">Hardware Setup</span>
              </div>
              
              <FormField name="fuelPumpPin" label="Output Pin" type="select" />
              
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-white/5">
                 <ShieldCheck size={18} className="text-white/20" />
                 <p className="text-[8px] font-bold text-white/30 uppercase leading-relaxed tracking-wider">
                   The pump will activate for the priming duration when the ignition is switched ON.
                 </p>
              </div>
           </div>

           <div className="p-8 rounded-[40px] glass-card border border-white/10 bg-black/40 space-y-8">
              <div className="flex items-center gap-3">
                 <div className="w-1 h-4 bg-neon-cyan rounded-full shadow-glow-cyan" />
                 <span className="text-[9px] font-black text-white/80 uppercase tracking-[0.3em]">Timing Logic</span>
              </div>

              <FormField name="fpPrime" label="Prime Duration" unit="Seconds" step={0.1} />

              <div className="p-4 rounded-2xl bg-neon-cyan/[0.02] border border-neon-cyan/10 flex flex-col gap-3">
                 <div className="flex items-center justify-between">
                    <span className="text-[7px] font-black text-neon-cyan uppercase tracking-widest">Pump status</span>
                    <Zap size={14} className="text-neon-cyan animate-pulse" />
                 </div>
                 <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-neon-cyan shadow-glow-cyan w-full transition-all duration-1000" />
                 </div>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
};

export default FuelPump;
