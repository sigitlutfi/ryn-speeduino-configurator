import React from "react";
import {
  Zap,
  Activity,
  Clock,
  Gauge,
  Settings,
  ShieldAlert,
  Info,
  Disc,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const FLAT_FIELDS = [
  "flatSEnable",
  "flatSSoftWin",
  "flatSRetard",
  "launchPin",
  "launchHiLo",
  "lnchPullRes",
  "flatSArm",
];

const DEFAULT_PINS = [
  "Board Default", "INVALID", "INVALID", "3", "4", "5", "6", "7", "8", "9",
  "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
  "31", "32", "33", "34", "35", "36", "37", "38", "39", "40"
];

const FlatShift = () => {
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
  } = useTuningModule(FLAT_FIELDS, {});

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
    <div className="flex items-center gap-4 mb-6 pt-6">
      <div className={`w-1.5 h-6 ${colorClass} rounded-full`} />
      <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
        {title}
      </h3>
      {Icon && <Icon className="ml-auto text-neon-cyan opacity-10" size={18} />}
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

  const SelectField = ({ name, label, icon: Icon, options, disabled = false, theme = "cyan" }) => {
    const val = getValue(name);
    const info = getFieldInfo(name);
    
    let availableOptions = options || info?.meta?.options || [];
    if (availableOptions.length === 0) {
      if (name === "launchPin") availableOptions = DEFAULT_PINS;
      if (name.includes("Enable")) availableOptions = ["No", "Yes"];
      if (name.includes("HiLo")) availableOptions = ["LOW", "HIGH"];
      if (name.includes("PullRes")) availableOptions = ["Floating", "Pullup"];
    }

    // Handle filtering "INVALID" while maintaining original mapping index
    const filterOptions = (opts) => {
      return opts
        .map((opt, i) => ({ label: opt, value: i }))
        .filter(o => o.label && o.label !== "INVALID");
    };

    const dropdownOptions = filterOptions(availableOptions);

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
          {dropdownOptions.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-bg-deep text-white">{opt.label}</option>
          ))}
        </select>
      </div>
    );
  };

  const flatSEnable = getValue("flatSEnable");

  return (
    <div className="flex flex-col h-full bg-black select-none animate-in fade-in slide-in-from-right-4 duration-700">
      <TuningHeader
        title="Flat Shift"
        icon={Zap}
        description="Full-throttle gear changes: Maintain boost and RPM during high-speed transitions"
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
                Synchronizing High-Speed Shifting...
             </div>
        )}
        <div className="max-w-[1400px] mx-auto space-y-10 pb-20">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-8 rounded-[40px] glass-card border border-neon-cyan/20 relative overflow-hidden group">
              <GroupHeader title="Shift Strategy" icon={Activity} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <SelectField name="flatSEnable" label="Flat Shift Controller" icon={ShieldAlert} />
                <StatField name="flatSSoftWin" label="Soft Window" unit="RPM" icon={Clock} disabled={!flatSEnable} />
                <div className="md:col-span-2">
                   <StatField name="flatSRetard" label="Ignition Retard" unit="°" icon={Gauge} disabled={!flatSEnable} />
                </div>
              </div>
            </div>

            <div className="p-8 rounded-[40px] border border-white/5 bg-black/40 flex flex-col justify-center gap-6 group overflow-hidden relative">
               <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-3xl pointer-events-none group-hover:bg-neon-cyan/10 transition-all" />
               <GroupHeader title="Information" icon={Info} colorClass="bg-white/10" />
               <p className="text-[10px] font-medium text-gray-400 uppercase leading-relaxed tracking-wider">
                 Flat shifting allows you to change gears without releasing the gas pedal. 
                 The "Soft Window" defines the RPM threshold before ignition timing is restored.
               </p>
               <div className="flex items-center gap-4 mt-4">
                  <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${flatSEnable ? 'bg-neon-cyan/20 text-neon-cyan animate-pulse' : 'bg-white/5 text-gray-600'}`}>
                    {flatSEnable ? 'ENABLED' : 'DISABLED'}
                  </div>
               </div>
            </div>
          </div>

          <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden bg-gradient-to-b from-transparent to-white/5">
             <GroupHeader title="Clutch Logic Setup" icon={Settings} colorClass="bg-white/20" />
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <SelectField name="launchPin" label="Clutch Input Pin" icon={Disc} theme="white" />
               <SelectField name="launchHiLo" label="Signal Logic" theme="white" />
               <SelectField name="lnchPullRes" label="Resistor Type" theme="white" />
               <StatField name="flatSArm" label="Arming RPM" unit="RPM" theme="white" />
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FlatShift;
