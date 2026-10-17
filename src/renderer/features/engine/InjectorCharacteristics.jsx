import React from "react";
import { Droplets, Battery, Clock } from "lucide-react";
import { useLiveTelemetry } from '../shared/hooks/useLiveTelemetry.js';
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { StatField } from "../shared/components/TuningComponents";
import IniCurvePanel from "../shared/components/IniCurvePanel";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const INJECTOR_FIELDS = [
  "dutyLim",
  "injOpen",
  "brvBins",
  "injBatRates",
  "injAngRPM",
  "injAng",
];

const InjectorCharacteristics = () => {
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
  } = useTuningModule(INJECTOR_FIELDS, {});

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal;
  };

  const updateField = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const liveBattery =
    isConnected && Number.isFinite(realtime?.battery) ? realtime.battery : null;
  const liveRpm =
    isConnected && Number.isFinite(realtime?.rpm) ? realtime.rpm : null;

  return (
    <div className="flex flex-col h-full select-none animate-in fade-in duration-700">
      <TuningHeader
        title="Injector Setup"
        icon={Droplets}
        description="Dead-time, battery correction, and timing for precise fuel delivery"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="yellow"
      />

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
        {!isReady && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="text-[10px] font-black text-neon-yellow animate-pulse uppercase tracking-[0.4em]">
              Mapping Injector Dynamics...
            </div>
          </div>
        )}

        <div className="max-w-[1400px] mx-auto space-y-8 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
            <StatField
              name="dutyLim"
              label="Duty Limit"
              unit="%"
              theme="yellow"
              getValue={getValue}
              getFieldInfo={getFieldInfo}
              updateValue={updateField}
            />
            <StatField
              name="injOpen"
              label="Open Time"
              unit="ms"
              step={0.1}
              theme="yellow"
              getValue={getValue}
              getFieldInfo={getFieldInfo}
              updateValue={updateField}
            />
          </div>

          <IniCurvePanel
        xName="brvBins"
        yName="injBatRates"
        title="Dead-Time Correction"
        description="100% is neutral compensation. Calibrate using measured injector data."
        icon={Battery}
        theme="yellow"
        liveXValue={liveBattery}
      />

          <IniCurvePanel
        xName="injAngRPM"
        yName="injAng"
        title="Injector Synchronization"
        description="Injection end-angle target vs engine speed"
        icon={Clock}
        theme="yellow"
        liveXValue={liveRpm}
      />
        </div>
      </div>
    </div>
  );
};

export default InjectorCharacteristics;
