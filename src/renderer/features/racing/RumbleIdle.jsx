import React from "react";
import { Activity, Zap, Music, Settings, Gauge } from "lucide-react";
import { useStore } from "../../core/store.js";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import PinSelect from "../shared/components/PinSelect";
import { toDisplay, toRaw } from "../shared/utils/normalization";
import {
  SelectRow,
  InputField,
  ToggleRow,
  InfoCard,
} from "../shared/components/TuningComponents";

const RUMBLE_IDLE_FIELDS = [
  "rumbleIdleEnabled",
  "rumbleIdlePin",
  "rumbleIdlePinMode",
  "rumbleIdleCutType",
  "rumbleIdleMinRPM",
  "rumbleIdleMaxRPM",
  "rumbleIdleMaxTPS",
  "rumbleIdleFrequency",
  "rumbleIdleMinCLT",
  "rumbleIdlePatternBits",
  "rumbleIdlePatternLength",
  "rumbleIdleMinVSS",
];

export default function RumbleIdle() {
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
  } = useTuningModule(RUMBLE_IDLE_FIELDS);

  const { realtime } = useStore();
  const isActive = realtime?.performance?.rumbleIdleActive;
  const beatState = realtime?.performance?.rumbleIdleBeat;

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const patternBits = getValue("rumbleIdlePatternBits") || 0;
  const patternLength = getValue("rumbleIdlePatternLength") || 8;

  const toggleBit = (bitIndex) => {
    const newBits = patternBits ^ (1 << bitIndex);
    updateValue("rumbleIdlePatternBits", newBits);
  };

  if (!isReady) return null;

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden animate-in fade-in duration-700">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neon-red/18 via-neon-red/8 to-transparent" />
      <div className="pointer-events-none absolute -top-16 right-[-8rem] h-64 w-64 rounded-full bg-neon-red/10 blur-[120px]" />
      <div className="pointer-events-none absolute left-[-6rem] top-40 h-56 w-56 rounded-full bg-neon-red/6 blur-[110px]" />
      <div className="pointer-events-none relative z-10 h-2 w-full bg-gradient-to-r from-neon-red/80 via-neon-red to-neon-orange/70" />
      <TuningHeader
        title="Rumble Idle"
        icon={Music}
        description="aggressive ignition/fuel cut patterns for a distinctive cam-style engine signature"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="orange"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
          {/* Header Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className={`p-6 rounded-[32px] border transition-all duration-700 flex items-center justify-between ${isActive ? "bg-neon-orange/10 border-neon-orange/40 shadow-glow-orange" : "bg-white/5 border-white/10"}`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">
                  Rumble State
                </span>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${isActive ? "bg-neon-orange shadow-glow-orange animate-pulse" : "bg-white/10"}`}
                  />
                  <span
                    className={`text-sm font-orbitron font-black uppercase tracking-widest ${isActive ? "text-white" : "text-white/20"}`}
                  >
                    {isActive ? "PATTERN ACTIVE" : "SYSTEM STANDBY"}
                  </span>
                </div>
              </div>
              <Activity
                size={24}
                className={isActive ? "text-neon-orange" : "text-white/5"}
              />
            </div>

            <div
              className={`p-6 rounded-[32px] border transition-all duration-300 flex items-center justify-between ${isActive && !beatState ? "bg-neon-red/10 border-neon-red/40 shadow-glow-red" : "bg-white/5 border-white/10"}`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">
                  Real-time Beat
                </span>
                <span
                  className={`text-sm font-orbitron font-black uppercase tracking-widest ${isActive ? (beatState ? "text-neon-cyan" : "text-neon-red") : "text-white/20"}`}
                >
                  {isActive
                    ? beatState
                      ? "COMBUSTION"
                      : "CUT ACTIVE"
                    : "IDLE"}
                </span>
              </div>
              <Zap
                size={24}
                className={
                  isActive
                    ? beatState
                      ? "text-neon-cyan"
                      : "text-neon-red scale-110 shadow-glow-red transition-all"
                    : "text-white/5"
                }
              />
            </div>
          </div>

          {/* Master Enable */}
          <ToggleRow
            label="Rumble Idle Activation"
            value={getValue("rumbleIdleEnabled")}
            onChange={(val) => updateValue("rumbleIdleEnabled", val)}
            description="Enable patterned cuts during idle/deceleration conditions"
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Visual Pattern Sequencer */}
            <div className="lg:col-span-12 p-8 rounded-[40px] bg-white/[0.02] border border-white/5 backdrop-blur-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-neon-orange/5 blur-[100px] pointer-events-none group-hover:bg-neon-orange/10 transition-all" />
              <div className="flex flex-col gap-8 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-[10px] font-black text-neon-orange uppercase tracking-[0.3em]">
                      Beat Sequencer
                    </h3>
                    <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-loose max-w-md mt-1">
                      Configure the 8-bit pattern that determines the
                      ignition/fuel cut signature. 1 = Fire, 0 = Cut.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 bg-black/40 p-2 rounded-2xl border border-white/5">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-widest pl-2">
                      Pattern Len
                    </span>
                    {[1, 2, 4, 8].map((len) => (
                      <button
                        key={len}
                        onClick={() =>
                          updateValue("rumbleIdlePatternLength", len)
                        }
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black transition-all ${patternLength === len ? "bg-neon-orange text-black shadow-glow-orange" : "text-white/40 hover:text-white"}`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between gap-4 max-w-4xl mx-auto w-full p-4 bg-black/40 rounded-3xl border border-white/5 shadow-inner">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const bit = (patternBits >> i) & 1;
                    const isOOB = i >= patternLength;
                    return (
                      <div
                        key={i}
                        className="flex flex-col items-center gap-4 flex-1"
                      >
                        <span
                          className={`text-[8px] font-black uppercase tracking-widest ${isOOB ? "text-white/5" : "text-white/40"}`}
                        >
                          {i + 1}
                        </span>
                        <button
                          disabled={isOOB}
                          onClick={() => toggleBit(i)}
                          className={`w-full aspect-square rounded-2xl border transition-all duration-500 transform ${
                            isOOB
                              ? "bg-transparent border-white/[0.02] scale-75"
                              : bit
                                ? "bg-neon-orange/20 border-neon-orange/50 shadow-glow-orange"
                                : "bg-black/80 border-white/10 hover:border-white/30 hover:scale-105 active:scale-95"
                          }`}
                        >
                          {!isOOB && (
                            <div
                              className={`w-4 h-4 rounded-full mx-auto transition-all ${bit ? "bg-neon-orange shadow-glow-orange" : "bg-white/5"}`}
                            />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Triggers & Safety */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-8 rounded-[40px] bg-white/5 border border-white/5 space-y-4 backdrop-blur-xl">
                <h3 className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] pl-4 mb-6 border-l-2 border-neon-orange/50">
                  Triggers & IO
                </h3>
                <PinSelect
                  label="Control Input"
                  fieldName="rumbleIdlePin"
                  value={getValue("rumbleIdlePin")}
                  onChange={(val) => updateValue("rumbleIdlePin", val)}
                  description="Choose a free input pin or leave the field on board-driven activation"
                  icon={Gauge}
                />
                <SelectRow
                  label="Cut Mode"
                  value={getValue("rumbleIdleCutType")}
                  onChange={(val) => updateValue("rumbleIdleCutType", val)}
                  options={getFieldInfo("rumbleIdleCutType")?.meta?.options}
                />
              </div>

              <InfoCard title="Engine Signature" theme="orange">
                Lower frequencies (4-8Hz) create a heavy "cammed" lope, while
                high frequencies (15-20Hz) create a faster "burble" effect.
              </InfoCard>
            </div>

            {/* Ranges */}
            <div className="lg:col-span-7 p-8 rounded-[40px] bg-white/5 border border-white/5 space-y-4 backdrop-blur-xl">
              <h3 className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] pl-4 mb-6 border-l-2 border-neon-orange/50">
                Operational Envelopes
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Min RPM"
                  value={getValue("rumbleIdleMinRPM")}
                  onChange={(val) => updateValue("rumbleIdleMinRPM", val)}
                  units="RPM"
                />
                <InputField
                  label="Max RPM"
                  value={getValue("rumbleIdleMaxRPM")}
                  onChange={(val) => updateValue("rumbleIdleMaxRPM", val)}
                  units="RPM"
                />
                <InputField
                  label="Max TPS"
                  value={getValue("rumbleIdleMaxTPS")}
                  onChange={(val) => updateValue("rumbleIdleMaxTPS", val)}
                  units="%"
                  step={0.5}
                />
                <InputField
                  label="Beat Freq"
                  value={getValue("rumbleIdleFrequency")}
                  onChange={(val) => updateValue("rumbleIdleFrequency", val)}
                  units="HZ"
                />
                <InputField
                  label="Min CLT"
                  value={getValue("rumbleIdleMinCLT")}
                  onChange={(val) => updateValue("rumbleIdleMinCLT", val)}
                  units="°C"
                />
                <SelectRow
                  label="Min Speed (km/h, 16-step)"
                  value={getValue("rumbleIdleMinVSS")}
                  onChange={(val) => updateValue("rumbleIdleMinVSS", val)}
                  options={getFieldInfo("rumbleIdleMinVSS")?.meta?.options}
                  description="Stored in 16 km/h steps to match current firmware behavior"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
