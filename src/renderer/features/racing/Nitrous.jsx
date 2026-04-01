import React from "react";
import {
  Flame,
  Zap,
  ShieldAlert,
  Settings,
  CircleDot,
  MousePointer2,
  Trophy,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import PinSelect from "../shared/components/PinSelect";
import {
  SelectRow,
  InputField,
  InfoCard,
} from "../shared/components/TuningComponents";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const NITROUS_FIELDS = [
  "n2o_enable",
  "n2o_arming_pin",
  "n2o_minCLT",
  "n2o_maxMAP",
  "n2o_minTPS",
  "n2o_maxAFR",
  "n2o_stage1_pin",
  "n2o_pin_polarity",
  "n2o_stage1_minRPM",
  "n2o_stage1_maxRPM",
  "n2o_stage1_adderMin",
  "n2o_stage1_adderMax",
  "n2o_stage1_retard",
  "n2o_stage2_pin",
  "n2o_stage2_minRPM",
  "n2o_stage2_maxRPM",
  "n2o_stage2_adderMin",
  "n2o_stage2_adderMax",
  "n2o_stage2_retard",
];

const Nitrous = () => {
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
  const armingPin = getValue("n2o_arming_pin");
  const stageOneReady = n2o_enable > 0;
  const stageTwoReady = n2o_enable > 1;
  const polarityLabel =
    getFieldInfo("n2o_pin_polarity")?.meta?.options?.[
      getValue("n2o_pin_polarity")
    ] || "Unknown";

  const SectionHeader = ({ title, icon: Icon, theme = "purple" }) => (
    <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
      <div
        className={`w-1 h-3 bg-neon-${theme} shadow-glow-${theme} rounded-full`}
      />
      <span className="text-[9px] font-black text-white/80 uppercase tracking-[0.2em]">
        {title}
      </span>
      {Icon && (
        <Icon size={12} className={`ml-auto text-neon-${theme} opacity-30`} />
      )}
    </div>
  );

  const StageCard = ({
    stage,
    pin,
    minRpm,
    maxRpm,
    fuel1,
    fuel2,
    ign,
    theme = "purple",
    disabled = false,
  }) => (
    <div
      className={`relative overflow-hidden p-6 rounded-[32px] glass-card border transition-all ${disabled ? "opacity-30 grayscale pointer-events-none border-white/5" : `border-neon-${theme}/20 bg-neon-${theme}/[0.01]`}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px ${
          disabled
            ? "bg-white/10"
            : `bg-gradient-to-r from-neon-${theme}/80 via-white/20 to-transparent`
        }`}
      />
      <SectionHeader
        title={`Nitrous Stage ${stage}`}
        icon={Flame}
        theme={theme}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <PinSelect
            label="Output Pin"
            fieldName={pin}
            value={getValue(pin)}
            onChange={(val) => updateValue(pin, val)}
            description={`Stage ${stage} only allows free output-capable pins`}
            icon={CircleDot}
            disabled={disabled}
          />
          <div className="rounded-2xl border border-white/5 bg-black/35 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[8px] font-black uppercase tracking-[0.22em] text-white/35">
                Stage Status
              </span>
              <div
                className={`text-[10px] font-black tracking-widest flex items-center gap-2 ${!disabled ? `text-neon-${theme}` : "text-white/10"}`}
              >
                <Zap size={10} className={!disabled ? "animate-pulse" : ""} />
                {!disabled ? "DYNAMO ACTIVE" : "STBY"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl bg-black/40 border border-white/5 p-4 md:grid-cols-2">
          <div className="space-y-4">
            <span className="text-[7px] font-black text-white/20 uppercase tracking-widest border-l-2 border-white/10 pl-2 block">
              Trigger Window
            </span>
            <InputField
              label="Min Engage"
              value={getValue(minRpm)}
              onChange={(val) => updateValue(minRpm, val)}
              units="RPM"
              disabled={disabled}
            />
            <InputField
              label="Max Engage"
              value={getValue(maxRpm)}
              onChange={(val) => updateValue(maxRpm, val)}
              units="RPM"
              disabled={disabled}
            />
          </div>
          <div className="space-y-4">
            <span className="text-[7px] font-black text-white/20 uppercase tracking-widest border-l-2 border-white/10 pl-2 block">
              Chem Correction
            </span>
            <InputField
              label="Fuel @ Min"
              value={getValue(fuel1)}
              onChange={(val) => updateValue(fuel1, val)}
              units="ms"
              disabled={disabled}
              step={0.1}
            />
            <InputField
              label="Fuel @ Max"
              value={getValue(fuel2)}
              onChange={(val) => updateValue(fuel2, val)}
              units="ms"
              disabled={disabled}
              step={0.1}
            />
            <InputField
              label="Ign Retard"
              value={getValue(ign)}
              onChange={(val) => updateValue(ign, val)}
              units="Deg"
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden h-screen animate-in fade-in duration-700">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neon-red/18 via-neon-red/8 to-transparent" />
      <div className="pointer-events-none absolute -top-16 right-[-8rem] h-64 w-64 rounded-full bg-neon-red/10 blur-[120px]" />
      <div className="pointer-events-none absolute left-[-6rem] top-40 h-56 w-56 rounded-full bg-neon-red/6 blur-[110px]" />
      <div className="pointer-events-none relative z-10 h-2 w-full bg-gradient-to-r from-neon-red/80 via-neon-red to-neon-orange/70" />
      <TuningHeader
        title="Nitrous Control"
        icon={Trophy}
        description="Chemical supercharging: Two-stage nitrous oxide engagement"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="purple"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
          <div className="p-8 rounded-[40px] border border-neon-yellow/25 bg-gradient-to-r from-neon-yellow/10 to-neon-orange/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255, 224, 87, 0.14),transparent_42%)] pointer-events-none" />
            <div className="relative z-10 flex items-start gap-6">
              <div className="p-4 rounded-3xl bg-neon-yellow/15 border border-neon-yellow/30 shadow-glow-yellow">
                <ShieldAlert size={28} className="text-neon-yellow" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-orbitron font-black text-white uppercase tracking-widest">
                  Chemical Supercharging Safety
                </h2>
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider leading-relaxed max-w-4xl">
                  Nitrous will only engage when all global safety thresholds are
                  met (CLT, TPS, MAP, AFR). Ensure Stage 2 starting RPM is
                  higher than Stage 1 ending RPM to prevent engine shock.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div
              className={`p-4 rounded-3xl border transition-all duration-500 ${
                n2o_enable > 0
                  ? "bg-neon-purple/10 border-neon-purple/35 shadow-glow-purple"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Mode
                </span>
                <span
                  className={`text-xs font-orbitron font-black uppercase ${
                    n2o_enable > 0 ? "text-neon-purple" : "text-white/20"
                  }`}
                >
                  {n2o_enable > 1
                    ? "DUAL STAGE"
                    : n2o_enable > 0
                      ? "SINGLE STAGE"
                      : "DISABLED"}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-3xl bg-white/5 border border-white/10">
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Arming Pin
                </span>
                <span
                  className={`text-xs font-orbitron font-black uppercase ${
                    armingPin > 0 ? "text-white" : "text-white/20"
                  }`}
                >
                  {armingPin > 0 ? `PIN ${armingPin}` : "UNASSIGNED"}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-3xl bg-white/5 border border-white/10">
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Stage Status
                </span>
                <span className="text-xs font-orbitron font-black uppercase text-white">
                  {stageOneReady
                    ? `S1 ${stageTwoReady ? "/ S2" : "READY"}`
                    : "STBY"}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-3xl bg-white/5 border border-white/10">
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Pin Polarity
                </span>
                <span className="text-xs font-orbitron font-black uppercase text-neon-cyan">
                  {polarityLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 p-6 rounded-[36px] glass-card border border-neon-purple/20 bg-gradient-to-br from-neon-purple/[0.06] to-transparent">
              <SectionHeader
                title="Hardware & Arming"
                icon={Settings}
                theme="purple"
              />
              <div className="space-y-4">
                <SelectRow
                  label="System Mode"
                  value={getValue("n2o_enable")}
                  onChange={(val) => updateValue("n2o_enable", val)}
                  options={getFieldInfo("n2o_enable")?.meta?.options}
                />
                <PinSelect
                  label="Arming Input"
                  fieldName="n2o_arming_pin"
                  value={getValue("n2o_arming_pin")}
                  onChange={(val) => updateValue("n2o_arming_pin", val)}
                  description="Only unclaimed arming input pins can be selected here"
                  icon={MousePointer2}
                />
                <SelectRow
                  label="Pin Polarity"
                  value={getValue("n2o_pin_polarity")}
                  onChange={(val) => updateValue("n2o_pin_polarity", val)}
                  options={getFieldInfo("n2o_pin_polarity")?.meta?.options}
                />
              </div>
            </div>

            <div className="lg:col-span-7 p-6 rounded-[36px] glass-card border border-white/10 bg-black/35">
              <SectionHeader
                title="Global Safety Window"
                icon={ShieldAlert}
                theme="cyan"
              />
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <InputField
                  label="Min CLT"
                  value={getValue("n2o_minCLT")}
                  onChange={(val) => updateValue("n2o_minCLT", val)}
                  units="°C"
                  disabled={n2o_enable === 0}
                />
                <InputField
                  label="Min TPS"
                  value={getValue("n2o_minTPS")}
                  onChange={(val) => updateValue("n2o_minTPS", val)}
                  units="%"
                  disabled={n2o_enable === 0}
                />
                <InputField
                  label="Max MAP"
                  value={getValue("n2o_maxMAP")}
                  onChange={(val) => updateValue("n2o_maxMAP", val)}
                  units="kPa"
                  disabled={n2o_enable === 0}
                />
                <InputField
                  label="Lean Alert"
                  value={getValue("n2o_maxAFR")}
                  onChange={(val) => updateValue("n2o_maxAFR", val)}
                  units="AFR"
                  disabled={n2o_enable === 0}
                />
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

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-6">
            <InfoCard title="Staging Rule" icon={Zap} theme="magenta">
              Stage 2 should enter later and exit later than Stage 1 so the
              handoff feels progressive instead of abrupt.
            </InfoCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Nitrous;
