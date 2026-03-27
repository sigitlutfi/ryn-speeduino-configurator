import React, { useState } from "react";
import {
  Wrench,
  Activity,
  Zap,
  Thermometer,
  Wind,
  Gauge,
  MousePointer2,
  ChevronRight,
  ChevronDown,
  Settings,
  CircleDot,
  Trash2,
  Save,
  RefreshCw,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { toDisplay, toRaw } from "../shared/utils/normalization";
import { useStore } from "../../core/store";

const SENSOR_FIELDS = [
  "ADCFILTER_TPS",
  "ADCFILTER_CLT",
  "ADCFILTER_IAT",
  "ADCFILTER_O2",
  "ADCFILTER_BAT",
  "ADCFILTER_MAP",
  "ADCFILTER_BARO",
  "FILTER_FLEX",
  "tpsMin",
  "tpsMax",
  "mapMin",
  "mapMax",
  "baroMin",
  "baroMax",
  "EMAPMin",
  "EMAPMax",
  "batVoltCorrect",
];

const THERMISTOR_PRESETS = {
  GM: { bias: 2490, t1: -40, r1: 100700, t2: 30, r2: 2238, t3: 99, r3: 177 },
  Ford: { bias: 2490, t1: 0, r1: 94000, t2: 50, r2: 11000, t3: 98, r3: 2370 },
  Mazda: {
    bias: 50000,
    t1: -40,
    r1: 2022088,
    t2: 21,
    r2: 68273,
    t3: 99,
    r3: 3715,
  },
  Toyota: {
    bias: 2490,
    t1: -40,
    r1: 101890,
    t2: 30,
    r2: 2268,
    t3: 99,
    r3: 156,
  },
  Bosch: { bias: 2490, t1: -30, r1: 26144, t2: 20, r2: 2500, t3: 110, r3: 144 },
};

const O2_PRESETS = {
  "Innovate LC-1/LC-2": { vMin: 0, afrMin: 7.35, vMax: 5, afrMax: 22.39 },
  "AEM Linear (30-42xx)": { vMin: 0, afrMin: 9.72, vMax: 5, afrMax: 19.6 },
  "AEM Linear (30-2310)": { vMin: 0, afrMin: 7.31, vMax: 5, afrMax: 19.18 },
  "14Point7 Spartan 2": { vMin: 0, afrMin: 10.0, vMax: 5, afrMax: 20.0 },
  "PLX iMFD": { vMin: 0, afrMin: 10.0, vMax: 5, afrMax: 20.0 },
  "Ballenger AFR500": { vMin: 0, afrMin: 9.0, vMax: 5, afrMax: 16.0 },
};

const SensorCalibration = () => {
  const [activeTab, setActiveTab] = useState("filters");
  const realtime = useStore((s) => s.realtime);

  // Speeduino usually puts TPS ADC in a field like tpsADC or just adc1.
  // We'll fallback to tps (percent) if ADC isn't explicitly in the slice yet.
  const tpsADC = realtime?.tpsADC ?? 0;

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
  } = useTuningModule(SENSOR_FIELDS, { page: 4 });

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 font-orbitron animate-pulse uppercase tracking-[0.3em]">
        Calibrating Interfaces...
      </div>
    );
  }

  const updateFilter = (name, val) => {
    // Clamp to 0-240 as per INI warning
    const clamped = Math.max(0, Math.min(240, Math.round(val)));
    setFieldValue(name, clamped);
  };

  const getVal = (name) => getFieldValue(name) ?? 0;

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-3 px-6 py-4 border-b-2 transition-all duration-500 font-bold uppercase tracking-widest text-[10px] ${
        activeTab === id
          ? "border-neon-cyan text-white bg-neon-cyan/5 shadow-[inset_0_-10px_20px_-10px_rgba(0,243,255,0.2)]"
          : "border-transparent text-white/30 hover:text-white/60 hover:bg-white/5"
      }`}
    >
      <Icon size={14} className={activeTab === id ? "text-neon-cyan" : ""} />
      {label}
    </button>
  );

  const MixerFader = ({ name, label, icon: Icon, color = "cyan" }) => {
    const value = getVal(name);
    // 0 is strong filtering, 240 is less?
    // Wait, INI says: "Higher values result in stronger filtering, but slower response times"
    // So 255 is strongest? INI says max is 240.

    return (
      <div className="flex flex-col items-center gap-6 group scale-95 hover:scale-100 transition-all duration-300">
        <div className="relative h-64 w-12 bg-black/60 rounded-2xl border border-white/5 p-1.5 flex flex-col justify-end overflow-hidden glass-card group-hover:border-neon-cyan/20 transition-shadow">
          {/* Fader Track (Decorative lines) */}
          <div className="absolute inset-0 flex flex-col items-center justify-between py-6 pointer-events-none opacity-10">
            {[...Array(11)].map((_, i) => (
              <div
                key={i}
                className={`w-4 h-[1px] ${i % 5 === 0 ? "bg-white w-6" : "bg-white/50"}`}
              />
            ))}
          </div>

          {/* Level Fill Visual */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-neon-${color}/60 to-neon-${color}/20 border-t border-neon-${color}/50 shadow-glow-${color} transition-all duration-150 pointer-events-none`}
            style={{ height: `${(value / 240) * 100}%` }}
          />

          {/* Actual Native Input (Invisible but functional) */}
          <input
            type="range"
            orient="vertical"
            min="0"
            max="240"
            value={value}
            onChange={(e) => updateFilter(name, e.target.value)}
            className="absolute inset-x-0 inset-y-0 w-full h-full opacity-0 cursor-ns-resize z-20"
            style={{
              WebkitAppearance: "slider-vertical",
              writingMode: "bt-lr", // Bottom to Top
              margin: 0,
            }}
          />

          {/* Custom Fader Handle (Follows input) */}
          <div
            className="absolute z-10 left-1 right-1 h-6 bg-gradient-to-b from-white/40 to-white/10 rounded-md border border-white/40 shadow-2xl pointer-events-none flex items-center justify-center backdrop-blur-md"
            style={{ bottom: `calc(${(value / 240) * 100}% - 12px)` }}
          >
            <div className="w-full h-[1px] bg-black/30" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className={`p-2 rounded-lg bg-neon-${color}/10 transition-all`}>
            <Icon size={14} className={`text-neon-${color}`} />
          </div>
          <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em] w-16 text-center leading-tight">
            {label}
          </span>
          <span className="text-[10px] font-mono font-black text-white mt-2">
            {value}%
          </span>
        </div>
      </div>
    );
  };

  const CalibrationRow = ({
    label,
    fieldName,
    unit = "",
    icon: Icon,
    color = "cyan",
  }) => {
    const value = getVal(fieldName);
    return (
      <div className="flex items-center gap-6 p-6 rounded-[24px] bg-white/[0.02] border border-white/5 hover:border-neon-cyan/20 transition-all group">
        <div
          className={`w-10 h-10 rounded-xl bg-neon-${color}/10 flex items-center justify-center shrink-0`}
        >
          <Icon size={18} className={`text-neon-${color}`} />
        </div>
        <div className="flex-1 space-y-1">
          <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">
            {label}
          </span>
          <div className="flex items-baseline gap-2">
            <input
              type="number"
              value={value}
              onChange={(e) =>
                setFieldValue(fieldName, parseFloat(e.target.value))
              }
              className="bg-transparent border-none outline-none text-xl font-mono font-black text-white w-24"
            />
            <span className="text-[10px] font-bold text-white/20 uppercase">
              {unit}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const ThermistorCal = ({ title, sensorKey }) => {
    const [preset, setPreset] = useState("Custom");
    const [params, setParams] = useState(THERMISTOR_PRESETS["GM"]); // Default to GM for UI

    const applyPreset = (pName) => {
      if (pName === "Custom") return;
      setPreset(pName);
      setParams(THERMISTOR_PRESETS[pName]);
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in slide-in-from-bottom-4 duration-500">
        <div className="lg:col-span-4 space-y-6">
          <div className="p-10 rounded-[40px] glass-card border border-white/5 space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-neon-orange/10 flex items-center justify-center border border-neon-orange/20">
                <Thermometer className="text-neon-orange" size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lx font-black text-white uppercase italic tracking-tighter">
                  {title}
                </h3>
                <p className="text-[8px] text-white/30 uppercase tracking-[0.3em]">
                  Live Feed:{" "}
                  {sensorKey === "clt" ? realtime?.clt : realtime?.iat}°C
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[8px] font-black text-white/30 uppercase tracking-widest pl-2">
                Select Preset
              </label>
              <select
                value={preset}
                onChange={(e) => applyPreset(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-[10px] font-bold text-white uppercase tracking-widest outline-none focus:border-neon-orange transition-all"
              >
                <option value="Custom">-- Custom Sensor --</option>
                {Object.keys(THERMISTOR_PRESETS).map((k) => (
                  <option key={k} value={k}>
                    {k} Sensor
                  </option>
                ))}
              </select>
            </div>

            <div className="p-6 rounded-3xl border border-dashed border-white/10 space-y-4 text-center">
              <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em] block">
                Bias Resistor Value
              </span>
              <input
                type="number"
                value={params.bias}
                onChange={(e) =>
                  setParams({ ...params, bias: parseInt(e.target.value) })
                }
                className="bg-transparent text-center text-3xl font-mono font-black text-white outline-none w-full"
              />
              <span className="text-[8px] font-bold text-neon-orange uppercase tracking-widest">
                OHMS (Ω)
              </span>
            </div>
          </div>

          <button className="w-full p-6 rounded-[30px] bg-neon-orange/10 border border-neon-orange/30 text-neon-orange font-black uppercase tracking-[0.2em] text-[10px] hover:bg-neon-orange hover:text-black transition-all shadow-glow-orange/20">
            Write Lookup Table to ECU
          </button>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="p-10 rounded-[40px] glass-card border border-white/5 grid grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-white/30">
                    {i}
                  </div>
                  <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">
                    Point {i}
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl border border-white/5">
                    <span className="text-[7px] text-white/20 uppercase block mb-1">
                      Temperature (°C)
                    </span>
                    <input
                      type="number"
                      value={params[`t${i}`]}
                      onChange={(e) =>
                        setParams({
                          ...params,
                          [`t${i}`]: parseFloat(e.target.value),
                        })
                      }
                      className="bg-transparent text-xl font-mono font-black text-white outline-none w-full"
                    />
                  </div>
                  <div className="p-4 rounded-2xl border border-white/5">
                    <span className="text-[7px] text-white/20 uppercase block mb-1">
                      Resistance (Ω)
                    </span>
                    <input
                      type="number"
                      value={params[`r${i}`]}
                      onChange={(e) =>
                        setParams({
                          ...params,
                          [`r${i}`]: parseFloat(e.target.value),
                        })
                      }
                      className="bg-transparent text-xl font-mono font-black text-white outline-none w-full"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex-1 p-10 rounded-[40px] border border-dashed border-white/5 flex flex-col items-center justify-center gap-6 text-center">
            <div className="flex items-center gap-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-8 bg-white/5 rounded-full`}
                  style={{ height: `${20 + i * 15}px`, opacity: 0.1 + i * 0.1 }}
                />
              ))}
            </div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed max-w-sm">
              Steinhart-Hart calculation is used to generate a 32-point lookup
              table. Ensure your sensor is at ambient temperature for Point 2 to
              get the best accuracy.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700">
      <TuningHeader
        title="Sensor Management"
        icon={Wrench}
        description="Global sensor calibration, signal filtering, and diagnostic tools"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="cyan"
      />

      {/* Internal Navigation */}
      <div className="flex bg-white/5 border-b border-white/10 px-6 backdrop-blur-xl shrink-0">
        <TabButton id="filters" label="Analog Filters" icon={Activity} />
        <TabButton id="tps" label="TPS Calibration" icon={MousePointer2} />
        <TabButton id="o2" label="O2 Calibration" icon={Activity} />
        <TabButton id="temp" label="Thermistor Cal" icon={Thermometer} />
        <TabButton id="pressure" label="Pressure Sensors" icon={Wind} />
        <TabButton id="battery" label="Battery" icon={Zap} />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
        <div className="max-w-[1400px] mx-auto">
          {activeTab === "filters" && (
            <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">
                    Signal Mixing Console
                  </h3>
                  <p className="text-[9px] text-white/30 uppercase tracking-widest">
                    Control alpha-beta smoothing factors for analog acquisition.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8 justify-items-center p-10 rounded-[40px] glass-card border border-white/5">
                <MixerFader
                  name="ADCFILTER_TPS"
                  label="TPS Sensor"
                  icon={MousePointer2}
                  color="cyan"
                />
                <MixerFader
                  name="ADCFILTER_MAP"
                  label="MAP Sensor"
                  icon={Wind}
                  color="blue"
                />
                <MixerFader
                  name="ADCFILTER_BARO"
                  label="Baro Sensor"
                  icon={Wind}
                  color="indigo"
                />
                <MixerFader
                  name="ADCFILTER_CLT"
                  label="Coolant Sensor"
                  icon={Thermometer}
                  color="emerald"
                />
                <MixerFader
                  name="ADCFILTER_IAT"
                  label="Air Temp Sensor"
                  icon={Thermometer}
                  color="orange"
                />
                <MixerFader
                  name="ADCFILTER_O2"
                  label="O2 Sensor"
                  icon={Activity}
                  color="rose"
                />
                <MixerFader
                  name="ADCFILTER_BAT"
                  label="Battery Voltage"
                  icon={Zap}
                  color="amber"
                />
                <MixerFader
                  name="FILTER_FLEX"
                  label="Flex Fuel Sensor"
                  icon={Activity}
                  color="purple"
                />
              </div>

              <div className="p-8 rounded-3xl border border-white/5 flex items-start gap-6 border-dashed">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
                  <Activity size={24} className="text-white/20" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-white/80 uppercase tracking-widest">
                    Tuning Insight
                  </h4>
                  <p className="text-[9px] text-white/40 leading-relaxed uppercase tracking-wider">
                    Most sensor issues are related to grounding or electrical
                    interference. Use "Strong Filtering" (values above 180) as a
                    temporary fix, but investigate wiring if signals jump more
                    than 5% at idle.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "tps" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in slide-in-from-bottom-4 duration-500">
              <div className="p-10 rounded-[40px] glass-card border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20">
                      <MousePointer2 className="text-neon-cyan" size={24} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lx font-black text-white uppercase italic tracking-tighter">
                        ADC Live Scope
                      </h3>
                      <p className="text-[8px] text-white/30 uppercase tracking-[0.3em]">
                        Raw Signal Monitor
                      </p>
                    </div>
                  </div>

                  <div className="relative h-64 rounded-3xl border border-white/5 p-8 flex flex-col items-center justify-center overflow-hidden group">
                    <div className="absolute inset-0 bg-neon-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-6xl font-mono font-black text-neon-cyan drop-shadow-glow-cyan animate-in zoom-in duration-300">
                      {tpsADC}
                    </span>
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-4">
                      RAW ADC UNITS (0-1023)
                    </span>
                    <div className="absolute bottom-10 inset-x-10 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neon-cyan shadow-glow-cyan transition-all duration-200"
                        style={{ width: `${(tpsADC / 1023) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mt-10">
                  <button
                    onClick={() => setFieldValue("tpsMin", tpsADC)}
                    className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-neon-cyan/[0.15] hover:border-neon-cyan/50 group transition-all"
                  >
                    <h4 className="text-[9px] font-black text-white/40 group-hover:text-neon-cyan uppercase mb-2">
                      Pedal Closed
                    </h4>
                    <span className="text-xl font-black text-white uppercase italic">
                      Set Min
                    </span>
                  </button>
                  <button
                    onClick={() => setFieldValue("tpsMax", tpsADC)}
                    className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-neon-cyan/[0.15] hover:border-neon-cyan/50 group transition-all"
                  >
                    <h4 className="text-[9px] font-black text-white/40 group-hover:text-neon-cyan uppercase mb-2">
                      Pedal Open
                    </h4>
                    <span className="text-xl font-black text-white uppercase italic">
                      Set Max
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="p-10 rounded-[40px] glass-card border border-white/5 space-y-8">
                  <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest italic">
                    Calibration Targets
                  </h3>
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <label className="text-[7px] font-black text-neon-cyan uppercase tracking-widest block">
                        Stored Min ADC
                      </label>
                      <input
                        type="number"
                        value={getVal("tpsMin")}
                        onChange={(e) =>
                          setFieldValue("tpsMin", parseInt(e.target.value))
                        }
                        className="w-full bg-transparent border-b border-white/10 text-3xl font-mono font-black text-white outline-none focus:border-neon-cyan transition-colors pb-2"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[7px] font-black text-neon-cyan uppercase tracking-widest block">
                        Stored Max ADC
                      </label>
                      <input
                        type="number"
                        value={getVal("tpsMax")}
                        onChange={(e) =>
                          setFieldValue("tpsMax", parseInt(e.target.value))
                        }
                        className="w-full bg-transparent border-b border-white/10 text-3xl font-mono font-black text-white outline-none focus:border-neon-cyan transition-colors pb-2"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-8 rounded-[40px] border border-dashed border-white/5 flex flex-col items-center justify-center gap-6 text-center group hover:border-neon-cyan/20 transition-all">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CircleDot
                      size={32}
                      className="text-white/20 group-hover:text-neon-cyan"
                    />
                  </div>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed max-w-[280px]">
                    Ensure your throttle body is fully closed before setting
                    min, and fully open for max. Do not use cruise control or
                    high idle during this process.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "o2" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in slide-in-from-bottom-4 duration-500">
              <div className="lg:col-span-4 space-y-6">
                <div className="p-10 rounded-[40px] glass-card border border-white/5 space-y-8">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-neon-red/10 flex items-center justify-center border border-neon-red/20">
                      <Activity className="text-neon-red" size={24} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lx font-black text-white uppercase italic tracking-tighter">
                        O2 Sensor Cal
                      </h3>
                      <p className="text-[8px] text-white/30 uppercase tracking-[0.3em]">
                        Live Feed: {realtime?.afr} AFR
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[8px] font-black text-white/30 uppercase tracking-widest pl-2">
                      Controller Preset
                    </label>
                    <select className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-[10px] font-bold text-white uppercase tracking-widest outline-none focus:border-neon-red transition-all">
                      <option value="Custom">-- Custom Linear WB --</option>
                      {Object.keys(O2_PRESETS).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-8 rounded-3xl border border-white/5 flex flex-col items-center justify-center gap-4 text-center">
                    <span className="text-[8px] text-white/20 uppercase font-black tracking-widest leading-relaxed">
                      Wideband sensors require a controller with a 0-5V analog
                      output for Speeduino to read AFR.
                    </span>
                  </div>
                </div>

                <button className="w-full p-6 rounded-[30px] bg-neon-red/10 border border-neon-red/30 text-neon-red font-black uppercase tracking-[0.2em] text-[10px] hover:bg-neon-red hover:text-white transition-all shadow-glow-red/20">
                  Write AFR Table to ECU
                </button>
              </div>

              <div className="lg:col-span-8 space-y-6">
                <div className="p-10 rounded-[40px] glass-card border border-white/5 grid grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-white/30">
                        L
                      </div>
                      <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">
                        Low Point (0V default)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                        <span className="text-[7px] text-white/20 uppercase block mb-1">
                          Voltage (V)
                        </span>
                        <input
                          type="number"
                          defaultValue={0}
                          className="bg-transparent text-xl font-mono font-black text-white outline-none w-full"
                        />
                      </div>
                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                        <span className="text-[7px] text-white/20 uppercase block mb-1">
                          λ / AFR
                        </span>
                        <input
                          type="number"
                          defaultValue={10.0}
                          className="bg-transparent text-xl font-mono font-black text-white outline-none w-full"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-white/30">
                        H
                      </div>
                      <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">
                        High Point (5V default)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                        <span className="text-[7px] text-white/20 uppercase block mb-1">
                          Voltage (V)
                        </span>
                        <input
                          type="number"
                          defaultValue={5.0}
                          className="bg-transparent text-xl font-mono font-black text-white outline-none w-full"
                        />
                      </div>
                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                        <span className="text-[7px] text-white/20 uppercase block mb-1">
                          λ / AFR
                        </span>
                        <input
                          type="number"
                          defaultValue={20.0}
                          className="bg-transparent text-xl font-mono font-black text-white outline-none w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-10 rounded-[40px] border border-dashed border-white/5 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest italic">
                        Calibration Curve Graph
                      </h4>
                      <p className="text-[8px] text-white/30 uppercase tracking-widest">
                        Generated Response Curve
                      </p>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-neon-red/10 border border-neon-red/20 text-[8px] font-bold text-neon-red uppercase">
                      Linear Scaled
                    </div>
                  </div>
                  <div className="h-48 w-full rounded-3xl border border-white/5 relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 opacity-10">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <line
                          x1="10"
                          y1="90"
                          x2="90"
                          y2="10"
                          stroke="#f43f5e"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                        />
                      </svg>
                    </div>
                    <span className="text-[10px] text-white/10 uppercase font-black tracking-[1em]">
                      Dynamic Curve Preview
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "temp" && (
            <div className="space-y-20">
              <ThermistorCal
                title="Coolant Temperature (CLT)"
                sensorKey="clt"
              />
              <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <ThermistorCal
                title="Intake Air Temperature (IAT)"
                sensorKey="iat"
              />
            </div>
          )}

          {activeTab === "pressure" && (
            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="p-10 rounded-[40px] glass-card border border-white/5 space-y-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-neon-blue/10 flex items-center justify-center border border-neon-blue/20">
                      <Wind className="text-neon-blue" size={24} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lx font-black text-white uppercase italic tracking-tighter">
                        MAP & Baro Calibration
                      </h3>
                      <p className="text-[8px] text-white/30 uppercase tracking-[0.3em]">
                        Manifold Absolute Pressure
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CalibrationRow
                      label="MAP Min Pressure"
                      fieldName="mapMin"
                      unit="kPa"
                      icon={Wind}
                      color="blue"
                    />
                    <CalibrationRow
                      label="MAP Max Pressure"
                      fieldName="mapMax"
                      unit="kPa"
                      icon={Wind}
                      color="blue"
                    />
                    <CalibrationRow
                      label="Baro Min Pressure"
                      fieldName="baroMin"
                      unit="kPa"
                      icon={Wind}
                      color="indigo"
                    />
                    <CalibrationRow
                      label="Baro Max Pressure"
                      fieldName="baroMax"
                      unit="kPa"
                      icon={Wind}
                      color="indigo"
                    />
                  </div>
                </div>

                <div className="p-10 rounded-[40px] glass-card border border-white/5 space-y-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-neon-purple/10 flex items-center justify-center border border-neon-purple/20">
                      <Wind className="text-neon-purple" size={24} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lx font-black text-white uppercase italic tracking-tighter">
                        EMAP Calibration
                      </h3>
                      <p className="text-[8px] text-white/30 uppercase tracking-[0.3em]">
                        Exhaust Backpressure
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CalibrationRow
                      label="EMAP Min Pressure"
                      fieldName="EMAPMin"
                      unit="kPa"
                      icon={Wind}
                      color="purple"
                    />
                    <CalibrationRow
                      label="EMAP Max Pressure"
                      fieldName="EMAPMax"
                      unit="kPa"
                      icon={Wind}
                      color="purple"
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 rounded-[30px] border border-dashed border-white/5 flex items-start gap-6 max-w-2xl">
                <div className="p-3 rounded-2xl bg-white/5 text-white/20">
                  <Save size={20} />
                </div>
                <p className="text-[9px] text-white/30 uppercase leading-relaxed tracking-wider">
                  Mini/Max values for pressure sensors are typically provided by
                  the manufacturer. For a standard 2.5 Bar MAP sensor, use 0kPa
                  - 250kPa.
                </p>
              </div>
            </div>
          )}

          {activeTab === "battery" && (
            <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
              <div className="p-10 rounded-[40px] glass-card border border-white/5 space-y-12 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-96 h-96 bg-neon-yellow/5 blur-[120px] pointer-events-none" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-3xl bg-neon-yellow/10 flex items-center justify-center border border-neon-yellow/20">
                      <Zap className="text-neon-yellow" size={32} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">
                        Battery Voltage Calibration
                      </h3>
                      <p className="text-[10px] text-white/30 uppercase tracking-[0.4em]">
                        Hardware Level Power Monitoring
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                      MCU Supply
                    </span>
                    <span className="text-xl font-mono font-black text-white">
                      5.01V
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 py-10">
                  <div className="flex flex-col items-center justify-center p-10 rounded-[40px] border border-white/5 relative group">
                    <div className="absolute inset-0 bg-neon-yellow/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[40px]" />
                    <div className="relative">
                      <div className="text-[100px] font-mono font-black text-white leading-none tracking-tighter glow-yellow">
                        {realtime?.vbatt ?? "0.0"}
                      </div>
                      <span className="text-[12px] font-black text-neon-yellow absolute -right-10 top-4 uppercase tracking-widest">
                        VOLTS
                      </span>
                    </div>
                    <div className="h-1.5 w-48 bg-white/5 rounded-full mt-8 overflow-hidden">
                      <div
                        className="h-full bg-neon-yellow shadow-glow-yellow transition-all duration-300"
                        style={{
                          width: `${Math.min(100, ((realtime?.vbatt ?? 0) / 16) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-center space-y-10">
                    <div className="space-y-6">
                      <div className="flex flex-col gap-2">
                        <h4 className="text-[10px] font-black text-white/60 uppercase tracking-widest pl-1">
                          Offset Correction
                        </h4>
                        <p className="text-[9px] text-white/20 uppercase tracking-wider leading-relaxed">
                          Adjust this value if the displayed voltage differs
                          from a physical multimeter reading at the battery.
                        </p>
                      </div>

                      <div className="flex items-center gap-8 bg-black/40 p-6 rounded-3xl border border-white/5">
                        <button
                          onClick={() =>
                            setFieldValue(
                              "batVoltCorrect",
                              getVal("batVoltCorrect") - 0.1,
                            )
                          }
                          className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-neon-yellow/10 hover:border-neon-yellow/30 hover:text-neon-yellow transition-all text-2xl font-black"
                        >
                          -
                        </button>
                        <div className="flex-1 text-center">
                          <div className="text-4xl font-mono font-black text-neon-yellow">
                            {getVal("batVoltCorrect") > 0 ? "+" : ""}
                            {getVal("batVoltCorrect")?.toFixed(1)}V
                          </div>
                          <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">
                            Current Bias
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            setFieldValue(
                              "batVoltCorrect",
                              getVal("batVoltCorrect") + 0.1,
                            )
                          }
                          className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-neon-yellow/10 hover:border-neon-yellow/30 hover:text-neon-yellow transition-all text-2xl font-black"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-[9px] text-white/30 uppercase leading-relaxed tracking-widest">
                      <span className="text-neon-yellow font-black block mb-2">
                        Notice:
                      </span>
                      High voltage readings (&gt;15.5V) may indicate a failing
                      alternator or voltage regulator, which could damage the
                      ECU.
                    </div>
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

export default SensorCalibration;
