import React from "react";
import { 
  Zap, 
  Settings, 
  Info, 
  AlertTriangle, 
  Flame, 
  Battery, 
  ShieldAlert,
  Activity
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { useStore } from "../../core/store";

const DWELL_FIELDS = [
  "dwellcrank",
  "useDwellMap",
  "dwellrun",
  "sparkDur",
  "useDwellLim",
  "dwellLim"
];

export default function DwellSettings() {
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
  } = useTuningModule(DWELL_FIELDS);

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-neon-purple/20 border-t-neon-purple rounded-full animate-spin" />
          <Battery className="absolute inset-0 m-auto text-neon-purple animate-pulse" size={20} />
        </div>
        <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] animate-pulse">
          Syncing Coil Charging Parameters...
        </div>
      </div>
    );
  }

  const getCleanOptions = (fieldName) => {
    const info = getFieldInfo(fieldName);
    if (!info?.pageId || !parsedIni?.constants?.pages?.[info.pageId]) return [];
    
    const pageObj = parsedIni.constants.pages[info.pageId];
    const fieldDef = pageObj[info.key];
    
    if (!fieldDef?.labels) return [];
    
    return fieldDef.labels
      .map((label, index) => ({ label, index }))
      .filter(opt => opt.label && opt.label.toUpperCase() !== "INVALID");
  };

  const GroupHeader = ({ title, icon: Icon, colorClass = "bg-neon-purple" }) => (
    <div className="flex items-center gap-3 mb-6">
      <div className={`${colorClass} p-2 rounded-xl shadow-lg shadow-black/20 text-black`}>
        <Icon size={16} />
      </div>
      <h3 className="text-xs font-black text-white uppercase tracking-widest">{title}</h3>
    </div>
  );

  const SelectRow = ({ name, label, description, icon: Icon, disabled = false }) => {
    const options = getCleanOptions(name);
    const value = getFieldValue(name);

    return (
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group/row ${disabled ? 'opacity-20 pointer-events-none' : ''}`}>
        <div className="flex items-start gap-4 flex-1">
          <div className="mt-1 p-2 rounded-lg bg-black/40 text-white/40 group-hover/row:text-neon-purple transition-colors">
            {Icon && <Icon size={16} />}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-black text-white uppercase tracking-wider">{label}</span>
            <span className="text-[10px] text-white/40 font-medium leading-relaxed max-w-sm">{description}</span>
          </div>
        </div>
        <div className="min-w-[160px]">
          <select
            value={value ?? 0}
            onChange={(e) => setFieldValue(name, parseInt(e.target.value))}
            className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black text-neon-purple outline-none focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/20 transition-all appearance-none cursor-pointer"
          >
            {options.map((opt) => (
              <option key={opt.index} value={opt.index}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  const InputField = ({ name, label, unit, icon: Icon, disabled = false }) => {
    const value = getFieldValue(name);
    
    return (
      <div className={`flex flex-col gap-2 ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-2 px-1">
          {Icon && <Icon size={12} className="text-white/40" />}
          <label className="text-[10px] font-black text-white/50 uppercase tracking-wider">{label}</label>
        </div>
        <div className="relative group/input">
          <input
            type="number"
            step="0.1"
            value={value ?? 0}
            disabled={disabled}
            onChange={(e) => setFieldValue(name, parseFloat(e.target.value))}
            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs font-black text-white outline-none focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/20 transition-all group-hover/input:border-white/20"
          />
          {unit && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-white/20 uppercase font-mono">
              {unit}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8 p-4 max-w-6xl mx-auto w-full animate-in fade-in duration-700">
      <TuningHeader
        title="Dwell Control"
        subtitle="Coil charging times and overdwell safety configuration"
        icon={Zap}
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        onSave={() => handleSave()}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        isConnected={isConnected}
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* Core Charging */}
        <div className="xl:col-span-3 flex flex-col gap-8">
          <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/5 blur-[60px] rounded-full" />
            <GroupHeader title="Coil Charging Timing" icon={Settings} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <InputField name="dwellcrank" label="Cranking Dwell" unit="MS" icon={Flame} />
              <InputField name="sparkDur" label="Spark Duration" unit="MS" icon={Activity} />
            </div>

            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex gap-4 items-start mb-8">
              <Info className="text-indigo-400 shrink-0 mt-0.5" size={16} />
              <p className="text-[10px] text-indigo-200/80 font-bold leading-relaxed tracking-tight">
                Note: Voltage correction is automatically applied to these values by the ECU. 
                Values shown are referenced to 12.0V baseline.
              </p>
            </div>

            <SelectRow 
              name="useDwellMap" 
              label="Running Calculation Mode" 
              description="Switch between fixed running dwell or using the dynamic Dwell Map table."
              icon={Settings}
            />

            <div className={`mt-6 transition-all duration-300 ${getFieldValue("useDwellMap") === 1 ? 'opacity-20 pointer-events-none scale-95' : 'opacity-100 animate-in fade-in'}`}>
              <InputField 
                name="dwellrun" 
                label="Base Running Dwell" 
                unit="MS" 
                icon={Zap}
                disabled={getFieldValue("useDwellMap") === 1}
              />
            </div>
          </div>
        </div>

        {/* Safety & Info */}
        <div className="xl:col-span-2 flex flex-col gap-8">
          <div className="p-8 rounded-[40px] glass-card border border-rose-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-rose/5 blur-[60px] rounded-full" />
            <GroupHeader 
              title="Overdwell Safety" 
              icon={ShieldAlert} 
              colorClass="bg-neon-rose shadow-glow-rose"
            />
            
            <div className="flex flex-col gap-8">
               <SelectRow 
                name="useDwellLim" 
                label="Protection Active" 
                description="Hard limit for dwell time to prevent coil burnout if triggers become unstable."
                icon={ShieldAlert}
              />

              <div className={`transition-all duration-300 ${getFieldValue("useDwellLim") === 0 ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                <InputField 
                  name="dwellLim" 
                  label="Maximum Permissible Dwell" 
                  unit="MS" 
                  icon={ShieldAlert}
                  disabled={getFieldValue("useDwellLim") === 0}
                />
              </div>

              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                 <p className="text-[9px] text-rose-500/60 font-black uppercase tracking-widest text-center">
                   Critical Warning
                 </p>
                 <p className="mt-2 text-[10px] text-rose-400 font-bold leading-relaxed text-center italic">
                   "Set this limit at least 3ms higher than your intended peak dwell time to avoid ignition cut-outs."
                 </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
