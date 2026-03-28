import React from "react";
import {
  Activity,
  Zap,
  Gauge,
  Flag,
  Settings,
  Flame,
  ShieldCheck,
  Orbit,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { toDisplay, toRaw } from "../shared/utils/normalization";
import { SelectRow, InputField, ToggleRow, InfoCard } from "../shared/components/TuningComponents";

const LAUNCH_FIELDS = [
  "launchEnable", "launchPin", "launchHiLo", "lnchPullRes", 
  "lnchSoftLim", "lnchRetard", "lnchHardLim", "lnchFuelAdd",
  "lnchCtrlTPS", "lnchCtrlVss"
];

const LaunchControl = () => {
  const {
    getFieldValue, setFieldValue, getFieldInfo, handleSave, discardChanges,
    isSaving, saveStatus, isConnected, isDirty, isReady,
  } = useTuningModule(LAUNCH_FIELDS, {});
  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const launchEnable = getValue("launchEnable");

  if (!isReady) return null;

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden animate-in fade-in duration-700">
      <TuningHeader
        title="Launch Control / 2-Step"
        icon={Flag}
        description="Static and variable RPM limiting logic"
        isDirty={isDirty} isSaving={isSaving} saveStatus={saveStatus}
        isConnected={isConnected} onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)} onDiscard={discardChanges} themeColor="red"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <SelectRow 
                    label="Input Pin" 
                    value={getValue("launchPin")} 
                    onChange={(v) => updateValue("launchPin", v)}
                    options={getFieldInfo("launchPin")?.meta?.options}
                    icon={Settings}
                  />
                  <SelectRow 
                    label="Signal Type" 
                    value={getValue("launchHiLo")} 
                    onChange={(v) => updateValue("launchHiLo", v)}
                    options={getFieldInfo("launchHiLo")?.meta?.options}
                  />
                  <SelectRow 
                    label="Internal Pullup" 
                    value={getValue("lnchPullRes")} 
                    onChange={(v) => updateValue("lnchPullRes", v)}
                    options={getFieldInfo("lnchPullRes")?.meta?.options}
                  />
               </div>
            </div>

            <div className="lg:col-span-12">
               <ToggleRow 
                  label="Launch Control Master"
                  value={getValue("launchEnable")}
                  onChange={(v) => updateValue("launchEnable", v)}
                  description="Arm the drag-staging system using the configured hardware trigger"
               />
            </div>
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-500 ${launchEnable > 0 ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
             <div className="space-y-6">
                <div className="p-8 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-xl">
                   <h3 className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] pl-4 mb-8 border-l-2 border-neon-red/50">Activation Envelope</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField label="TPS Threshold" value={getValue("lnchCtrlTPS")} onChange={(v) => updateValue("lnchCtrlTPS", v)} units="%" />
                      <InputField label="VSS Limit" value={getValue("lnchCtrlVss")} onChange={(v) => updateValue("lnchCtrlVss", v)} units="KPH" />
                      <div className="md:col-span-2">
                         <InputField label="Fuel Enrichment" value={getValue("lnchFuelAdd")} onChange={(v) => updateValue("lnchFuelAdd", v)} units="%" description="Additional fuel mass during launch phase" />
                      </div>
                   </div>
                </div>

                <InfoCard title="Antilag Strategy" icon={Flame} theme="red">
                   Launch control uses aggressive spark cut and fuel management to build boost while stationary. Use with caution on stock turbo manifolds.
                </InfoCard>
             </div>

             <div className="space-y-6">
                <div className="p-8 rounded-[40px] bg-neon-red/5 border border-neon-red/20 backdrop-blur-3xl">
                   <h3 className="text-[9px] font-black text-neon-red uppercase tracking-[0.3em] pl-4 mb-8 border-l-2 border-neon-red">Limit Geometry</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputField label="Soft Target" value={getValue("lnchSoftLim")} onChange={(v) => updateValue("lnchSoftLim", v)} units="RPM" description="Initial retard begins" />
                      <InputField label="Hard Limit" value={getValue("lnchHardLim")} onChange={(v) => updateValue("lnchHardLim", v)} units="RPM" description="Full ignition cutout" />
                      <div className="md:col-span-2">
                         <InputField label="Timing Retard" value={getValue("lnchRetard")} onChange={(v) => updateValue("lnchRetard", v)} units="°" description="Absolute timing value while on the limiter" icon={Zap} />
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="p-6 rounded-3xl border border-dashed border-white/5 flex items-center justify-center">
             <div className="text-[8px] font-black text-white/10 uppercase tracking-[0.4em]">Staging Module Active</div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LaunchControl;
