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
import {
  GroupHeader,
  InputField,
  SelectRow,
} from "../shared/components/TuningComponents";
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

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, value) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(value, info?.meta));
  };

  const fieldProps = { getValue, updateValue, getFieldInfo };

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
                {...fieldProps}
                name="crankRPM"
                label="Cranking RPM"
                unit="RPM"
                icon={RotateCw}
              />
              <InputField
                {...fieldProps}
                name="tpsflood"
                label="Flood Clear TPS"
                unit="%"
                icon={TrendingUp}
              />
              <InputField
                {...fieldProps}
                name="crankingPct"
                label="Base Cranking Pulse"
                unit="%"
                icon={Flame}
              />
              <InputField
                {...fieldProps}
                name="fpPrime"
                label="Fuel Prime Duration"
                unit="S"
                step={0.1}
                icon={Droplets}
              />
            </div>

            <SelectRow
              {...fieldProps}
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
                {...fieldProps}
                name="primingDelay"
                label="Priming Delay"
                unit="S"
                step={0.1}
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
              theme="purple"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <InputField
                {...fieldProps}
                name="aeColdPct"
                label="Cold AE Multiplier"
                unit="%"
                icon={TrendingUp}
              />
              <InputField
                {...fieldProps}
                name="aseTaperTime"
                label="ASE Taper"
                unit="S"
                step={0.1}
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
                    {...fieldProps}
                    name="aeColdTaperMin"
                    label="Min Temp (Full AE)"
                    unit="°"
                  />
                  <InputField
                    {...fieldProps}
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
