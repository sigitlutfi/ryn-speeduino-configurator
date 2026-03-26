import React, { useState } from "react";
import {
  Wind,
  Thermometer,
  Zap,
  Settings2,
  AlertTriangle,
  Activity,
  Power,
  RotateCcw,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { SelectRow, InputField, ToggleRow, InfoCard } from "../shared/components/TuningComponents";
import CurveEditor from "../../ui/CurveEditor";
import { useStore } from "../../core/store";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const FanSettings = () => {
  const parsedIni = useStore((s) => s.currentProject?.parsedIni);
  const [activePoint, setActivePoint] = useState(null);

  // Constants mapping
  const fieldNames = [
    "fanEnable",
    "fanWhenOff",
    "fanWhenCranking",
    "fanPin",
    "fanInv",
    "fanSP",
    "fanHyster",
    "fanFreq",
    "fanPWMBins",
    "PWMFanDuty"
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
    getFieldInfo
  } = useTuningModule(fieldNames);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 font-orbitron animate-pulse">
        Initializing Fan Controller...
      </div>
    );
  }

  const fanEnable = getFieldValue("fanEnable");
  const isPWM = fanEnable === 2; // 0=Off, 1=On/Off, 2=PWM

  // Constants metadata for arrays
  const getMetadata = (name) => {
    return getFieldInfo(name)?.meta || null;
  };

  const updateArrayValue = (name, index, value) => {
    const meta = getMetadata(name);
    const current = [...toDisplay(getFieldValue(name), meta)];
    current[index] = value;
    setFieldValue(name, toRaw(current, meta));
  };

  const fanPWMBins = toDisplay(getFieldValue("fanPWMBins"), getMetadata("fanPWMBins")) || [0, 0, 0, 0];
  const fanPWMDuty = toDisplay(getFieldValue("PWMFanDuty"), getMetadata("PWMFanDuty")) || [0, 0, 0, 0];

  return (
    <div className="flex flex-col h-full bg-transparent select-none animate-in fade-in duration-700">
      <TuningHeader
        title="Fan Control"
        icon={Wind}
        description="Configure cooling fan engagement based on engine temperature and state"
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
        <div className="max-w-[1400px] mx-auto space-y-8 pb-20">
          
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Main Configuration */}
            <div className="xl:col-span-2 space-y-8">
              <section className="glass-card rounded-[40px] border border-white/5 p-8 relative overflow-hidden bg-black/20">
                <div className="absolute top-0 left-0 w-32 h-32 bg-neon-cyan/5 blur-[60px] pointer-events-none" />
                
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-1.5 h-6 bg-neon-cyan rounded-full shadow-glow-cyan" />
                  <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
                    General Setup
                  </h3>
                </div>

                <div className="space-y-4">
                  <SelectRow
                    label="Fan Mode"
                    value={fanEnable}
                    onChange={(v) => setFieldValue("fanEnable", v)}
                    options={getFieldInfo("fanEnable")?.meta?.options || ["Off", "On/Off", "PWM"]}
                    description="Select cooling fan operation mode. PWM allows variable speed control."
                  />

                  <SelectRow
                    label="Output Pin"
                    value={getFieldValue("fanPin")}
                    onChange={(v) => setFieldValue("fanPin", v)}
                    options={getFieldInfo("fanPin")?.meta?.options || []}
                    description="The physical pin on the controller connected to the fan relay or PWM driver."
                  />

                  <ToggleRow
                    label="Invert Output"
                    value={getFieldValue("fanInv")}
                    onChange={(v) => setFieldValue("fanInv", v)}
                    description="Invert signal logic (On = Low). Use for most fan relays if triggered by ground."
                  />
                </div>
              </section>

              <section className="glass-card rounded-[40px] border border-white/5 p-8 relative overflow-hidden bg-black/20">
                <div className="absolute top-0 left-0 w-32 h-32 bg-neon-blue/5 blur-[60px] pointer-events-none" />
                
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-1.5 h-6 bg-neon-blue rounded-full shadow-glow-blue" />
                  <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
                    Operational Logic
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ToggleRow
                    label="Run When Engine Off"
                    value={getFieldValue("fanWhenOff")}
                    onChange={(v) => setFieldValue("fanWhenOff", v)}
                  />
                  <ToggleRow
                    label="Off During Cranking"
                    value={getFieldValue("fanWhenCranking") === 0}
                    onChange={(v) => setFieldValue("fanWhenCranking", v ? 0 : 1)}
                  />
                </div>

                <div className="mt-8 space-y-4">
                  {!isPWM ? (
                    <>
                      <InputField
                        label="Engagement Temperature"
                        value={getFieldValue("fanSP")}
                        onChange={(v) => setFieldValue("fanSP", v)}
                        units={getFieldInfo("fanSP")?.meta?.units || "°"}
                      />
                      <InputField
                        label="Hysteresis"
                        value={getFieldValue("fanHyster")}
                        onChange={(v) => setFieldValue("fanHyster", v)}
                        units={getFieldInfo("fanHyster")?.meta?.units || "°"}
                        description="Temperature drop required before turning off fan."
                      />
                    </>
                  ) : (
                    <InputField
                      label="PWM Frequency"
                      value={getFieldValue("fanFreq")}
                      onChange={(v) => setFieldValue("fanFreq", v)}
                      units="Hz"
                      description="Usually between 10Hz and 100Hz depending on the fan controller."
                    />
                  )}
                </div>
              </section>
            </div>

            {/* Sidebar info */}
            <div className="space-y-6">
              <InfoCard
                title="Safety Warning"
                icon={AlertTriangle}
                theme="yellow"
              >
                Ensure your cooling fan does not exceed the current rating of your ECU outputs. Always use a relay for high-current fans.
              </InfoCard>

              <InfoCard
                title="Status"
                icon={Activity}
                theme={isConnected ? "cyan" : "gray"}
              >
                {isConnected 
                  ? "Connected - Real-time monitoring active." 
                  : "Offline - Module changes stored locally."}
              </InfoCard>
            </div>
          </div>

          {/* PWM Curve Section */}
          {isPWM && (
            <div className="rounded-[40px] glass-card border border-white/10 relative overflow-hidden bg-black/20 group">
              <div className="p-8 flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-white/5">
                <div className="p-8 flex-1">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20">
                        <Wind className="text-neon-cyan" size={20} />
                      </div>
                      <h4 className="text-sm font-orbitron font-black text-white uppercase tracking-wider">
                        PWM Duty Cycle Curve
                      </h4>
                    </div>
                  </div>

                  <div className="min-h-[400px]">
                    <CurveEditor
                      xValues={fanPWMBins}
                      yValues={fanPWMDuty}
                      theme="cyan"
                      xLabel={`Temperature (${getFieldInfo("fanPWMBins")?.meta?.units || "°"})`}
                      yLabel="Fan Duty %"
                      xRange={{ min: -40, max: 120 }}
                      yRange={{ min: 0, max: 100 }}
                      precision={1}
                      activeIdx={activePoint}
                      onHoverPoint={setActivePoint}
                      onChange={(newX, newY) => {
                        setFieldValue("fanPWMBins", toRaw(newX, getMetadata("fanPWMBins")));
                        setFieldValue("PWMFanDuty", toRaw(newY, getMetadata("PWMFanDuty")));
                      }}
                    />
                  </div>
                </div>

                {/* Numerical Table */}
                <div className="w-full lg:w-[350px] p-8 bg-black/20">
                   <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
                      Duty Table
                    </span>
                  </div>
                  <div className="space-y-2">
                    {fanPWMBins.map((temp, i) => (
                      <div 
                        key={i}
                        className={`flex items-center gap-3 p-3 rounded-2xl transition-all border ${activePoint === i ? "bg-neon-cyan/10 border-neon-cyan/40" : "bg-black/20 border-white/5"}`}
                        onMouseEnter={() => setActivePoint(i)}
                        onMouseLeave={() => setActivePoint(null)}
                      >
                         <div className="flex-1">
                          <span className="text-[6px] font-black text-gray-500 uppercase block">Temp</span>
                          <input
                            type="number"
                            value={temp}
                            onChange={(e) => updateArrayValue("fanPWMBins", i, parseFloat(e.target.value))}
                            className="w-full bg-transparent border-none text-[10px] font-mono font-black text-white outline-none"
                          />
                        </div>
                        <div className="w-px h-6 bg-white/5" />
                        <div className="flex-1 text-right">
                          <span className="text-[6px] font-black text-gray-500 uppercase block">Duty %</span>
                          <input
                            type="number"
                            value={fanPWMDuty[i]}
                            onChange={(e) => updateArrayValue("PWMFanDuty", i, parseFloat(e.target.value))}
                            className="w-full bg-transparent border-none text-[10px] font-mono font-black text-neon-cyan text-right outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FanSettings;
