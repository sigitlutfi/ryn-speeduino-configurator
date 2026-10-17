import PinSelect from "../shared/components/PinSelect";
import React from "react";
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
import {
  GroupHeader,
  SelectField,
  StatField,
} from "../shared/components/TuningComponents";
import IniCurvePanel from "../shared/components/IniCurvePanel.jsx";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const FAN_FIELDS = [
  "fanEnable", "fanWhenOff", "fanWhenCranking", "fanPin", "fanInv",
  "fanSP", "fanHyster", "fanFreq", "fanPWMBins", "PWMFanDuty"
];

const FanSettings = () => {

  const {
    pinPages,
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

  const fanEnable = getValue("fanEnable");
  const isPWM = fanEnable === 2;

  const fieldProps = { getValue, updateValue, getFieldInfo, pinPages };

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
              <GroupHeader title="Core Configuration" icon={Settings} theme="cyan" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SelectField {...fieldProps} name="fanEnable" label="Fan Mode" />
                <PinSelect fieldName="fanPin" label="Output Pin" value={getFieldValue("fanPin")}
                onChange={value => setFieldValue("fanPin", value)} decodedPages={pinPages} />
                <SelectField {...fieldProps} name="fanInv" label="Output Polarity" />
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
              <GroupHeader title="Operational Logic" icon={Zap} theme="blue" />
              <div className="grid grid-cols-2 gap-4">
                 <SelectField {...fieldProps} name="fanWhenOff" label="Allow Engine Off" theme="blue" />
                 <SelectField {...fieldProps} name="fanWhenCranking" label="Allow Cranking" theme="blue" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             {/* Target Settings */}
             <div className={`lg:col-span-12 p-6 rounded-[32px] glass-card border transition-all ${fanEnable > 0 ? "border-neon-cyan/20" : "opacity-30 grayscale pointer-events-none"}`}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 divide-x divide-white/5">
                   {/* On/Off Logic */}
                   <div className="space-y-4">
                      <GroupHeader title="Threshold Strategy" icon={Thermometer} theme="cyan" />
                      <div className="grid grid-cols-2 gap-4">
                         <StatField {...fieldProps} name="fanSP" label="Switch Temp" unit="°C" disabled={isPWM} />
                         <StatField {...fieldProps} name="fanHyster" label="Hysteresis" unit="°C" disabled={isPWM} />
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                         <CircleDot size={14} className="text-white/20" />
                         <p className="text-[8px] font-medium text-white/30 leading-tight uppercase">Classic relay logic based on coolant threshold.</p>
                      </div>
                   </div>

                   {/* PWM Logic */}
                   <div className={`px-10 space-y-4 ${!isPWM ? "opacity-20 flex flex-col justify-center" : ""}`}>
                      <GroupHeader title="PWM Profile" icon={Activity} theme="blue" />
                      <StatField {...fieldProps} name="fanFreq" label="Drive Frequency" unit="Hz" theme="blue" disabled={!isPWM} />
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

          <IniCurvePanel xName="fanPWMBins" yName="PWMFanDuty"
            title="PWM Fan Duty" description="Prepare the curve before selecting PWM mode. Feature activation is separate."
            theme="cyan" />

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
