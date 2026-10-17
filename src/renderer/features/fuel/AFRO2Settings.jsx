import React from "react";
import {
  Wind,
  Settings,
  ShieldAlert,
  Gauge,
  Activity,
  Zap,
  Info,
  Droplets,
  Timer,
  Thermometer,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import {
  GroupHeader,
  StatField,
  SelectField,
} from "../shared/components/TuningComponents";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const O2_FIELDS = [
  "egoType",
  "egoAlgorithm",
  "egoKP",
  "egoKI",
  "egoKD",
  "egoCount",
  "egoLimit",
  "ego_min_afr",
  "ego_max_afr",
  "egoRPM",
  "egoTPSMax",
  "egoTemp",
  "ego_sdelay",
];

const AFRO2Settings = () => {
  const {
    pinPages,
    getFieldValue,
    setFieldValue,
    getFieldInfo,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isConnected,
    isDirty,
    isReady,
  } = useTuningModule(O2_FIELDS, {});

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const fieldProps = { getValue, updateValue, getFieldInfo, pinPages };

  const egoType = getValue("egoType");
  const egoAlgorithm = getValue("egoAlgorithm");
  const isActive = egoType > 0 && egoAlgorithm !== 3;
  const isPID = egoAlgorithm === 2;

  return (
    <div className="flex flex-col h-full bg-black select-none animate-in fade-in duration-700">
      <TuningHeader
        title="O2 Sensor & EGO"
        icon={Droplets}
        description="Configure hardware sensor and closed-loop fueling corrections"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {!isReady && (
             <div className="max-w-[1400px] mx-auto p-12 text-center text-[10px] font-black text-neon-cyan animate-pulse uppercase tracking-[0.4em]">
                Capturing AFR Metadata...
             </div>
        )}

        <div className="max-w-[1400px] mx-auto space-y-10 pb-20">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-8 rounded-[40px] glass-card border border-neon-cyan/20 bg-gradient-to-br from-bg-deep/40 to-black">
              <GroupHeader title="Oxygen Sensor Hardware" icon={Settings} />
              <div className="grid grid-cols-1 gap-6 pb-6">
                <SelectField {...fieldProps} name="egoType" label="Sensor Type" icon={ShieldAlert} />
              </div>
              <div className="p-6 rounded-3xl bg-black/40 border border-white/5 flex items-center justify-between">
                 <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Closed Loop Status</span>
                 <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isActive ? 'bg-neon-cyan/20 text-neon-cyan animate-pulse' : 'bg-white/5 text-gray-700'}`}>
                   {isActive ? (egoAlgorithm === 2 ? 'PID CONTROL' : 'SIMPLE CONTROL') : 'INACTIVE'}
                 </div>
              </div>
            </div>

            <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-3xl pointer-events-none group-hover:bg-neon-cyan/10 transition-all" />
               <GroupHeader title="Closed Loop Algorithm" icon={Zap} colorClass="bg-white/20 shadow-none" />
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="md:col-span-2">
                    <SelectField {...fieldProps} name="egoAlgorithm" label="Control Strategy" disabled={egoType === 0} />
                 </div>
                 {isPID ? (
                   <>
                    <StatField {...fieldProps} name="egoKP" label="Proportional (P)" unit="%" disabled={!isActive} />
                    <StatField {...fieldProps} name="egoKI" label="Integral (I)" unit="%" disabled={!isActive} />
                    <StatField {...fieldProps} name="egoKD" label="Derivative (D)" unit="%" disabled={!isActive} />
                   </>
                 ) : (
                    <div className="md:col-span-2 p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest text-center">
                          PID parameters hidden in Simple mode
                        </p>
                    </div>
                 )}
                 <StatField {...fieldProps} name="egoCount" label="Cycles per Step" disabled={!isActive} />
                 <StatField {...fieldProps} name="egoLimit" label="Max Correction (±)" unit="%" disabled={!isActive} />
               </div>
            </div>
          </div>

          <div className="p-8 rounded-[40px] glass-card border border-white/5 bg-black/40">
             <GroupHeader title="Activation Thresholds" icon={Gauge} theme="orange" />
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-8">
               <StatField {...fieldProps} name="egoRPM" label="Min RPM" theme="orange" disabled={!isActive} />
               <StatField {...fieldProps} name="egoTPSMax" label="Max TPS" unit="%" theme="orange" disabled={!isActive} />
               <StatField {...fieldProps} name="egoTemp" label="Min Coolant" unit="°C" theme="orange" disabled={!isActive} />
               <StatField {...fieldProps} name="ego_sdelay" label="Start Delay" unit="S" theme="orange" disabled={!isActive} />
             </div>
             
             <div className="border-t border-white/5 pt-8">
                <div className="flex items-center gap-2 mb-6 ml-2">
                   <ShieldAlert size={12} className="text-neon-orange opacity-40" />
                   <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Safe Correction Window (AFR)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <StatField {...fieldProps} name="ego_min_afr" label="Lower Bound (Leanest)" unit="AFR" theme="orange" disabled={!isActive} />
                  <StatField {...fieldProps} name="ego_max_afr" label="Upper Bound (Richest)" unit="AFR" theme="orange" disabled={!isActive} />
                </div>
             </div>
          </div>

          <div className="p-8 rounded-[40px] bg-bg-deep/40 border border-white/5 flex gap-6 items-center">
             <div className="p-4 rounded-3xl bg-white/5 text-white/40">
                <Info size={24} />
             </div>
             <p className="text-[9px] text-gray-500 font-bold uppercase leading-relaxed tracking-widest">
               Wideband sensor is required for "Closed Loop" PID or Simple control. Narrowband is only recommended for cruising economy. 
             </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AFRO2Settings;
