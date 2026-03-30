import React from "react";
import { 
  Flame, 
  Settings, 
  Info, 
  AlertTriangle, 
  Activity, 
  TrendingUp,
  Zap,
  Table2,
  GitBranch,
  SlidersHorizontal,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { useStore } from "../../core/store";

const FUEL_FIELDS = [
  "multiplyMAP",
  "includeAFR",
  "incorporateAFR",
  "fuel2Mode",
  "fuel2SwitchVariable",
  "fuel2SwitchValue",
  "fuel2InputPin",
  "fuel2InputPolarity",
  "fuel2InputPullup",
];

export default function FuelSettings() {
  const parsedIni = useStore((s) => s.parsedIni);
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

  const NumberRow = ({ name, label, description, icon: Icon }) => {
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
          <input
            type="number"
            value={value ?? 0}
            onChange={(e) => setFieldValue(name, parseFloat(e.target.value || "0"))}
            className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black text-neon-cyan outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-all"
          />
        </div>
      </div>
    );
  };

  const fuel2Mode = getFieldValue("fuel2Mode") ?? 0;
  const fuel2SwitchVariable = getFieldValue("fuel2SwitchVariable") ?? 0;
  const fuel2SwitchValue = getFieldValue("fuel2SwitchValue") ?? 0;
  const fuel2InputPin = getFieldValue("fuel2InputPin") ?? 0;
  const fuel2InputPolarity = getFieldValue("fuel2InputPolarity") ?? 0;
  const fuel2InputPullup = getFieldValue("fuel2InputPullup") ?? 0;

  const fuel2ModeDescription = {
    0: "Fuel Table 2 is disabled. VE2 exists, but it is not used in fueling.",
    1: "VE2 is used as a multiplied percent map. 100 means neutral, 95 means minus 5 percent, 110 means plus 10 percent.",
    2: "VE2 is used as an added layer on top of the primary fueling calculation.",
    3: "VE2 becomes a switched secondary map when the selected variable passes the threshold below.",
    4: "VE2 becomes a switched secondary map based on an external input pin configuration.",
  }[fuel2Mode] || "Secondary fuel table strategy is not defined.";

  const fuel2VariableLabel =
    getCleanOptions("fuel2SwitchVariable").find(
      (opt) => opt.index === fuel2SwitchVariable,
    )?.label || "Trigger";

  const fuel2InputPinLabel =
    getCleanOptions("fuel2InputPin").find(
      (opt) => opt.index === fuel2InputPin,
    )?.label || "Input pin";

  const fuel2InputPolarityLabel =
    getCleanOptions("fuel2InputPolarity").find(
      (opt) => opt.index === fuel2InputPolarity,
    )?.label || "LOW";

  const fuel2InputPullupLabel =
    getCleanOptions("fuel2InputPullup").find(
      (opt) => opt.index === fuel2InputPullup,
    )?.label || "No";

  const showConditionalControls = fuel2Mode === 3;
  const showInputBasedNotice = fuel2Mode === 4;
  const showInputPullupControl = showInputBasedNotice && fuel2InputPolarity === 0;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="flex flex-col gap-8 p-4 max-w-5xl mx-auto w-full animate-in fade-in duration-700">
      <TuningHeader
        title="Fueling Strategy"
        subtitle="Core fueling equation and secondary VE table behavior"
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

        <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-neon-green/5 blur-[60px] rounded-full" />
          <GroupHeader
            title="Fuel Table 2 Strategy"
            icon={Table2}
            colorClass="bg-neon-green shadow-glow-green"
          />

          <div className="flex flex-col gap-4">
            <SelectRow
              name="fuel2Mode"
              label="Secondary Fuel Table Mode"
              description="Defines what VE Table 2 means: disabled, percent multiplier, additive layer, or switched map."
              icon={GitBranch}
            />

            <div className="p-5 rounded-2xl bg-neon-green/5 border border-neon-green/15">
              <div className="text-[9px] font-black text-neon-green uppercase tracking-widest">
                Current Mode Meaning
              </div>
              <div className="mt-2 text-[11px] leading-6 text-white/65">
                {fuel2ModeDescription}
              </div>
            </div>

            {showConditionalControls ? (
              <>
                <SelectRow
                  name="fuel2SwitchVariable"
                  label="Switch Variable"
                  description="Selects the live value used to decide when VE2 takes over in conditional switch mode."
                  icon={Activity}
                />

                <NumberRow
                  name="fuel2SwitchValue"
                  label="Switch Threshold"
                  description={`VE2 becomes active when ${fuel2VariableLabel} is greater than this threshold.`}
                  icon={SlidersHorizontal}
                />
              </>
            ) : null}

            {showInputBasedNotice ? (
              <>
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-4 items-start">
                  <Info className="text-amber-400 shrink-0 mt-0.5" size={16} />
                  <p className="text-[10px] text-amber-200/80 font-bold leading-relaxed tracking-tight">
                    Input-based mode relies on firmware pin routing. Changes here usually require a power cycle to behave exactly like TunerStudio.
                  </p>
                </div>

                <SelectRow
                  name="fuel2InputPin"
                  label="Input Pin"
                  description="The ECU input pin that triggers Fuel Table 2 when input-based switching is selected."
                  icon={Activity}
                />

                <SelectRow
                  name="fuel2InputPolarity"
                  label="Input Polarity"
                  description={`VE2 becomes active when the selected pin is ${fuel2InputPolarityLabel}.`}
                  icon={GitBranch}
                />

                {showInputPullupControl ? (
                  <SelectRow
                    name="fuel2InputPullup"
                    label="Internal Pullup"
                    description={`Current setting is ${fuel2InputPullupLabel}. Typical ground-switch inputs usually want the pullup enabled.`}
                    icon={Settings}
                  />
                ) : (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex gap-4 items-start">
                    <Info className="text-white/40 shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] text-white/50 font-bold leading-relaxed tracking-tight">
                      Internal pullup is only relevant when the input is active <span className="text-white">LOW</span>. Current pin: <span className="text-white">{fuel2InputPinLabel}</span>.
                    </p>
                  </div>
                )}
              </>
            ) : null}

            {!showConditionalControls && !showInputBasedNotice ? (
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex gap-4 items-start">
                <Info className="text-white/40 shrink-0 mt-0.5" size={16} />
                <p className="text-[10px] text-white/50 font-bold leading-relaxed tracking-tight">
                  The switch variable and threshold only matter in <span className="text-white">Switched - Conditional</span> mode.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
