import React from "react";
import { 
  Zap, 
  Settings, 
  Info, 
  Lock, 
  Activity, 
  ShieldAlert,
  Flame,
  ArrowRightLeft
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { useStore } from "../../core/store";

const SPARK_FIELDS = [
  "ignAlgorithm",
  "sparkMode",
  "CrankAng",
  "IgInv",
  "fixAngEnable",
  "FixAng",
  "perToothIgn",
  "dwellErrCorrect",
];

export default function SparkSettings() {
  const { parsedIni } = useStore();
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
  } = useTuningModule(SPARK_FIELDS);

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-neon-purple/20 border-t-neon-purple rounded-full animate-spin" />
          <Zap className="absolute inset-0 m-auto text-neon-purple animate-pulse" size={20} />
        </div>
        <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] animate-pulse">
          Syncing Ignition Logic...
        </div>
      </div>
    );
  }

  // Helper to filter dropdown options (same as LaunchControl/FlatShift)
  const getCleanOptions = (fieldName) => {
    const info = getFieldInfo(fieldName);
    if (info?.pageId === undefined || info?.pageId === null) return [];
    if (!parsedIni?.constants?.pages?.[info.pageId]) return [];
    
    const pageObj = parsedIni.constants.pages[info.pageId];
    const fieldDef = pageObj[info.key]; // e.g., { type: 'bits', labels: [...] }
    
    const labels = fieldDef?.labels || fieldDef?.options;
    if (!labels) return [];
    
    // Maintain original index for ECU communication
    return labels
      .map((label, index) => ({ label, index }))
      .filter(opt => opt.label && opt.label.toUpperCase() !== "INVALID");
  };

  // Internal Components for Spark UI Consistency
  const GroupHeader = ({ title, icon: Icon, colorClass = "bg-neon-purple" }) => (
    <div className="flex items-center gap-3 mb-6">
      <div className={`${colorClass} p-2 rounded-xl shadow-lg shadow-black/20`}>
        <Icon size={16} className="text-black" />
      </div>
      <h3 className="text-xs font-black text-white uppercase tracking-widest">{title}</h3>
    </div>
  );

  const SelectField = ({ name, label, icon: Icon }) => {
    const options = getCleanOptions(name);
    const value = getFieldValue(name);

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-1">
          {Icon && <Icon size={12} className="text-white/40" />}
          <label className="text-[10px] font-black text-white/50 uppercase tracking-wider">{label}</label>
        </div>
        <select
          value={value ?? 0}
          onChange={(e) => setFieldValue(name, parseInt(e.target.value))}
          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs font-black text-neon-purple outline-none focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/20 transition-all appearance-none cursor-pointer hover:bg-black/60"
        >
          {options.map((opt) => (
            <option key={opt.index} value={opt.index}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  };

  const InputField = ({ name, label, unit, icon: Icon, disabled = false }) => {
    const value = getFieldValue(name);
    
    return (
      <div className={`flex flex-col gap-2 ${disabled ? 'opacity-30' : ''}`}>
        <div className="flex items-center gap-2 px-1">
          {Icon && <Icon size={12} className="text-white/40" />}
          <label className="text-[10px] font-black text-white/50 uppercase tracking-wider">{label}</label>
        </div>
        <div className="relative group/input">
          <input
            type="number"
            value={value ?? 0}
            disabled={disabled}
            onChange={(e) => setFieldValue(name, parseFloat(e.target.value))}
            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs font-black text-white outline-none focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/20 transition-all group-hover/input:border-white/20"
          />
          {unit && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-white/20 uppercase">
              {unit}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8 p-4 max-w-7xl mx-auto w-full animate-in fade-in duration-700">
      <TuningHeader
        title="Ignition Logic"
        subtitle="Primary timing patterns and spark hardware configuration"
        icon={Zap}
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        onSave={() => handleSave()}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        isConnected={isConnected}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Hardware & Hardware */}
        <div className="flex flex-col gap-8">
          <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/5 blur-[60px] rounded-full" />
            <GroupHeader title="Spark Hardware" icon={Settings} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SelectField name="sparkMode" label="Spark Output Mode" icon={Zap} />
              <SelectField name="IgInv" label="Output Trigger" icon={ShieldAlert} />
              <SelectField name="ignAlgorithm" label="Ignition Algorithm" icon={Activity} />
              <InputField name="CrankAng" label="Cranking Advance" unit="DEG" icon={Flame} />
            </div>
            {getFieldValue("IgInv") === 1 && (
              <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex gap-4 items-start animate-in zoom-in-95">
                <ShieldAlert className="text-rose-500 shrink-0 mt-0.5" size={16} />
                <p className="text-[10px] text-rose-500/80 font-bold leading-relaxed tracking-tight">
                  WARNING: "Going High" output can destroy smart-coils/igniters if configured incorrectly. 
                  Ensure your hardware supports this logic.
                </p>
              </div>
            )}
          </div>

          <div className="p-8 rounded-[40px] glass-card border border-white/10">
            <GroupHeader title="Timing Precision" icon={Activity} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
              <SelectField name="perToothIgn" label="Per Tooth Precision" />
              <SelectField 
                name="dwellErrCorrect" 
                label="Dwell Error Correction" 
                disabled={getFieldValue("perToothIgn") === 0}
              />
            </div>
            <p className="text-[10px] text-white/30 font-medium px-2 leading-relaxed italic">
              * Per tooth timing improves accuracy on high-count triggers but requires reliable crank signals.
            </p>
          </div>
        </div>

        {/* Locked Timing */}
        <div className="flex flex-col gap-8">
          <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-[60px] rounded-full" />
            <GroupHeader 
              title="Fixed Timing (Locked)" 
              icon={Lock} 
              colorClass="bg-neon-cyan shadow-glow-cyan"
            />
            
            <div className="grid grid-cols-1 gap-8">
              <div className="flex flex-col md:flex-row gap-6 items-end group/item">
                <div className="flex-1 w-full">
                  <SelectField 
                    name="fixAngEnable" 
                    label="Enable Locked Timing" 
                    icon={Lock}
                  />
                </div>
                <div className={`w-full md:w-1/3 transition-all duration-300 ${getFieldValue("fixAngEnable") === 0 ? 'opacity-20 pointer-events-none' : 'opacity-100 animate-in slide-in-from-right-4'}`}>
                  <InputField 
                    name="FixAng" 
                    label="Locked Angle" 
                    unit="DEG" 
                    icon={ArrowRightLeft}
                  />
                </div>
              </div>

              <div className="p-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-2xl">
                 <div className="flex items-center gap-2 mb-2">
                    <Info size={12} className="text-neon-cyan" />
                    <span className="text-[9px] font-black text-neon-cyan uppercase">Timing Protocol</span>
                 </div>
                 <p className="text-[10px] text-white/40 font-medium leading-relaxed">
                   When "Fixed Timing" is enabled, the ECU ignores the Ignition Table and stays locked at the specified angle. 
                   Useful for verifying trigger offset with a timing light.
                 </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
