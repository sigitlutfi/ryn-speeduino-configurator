import React from "react";
import { Snail, ShieldAlert, Zap, Target, Gauge } from "lucide-react";
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

const PIT_LIMITER_FIELDS = [
  "pitLimiterEnabled",
  "pitLimiterPin",
  "pitLimiterPinMode",
  "pitLimiterRPM",
  "pitLimiterSpeed",
  "pitLimiterCutType",
  "pitLimiterSoftWindow",
];

export default function PitLimiter() {
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
  } = useTuningModule(PIT_LIMITER_FIELDS);

  const { realtime } = useStore();
  const isActive = realtime?.performance?.pitLimiterActive;
  const switchState = realtime?.performance?.pitLimiterSwitch;

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const isEnabled = !!getValue("pitLimiterEnabled");
  const activationPin = getValue("pitLimiterPin");
  const rpmLimit = getValue("pitLimiterRPM");
  const speedLimit = getValue("pitLimiterSpeed");
  const cutType = getValue("pitLimiterCutType");
  const softWindow = getValue("pitLimiterSoftWindow");
  const cutTypeLabel =
    getFieldInfo("pitLimiterCutType")?.meta?.options?.[cutType] || "Unknown";

  const validationErrors = [];
  const advisoryWarnings = [];

  if (isEnabled && activationPin === 0) {
    validationErrors.push(
      "Assign an activation pin before enabling the pit limiter.",
    );
  }
  if (isEnabled && rpmLimit <= 0 && speedLimit <= 0) {
    validationErrors.push(
      "Set at least one RPM or speed limit so the limiter has an active threshold.",
    );
  }

  if (speedLimit === 0) {
    advisoryWarnings.push(
      "Speed limit is 0 km/h, so the system currently behaves like an RPM-only limiter.",
    );
  }
  if (rpmLimit === 0) {
    advisoryWarnings.push(
      "RPM limit is 0, so limiter engagement depends only on vehicle speed.",
    );
  }
  if (cutType > 0 && softWindow > 0 && softWindow < 100) {
    advisoryWarnings.push(
      "A very small soft-cut window can make intervention feel abrupt near the limit.",
    );
  }
  if (cutType === 0) {
    advisoryWarnings.push(
      "Hard cut is aggressive but offers the strongest control when load stays high in pit lane.",
    );
  }

  if (!isReady) return null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden  select-none animate-in fade-in duration-700">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neon-red/18 via-neon-red/8 to-transparent" />
      <div className="pointer-events-none absolute -top-16 right-[-8rem] h-64 w-64 rounded-full bg-neon-red/10 blur-[120px]" />
      <div className="pointer-events-none absolute left-[-6rem] top-40 h-56 w-56 rounded-full bg-neon-red/6 blur-[110px]" />
      <div className="pointer-events-none relative z-10 h-2 w-full bg-gradient-to-r from-neon-red/80 via-neon-red to-neon-orange/70" />
      <TuningHeader
        title="Pit Speed Limiter"
        icon={Snail}
        description="Precision speed control for pit lane compliance and staging safety"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="red"
      />

      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="mx-auto max-w-[1460px] space-y-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div
              className={`relative overflow-hidden rounded-3xl border p-4 transition-all duration-500 flex items-center justify-between ${
                isEnabled
                  ? "border-neon-red/45 bg-neon-red/12 shadow-glow-red"
                  : "border-neon-red/15 bg-white/5"
              }`}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-neon-red/80 via-white/30 to-transparent" />
              <div className="flex flex-col">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Logic Status
                </span>
                <span
                  className={`text-xs font-orbitron font-black uppercase ${isEnabled ? "text-neon-red" : "text-white/20"}`}
                >
                  {isEnabled ? "ARMED" : "DISABLED"}
                </span>
              </div>
              <Zap
                size={18}
                className={
                  isEnabled ? "text-neon-red animate-pulse" : "text-white/10"
                }
              />
            </div>

            <div
              className={`relative overflow-hidden rounded-3xl border p-4 transition-all duration-500 flex items-center justify-between ${
                switchState
                  ? "border-neon-orange/35 bg-neon-red/10"
                  : "border-neon-red/15 bg-white/5"
              }`}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-neon-orange/70 via-white/20 to-transparent" />
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Switch Input
                </span>
                <span
                  className={`text-xs font-orbitron font-black uppercase ${switchState ? "text-white" : "text-white/20"}`}
                >
                  {switchState ? "SIGNAL HIGH" : "SIGNAL LOW"}
                </span>
              </div>
              <Target
                size={18}
                className={switchState ? "text-white" : "text-white/10"}
              />
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-neon-red/15 bg-white/5 p-4 flex items-center justify-between">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-neon-red/55 via-white/20 to-transparent" />
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Current Speed
                </span>
                <span className="text-xs font-orbitron font-black text-white uppercase italic">
                  {realtime?.vss ?? 0}{" "}
                  <span className="text-[8px] opacity-40">KM/H</span>
                </span>
              </div>
              <Gauge size={18} className="text-white/20" />
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-neon-red/15 bg-white/5 p-4 flex items-center justify-between">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-neon-red/55 via-white/20 to-transparent" />
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">
                  Cut Strategy
                </span>
                <span
                  className={`text-xs font-orbitron font-black uppercase ${cutType === 0 ? "text-neon-red" : "text-neon-orange"}`}
                >
                  {cutTypeLabel}
                </span>
              </div>
              <ShieldAlert
                size={18}
                className={cutType === 0 ? "text-neon-red" : "text-neon-orange"}
              />
            </div>
          </div>

          <ToggleRow
            label="Pit Limiter Master"
            value={getValue("pitLimiterEnabled")}
            onChange={(val) => updateValue("pitLimiterEnabled", val)}
            description="Enable global pit lane speed and RPM limiting logic"
          />

          {(validationErrors.length > 0 || advisoryWarnings.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {validationErrors.length > 0 && (
                <div className="p-5 rounded-[32px] border border-neon-red/30 bg-neon-red/10">
                  <div className="flex items-center gap-3 mb-3">
                    <ShieldAlert size={18} className="text-neon-red" />
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
                    <Gauge size={18} className="text-neon-yellow" />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neon-yellow">
                      Setup Notes
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Hardware IO */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-[40px] border border-neon-red/12 bg-gradient-to-b from-neon-red/14 via-neon-red/5 to-transparent p-[1px] shadow-[0_18px_70px_rgba(255,95,87,0.08)]">
                <div className="relative overflow-hidden rounded-[38px] bg-bg-deep/90 p-6 backdrop-blur-3xl space-y-4">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-neon-red/90 via-neon-orange/35 to-transparent" />
                  <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 bg-neon-red/8 blur-3xl" />
                  <h3 className="mb-6 border-l-2 border-neon-red/60 pl-4 text-[9px] font-black uppercase tracking-[0.3em] text-white/60">
                    Hardware Interface
                  </h3>
                  <PinSelect
                    label="Activation Pin"
                    fieldName="pitLimiterPin"
                    value={getValue("pitLimiterPin")}
                    onChange={(val) => updateValue("pitLimiterPin", val)}
                    description="Unavailable pins are blocked when another feature already owns them"
                    icon={Zap}
                  />
                  <SelectRow
                    label="Pin Polarity"
                    value={getValue("pitLimiterPinMode")}
                    onChange={(val) => updateValue("pitLimiterPinMode", val)}
                    options={getFieldInfo("pitLimiterPinMode")?.meta?.options}
                  />
                </div>
              </div>

              <InfoCard title="Activation Guide" theme="yellow">
                Limiter engages only when the switch is CLOSED and EITHER RPM or
                Speed thresholds are exceeded.
              </InfoCard>
            </div>

            {/* Setpoints & Cut Strategy */}
            <div className="lg:col-span-7 space-y-4">
              <div className="relative overflow-hidden rounded-[40px] border border-neon-red/14 bg-white/[0.04] p-6 backdrop-blur-xl space-y-4 shadow-[0_20px_80px_rgba(255,95,87,0.06)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-neon-red/90 via-neon-orange/30 to-transparent" />
                <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-28 bg-neon-red/7 blur-3xl" />
                <h3 className="mb-6 border-l-2 border-neon-red/60 pl-4 text-[9px] font-black uppercase tracking-[0.3em] text-white/60">
                  Speed & RPM Limits
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="RPM Limit"
                    value={getValue("pitLimiterRPM")}
                    onChange={(val) => updateValue("pitLimiterRPM", val)}
                    units="RPM"
                  />
                  <InputField
                    label="Speed Limit"
                    value={getValue("pitLimiterSpeed")}
                    onChange={(val) => updateValue("pitLimiterSpeed", val)}
                    units="KM/H"
                  />
                </div>
                <SelectRow
                  label="Cut Strategy"
                  value={getValue("pitLimiterCutType")}
                  onChange={(val) => updateValue("pitLimiterCutType", val)}
                  options={getFieldInfo("pitLimiterCutType")?.meta?.options}
                />
                <div
                  className={`transition-all duration-500 overflow-hidden ${getValue("pitLimiterCutType") > 0 ? "max-h-32 opacity-100 mt-4" : "max-h-0 opacity-0"}`}
                >
                  <InputField
                    label="Soft Cut Window"
                    value={getValue("pitLimiterSoftWindow")}
                    onChange={(val) => updateValue("pitLimiterSoftWindow", val)}
                    units="RPM"
                    description="RPM range below limit where timing retard begins"
                  />
                </div>
              </div>

              <InfoCard title="Safety Note" icon={ShieldAlert} theme="red">
                Hard cut strategy is recommended for high-load applications to
                prevent exhaust manifold melting.
              </InfoCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
