import React from "react";
import {
  Droplets,
  Thermometer,
  Zap,
  Activity,
  Timer,
  Clock,
  Wind,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import {
  InputField,
  InfoCard,
} from "../shared/components/TuningComponents";
import IniCurvePanel from "../shared/components/IniCurvePanel";
import { useLiveTelemetry } from '../shared/hooks/useLiveTelemetry.js';
import { toDisplay, toRaw } from "../shared/utils/normalization";

const CurveSection = ({
    liveCoolant,
    title,
    icon,
    xName,
    yName,
    theme,
    description,
  }) => {


    return (
      <IniCurvePanel
        xName={xName}
        yName={yName}
        title={title}
        description={description}
        icon={icon}
        theme={theme}
        liveXValue={liveCoolant}
      />
    );
  };


const StartupCurves = () => {
  const { realtime } = useLiveTelemetry();

  // Constants mapping across Page 1, 2, 5
  const fieldNames = [
    // Page 1
    "aseTaperTime",
    "asePct",
    "aseCount",
    "aseBins",
    "primePulse",
    "primeBins",
    "wueRates",
    "fpPrime",
    "crankingPct",
    // Page 2
    "wueBins",
    "SoftRevLim",
    // Page 5
    "iacBins",
    "iacCLValues",
    "iacCrankDuty",
    "iacCrankSteps",
  ];

  const {
    getFieldValue,
    setFieldValue,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isConnected,
    isDirty,
    isReady,
    getFieldInfo,
  } = useTuningModule(fieldNames);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 font-orbitron animate-pulse">
        Initializing Engine Environment...
      </div>
    );
  }

  const getMetadata = (name) => getFieldInfo(name)?.meta || null;

  const liveCoolant =
    isConnected && Number.isFinite(realtime?.coolant) ? realtime.coolant : null;


  return (
    <div className="flex flex-col h-full bg-transparent select-none animate-in fade-in duration-700">
      <TuningHeader
        title="Startup & Enrichment"
        icon={Clock}
        description="Optimize fueling and targets for various engine temperatures and states"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-[1400px] mx-auto space-y-12 pb-20">
          {/* Global Config Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Fuel Pump Prime"
                  value={toDisplay(getFieldValue("fpPrime"), getMetadata("fpPrime"))}
                  onChange={(v) => setFieldValue("fpPrime", toRaw(v, getMetadata("fpPrime")))}
                  units="s"
                  description="Duration the fuel pump runs when switching on the ignition."
                />
                <InputField
                  label="Cranking Enrichment"
                  value={toDisplay(getFieldValue("crankingPct"), getMetadata("crankingPct"))}
                  onChange={(v) => setFieldValue("crankingPct", toRaw(v, getMetadata("crankingPct")))}
                  units="%"
                  description="Global enrichment applied during engine cranking."
                />
              </div>
              <InputField
                label="ASE Transition Time"
                value={toDisplay(getFieldValue("aseTaperTime"), getMetadata("aseTaperTime"))}
                onChange={(v) => setFieldValue("aseTaperTime", toRaw(v, getMetadata("aseTaperTime")))}
                units="s"
                description="Duration to transition from ASE to normal fueling/WUE."
              />
            </div>
            <InfoCard title="Startup Guide" icon={Activity} theme="cyan">
              Engine behavior is critical here. WUE should taper to 100% as the
              engine reaches operating temp. Avoid excessive priming pulses to prevent flooding.
            </InfoCard>
          </div>

          <div className="space-y-12">
            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <Droplets className="text-neon-cyan" size={18} />
                <h3 className="font-orbitron text-xs font-black text-white uppercase tracking-[0.3em]">
                  Fueling Curves
                </h3>
              </div>

              <CurveSection liveCoolant={liveCoolant}
                id="wue"
                title="Warm Up Enrichment (WUE)"
                icon={Thermometer}
                theme="cyan"
                xName="wueBins"
                yName="wueRates"
                description="Fuel multiplier applied while coolant is below operating temperature."
                xRange={{ min: -40, max: 120 }}
                yRange={{ min: 100, max: 255 }}
              />

              <CurveSection liveCoolant={liveCoolant}
                id="prime"
                title="Priming Pulse"
                icon={Zap}
                theme="yellow"
                xName="primeBins"
                yName="primePulse"
                description="Initial fuel burst injected upon key-on to assist starting."
                xRange={{ min: -40, max: 120 }}
                yRange={{ min: 0, max: 25 }}
              />
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <Wind className="text-neon-magenta" size={18} />
                <h3 className="font-orbitron text-xs font-black text-white uppercase tracking-[0.3em]">
                  Afterstart Enrichment
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <CurveSection liveCoolant={liveCoolant}
                  id="asePct"
                  title="ASE Enrichment Amount"
                  icon={Wind}
                  theme="magenta"
                  xName="aseBins"
                  yName="asePct"
                  description="Additional enrichment (%) immediately after engine fires."
                  xRange={{ min: -40, max: 120 }}
                  yRange={{ min: 0, max: 155 }}
                />

                <CurveSection liveCoolant={liveCoolant}
                  id="aseCount"
                  title="ASE Duration"
                  icon={Timer}
                  theme="purple"
                  xName="aseBins"
                  yName="aseCount"
                  description="Length of time the ASE enrichment is applied."
                  xRange={{ min: -40, max: 120 }}
                  yRange={{ min: 0, max: 255 }}
                />
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <Activity className="text-neon-green" size={18} />
                <h3 className="font-orbitron text-xs font-black text-white uppercase tracking-[0.3em]">
                  Idle Targets
                </h3>
              </div>

              <CurveSection liveCoolant={liveCoolant}
                id="iac"
                title="Idle RPM Target"
                icon={Activity}
                theme="green"
                xName="iacBins"
                yName="iacCLValues"
                description="Desired idle speed based on engine coolant temperature."
                xRange={{ min: -40, max: 120 }}
                yRange={{ min: 500, max: 2500 }}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartupCurves;
