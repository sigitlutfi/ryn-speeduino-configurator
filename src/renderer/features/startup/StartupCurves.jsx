import React, { useState } from "react";
import {
  Droplets,
  Thermometer,
  Zap,
  Activity,
  Timer,
  Clock,
  Wind,
  Settings2,
  ChevronRight,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import {
  SelectRow,
  InputField,
  ToggleRow,
  InfoCard,
} from "../shared/components/TuningComponents";
import CurveEditor from "../../ui/CurveEditor";
import { useStore } from "../../core/store";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const FALLBACK_CONSTANTS = {
  // Page 1
  "aseTaperTime": 50,    // 5.0s
  "asePct": [50, 40, 30, 20],   // 50%, 40%, 30%, 20%
  "aseCount": [10, 8, 5, 2],    // 10s, 8s, 5s, 2s
  "aseBins": [0, 60, 90, 120],  // -40C, 20C, 50C, 80C
  "primePulse": [10, 8, 4, 2],  // 5ms, 4ms, 2ms, 1ms (0.5 scale)
  "primeBins": [0, 60, 90, 120],
  "wueRates": [160, 150, 140, 130, 120, 115, 110, 105, 102, 100],
  "fpPrime": 3,
  "crankingPct": 150,
  // Page 2
  "wueBins": [0, 30, 50, 70, 80, 90, 100, 110, 120, 130], // -40C to 90C
  "SoftRevLim": 65,     // 6500 RPM
  // Page 5
  "iacBins": [0, 30, 50, 70, 80, 90, 100, 110, 120, 130],
  "iacCLValues": [150, 140, 130, 120, 110, 100, 90, 85, 80, 75], // 1500 to 750 RPM
  "iacCrankDuty": [50, 40, 30, 20],
  "iacCrankSteps": [100, 80, 60, 40],
};

const StartupCurves = () => {
  const parsedIni = useStore((s) => s.currentProject?.parsedIni);
  const [activeCurve, setActiveCurve] = useState(null);
  const [activePoint, setActivePoint] = useState(null);

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
  } = useTuningModule(fieldNames, { fallbacks: FALLBACK_CONSTANTS });

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 font-orbitron animate-pulse">
        Initializing Engine Environment...
      </div>
    );
  }

  const getMetadata = (name) => getFieldInfo(name)?.meta || null;

  const getCurveData = (xName, yName) => {
    const metaX = getMetadata(xName);
    const metaY = getMetadata(yName);
    const rawX = getFieldValue(xName);
    const rawY = getFieldValue(yName);

    const x = toDisplay(rawX, metaX);
    const y = toDisplay(rawY, metaY);

    return {
      x: Array.isArray(x) ? x : [],
      y: Array.isArray(y) ? y : [],
      metaX,
      metaY,
    };
  };

  const updateArrayPoint = (name, index, value) => {
    const meta = getMetadata(name);
    const raw = getFieldValue(name);
    const current = Array.isArray(toDisplay(raw, meta)) 
      ? [...toDisplay(raw, meta)] 
      : [];
      
    if (current.length === 0) return;
    
    current[index] = value;
    setFieldValue(name, toRaw(current, meta));
  };

  const CurveSection = ({
    id,
    title,
    icon: Icon,
    xName,
    yName,
    theme,
    description,
    xRange,
    yRange,
  }) => {
    const { x, y, metaX, metaY } = getCurveData(xName, yName);
    const isActive = activeCurve === id;

    return (
      <div
        className={`glass-card rounded-[40px] border transition-all duration-700 overflow-hidden bg-black/20 ${isActive ? "border-neon-" + theme + "/40 ring-1 ring-neon-" + theme + "/20" : "border-white/5"}`}
      >
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-white/5">
          <div className="p-8 flex-1">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl bg-neon-${theme}/10 flex items-center justify-center border border-neon-${theme}/20`}
                >
                  <Icon className={`text-neon-${theme}`} size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-orbitron font-black text-white uppercase tracking-wider">
                    {title}
                  </h4>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                    {description}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-[450px]">
              <CurveEditor
                xValues={x}
                yValues={y}
                theme={theme}
                xLabel={`${metaX?.units || "X"}`}
                yLabel={`${metaY?.units || "Y"}`}
                xRange={xRange}
                yRange={yRange}
                precision={metaY?.digits || 1}
                activeIdx={activeCurve === id ? activePoint : null}
                onHoverPoint={(idx) => {
                  setActiveCurve(id);
                  setActivePoint(idx);
                }}
                onChange={(newX, newY) => {
                  setFieldValue(xName, toRaw(newX, metaX));
                  setFieldValue(yName, toRaw(newY, metaY));
                }}
              />
            </div>
          </div>

          {/* Side Table */}
          <div className="w-full lg:w-[350px] p-8 flex flex-col bg-black/20">
            <h5 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Settings2 size={12} /> Numerical Data
            </h5>
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {x.map((val, i) => (
                <div
                  key={i}
                  onMouseEnter={() => {
                    setActiveCurve(id);
                    setActivePoint(i);
                  }}
                  onMouseLeave={() => {
                    setActiveCurve(null);
                    setActivePoint(null);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-all border ${activeCurve === id && activePoint === i ? `bg-neon-${theme}/10 border-neon-${theme}/40` : "bg-black/20 border-white/5"}`}
                >
                  <div className="flex-1">
                    <span className="text-[6px] font-black text-gray-600 uppercase block">
                      {metaX?.units || "X"}
                    </span>
                    <input
                      type="number"
                      value={val}
                      onChange={(e) =>
                        updateArrayPoint(xName, i, parseFloat(e.target.value))
                      }
                      className="w-full bg-transparent border-none text-[10px] font-mono font-black text-white outline-none"
                    />
                  </div>
                  <div className="w-px h-6 bg-white/5" />
                  <div className="flex-1 text-right">
                    <span className="text-[6px] font-black text-gray-600 uppercase block">
                      {metaY?.units || "Y"}
                    </span>
                    <input
                      type="number"
                      value={y[i]}
                      onChange={(e) =>
                        updateArrayPoint(yName, i, parseFloat(e.target.value))
                      }
                      className={`w-full bg-transparent border-none text-[10px] font-mono font-black text-right outline-none text-neon-${theme}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
                  value={getFieldValue("fpPrime")}
                  onChange={(v) => setFieldValue("fpPrime", v)}
                  units="s"
                  description="Duration the fuel pump runs when switching on the ignition."
                />
                <InputField
                  label="Cranking Enrichment"
                  value={getFieldValue("crankingPct")}
                  onChange={(v) => setFieldValue("crankingPct", v)}
                  units="%"
                  description="Global enrichment applied during engine cranking."
                />
              </div>
              <InputField
                label="ASE Transition Time"
                value={getFieldValue("aseTaperTime")}
                onChange={(v) => setFieldValue("aseTaperTime", v)}
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

              <CurveSection
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

              <CurveSection
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
                <CurveSection
                  id="asePct"
                  title="ASE Enrichment Amount"
                  icon={Wind}
                  theme="magenta"
                  xName="aseBins"
                  yName="asePct"
                  description="Enrichment multiplier (%) immediately after engine fires."
                  xRange={{ min: -40, max: 120 }}
                  yRange={{ min: 0, max: 155 }}
                />

                <CurveSection
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

              <CurveSection
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
