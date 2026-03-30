import React, { useEffect, useState } from "react";
import {
  Zap,
  Flame,
  Settings,
  Info,
  Activity,
  TrendingUp,
  Thermometer,
  RotateCw,
  Droplets,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { useStore } from "../../core/store";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const CRANKING_FIELDS = [
  "aseTaperTime",
  "aeColdPct",
  "aeColdTaperMin",
  "aeColdTaperMax",
  "crankingPct",
  "fpPrime",
  "primingDelay",
  "crankRPM",
  "tpsflood",
  "crkngAddCLTAdv",
];

export default function CrankingSettings() {
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
    getFieldInfo,
  } = useTuningModule(CRANKING_FIELDS);

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin" />
          <RotateCw
            className="absolute inset-0 m-auto text-neon-cyan animate-spin duration-3000"
            size={20}
          />
        </div>
        <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] animate-pulse">
          Syncing Cold Start Parameters...
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
      .filter((opt) => opt.label && opt.label.toUpperCase() !== "INVALID");
  };

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, value) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(value, info?.meta));
  };

  const GroupHeader = ({ title, icon: Icon, colorClass = "bg-neon-cyan" }) => (
    <div className="flex items-center gap-3 mb-6">
      <div
        className={`${colorClass} p-2 rounded-xl shadow-lg shadow-black/20 text-black`}
      >
        <Icon size={16} />
      </div>
      <h3 className="text-xs font-black text-white uppercase tracking-widest">
        {title}
      </h3>
    </div>
  );

  const InputField = ({ name, label, unit, icon: Icon }) => {
    const [draft, setDraft] = useState(String(getValue(name) ?? 0));
    const [isFocused, setIsFocused] = useState(false);
    const value = getValue(name);

    useEffect(() => {
      if (!isFocused) {
        setDraft(String(value ?? 0));
      }
    }, [value, isFocused]);

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-1">
          {Icon && <Icon size={12} className="text-white/40" />}
          <label className="text-[10px] font-black text-white/50 uppercase tracking-wider">
            {label}
          </label>
        </div>
        <div className="relative group/input">
          <input
            type="number"
            step="0.1"
            value={draft}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              const nextDraft = e.target.value;
              setDraft(nextDraft);
              updateValue(name, nextDraft === "" ? 0 : parseFloat(nextDraft));
            }}
            onBlur={() => setIsFocused(false)}
            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs font-black text-white outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-all group-hover/input:border-white/20"
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

  const SelectRow = ({ name, label, description, icon: Icon }) => {
    const options = getCleanOptions(name);
    const value = getFieldValue(name);

    return (
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
        <div className="flex items-start gap-4 flex-1">
          <div className="mt-1 p-2 rounded-lg bg-black/40 text-white/40">
            {Icon && <Icon size={16} />}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-black text-white uppercase tracking-wider">
              {label}
            </span>
            <span className="text-[10px] text-white/40 font-medium leading-relaxed max-w-sm">
              {description}
            </span>
          </div>
        </div>
        <div className="min-w-[140px]">
          <select
            value={getValue(name) ?? 0}
            onChange={(e) => updateValue(name, parseInt(e.target.value, 10))}
            className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black text-neon-cyan outline-none focus:border-neon-cyan/50 transition-all appearance-none cursor-pointer text-center"
          >
            {options.map((opt) => (
              <option key={opt.index} value={opt.index}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8  mx-auto w-full animate-in fade-in duration-700">
      <TuningHeader
        title="Startup & Cranking"
        subtitle="Global injection multipliers and algorithmic compensation"
        icon={RotateCw}
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        onSave={() => handleSave()}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        isConnected={isConnected}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 p-6">
        {/* Cranking Fundamentals */}
        <div className="flex flex-col gap-8">
          <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-[60px] rounded-full" />
            <GroupHeader title="Cranking Logic" icon={Activity} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <InputField
                name="crankRPM"
                label="Cranking RPM"
                unit="RPM"
                icon={RotateCw}
              />
              <InputField
                name="tpsflood"
                label="Flood Clear TPS"
                unit="%"
                icon={TrendingUp}
              />
              <InputField
                name="crankingPct"
                label="Base Cranking Pulse"
                unit="%"
                icon={Flame}
              />
              <InputField
                name="fpPrime"
                label="Fuel Prime Duration"
                unit="S"
                icon={Droplets}
              />
            </div>

            <SelectRow
              name="crkngAddCLTAdv"
              label="Cranking CLT Advance"
              description="Apply additional ignition advance compensation based on coolant temperature during cranking."
              icon={Zap}
            />
          </div>

          <div className="p-8 rounded-[40px] glass-card border border-white/10">
            <GroupHeader title="Priming Control" icon={Droplets} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <InputField
                name="primingDelay"
                label="Priming Delay"
                unit="S"
                icon={TrendingUp}
              />
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col justify-center">
                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">
                  Status
                </span>
                <span className="text-[10px] text-neon-cyan font-bold">
                  Delay before priming pulse starts after ignition on.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cold Start Taper */}
        <div className="flex flex-col gap-8">
          <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/5 blur-[60px] rounded-full" />
            <GroupHeader
              title="Cold Start Taper"
              icon={Thermometer}
              colorClass="bg-neon-purple shadow-glow-purple text-black"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <InputField
                name="aeColdPct"
                label="Cold AE Multiplier"
                unit="%"
                icon={TrendingUp}
              />
              <InputField
                name="aseTaperTime"
                label="ASE Taper"
                unit="S"
                icon={TrendingUp}
              />
            </div>

            <div className="flex flex-col gap-4">
              <div className="p-4 bg-white/5 border border-white/5 rounded-3xl mt-2">
                <div className="flex items-center gap-2 mb-4 px-2">
                  <TrendingUp size={12} className="text-neon-purple" />
                  <span className="text-[10px] font-black text-white/70 uppercase">
                    Temperature Taper Range
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <InputField
                    name="aeColdTaperMin"
                    label="Min Temp (Full AE)"
                    unit="°"
                  />
                  <InputField
                    name="aeColdTaperMax"
                    label="Max Temp (Zero AE)"
                    unit="°"
                  />
                </div>
                <div className="mt-6 p-4 bg-neon-purple/5 border border-neon-purple/10 rounded-2xl">
                  <p className="text-[10px] text-white/40 leading-relaxed font-medium italic">
                    Acceleration enrichment (AE) is gradually reduced from "Min
                    Temp" to "Max Temp". Below Min, full multiplier is applied.
                    Above Max, AE is normalized.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
