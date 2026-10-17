import React from "react";
import { Timer, Zap, Settings, ShieldCheck, Flag } from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import PinSelect from "../shared/components/PinSelect";
import {
  GroupHeader,
  SelectRow,
  InputField,
  InfoCard,
} from "../shared/components/TuningComponents";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const FLATSHIFT_FIELDS = [
  "flatSEnable",
  "flatSSoftWin",
  "flatSRetard",
  "flatSArm",
  "launchPin",
  "launchHiLo",
  "lnchPullRes",
];

const FlatShift = () => {
  const {
    pinPages,
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
  } = useTuningModule(FLATSHIFT_FIELDS, {});

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const flatSEnable = getValue("flatSEnable");

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden h-screen animate-in fade-in duration-700">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neon-red/18 via-neon-red/8 to-transparent" />
      <div className="pointer-events-none absolute -top-16 right-[-8rem] h-64 w-64 rounded-full bg-neon-red/10 blur-[120px]" />
      <div className="pointer-events-none absolute left-[-6rem] top-40 h-56 w-56 rounded-full bg-neon-red/6 blur-[110px]" />
      <div className="pointer-events-none relative z-10 h-2 w-full bg-gradient-to-r from-neon-red/80 via-neon-red to-neon-orange/70" />
      <TuningHeader
        title="Flat Shift"
        icon={Timer}
        description="Full Throttle Shifting: Maintain boost and RPM during gear changes"
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12 p-5 rounded-3xl glass-card border border-white/5 bg-gradient-to-r from-neon-orange/[0.02] to-transparent">
              <GroupHeader
                title="Global Hardware"
                icon={Settings}
                theme="orange"
              />
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <PinSelect decodedPages={pinPages}
                  label="Input Pin"
                  fieldName="launchPin"
                  value={getValue("launchPin")}
                  onChange={(val) => updateValue("launchPin", val)}
                  description="Only unclaimed launch input pins can be selected here"
                  icon={Flag}
                />
                <SelectRow
                  label="Signal Type"
                  value={getValue("launchHiLo")}
                  onChange={(val) => updateValue("launchHiLo", val)}
                  options={getFieldInfo("launchHiLo")?.meta?.options}
                />
                <SelectRow
                  label="Pullup"
                  value={getValue("lnchPullRes")}
                  onChange={(val) => updateValue("lnchPullRes", val)}
                  options={getFieldInfo("lnchPullRes")?.meta?.options}
                />
                <div className="col-span-1 md:col-span-3 flex items-center gap-6 px-6 border-l border-white/5 ml-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[7px] font-bold text-white/30 uppercase tracking-[0.2em]">
                      Flat Shift Status
                    </span>
                    <div
                      className={`px-4 py-1 rounded-full text-[9px] font-black tracking-widest flex items-center gap-2 ${flatSEnable > 0 ? "bg-neon-orange/20 text-neon-orange shadow-glow-orange/20" : "bg-white/5 text-white/20"}`}
                    >
                      <Zap
                        size={10}
                        className={flatSEnable > 0 ? "animate-pulse" : ""}
                      />
                      {flatSEnable > 0 ? "ARMED & ACTIVE" : "INACTIVE"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`p-6 rounded-[32px] glass-card border transition-all ${flatSEnable > 0 ? "border-neon-orange/30 bg-neon-orange/[0.01]" : "border-white/5 opacity-40 grayscale"}`}
          >
            <GroupHeader title="Shift Strategy" icon={Zap} theme="orange" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <SelectRow
                    label="System Mode"
                    value={getValue("flatSEnable")}
                    onChange={(val) => updateValue("flatSEnable", val)}
                    options={getFieldInfo("flatSEnable")?.meta?.options}
                  />
                  <InputField
                    label="Arming RPM"
                    value={getValue("flatSArm")}
                    onChange={(val) => updateValue("flatSArm", val)}
                    units="RPM"
                    disabled={flatSEnable === 0}
                  />
                </div>
                <InfoCard title="Setup Guide" theme="orange">
                  Flat Shift targets are typically set slightly above your
                  arming RPM. Ensure your clutch switch is adjusted for instant
                  engagement.
                </InfoCard>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-black/40 border border-white/5 h-fit">
                <div className="space-y-4">
                  <h4 className="text-[8px] font-black text-neon-orange/50 uppercase tracking-widest border-l-2 border-neon-orange pl-3">
                    Windows
                  </h4>
                  <InputField
                    label="Soft Window"
                    value={getValue("flatSSoftWin")}
                    onChange={(val) => updateValue("flatSSoftWin", val)}
                    units="RPM"
                    disabled={flatSEnable === 0}
                  />
                </div>
                <div className="space-y-4">
                  <h4 className="text-[8px] font-black text-neon-orange/50 uppercase tracking-widest border-l-2 border-neon-orange pl-3">
                    Corrections
                  </h4>
                  <InputField
                    label="Timing Retard"
                    value={getValue("flatSRetard")}
                    onChange={(val) => updateValue("flatSRetard", val)}
                    units="°"
                    disabled={flatSEnable === 0}
                  />
                  <InfoCard title="Shift Cut" icon={ShieldCheck} theme="orange">
                    Shift-cut logic active.
                  </InfoCard>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-dashed border-white/5 flex items-center justify-center">
            <div className="text-[8px] font-black text-white/10 uppercase tracking-[0.4em]">
              No-Lift Shift Module
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlatShift;
