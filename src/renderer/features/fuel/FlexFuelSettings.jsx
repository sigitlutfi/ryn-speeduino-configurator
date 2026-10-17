import React from "react";
import {
  Zap,
  Gauge,
  Settings,
  Droplet,
  Flame,
  Info,
} from "lucide-react";
import { useLiveTelemetry } from '../shared/hooks/useLiveTelemetry.js';
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import {
  GroupHeader,
  StatField,
  SelectField,
} from "../shared/components/TuningComponents";
import IniCurvePanel from "../shared/components/IniCurvePanel";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const FLEX_FIELDS = [
  "flexEnabled",
  "flexFreqLow",
  "flexFreqHigh",
  "FILTER_FLEX",
  "flexFuelBins",
  "flexFuelAdj",
  "flexAdvBins",
  "flexAdvAdj",
  "flexBoostBins",
  "flexBoostAdj",
  "boostEnabled",
];

export default function FlexFuelSettings() {
  const { realtime } = useLiveTelemetry();

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
  } = useTuningModule(FLEX_FIELDS);

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal;
  };

  const updateField = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const flexEnabled = getValue("flexEnabled") === 1;
  const fieldProps = { getValue, updateValue: updateField, getFieldInfo };
  const liveEthanol =
    isConnected && flexEnabled && Number.isFinite(realtime?.ethanolPct)
      ? realtime.ethanolPct
      : null;

  return (
    <div className="flex flex-col h-full bg-black select-none animate-in fade-in duration-700">
      <TuningHeader
        title="Flex Fuel System"
        icon={Droplet}
        description="Configure Ethanol sensor hardware and blended correction curves"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
        {!isReady && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="text-[10px] font-black text-neon-cyan animate-pulse uppercase tracking-[0.4em]">
              Synchronizing Flex Fuel Maps...
            </div>
          </div>
        )}

        <div className="max-w-[1400px] mx-auto space-y-10 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-8 rounded-[40px] glass-card border border-neon-cyan/20 bg-gradient-to-br from-bg-deep to-black">
              <GroupHeader title="Sensor Setup" icon={Settings} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                <SelectField
                  {...fieldProps}
                  name="flexEnabled"
                  label="Master System"
                  options={["Disabled", "Enabled"]}
                />
                <StatField
                  {...fieldProps}
                  name="FILTER_FLEX"
                  label="Digital Filter"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatField
                  {...fieldProps}
                  name="flexFreqLow"
                  label="E0 Target"
                  unit="Hz"
                  disabled={!flexEnabled}
                />
                <StatField
                  {...fieldProps}
                  name="flexFreqHigh"
                  label="E100 Target"
                  unit="Hz"
                  disabled={!flexEnabled}
                />
              </div>
            </div>

            <div className="p-8 rounded-[40px] border border-white/5 bg-black/40 flex flex-col justify-center gap-6 group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-3xl pointer-events-none group-hover:bg-neon-cyan/10 transition-all" />
              <GroupHeader
                title="Information"
                icon={Info}
                colorClass="bg-white/10"
              />
              <p className="text-[10px] font-medium text-gray-500 uppercase leading-relaxed tracking-widest">
                Flex Fuel adjusts fuel duration and ignition timing based on
                Ethanol percentage. Ensure your sensor frequency matches your
                sensor brand (GM vs Continental).
              </p>
              <div className="mt-4 flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-[8px] font-black text-white/20 uppercase">
                  Ethanol Mix
                </span>
                <div
                  className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${flexEnabled ? "bg-neon-cyan/20 text-neon-cyan animate-pulse" : "bg-white/5 text-gray-600"}`}
                >
                  {liveEthanol !== null
                    ? `LIVE E${liveEthanol}%`
                    : flexEnabled
                      ? "MULTI-FUEL"
                      : "E0 GASOLINE"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <IniCurvePanel
        xName="flexFuelBins"
        yName="flexFuelAdj"
        title="Fuel Correction"
        description="Ethanol % vs Fuel Multiplier"
        icon={Flame}
        theme="red"
        layout="stacked"
        liveXValue={liveEthanol}
      />
            <IniCurvePanel
        xName="flexAdvBins"
        yName="flexAdvAdj"
        title="Ignition Advance"
        description="Ethanol % vs Timing Addition"
        icon={Zap}
        theme="orange"
        layout="stacked"
        liveXValue={liveEthanol}
      />
            <div className="xl:col-span-2">
                <IniCurvePanel
        xName="flexBoostBins"
        yName="flexBoostAdj"
        title="Boost Target Offset"
        description="Ethanol % vs Boost Target Offset"
        icon={Gauge}
        theme="cyan"
        layout="stacked"
        liveXValue={liveEthanol}
      />
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
