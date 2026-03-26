import React from "react";
import { 
  Flame, 
  Settings, 
  Info, 
  AlertTriangle, 
  Activity, 
  TrendingUp,
  Zap
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { useStore } from "../../core/store";

const FUEL_FIELDS = [
  "multiplyMAP",
  "includeAFR",
  "incorporateAFR"
];

export default function FuelSettings() {
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
  } = useTuningModule(FUEL_FIELDS);

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
        <div className="relative">
          <div className="w-10 h-10 border-2 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin" />
          <Flame className="absolute inset-0 m-auto text-neon-cyan animate-pulse" size={18} />
        </div>
        <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] animate-pulse">
          Syncing Fuel Strategies...
        </div>
      </div>
    );
  }

  // Helper to filter dropdown options
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

  const GroupHeader = ({ title, icon: Icon, colorClass = "bg-neon-cyan" }) => (
    <div className="flex items-center gap-3 mb-6">
      <div className={`${colorClass} p-2 rounded-xl shadow-lg shadow-black/20 text-black`}>
        <Icon size={16} />
      </div>
      <h3 className="text-xs font-black text-white uppercase tracking-widest">{title}</h3>
    </div>
  );

  const SelectRow = ({ name, label, description, icon: Icon }) => {
    const options = getCleanOptions(name);
    const value = getFieldValue(name);

    return (
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group/row">
        <div className="flex items-start gap-4 flex-1">
          <div className="mt-1 p-2 rounded-lg bg-black/40 text-white/40 group-hover/row:text-neon-cyan transition-colors">
            {Icon && <Icon size={16} />}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-black text-white uppercase tracking-wider">{label}</span>
            <span className="text-[10px] text-white/40 font-medium leading-relaxed max-w-md">{description}</span>
          </div>
        </div>
        <div className="min-w-[200px]">
          <select
            value={value ?? 0}
            onChange={(e) => setFieldValue(name, parseInt(e.target.value))}
            className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black text-neon-cyan outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-all appearance-none cursor-pointer"
          >
            {options.map((opt) => (
              <option key={opt.index} value={opt.index}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8 p-4 max-w-5xl mx-auto w-full animate-in fade-in duration-700">
      <TuningHeader
        title="Fueling Strategy"
        subtitle="Global injection multipliers and algorithmic compensation"
        icon={Flame}
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        onSave={() => handleSave()}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        isConnected={isConnected}
      />

      <div className="grid grid-cols-1 gap-8">
        {/* Core Multipliers */}
        <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-[60px] rounded-full" />
          <GroupHeader title="Core Calculation Multipliers" icon={Activity} />
          
          <div className="flex flex-col gap-4">
            <SelectRow 
              name="multiplyMAP" 
              label="Multiply MAP" 
              description="Primary density compensation. Multiplies VE table value by (MAP/Baro) ratio. Essential for Speed-Density tuning."
              icon={TrendingUp}
            />
          </div>
        </div>

        {/* Legacy & Precision */}
        <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-neon-rose/5 blur-[60px] rounded-full" />
          <GroupHeader 
            title="AFR Corrections" 
            icon={Zap} 
            colorClass="bg-neon-rose shadow-glow-rose"
          />

          <div className="flex flex-col gap-6">
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex gap-4 items-start mb-2">
              <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
              <p className="text-[10px] text-rose-500/80 font-bold leading-relaxed tracking-tight">
                Use these options with caution. They directly modify the injector pulsewidth calculation 
                based on your Target AFR. Usually kept disabled unless explicitly required by your setup.
              </p>
            </div>

            <SelectRow 
              name="includeAFR" 
              label="Include AFR Target" 
              description="Multiplies by the ratio of actual AFR to Target AFR. (Legacy support only)"
              icon={Settings}
            />

            <SelectRow 
              name="incorporateAFR" 
              label="Incorporate AFR Target" 
              description="Modern strategy to include target AFR in the main fueling equation (Stoich / Target AFR)."
              icon={Activity}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
