import React from "react";
import {
  Flame,
  ShieldAlert,
  Zap,
  Timer,
  Gauge,
  Thermometer,
  Target,
} from "lucide-react";
import { useStore } from "../../core/store.js";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { toDisplay, toRaw } from "../shared/utils/normalization";
import {
  SelectRow,
  InputField,
  ToggleRow,
  InfoCard,
} from "../shared/components/TuningComponents";
import PinSelect from "../shared/components/PinSelect";

const ALS_FIELDS = [
  "alsEnabled",
  "alsSwitchPin",
  "alsSwitchPolarity",
  "alsMinRPM",
  "alsMaxTPS",
  "alsMinBoost",
  "alsTimingRetard",
  "alsFuelModifier",
  "alsMinCLT",
  "alsMaxCLT",
  "alsMinVSS",
  "alsMaxDuration",
  "alsIgnCutEnable",
  "alsIgnCutPattern",
  "alsFuelCutPattern",
];

export default function AntiLag() {
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
  } = useTuningModule(ALS_FIELDS);

  const { realtime } = useStore();
  const isActive = realtime?.performance?.alsActive;
  const activeTimeMs = realtime?.performance?.alsActiveTime ?? 0;
  const activeTimeSeconds = activeTimeMs / 1000;

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  if (!isReady) return null;

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden animate-in fade-in duration-700">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neon-red/18 via-neon-red/8 to-transparent" />
      <div className="pointer-events-none absolute -top-16 right-[-8rem] h-64 w-64 rounded-full bg-neon-red/10 blur-[120px]" />
      <div className="pointer-events-none absolute left-[-6rem] top-40 h-56 w-56 rounded-full bg-neon-red/6 blur-[110px]" />
      <div className="pointer-events-none relative z-10 h-2 w-full bg-gradient-to-r from-neon-red/80 via-neon-red to-neon-orange/70" />
      <TuningHeader
        title="Anti-Lag System (ALS)"
        icon={Flame}
        description="High-performance boost maintenance via aggressive ignition retard and fuel enrichment"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="red"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
          {/* Critical Warnings */}
          <div className="p-8 rounded-[40px] border border-neon-red/40 bg-neon-red/5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-neon-red/10 to-transparent pointer-events-none" />
            <div className="flex items-start gap-8 relative z-10">
              <div className="p-5 rounded-3xl bg-neon-red/20 border border-neon-red/30 shadow-glow-red">
                <ShieldAlert size={32} className="text-neon-red" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-orbitron font-black text-white uppercase tracking-widest">
                  Racing Use Only - Extreme Stress
                </h2>
                <p className="text-[9px] font-medium text-gray-300 leading-relaxed uppercase tracking-wider max-w-3xl">
                  Anti-Lag moves the combustion process into the exhaust
                  manifold to maintain turbine speed. This results in{" "}
                  <span className="text-neon-red font-black">
                    VOLCANIC EXHAUST GAS TEMPERATURES
                  </span>
                  . Continuous activation WILL destroy turbochargers, manifolds,
                  and valves. Duration and CLT based safety limits are
                  mandatory.
                </p>
              </div>
            </div>
          </div>

          {/* Real-time Telemetry Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            <div
              className={`p-4 rounded-3xl border transition-all duration-700 ${isActive ? "bg-neon-red/10 border-neon-red/40 shadow-glow-red" : "bg-white/5 border-white/10"}`}
            >
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  ALS Status
                </span>
                <span
                  className={`text-xs font-orbitron font-black uppercase ${isActive ? "text-neon-red" : "text-white/20"}`}
                >
                  {isActive ? "BURNING ACTIVE" : "STBY"}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-white/5 border border-white/10">
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Cycle Timer
                </span>
                <span
                  className={`text-xs font-orbitron font-black uppercase ${isActive ? "text-white" : "text-white/20"}`}
                >
                  {activeTimeSeconds.toFixed(activeTimeSeconds < 10 ? 1 : 0)}S{" "}
                  <span className="text-[8px] opacity-40">ELAPSED</span>
                </span>
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-white/5 border border-white/10">
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Ign Retard
                </span>
                <span
                  className={`text-xs font-orbitron font-black uppercase ${isActive ? "text-neon-orange" : "text-white/20"}`}
                >
                  {realtime?.performance?.alsTimingCorr ?? 0}°{" "}
                  <span className="text-[8px] opacity-40">CORR</span>
                </span>
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-white/5 border border-white/10">
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Fuel Mult
                </span>
                <span
                  className={`text-xs font-orbitron font-black uppercase ${isActive ? "text-neon-cyan" : "text-white/20"}`}
                >
                  {Math.max(100, realtime?.performance?.alsFuelCorr ?? 0)}%{" "}
                  <span className="text-[8px] opacity-40">VE</span>
                </span>
              </div>
            </div>
          </div>

          <ToggleRow
            label="Anti-Lag System Arming"
            value={getValue("alsEnabled")}
            onChange={(val) => updateValue("alsEnabled", val)}
            description="Arm the system for activation during overrun conditions"
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Activation Logic */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-8 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-xl relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon-red/5 blur-3xl pointer-events-none" />
                <h3 className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] pl-4 mb-8 border-l-2 border-neon-red/50">
                  Engagement Trigger
                </h3>
                <div className="space-y-4">
                  <PinSelect
                    label="Activation Switch"
                    fieldName="alsSwitchPin"
                    value={getValue("alsSwitchPin")}
                    onChange={(val) => updateValue("alsSwitchPin", val)}
                    description="Only pins not already claimed by another feature can be selected"
                    icon={Target}
                  />
                  <SelectRow
                    label="Switch Polarity"
                    value={getValue("alsSwitchPolarity")}
                    onChange={(val) => updateValue("alsSwitchPolarity", val)}
                    options={getFieldInfo("alsSwitchPolarity")?.meta?.options}
                  />
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <InputField
                      label="Min RPM"
                      value={getValue("alsMinRPM")}
                      onChange={(val) => updateValue("alsMinRPM", val)}
                      units="RPM"
                    />
                    <InputField
                      label="Max TPS"
                      value={getValue("alsMaxTPS")}
                      onChange={(val) => updateValue("alsMaxTPS", val)}
                      units="%"
                    />
                    <InputField
                      label="Min Boost"
                      value={getValue("alsMinBoost")}
                      onChange={(val) => updateValue("alsMinBoost", val)}
                      units="kPa"
                    />
                    <InputField
                      label="Min Speed"
                      value={getValue("alsMinVSS")}
                      onChange={(val) => updateValue("alsMinVSS", val)}
                      units="KM/H"
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-xl">
                <h3 className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] pl-4 mb-8 border-l-2 border-neon-red/50">
                  Correction Matrix
                </h3>
                <div className="space-y-4">
                  <InputField
                    label="Ignition Retard"
                    value={getValue("alsTimingRetard")}
                    onChange={(val) => updateValue("alsTimingRetard", val)}
                    units="DEG"
                    description="Flat retard applied during ALS activation"
                    icon={Zap}
                  />
                  <InputField
                    label="Fuel Enrichment"
                    value={getValue("alsFuelModifier")}
                    onChange={(val) => updateValue("alsFuelModifier", val)}
                    units="%"
                    description="0% = no change; +15% adds fuel. Effective correction is limited to -30% through +50%."
                    icon={Thermometer}
                  />
                </div>
              </div>
            </div>

            {/* Safety & Cut Strategy */}
            <div className="lg:col-span-7 space-y-6">
              <div className="p-8 rounded-[40px] bg-neon-red/5 border border-neon-red/20 backdrop-blur-3xl">
                <h3 className="text-[9px] font-black text-neon-red uppercase tracking-[0.3em] pl-4 mb-8 border-l-2 border-neon-red">
                  Failsafe Thresholds
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField
                    label="Max Duration"
                    value={getValue("alsMaxDuration")}
                    onChange={(val) => updateValue("alsMaxDuration", val)}
                    units="SEC"
                    description="0 disables activation. Maximum 30 seconds; after timeout, activation conditions must clear before rearming."
                    icon={Timer}
                  />
                  <InputField
                    label="Min CLT"
                    value={getValue("alsMinCLT")}
                    onChange={(val) => updateValue("alsMinCLT", val)}
                    units={getFieldInfo("alsMinCLT")?.meta?.units || "C"}
                    description="Engine must be warm"
                  />
                  <InputField
                    label="Max CLT"
                    value={getValue("alsMaxCLT")}
                    onChange={(val) => updateValue("alsMaxCLT", val)}
                    units={getFieldInfo("alsMaxCLT")?.meta?.units || "C"}
                    description="Hard cutout if overheating"
                  />
                </div>
              </div>

              <div className="p-8 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] pl-4 border-l-2 border-neon-red/50">
                    Advanced Cut Geometry
                  </h3>
                  <ToggleRow
                    label="IGN CUT"
                    value={getValue("alsIgnCutEnable")}
                    onChange={(val) => updateValue("alsIgnCutEnable", val)}
                  />
                </div>
                <div className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                      Ignition Cut Pattern (Hex)
                    </span>
                    <InputField
                      label="Pattern Bitmask"
                      value={getValue("alsIgnCutPattern")}
                      onChange={(val) => updateValue("alsIgnCutPattern", val)}
                      units="HEX"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                      Fuel Cut Pattern (Hex)
                    </span>
                    <InputField
                      label="Pattern Bitmask"
                      value={getValue("alsFuelCutPattern")}
                      onChange={(val) => updateValue("alsFuelCutPattern", val)}
                      units="HEX"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
