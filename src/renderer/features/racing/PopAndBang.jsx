import React from "react";
import {
  Flame,
  ShieldAlert,
  Target,
  Gauge,
  Thermometer,
  Timer,
  Zap,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import { useStore } from "../../core/store.js";
import TuningHeader from "../shared/components/TuningHeader";
import { toDisplay, toRaw } from "../shared/utils/normalization";
import {
  SelectRow,
  InputField,
  ToggleRow,
  InfoCard,
} from "../shared/components/TuningComponents";
import PinSelect from "../shared/components/PinSelect";

const POP_AND_BANG_FIELDS = [
  "rollingPopBangEnabled",
  "rollingPopBangPin",
  "rollingPopBangPinMode",
  "rollingPopBangMinRPM",
  "rollingPopBangMaxRPM",
  "rollingPopBangMaxTPS",
  "rollingPopBangMinVSS",
  "rollingPopBangMinCLT",
  "rollingPopBangTimingRetard",
  "rollingPopBangFuelModifier",
  "rollingPopBangMaxDuration",
  "rollingPopBangCutType",
  "rollingPopBangCutPattern",
];

const PATTERN_PRESETS = [
  {
    label: "Single Hit",
    value: 1,
    hint: "0x01 one cut step, then seven clear",
  },
  { label: "Alt A", value: 85, hint: "0x55 alternating cut / clear" },
  { label: "Alt B", value: 170, hint: "0xAA alternating with opposite phase" },
  { label: "Burst 4", value: 240, hint: "0xF0 four clear, then four cut" },
];

const PATTERN_STEPS = Array.from({ length: 8 }, (_, i) => i);

export default function PopAndBang() {
  const notify = useStore((s) => s.notify);
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
  } = useTuningModule(POP_AND_BANG_FIELDS);

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const isEnabled = !!getValue("rollingPopBangEnabled");
  const cutType = getValue("rollingPopBangCutType");
  const cutPattern = Math.round(getValue("rollingPopBangCutPattern") || 0);
  const minRpm = getValue("rollingPopBangMinRPM");
  const maxRpm = getValue("rollingPopBangMaxRPM");
  const maxTps = getValue("rollingPopBangMaxTPS");
  const minVss = getValue("rollingPopBangMinVSS");
  const minClt = getValue("rollingPopBangMinCLT");
  const timingRetard = getValue("rollingPopBangTimingRetard");
  const fuelModifier = getValue("rollingPopBangFuelModifier");
  const maxDuration = getValue("rollingPopBangMaxDuration");
  const switchPin = getValue("rollingPopBangPin");
  const patternBinary = cutPattern.toString(2).padStart(8, "0");

  const validationErrors = [];
  const advisoryWarnings = [];

  if (isEnabled && switchPin === 0) {
    validationErrors.push(
      "Assign a valid switch pin before enabling the feature.",
    );
  }
  if (minRpm >= maxRpm) {
    validationErrors.push("Min RPM must be lower than Max RPM.");
  }
  if (maxTps <= 0) {
    validationErrors.push(
      "Max TPS must be greater than 0% or the mode can never arm.",
    );
  }
  if (cutType > 0 && cutPattern === 0) {
    validationErrors.push(
      "Cut Pattern must be above 0 when a cut type is enabled.",
    );
  }

  if (timingRetard >= 20) {
    advisoryWarnings.push(
      "Timing retard is very aggressive and will raise exhaust temperature quickly.",
    );
  }
  if (Math.abs(fuelModifier) >= 25) {
    advisoryWarnings.push(
      "Large fuel modifier values can swing lambda hard during overrun.",
    );
  }
  if (maxDuration >= 10) {
    advisoryWarnings.push(
      "Long max duration values can keep the effect active long enough to overheat hardware.",
    );
  }
  if (minVss === 0) {
    advisoryWarnings.push(
      "Min VSS is 0 km/h, so this may trigger outside true rolling conditions.",
    );
  }
  if (minClt < 60) {
    advisoryWarnings.push(
      "Low CLT threshold may allow activation before the engine is fully warm.",
    );
  }
  if (cutType === 3 && [170, 240].includes(cutPattern)) {
    advisoryWarnings.push(
      "Combined fuel and ignition cut with a dense pattern is a very harsh setup.",
    );
  }

  const handleValidatedSave = async (isBurn = false) => {
    if (validationErrors.length > 0) {
      notify(validationErrors[0], "error");
      return;
    }

    return handleSave(isBurn);
  };

  if (!isReady) return null;

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden animate-in fade-in duration-700">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neon-red/18 via-neon-red/8 to-transparent" />
      <div className="pointer-events-none absolute -top-16 right-[-8rem] h-64 w-64 rounded-full bg-neon-red/10 blur-[120px]" />
      <div className="pointer-events-none absolute left-[-6rem] top-40 h-56 w-56 rounded-full bg-neon-red/6 blur-[110px]" />
      <div className="pointer-events-none relative z-10 h-2 w-full bg-gradient-to-r from-neon-red/80 via-neon-red to-neon-orange/70" />
      <TuningHeader
        title="Rolling Pop & Bang"
        icon={Sparkles}
        description="Manual overrun theatrics using timing retard, fuel adjustment, and optional patterned cut"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleValidatedSave(false)}
        onBurn={() => handleValidatedSave(true)}
        onDiscard={discardChanges}
        themeColor="orange"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
          <div className="p-8 rounded-[40px] border border-neon-orange/30 bg-gradient-to-r from-neon-orange/10 to-neon-red/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,107,53,0.15),transparent_40%)] pointer-events-none" />
            <div className="relative z-10 flex items-start gap-6">
              <div className="p-4 rounded-3xl bg-neon-orange/15 border border-neon-orange/30 shadow-glow-orange">
                <ShieldAlert size={28} className="text-neon-orange" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-orbitron font-black text-white uppercase tracking-widest">
                  Driver-Controlled Overrun Effect
                </h2>
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider leading-relaxed max-w-4xl">
                  Use with care. Aggressive timing retard and cut patterns can
                  increase exhaust temperature and stress turbo, manifold, and
                  exhaust hardware. Keep the activation window tight and
                  duration short.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div
              className={`p-4 rounded-3xl border transition-all duration-500 ${isEnabled ? "bg-neon-orange/10 border-neon-orange/40 shadow-glow-orange" : "bg-white/5 border-white/10"}`}
            >
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Mode
                </span>
                <span
                  className={`text-xs font-orbitron font-black uppercase ${isEnabled ? "text-neon-orange" : "text-white/20"}`}
                >
                  {isEnabled ? "ARMED" : "DISABLED"}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-3xl bg-white/5 border border-white/10">
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  RPM Window
                </span>
                <span className="text-xs font-orbitron font-black uppercase text-white">
                  {minRpm} - {maxRpm}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-3xl bg-white/5 border border-white/10">
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Cut Type
                </span>
                <span
                  className={`text-xs font-orbitron font-black uppercase ${cutType > 0 ? "text-neon-red" : "text-white/20"}`}
                >
                  {getFieldInfo("rollingPopBangCutType")?.meta?.options?.[
                    cutType
                  ] || "Disabled"}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-3xl bg-white/5 border border-white/10">
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Pattern Mask
                </span>
                <span
                  className={`text-xs font-orbitron font-black uppercase ${cutType > 0 ? "text-neon-cyan" : "text-white/20"}`}
                >
                  {cutPattern}{" "}
                  <span className="text-[8px] opacity-50">
                    0x{cutPattern.toString(16).toUpperCase().padStart(2, "0")}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <ToggleRow
            label="Rolling Pop & Bang Master"
            value={getValue("rollingPopBangEnabled")}
            onChange={(val) => updateValue("rollingPopBangEnabled", val)}
            description="Enable the manual rolling overrun mode and allow the configured trigger to arm it"
          />

          {(validationErrors.length > 0 || advisoryWarnings.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {validationErrors.length > 0 && (
                <div className="p-5 rounded-[32px] border border-neon-red/30 bg-neon-red/10">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle size={18} className="text-neon-red" />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neon-red">
                      Fix Before Save
                    </span>
                  </div>
                  <div className="space-y-2">
                    {validationErrors.map((warning) => (
                      <p
                        key={warning}
                        className="text-[9px] font-bold text-white/80 uppercase tracking-wider leading-relaxed"
                      >
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {advisoryWarnings.length > 0 && (
                <div className="p-5 rounded-[32px] border border-neon-yellow/30 bg-neon-yellow/10">
                  <div className="flex items-center gap-3 mb-3">
                    <ShieldAlert size={18} className="text-neon-yellow" />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neon-yellow">
                      Setup Warnings
                    </span>
                  </div>
                  <div className="space-y-2">
                    {advisoryWarnings.map((warning) => (
                      <p
                        key={warning}
                        className="text-[9px] font-bold text-white/80 uppercase tracking-wider leading-relaxed"
                      >
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div
            className={`grid grid-cols-1 lg:grid-cols-12 gap-6 transition-all duration-500 ${isEnabled ? "opacity-100" : "opacity-40 grayscale pointer-events-none"}`}
          >
            <div className="lg:col-span-5 space-y-6">
              <div className="p-8 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-xl">
                <h3 className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] pl-4 mb-8 border-l-2 border-neon-orange/50">
                  Activation Window
                </h3>
                <div className="space-y-4">
                  <PinSelect
                    label="Switch Pin"
                    fieldName="rollingPopBangPin"
                    value={getValue("rollingPopBangPin")}
                    onChange={(val) => updateValue("rollingPopBangPin", val)}
                    description="Only unclaimed input-capable pin assignments can be selected here"
                    icon={Target}
                  />
                  <SelectRow
                    label="Pin Mode"
                    value={getValue("rollingPopBangPinMode")}
                    onChange={(val) =>
                      updateValue("rollingPopBangPinMode", val)
                    }
                    options={
                      getFieldInfo("rollingPopBangPinMode")?.meta?.options
                    }
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Min RPM"
                      value={getValue("rollingPopBangMinRPM")}
                      onChange={(val) =>
                        updateValue("rollingPopBangMinRPM", val)
                      }
                      units="RPM"
                      icon={Gauge}
                    />
                    <InputField
                      label="Max RPM"
                      value={getValue("rollingPopBangMaxRPM")}
                      onChange={(val) =>
                        updateValue("rollingPopBangMaxRPM", val)
                      }
                      units="RPM"
                    />
                    <InputField
                      label="Max TPS"
                      value={getValue("rollingPopBangMaxTPS")}
                      onChange={(val) =>
                        updateValue("rollingPopBangMaxTPS", val)
                      }
                      units="%"
                      step={0.5}
                    />
                    <InputField
                      label="Min VSS"
                      value={getValue("rollingPopBangMinVSS")}
                      onChange={(val) =>
                        updateValue("rollingPopBangMinVSS", val)
                      }
                      units="KM/H"
                    />
                    <div className="col-span-2">
                      <InputField
                        label="Min CLT"
                        value={getValue("rollingPopBangMinCLT")}
                        onChange={(val) =>
                          updateValue("rollingPopBangMinCLT", val)
                        }
                        units={
                          getFieldInfo("rollingPopBangMinCLT")?.meta?.units ||
                          "°"
                        }
                        icon={Thermometer}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <InfoCard title="How It Arms" icon={Flame} theme="yellow">
                Active only when the switch is on, TPS stays under the
                threshold, RPM stays inside the window, vehicle speed is high
                enough, coolant is warm enough, and max duration has not been
                exceeded.
              </InfoCard>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div className="p-8 rounded-[40px] bg-neon-orange/5 border border-neon-orange/20 backdrop-blur-3xl">
                <h3 className="text-[9px] font-black text-neon-orange uppercase tracking-[0.3em] pl-4 mb-8 border-l-2 border-neon-orange">
                  Effect Calibration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField
                    label="Timing Retard"
                    value={getValue("rollingPopBangTimingRetard")}
                    onChange={(val) =>
                      updateValue("rollingPopBangTimingRetard", val)
                    }
                    units="DEG"
                    description="Ignition retard applied while the mode is active"
                    icon={Zap}
                  />
                  <InputField
                    label="Fuel Modifier"
                    value={getValue("rollingPopBangFuelModifier")}
                    onChange={(val) =>
                      updateValue("rollingPopBangFuelModifier", val)
                    }
                    units="%"
                    description="Fuel correction added on top of the base 100% value"
                    icon={Flame}
                  />
                  <div className="md:col-span-2">
                    <InputField
                      label="Max Duration"
                      value={getValue("rollingPopBangMaxDuration")}
                      onChange={(val) =>
                        updateValue("rollingPopBangMaxDuration", val)
                      }
                      units="SEC"
                      description="Automatic timeout to stop long exhaust heat cycles"
                      icon={Timer}
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-xl">
                <h3 className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] pl-4 mb-8 border-l-2 border-neon-red/50">
                  Cut Strategy
                </h3>
                <div className="space-y-4">
                  <SelectRow
                    label="Cut Type"
                    value={cutType}
                    onChange={(val) =>
                      updateValue("rollingPopBangCutType", val)
                    }
                    options={
                      getFieldInfo("rollingPopBangCutType")?.meta?.options
                    }
                    description="Disabled, ignition cut, fuel cut, or both"
                    icon={ShieldAlert}
                  />

                  <div
                    className={`space-y-4 transition-all duration-500 ${cutType > 0 ? "opacity-100" : "opacity-40 pointer-events-none"}`}
                  >
                    <InputField
                      label="Pattern Bitmask"
                      value={cutPattern}
                      onChange={(val) =>
                        updateValue("rollingPopBangCutPattern", val)
                      }
                      units="0-255"
                      description="8-bit repeating mask. Set bit = cut step, clear bit = normal step"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {PATTERN_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() =>
                            updateValue(
                              "rollingPopBangCutPattern",
                              preset.value,
                            )
                          }
                          className={`text-left p-4 rounded-3xl border transition-all duration-300 ${
                            cutPattern === preset.value
                              ? "bg-neon-red/10 border-neon-red/40 shadow-glow-red"
                              : "bg-black/20 border-white/5 hover:border-white/15"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                              {preset.label}
                            </span>
                            <span className="text-[9px] font-orbitron font-black uppercase text-neon-red">
                              {preset.value}
                            </span>
                          </div>
                          <p className="mt-2 text-[8px] font-bold text-gray-500 uppercase tracking-wider leading-relaxed">
                            {preset.hint}
                          </p>
                        </button>
                      ))}
                    </div>

                    <div className="p-5 rounded-3xl bg-black/30 border border-white/5 space-y-4">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em] leading-loose">
                        Current pattern:{" "}
                        <span className="text-neon-cyan">{patternBinary}</span>{" "}
                        <span className="text-white/15">
                          / 0x
                          {cutPattern
                            .toString(16)
                            .toUpperCase()
                            .padStart(2, "0")}
                        </span>
                      </p>

                      <div className="grid grid-cols-8 gap-2">
                        {PATTERN_STEPS.map((step) => {
                          const isCutStep = ((cutPattern >> step) & 1) === 1;

                          return (
                            <div
                              key={step}
                              className="flex flex-col items-center gap-2"
                            >
                              <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">
                                {step + 1}
                              </span>
                              <div
                                className={`w-full aspect-square rounded-2xl border transition-all duration-300 flex items-center justify-center ${
                                  isCutStep
                                    ? "bg-neon-red/15 border-neon-red/40 shadow-glow-red"
                                    : "bg-white/[0.03] border-white/10"
                                }`}
                              >
                                <span
                                  className={`text-[8px] font-orbitron font-black uppercase ${isCutStep ? "text-neon-red" : "text-white/30"}`}
                                >
                                  {isCutStep ? "CUT" : "RUN"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <InfoCard title="Recommended Setup" icon={Sparkles} theme="gray">
                Start mild: 8 to 12 degrees retard, small positive fuel
                modifier, short duration, and either disabled cut or an
                alternating 0x55 pattern before trying harsher burst masks.
              </InfoCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
