import PinSelect from "../shared/components/PinSelect";
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
import { GroupHeader, StatField } from "../shared/components/TuningComponents";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const FUEL_PUMP_FIELDS = ["fuelPumpPin", "fpPrime"];

const FuelPump = () => {
  const {
    pinPages,
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
              <GroupHeader title="Hardware Setup" icon={Settings} theme="white" />
              
              <PinSelect fieldName="fuelPumpPin" label="Output Pin" value={getFieldValue("fuelPumpPin")}
                onChange={value => setFieldValue("fuelPumpPin", value)} decodedPages={pinPages} />
              
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-white/5">
                 <ShieldCheck size={18} className="text-white/20" />
                 <p className="text-[8px] font-bold text-white/30 uppercase leading-relaxed tracking-wider">
                   The pump will activate for the priming duration when the ignition is switched ON.
                 </p>
              </div>
           </div>

           <div className="p-8 rounded-[40px] glass-card border border-white/10 bg-black/40 space-y-8">
              <GroupHeader title="Timing Logic" icon={Timer} theme="cyan" />

              <StatField
                name="fpPrime"
                label="Prime Duration"
                unit="Seconds"
                step={0.1}
                getValue={getValue}
                updateValue={updateValue}
              />

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
