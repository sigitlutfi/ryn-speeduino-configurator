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
];

const SensorCalibration = () => {
  const [activeTab, setActiveTab] = useState("filters");
  const realtime = useStore((s) => s.realtime);
  
  // Speeduino usually puts TPS ADC in a field like tpsADC or just adc1.
  // We'll fallback to tps (percent) if ADC isn't explicitly in the slice yet.
  const tpsADC = realtime?.tpsADC ?? 0;

  const {
    getFieldValue, setFieldValue, getFieldInfo, handleSave, discardChanges,
    isSaving, saveStatus, isConnected, isDirty, isReady,
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
                <div key={i} className={`w-4 h-[1px] ${i % 5 === 0 ? "bg-white w-6" : "bg-white/50"}`} />
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
              WebkitAppearance: 'slider-vertical',
              writingMode: 'bt-lr', // Bottom to Top
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

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden h-screen animate-in fade-in duration-700">
      <TuningHeader
        title="Sensor Management"
        icon={Wrench}
        description="Global sensor calibration, signal filtering, and diagnostic tools"
        isDirty={isDirty} isSaving={isSaving} saveStatus={saveStatus}
        isConnected={isConnected} onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)} onDiscard={discardChanges} themeColor="cyan"
      />

      {/* Internal Navigation */}
      <div className="flex bg-black/40 border-b border-white/5 px-6 backdrop-blur-xl shrink-0">
        <TabButton id="filters" label="Analog Filters" icon={Activity} />
        <TabButton id="tps" label="TPS Calibration" icon={MousePointer2} />
        <TabButton id="temp" label="Thermistor Cal" icon={Thermometer} />
        <TabButton id="pressure" label="Pressure Sensors" icon={Wind} />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
        <div className="max-w-[1400px] mx-auto">
          {activeTab === "filters" && (
            <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div className="space-y-1">
                   <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Signal Mixing Console</h3>
                   <p className="text-[9px] text-white/30 uppercase tracking-widest">
                     Control alpha-beta smoothing factors for analog acquisition.
                   </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8 justify-items-center p-12 bg-white/[0.02] rounded-[40px] border border-white/5 shadow-inner">
                 <MixerFader name="ADCFILTER_TPS" label="TPS Sensor" icon={MousePointer2} color="cyan" />
                 <MixerFader name="ADCFILTER_MAP" label="MAP Sensor" icon={Wind} color="blue" />
                 <MixerFader name="ADCFILTER_BARO" label="Baro Sensor" icon={Wind} color="indigo" />
                 <MixerFader name="ADCFILTER_CLT" label="Coolant Sensor" icon={Thermometer} color="emerald" />
                 <MixerFader name="ADCFILTER_IAT" label="Air Temp Sensor" icon={Thermometer} color="orange" />
                 <MixerFader name="ADCFILTER_O2" label="O2 Sensor" icon={Activity} color="rose" />
                 <MixerFader name="ADCFILTER_BAT" label="Battery Voltage" icon={Zap} color="amber" />
                 <MixerFader name="FILTER_FLEX" label="Flex Fuel Sensor" icon={Activity} color="purple" />
              </div>

              <div className="p-8 rounded-3xl border border-white/5 bg-black/40 flex items-start gap-6 border-dashed">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
                    <Activity size={24} className="text-white/20" />
                 </div>
                 <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-white/80 uppercase tracking-widest">Tuning Insight</h4>
                    <p className="text-[9px] text-white/40 leading-relaxed uppercase tracking-wider">
                      Most sensor issues are related to grounding or electrical interference. Use "Strong Filtering" (values above 180) as a temporary fix, but investigate wiring if signals jump more than 5% at idle.
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
                      <h3 className="text-lx font-black text-white uppercase italic tracking-tighter">ADC Live Scope</h3>
                      <p className="text-[8px] text-white/30 uppercase tracking-[0.3em]">Raw Signal Monitor</p>
                    </div>
                  </div>

                  <div className="relative h-64 bg-black/40 rounded-3xl border border-white/5 p-8 flex flex-col items-center justify-center overflow-hidden group">
                    <div className="absolute inset-0 bg-neon-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-6xl font-mono font-black text-neon-cyan drop-shadow-glow-cyan animate-in zoom-in duration-300">
                      {tpsADC}
                    </span>
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-4">RAW ADC UNITS (0-1023)</span>
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
                    <h4 className="text-[9px] font-black text-white/40 group-hover:text-neon-cyan uppercase mb-2">Pedal Closed</h4>
                    <span className="text-xl font-black text-white uppercase italic">Set Min</span>
                  </button>
                  <button 
                    onClick={() => setFieldValue("tpsMax", tpsADC)}
                    className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-neon-cyan/[0.15] hover:border-neon-cyan/50 group transition-all"
                  >
                    <h4 className="text-[9px] font-black text-white/40 group-hover:text-neon-cyan uppercase mb-2">Pedal Open</h4>
                    <span className="text-xl font-black text-white uppercase italic">Set Max</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="p-8 rounded-[40px] border border-white/5 bg-black/40 space-y-8">
                  <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest italic">Calibration Targets</h3>
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <label className="text-[7px] font-black text-neon-cyan uppercase tracking-widest block">Stored Min ADC</label>
                      <input 
                        type="number" value={getVal("tpsMin")} 
                        onChange={(e) => setFieldValue("tpsMin", parseInt(e.target.value))}
                        className="w-full bg-transparent border-b border-white/10 text-3xl font-mono font-black text-white outline-none focus:border-neon-cyan transition-colors pb-2"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[7px] font-black text-neon-cyan uppercase tracking-widest block">Stored Max ADC</label>
                      <input 
                        type="number" value={getVal("tpsMax")} 
                        onChange={(e) => setFieldValue("tpsMax", parseInt(e.target.value))}
                        className="w-full bg-transparent border-b border-white/10 text-3xl font-mono font-black text-white outline-none focus:border-neon-cyan transition-colors pb-2"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-8 rounded-[40px] border border-dashed border-white/5 flex flex-col items-center justify-center gap-6 text-center group hover:border-neon-cyan/20 transition-all">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CircleDot size={32} className="text-white/20 group-hover:text-neon-cyan" />
                  </div>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed max-w-[280px]">
                    Ensure your throttle body is fully closed before setting min, and fully open for max. Do not use cruise control or high idle during this process.
                  </p>
                </div>
              </div>
            </div>
          )}

          {(activeTab === "temp" || activeTab === "pressure") && (
            <div className="flex flex-col items-center justify-center h-[500px] text-white/10 space-y-4">
              <Wrench size={48} className="opacity-10" />
              <span className="font-orbitron uppercase tracking-[0.5em] text-[10px]">Module Under Construction</span>
              <p className="text-[8px] uppercase tracking-widest opacity-30 text-center max-w-xs">
                Calibration tools for {activeTab} sensor profiles will be integrated soon.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SensorCalibration;
