import React, { useState } from "react";
import {
  Wind,
  Thermometer,
  Zap,
  Activity,
  ShieldAlert,
  Settings,
  CircleDot,
  MousePointer2,
  Lock,
  Flame,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import CurveEditor from "../../ui/CurveEditor";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const FAN_FIELDS = [
  "fanEnable", "fanWhenOff", "fanWhenCranking", "fanPin", "fanInv",
  "fanSP", "fanHyster", "fanFreq", "fanPWMBins", "PWMFanDuty"
];

const FanSettings = () => {
  const [activePoint, setActivePoint] = useState(null);

  const {
    getFieldValue, setFieldValue, getFieldInfo, handleSave, discardChanges,
    isSaving, saveStatus, isConnected, isDirty, isReady,
  } = useTuningModule(FAN_FIELDS, {});

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const getMetadata = (name) => getFieldInfo(name)?.meta || null;

  const updateArrayValue = (name, index, value) => {
    const meta = getMetadata(name);
    const current = [...(getValue(name) || [0,0,0,0])];
    current[index] = value;
    setFieldValue(name, toRaw(current, meta));
  };

  const fanEnable = getValue("fanEnable");
  const isPWM = fanEnable === 2;

  const fanPWMBins = getValue("fanPWMBins") || [80, 85, 90, 95];
  const fanPWMDuty = getValue("PWMFanDuty") || [0, 50, 80, 100];

  const SectionHeader = ({ title, icon: Icon, theme = "cyan" }) => (
    <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
      <div className={`w-1 h-3 bg-neon-${theme} shadow-glow-${theme} rounded-full`} />
      <span className="text-[9px] font-black text-white/80 uppercase tracking-[0.2em]">{title}</span>
      {Icon && <Icon size={12} className={`ml-auto text-neon-${theme} opacity-30`} />}
    </div>
  );

  const FormField = ({ name, label, unit, type = "number", theme = "cyan", disabled = false, step = 1 }) => {
    const val = getValue(name);
    const info = getFieldInfo(name);

    return (
      <div className={`flex flex-col gap-1.5 p-2.5 rounded-xl transition-all ${disabled ? "opacity-20 select-none cursor-not-allowed grayscale" : "hover:bg-white/5"}`}>
        <label className="text-[7px] font-black text-gray-400 uppercase tracking-widest flex justify-between">
          {label}
          {unit && <span className="text-white/20 italic">{unit}</span>}
        </label>
        
        {type === "select" ? (
          <select
            value={val}
            onChange={(e) => updateValue(name, parseInt(e.target.value))}
            className={`bg-black/30 text-[10px] font-bold text-white outline-none border-none cursor-pointer focus:text-neon-${theme} py-1`}
          >
            {info?.meta?.options?.map((opt, i) => opt !== "INVALID" && (
              <option key={i} value={i} className="bg-bg-deep text-white">{opt}</option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            step={step}
            value={val}
            onChange={(e) => updateValue(name, parseFloat(e.target.value))}
            className={`bg-transparent text-sm font-mono font-black text-white outline-none border-none focus:text-neon-${theme}`}
          />
        ) }
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden h-screen animate-in fade-in duration-700">
      <TuningHeader
        title="Fan Settings"
        icon={Wind}
        description="Cooling logic: Thermo-control and PWM variable speeds"
        isDirty={isDirty} isSaving={isSaving} saveStatus={saveStatus}
        isConnected={isConnected} onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)} onDiscard={discardChanges} themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Core Config */}
            <div className="lg:col-span-8 p-6 rounded-3xl glass-card border border-white/5 bg-gradient-to-br from-neon-cyan/[0.02] to-transparent">
              <SectionHeader title="Core Configuration" icon={Settings} theme="cyan" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormField name="fanEnable" label="Fan Mode" type="select" />
                <FormField name="fanPin" label="Output Pin" type="select" />
                <FormField name="fanInv" label="Output Polarity" type="select" />
                <div className="p-2.5 flex flex-col justify-center items-center gap-1 rounded-xl bg-black/40 border border-white/5">
                   <span className="text-[7px] font-bold text-white/30 uppercase tracking-widest">Active State</span>
                   <div className={`px-3 py-0.5 rounded-full text-[8px] font-black tracking-widest ${fanEnable > 0 ? "bg-neon-cyan/20 text-neon-cyan" : "bg-white/5 text-white/20"}`}>
                      {fanEnable > 0 ? "RELIANCE ACTIVE" : "DISABLED"}
                   </div>
                </div>
              </div>
            </div>

            {/* Run Logic */}
            <div className="lg:col-span-4 p-6 rounded-3xl glass-card border border-white/5 bg-black/40">
              <SectionHeader title="Operational Logic" icon={Zap} theme="blue" />
              <div className="grid grid-cols-2 gap-4">
                 <FormField name="fanWhenOff" label="Allow Engine Off" type="select" theme="blue" />
                 <FormField name="fanWhenCranking" label="Allow Cranking" type="select" theme="blue" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             {/* Target Settings */}
             <div className={`lg:col-span-12 p-6 rounded-[32px] glass-card border transition-all ${fanEnable > 0 ? "border-neon-cyan/20" : "opacity-30 grayscale pointer-events-none"}`}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 divide-x divide-white/5">
                   {/* On/Off Logic */}
                   <div className="space-y-4">
                      <SectionHeader title="Threshold Strategy" icon={Thermometer} theme="cyan" />
                      <div className="grid grid-cols-2 gap-4">
                         <FormField name="fanSP" label="Switch Temp" unit="°C" disabled={isPWM} />
                         <FormField name="fanHyster" label="Hysteresis" unit="°C" disabled={isPWM} />
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                         <CircleDot size={14} className="text-white/20" />
                         <p className="text-[8px] font-medium text-white/30 leading-tight uppercase">Classic relay logic based on coolant threshold.</p>
                      </div>
                   </div>

                   {/* PWM Logic */}
                   <div className={`px-10 space-y-4 ${!isPWM ? "opacity-20 flex flex-col justify-center" : ""}`}>
                      <SectionHeader title="PWM Profile" icon={Activity} theme="blue" />
                      <FormField name="fanFreq" label="Drive Frequency" unit="Hz" disabled={!isPWM} />
                      <div className={`p-3 rounded-xl border flex items-center gap-3 ${isPWM ? "bg-neon-blue/5 border-neon-blue/10" : "bg-white/5 border-white/5"}`}>
                         <ShieldAlert size={14} className={isPWM ? "text-neon-blue" : "text-white/20"} />
                         <span className="text-[8px] font-bold text-white/30 uppercase leading-tight italic">Low frequency (10-30Hz) for most fan modules</span>
                      </div>
                   </div>

                   {/* Current Stats */}
                   <div className="pl-10 flex flex-col justify-center">
                      <div className="flex items-center gap-3 bg-black/40 p-6 rounded-3xl border border-white/5">
                         <div className="flex-1">
                            <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em] mb-1 block">Live Engagement</span>
                            <div className="text-3xl font-mono font-black text-white flex items-baseline gap-2">
                               {fanEnable === 0 ? "0" : fanEnable === 1 ? "100" : "VAR"}
                               <span className="text-xs text-neon-cyan font-black">%</span>
                            </div>
                         </div>
                         <div className={`p-4 rounded-2xl ${fanEnable > 0 ? "bg-neon-cyan/10" : "bg-white/5"}`}>
                            <Flame size={24} className={fanEnable > 0 ? "text-neon-cyan animate-pulse" : "text-white/10"} />
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* PWM Curve View - Visible if PWM mode or as a preview if not? 
              Commonly visible as visual reference in high-spec apps even if disabled. 
              But let's stick to conditional for focus. */}
          {isPWM && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4 duration-500">
               <div className="lg:col-span-8 p-8 rounded-[40px] glass-card border border-neon-cyan/10 relative overflow-hidden bg-black/20">
                  <SectionHeader title="Variable Speed Profile" icon={MousePointer2} theme="cyan" />
                  <div className="h-[350px] relative">
                    <CurveEditor
                      xValues={fanPWMBins}
                      yValues={fanPWMDuty}
                      theme="cyan"
                      xLabel="Coolant Temp"
                      yLabel="Duty %"
                      xRange={{ min: 40, max: 120 }}
                      yRange={{ min: 0, max: 100 }}
                      activeIdx={activePoint}
                      onHoverPoint={setActivePoint}
                      onChange={(newX, newY) => {
                        setFieldValue("fanPWMBins", toRaw(newX, getMetadata("fanPWMBins")));
                        setFieldValue("PWMFanDuty", toRaw(newY, getMetadata("PWMFanDuty")));
                      }}
                    />
                  </div>
                  <div className="absolute top-8 right-8 text-[8px] font-black text-neon-cyan/30 uppercase tracking-[0.4em]">Linear Interpolation</div>
               </div>

               <div className="lg:col-span-4 space-y-4">
                  <div className="p-4 bg-black/40 rounded-3xl border border-white/5">
                     <span className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-2 block mb-4">Precision Mapping</span>
                     <div className="space-y-2">
                        {fanPWMBins.map((temp, i) => (
                           <div 
                              key={i}
                              className={`flex items-center gap-3 p-3 rounded-2xl transition-all border ${activePoint === i ? "bg-neon-cyan/5 border-neon-cyan/30" : "bg-white/5 border-transparent"}`}
                              onMouseEnter={() => setActivePoint(i)}
                              onMouseLeave={() => setActivePoint(null)}
                           >
                              <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center font-mono font-black text-[10px] text-white/20 border border-white/5">
                                 {i + 1}
                              </div>
                              <div className="flex-1">
                                 <span className="text-[6px] font-black text-gray-400 uppercase">Temp</span>
                                 <div className="flex items-baseline gap-1">
                                    <input
                                      type="number"
                                      value={temp}
                                      onChange={(e) => updateArrayValue("fanPWMBins", i, parseFloat(e.target.value))}
                                      className="bg-transparent border-none text-xs font-mono font-black text-white outline-none w-10 text-center"
                                    />
                                    <span className="text-[8px] text-white/20">°C</span>
                                 </div>
                              </div>
                              <div className="flex-1 text-right">
                                 <span className="text-[6px] font-black text-gray-400 uppercase">Duty</span>
                                 <div className="flex items-baseline justify-end gap-1">
                                    <input
                                      type="number"
                                      value={fanPWMDuty[i]}
                                      onChange={(e) => updateArrayValue("PWMFanDuty", i, parseFloat(e.target.value))}
                                      className="bg-transparent border-none text-xs font-mono font-black text-neon-cyan outline-none w-10 text-right"
                                    />
                                    <span className="text-[8px] text-white/20">%</span>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                  
                  <div className="p-6 rounded-[32px] border border-white/5 flex flex-col gap-4 justify-center bg-gradient-to-b from-transparent to-white/5">
                     <div className="flex items-center gap-3 text-white/30">
                        <Lock size={14} />
                        <span className="text-[8px] font-black uppercase tracking-widest">MCU Level Guard</span>
                     </div>
                     <p className="text-[9px] font-medium text-white/20 leading-relaxed uppercase">
                        Curve values are limited by firmware hardware bounds. Changes are updated in real-time.
                     </p>
                  </div>
               </div>
            </div>
          )}

          <div className="p-6 rounded-3xl border border-dashed border-white/5 flex items-center justify-between group hover:border-neon-cyan/20 transition-all">
             <div className="flex items-center gap-4">
                <ShieldAlert size={16} className="text-white/20 group-hover:text-neon-cyan transition-colors" />
                <p className="text-[9px] font-medium text-white/20 uppercase tracking-widest group-hover:text-white/40">
                  Coolant temp source is global sensors (Page 1)
                </p>
             </div>
             <div className="text-[8px] font-black text-white/10 uppercase tracking-[0.4em]">Thermal Health Active</div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FanSettings;
