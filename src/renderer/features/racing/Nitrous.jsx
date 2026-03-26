import React from "react";
import {
  Flame,
  Zap,
  Activity,
  ShieldAlert,
  Settings,
  CircleDot,
  MousePointer2,
  Lock,
  Thermometer,
  Trophy,
  Gauge,
  Droplets,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const NITROUS_FIELDS = [
  "n2o_enable", "n2o_arming_pin", "n2o_minCLT", "n2o_maxMAP", "n2o_minTPS", "n2o_maxAFR",
  "n2o_stage1_pin", "n2o_pin_polarity", "n2o_stage1_minRPM", "n2o_stage1_maxRPM", "n2o_stage1_adderMin", "n2o_stage1_adderMax", "n2o_stage1_retard",
  "n2o_stage2_pin", "n2o_stage2_minRPM", "n2o_stage2_maxRPM", "n2o_stage2_adderMin", "n2o_stage2_adderMax", "n2o_stage2_retard"
];

const Nitrous = () => {
  const {
    getFieldValue, setFieldValue, getFieldInfo, handleSave, discardChanges,
    isSaving, saveStatus, isConnected, isDirty, isReady,
  } = useTuningModule(NITROUS_FIELDS, {});

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const n2o_enable = getValue("n2o_enable");

  const SectionHeader = ({ title, icon: Icon, theme = "purple" }) => (
    <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
      <div className={`w-1 h-3 bg-neon-${theme} shadow-glow-${theme} rounded-full`} />
      <span className="text-[9px] font-black text-white/80 uppercase tracking-[0.2em]">{title}</span>
      {Icon && <Icon size={12} className={`ml-auto text-neon-${theme} opacity-30`} />}
    </div>
  );

  const FormField = ({ name, label, unit, type = "number", theme = "purple", disabled = false, step = 1 }) => {
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
            className={`bg-black/30 text-[10px] font-bold text-white outline-none border-none cursor-pointer focus:text-neon-${theme} py-1`}
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

  const StageCard = ({ stage, pin, minRpm, maxRpm, fuel1, fuel2, ign, theme = "purple", disabled = false }) => (
    <div className={`p-6 rounded-[32px] glass-card border transition-all ${disabled ? "opacity-30 grayscale pointer-events-none border-white/5" : `border-neon-${theme}/20 bg-neon-${theme}/[0.01]`}`}>
      <SectionHeader title={`Nitrous Stage ${stage}`} icon={Flame} theme={theme} />
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <FormField name={pin} label="Output Pin" type="select" theme={theme} />
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex flex-col justify-center">
           <span className="text-[7px] font-bold text-white/20 uppercase">Stage Status</span>
           <div className={`text-[10px] font-black tracking-widest flex items-center gap-2 ${!disabled ? `text-neon-${theme}` : "text-white/10"}`}>
              <Zap size={10} className={!disabled ? "animate-pulse" : ""} />
              {!disabled ? "DYNAMO ACTIVE" : "STBY"}
           </div>
        </div>
        
        <div className="col-span-2 grid grid-cols-2 gap-4 p-4 rounded-2xl bg-black/40 border border-white/5">
           <div className="space-y-4">
              <span className="text-[7px] font-black text-white/20 uppercase tracking-widest border-l-2 border-white/10 pl-2 block">Trigger Window</span>
              <FormField name={minRpm} label="Min Engage" unit="RPM" theme={theme} />
              <FormField name={maxRpm} label="Max Engage" unit="RPM" theme={theme} />
           </div>
           <div className="space-y-4">
              <span className="text-[7px] font-black text-white/20 uppercase tracking-widest border-l-2 border-white/10 pl-2 block">Chem Correction</span>
              <FormField name={fuel1} label="Fuel @ Min" unit="ms" theme={theme} step={0.1} />
              <FormField name={fuel2} label="Fuel @ Max" unit="ms" theme={theme} step={0.1} />
              <FormField name={ign} label="Ign Retard" unit="Deg" theme={theme} />
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden h-screen animate-in fade-in duration-700">
      <TuningHeader
        title="Nitrous Control"
        icon={Trophy}
        description="Chemical supercharging: Two-stage nitrous oxide engagement"
        isDirty={isDirty} isSaving={isSaving} saveStatus={saveStatus}
        isConnected={isConnected} onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)} onDiscard={discardChanges} themeColor="purple"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
          
          {/* Main Enable & Hardware */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12 p-6 rounded-3xl glass-card border border-white/5 bg-gradient-to-r from-neon-purple/[0.05] to-transparent">
              <SectionHeader title="Global Safe Strategy" icon={Settings} theme="purple" />
              <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                <FormField name="n2o_enable" label="System Mode" type="select" />
                <FormField name="n2o_arming_pin" label="Arming Input" type="select" />
                <FormField name="n2o_pin_polarity" label="Pin Polarity" type="select" />
                
                <div className="md:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-4 pl-6 border-l border-white/5">
                   <FormField name="n2o_minCLT" label="Min CLT" unit="°C" theme="cyan" disabled={n2o_enable === 0} />
                   <FormField name="n2o_minTPS" label="Min TPS" unit="%" theme="cyan" disabled={n2o_enable === 0} />
                   <FormField name="n2o_maxMAP" label="Max MAP" unit="kPa" theme="cyan" disabled={n2o_enable === 0} />
                   <FormField name="n2o_maxAFR" label="Lean Alert" unit="AFR" theme="cyan" disabled={n2o_enable === 0} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <StageCard 
                stage={1} 
                pin="n2o_stage1_pin" 
                minRpm="n2o_stage1_minRPM" 
                maxRpm="n2o_stage1_maxRPM"
                fuel1="n2o_stage1_adderMin"
                fuel2="n2o_stage1_adderMax"
                ign="n2o_stage1_retard"
                disabled={n2o_enable === 0}
             />
             <StageCard 
                stage={2} 
                pin="n2o_stage2_pin" 
                minRpm="n2o_stage2_minRPM" 
                maxRpm="n2o_stage2_maxRPM"
                fuel1="n2o_stage2_adderMin"
                fuel2="n2o_stage2_adderMax"
                ign="n2o_stage2_retard"
                theme="magenta"
                disabled={n2o_enable <= 1}
             />
          </div>

          <div className="p-8 rounded-[40px] border border-white/5 bg-black/40 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/5 blur-[100px] pointer-events-none group-hover:bg-neon-purple/10 transition-all" />
             <div className="flex items-start gap-6">
                <div className="p-4 rounded-2xl bg-neon-purple/10 border border-neon-purple/20">
                   <ShieldAlert className="text-neon-purple" size={24} />
                </div>
                <div className="space-y-2">
                   <h4 className="text-[10px] font-black text-white/80 uppercase tracking-widest">Chemical Supercharging Safety</h4>
                   <p className="text-[9px] font-medium text-white/30 leading-relaxed uppercase max-w-2xl">
                     Nitrous will only engage when all global safety thresholds are met (CLT, TPS, MAP, AFR). Ensure Stage 2 starting RPM is higher than Stage 1 ending RPM to prevent engine shock.
                   </p>
                </div>
                <div className="ml-auto flex items-center gap-4">
                   <div className="flex flex-col items-end">
                      <span className="text-[7px] font-black text-white/20 uppercase">Bottled HP</span>
                      <span className="text-xl font-mono font-black text-white/10 group-hover:text-neon-purple transition-colors tracking-tighter">N₂O READY</span>
                   </div>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Nitrous;
