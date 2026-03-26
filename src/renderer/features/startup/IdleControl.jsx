import React from "react";
import {
  Wind,
  Activity,
  Zap,
  Clock,
  Gauge,
  Settings,
  ShieldAlert,
  Flame,
  Info,
  Disc,
  Cpu,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const IDLE_FIELDS = [
  // General IAC / Hardware
  "iacAlgorithm",
  "iacStepTime",
  "iacChannels",
  "idleFreq",
  "iacPWMdir",
  "iacCLminValue",
  "iacCLmaxValue",
  "idleKP",
  "idleKI",
  "idleKD",
  // Idle Advance
  "idleAdvEnabled",
  "idleAdvRPM",
  "idleAdvTPS",
  "idleAdvDelay",
];

const IdleControl = () => {
  const {
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
  } = useTuningModule(IDLE_FIELDS, {});

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const GroupHeader = ({ title, icon: Icon, colorClass = "bg-neon-cyan shadow-glow-cyan" }) => (
    <div className="flex items-center gap-4 mb-6">
      <div className={`w-1.5 h-6 ${colorClass} rounded-full`} />
      <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
        {title}
      </h3>
      {Icon && <Icon className="ml-auto text-neon-cyan opacity-20" size={18} />}
    </div>
  );

  const StatField = ({ name, label, icon: Icon, unit, step = 1, disabled = false, theme = "cyan" }) => {
    const val = getValue(name);
    return (
      <div className={`p-6 rounded-3xl glass-card border border-white/10 transition-all ${disabled ? "opacity-20 grayscale pointer-events-none" : "hover:border-neon-cyan/30"}`}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
            {Icon && <Icon size={12} className={`text-neon-${theme} opacity-40`} />}
            {label}
          </span>
          {unit && <span className="text-[8px] font-black text-white/20 uppercase">{unit}</span>}
        </div>
        <input
          type="number"
          step={step}
          value={val}
          onChange={(e) => updateValue(name, parseFloat(e.target.value))}
          className={`w-full bg-black/40 border-none text-2xl font-mono font-black text-white focus:text-neon-${theme} outline-none`}
        />
      </div>
    );
  };

  const SelectField = ({ name, label, icon: Icon, disabled = false, theme = "cyan" }) => {
    const val = getValue(name);
    const info = getFieldInfo(name);
    const availableOptions = info?.meta?.options || [];

    const filteredOptions = availableOptions
      .map((opt, i) => ({ label: opt, value: i }))
      .filter(o => o.label && o.label !== "INVALID");

    return (
      <div className={`p-6 rounded-3xl glass-card border border-white/10 transition-all ${disabled ? "opacity-20 grayscale pointer-events-none" : "hover:border-neon-cyan/30"}`}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
            {Icon && <Icon size={12} className={`text-neon-${theme} opacity-40`} />}
            {label}
          </span>
        </div>
        <select
          value={val}
          onChange={(e) => updateValue(name, parseInt(e.target.value))}
          className={`w-full bg-black/40 border-none text-[10px] font-orbitron font-bold uppercase text-neon-${theme} outline-none py-1.5 appearance-none cursor-pointer`}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-bg-deep text-white">{opt.label}</option>
            ))
          ) : (
            <option value={val} className="bg-bg-deep text-white">Loading Map...</option>
          )}
        </select>
      </div>
    );
  };

  const iacAlgorithm = getValue("iacAlgorithm");
  const isPWM = iacAlgorithm >= 2; // PWM/Stepper algorithm indices

  return (
    <div className="flex flex-col h-full bg-black select-none animate-in fade-in duration-700">
      <TuningHeader
        title="Idle Control"
        icon={Wind}
        description="Air bypassing management: Target RPM stability and decel control"
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
        {!isReady && isConnected && (
             <div className="max-w-[1400px] mx-auto p-12 text-center text-[10px] font-black text-neon-cyan animate-pulse uppercase tracking-[0.3em]">
                Scanning IAC Maps...
             </div>
        )}

        <div className="max-w-[1400px] mx-auto space-y-10 pb-20">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-8 rounded-[40px] glass-card border border-neon-cyan/20">
              <GroupHeader title="General Settings" icon={Activity} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                <SelectField name="iacAlgorithm" label="Algorithm Type" icon={ShieldAlert} />
                <SelectField name="iacChannels" label="Output Channels" icon={Cpu} />
                <SelectField name="iacStepTime" label="Step Time (Stepper)" icon={Clock} />
              </div>
            </div>

            <div className="p-8 rounded-[40px] glass-card border border-white/10">
              <GroupHeader title="PWM / Stepper Configuration" icon={Zap} colorClass="bg-white/20 shadow-none" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatField name="idleFreq" label="PWM Frequency" unit="Hz" />
                <SelectField name="iacPWMdir" label="Output Polarity" />
                <StatField name="iacCLminValue" label="Min Duty / Steps" unit="%" />
                <StatField name="iacCLmaxValue" label="Max Duty / Steps" unit="%" />
              </div>
            </div>
          </div>

          <div className="p-8 rounded-[40px] glass-card border border-white/5 bg-gradient-to-br from-black to-bg-deep/40">
             <GroupHeader title="Closed-Loop PID Tuning" icon={Gauge} colorClass="bg-neon-orange shadow-glow-orange" />
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <StatField name="idleKP" label="Proportional (P)" theme="orange" />
               <StatField name="idleKI" label="Integral (I)" theme="orange" />
               <StatField name="idleKD" label="Derivative (D)" theme="orange" />
             </div>
             <p className="mt-6 text-[9px] text-gray-600 uppercase font-bold tracking-widest text-center">
               Finetune PID to resolve dipping RPM or oscillating idle.
             </p>
          </div>

          <div className="p-8 rounded-[40px] glass-card border border-white/10 overflow-hidden relative group">
             <div className="absolute top-0 right-0 w-64 h-64 bg-neon-cyan/5 blur-3xl group-hover:bg-neon-cyan/10 transition-all pointer-events-none" />
             <GroupHeader title="Idle Advance Settings" icon={Zap} />
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <SelectField name="idleAdvEnabled" label="Idle Advance System" icon={ShieldAlert} />
               <StatField name="idleAdvRPM" label="Target RPM Threshold" unit="RPM" theme="cyan" />
               <StatField name="idleAdvTPS" label="TPS Activation Limit" unit="%" theme="cyan" />
               <StatField name="idleAdvDelay" label="Settling Delay" unit="S" theme="cyan" />
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default IdleControl;
