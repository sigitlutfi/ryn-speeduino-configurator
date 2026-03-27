import React, { useState, useMemo } from "react";
import {
  Database,
  Droplets,
  Battery,
  Clock,
  Info,
  Activity,
  ArrowRight,
  Edit3,
  ShieldAlert,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import CurveEditor from "../../ui/CurveEditor";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const INJECTOR_FIELDS = [
  "dutyLim",
  "injOpen",
  "injVoltageBins",
  "injBatRates",
  "injAngRPM",
  "injAng",
];

const InjectorCharacteristics = () => {
  const [hoverVoltageIdx, setHoverVoltageIdx] = useState(null);
  const [hoverTimingIdx, setHoverTimingIdx] = useState(null);

  const {
    getFieldValue,
    setFieldValue,
    setPageData,
    getFieldInfo,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isConnected,
    isDirty,
    isReady,
  } = useTuningModule(INJECTOR_FIELDS, {});

  // Values are arrays or scalars
  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal;
  };

  const updateField = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const updateCurve = (nameX, nameY, newX, newY) => {
    const infoX = getFieldInfo(nameX);
    const infoY = getFieldInfo(nameY);

    if (infoX && infoY && infoX.pageId === infoY.pageId) {
      // Optimized: updating both if on same page
      setPageData(infoX.pageId, {
        [infoX.key]: toRaw(newX, infoX.meta),
        [infoY.key]: toRaw(newY, infoY.meta),
      });
    } else {
      updateField(nameX, newX);
      updateField(nameY, newY);
    }
  };

  const vBins = getValue("injVoltageBins") || [7, 8, 9, 10, 11, 12, 13, 14, 15];
  const vRates = getValue("injBatRates") || [
    120, 110, 100, 95, 90, 85, 80, 75, 70,
  ];
  const tRPM = getValue("injAngRPM") || [500, 2000, 4000, 6000];
  const tAng = getValue("injAng") || [360, 360, 360, 360];

  const GroupHeader = ({
    title,
    icon: Icon,
    colorClass = "bg-neon-yellow shadow-glow-yellow",
  }) => (
    <div className="flex items-center gap-4 mb-6">
      <div className={`w-1.5 h-6 ${colorClass} rounded-full`} />
      <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
        {title}
      </h3>
      {Icon && <Icon className="ml-auto text-white/10" size={18} />}
    </div>
  );

  return (
    <div className="flex flex-col h-full  select-none animate-in fade-in duration-700">
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

        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-10 pb-20">
          <div className="space-y-10">
            {/* Battery Correction */}
            <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-64 h-64 bg-neon-yellow/5 blur-[100px] pointer-events-none" />
              <GroupHeader title="Dead-Time Correction" icon={Battery} />
              <CurveEditor
                xValues={vBins}
                yValues={vRates}
                theme="yellow"
                xLabel="Battery Voltage (V)"
                yLabel="Correction (%)"
                xRange={{ min: 6, max: 20 }}
                yRange={{ min: 0, max: 250 }}
                precision={1}
                activeIdx={hoverVoltageIdx}
                onHoverPoint={setHoverVoltageIdx}
                onChange={(nx, ny) =>
                  updateCurve("injVoltageBins", "injBatRates", nx, ny)
                }
              />
            </div>

            {/* Timing */}
            <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden">
              <GroupHeader title="Injector Synchronization" icon={Clock} />
              <CurveEditor
                xValues={tRPM}
                yValues={tAng}
                theme="yellow"
                xLabel="Engine Speed (RPM)"
                yLabel="Finish Angle (°)"
                xRange={{ min: 0, max: 10000 }}
                yRange={{ min: 0, max: 720 }}
                activeIdx={hoverTimingIdx}
                onHoverPoint={setHoverTimingIdx}
                onChange={(nx, ny) =>
                  updateCurve("injAngRPM", "injAng", nx, ny)
                }
              />
            </div>
          </div>

          <div className="space-y-10">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-3xl glass-card border border-white/10 hover:border-neon-yellow/30 transition-all">
                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                  Duty Limit
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={getValue("dutyLim")}
                    onChange={(e) =>
                      updateField("dutyLim", parseInt(e.target.value))
                    }
                    className="w-full bg-black/40 border-none text-xl font-mono font-black text-neon-yellow outline-none"
                  />
                  <span className="text-xs text-white/20 font-bold uppercase font-orbitron">
                    %
                  </span>
                </div>
              </div>
              <div className="p-6 rounded-3xl glass-card border border-white/10 hover:border-neon-yellow/30 transition-all">
                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                  Open Time
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.1"
                    value={getValue("injOpen")}
                    onChange={(e) =>
                      updateField("injOpen", parseFloat(e.target.value))
                    }
                    className="w-full bg-black/40 border-none text-xl font-mono font-black text-white outline-none"
                  />
                  <span className="text-xs text-white/20 font-bold uppercase font-orbitron">
                    ms
                  </span>
                </div>
              </div>
            </div>

            {/* Voltage Table */}
            <div className="p-8 rounded-[40px] glass-card border border-white/10">
              <GroupHeader title="Voltage Bins" icon={Activity} />
              <div className="grid grid-cols-3 gap-2">
                {vBins.map((v, i) => (
                  <div
                    key={i}
                    onMouseEnter={() => setHoverVoltageIdx(i)}
                    onMouseLeave={() => setHoverVoltageIdx(null)}
                    className={`flex flex-col gap-1 p-3 rounded-2xl border transition-all ${hoverVoltageIdx === i ? "bg-neon-yellow/10 border-neon-yellow/40" : "bg-black/20 border-white/5"}`}
                  >
                    <span className="text-[7px] font-black text-gray-600 uppercase">
                      V_IN
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      value={v}
                      onChange={(e) => {
                        const nx = [...vBins];
                        nx[i] = parseFloat(e.target.value);
                        updateCurve(
                          "injVoltageBins",
                          "injBatRates",
                          nx,
                          vRates,
                        );
                      }}
                      className="bg-transparent border-none text-[11px] font-mono font-black text-white outline-none"
                    />
                    <div className="h-px bg-white/5 my-1" />
                    <span className="text-[7px] font-black text-gray-600 uppercase">
                      RATE
                    </span>
                    <input
                      type="number"
                      value={vRates[i]}
                      onChange={(e) => {
                        const ny = [...vRates];
                        ny[i] = parseInt(e.target.value);
                        updateCurve("injVoltageBins", "injBatRates", vBins, ny);
                      }}
                      className="bg-transparent border-none text-[11px] font-mono font-black text-neon-yellow outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 rounded-[40px] glass-card border border-white/10">
              <GroupHeader title="Timing Data" icon={Edit3} />
              <div className="space-y-3">
                {tRPM.map((rpm, i) => (
                  <div
                    key={i}
                    onMouseEnter={() => setHoverTimingIdx(i)}
                    onMouseLeave={() => setHoverTimingIdx(null)}
                    className={`flex items-center gap-4 p-3 rounded-2xl transition-all border ${hoverTimingIdx === i ? "bg-neon-yellow/10 border-neon-yellow/40" : "bg-black/20 border-white/5"}`}
                  >
                    <input
                      type="number"
                      value={rpm}
                      onChange={(e) => {
                        const nx = [...tRPM];
                        nx[i] = parseInt(e.target.value);
                        updateCurve("injAngRPM", "injAng", nx, tAng);
                      }}
                      className="w-full bg-transparent border-none text-xs font-mono font-black text-white focus:text-neon-yellow outline-none"
                    />
                    <ArrowRight size={12} className="opacity-10" />
                    <input
                      type="number"
                      value={tAng[i]}
                      onChange={(e) => {
                        const ny = [...tAng];
                        ny[i] = parseInt(e.target.value);
                        updateCurve("injAngRPM", "injAng", tRPM, ny);
                      }}
                      className="w-20 bg-black/40 border border-white/5 rounded-lg py-1 px-2 text-xs font-mono font-black text-right text-white/40 focus:text-white outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InjectorCharacteristics;
