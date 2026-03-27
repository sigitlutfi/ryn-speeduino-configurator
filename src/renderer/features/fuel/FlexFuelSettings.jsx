import React, { useState, useMemo } from "react";
import {
  Zap,
  Gauge,
  Settings,
  Activity,
  Droplet,
  Flame,
  Wind,
  Layers,
  ShieldAlert,
  Info,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { toDisplay, toRaw } from "../shared/utils/normalization";
import CurveEditor from "../../ui/CurveEditor";

const FLEX_FIELDS = [
  "flexEnabled",
  "flexFreqLow",
  "flexFreqHigh",
  "FILTER_FLEX",
  "flexFuelBins",
  "flexFuelAdj",
  "flexAdvBins",
  "flexAdvAdj",
  "flexBoostBins",
  "flexBoostAdj",
  "boostEnabled",
];

const FALLBACK_CONSTANTS = {
  flexFuelBins: [0, 20, 40, 60, 80, 100],
  flexFuelAdj: [100, 110, 120, 130, 140, 150],
  flexAdvBins: [0, 20, 40, 60, 80, 100],
  // Raw values (Speeduino uses 40-based offset for timing: Display = Raw - 40)
  // So 40 raw = 0 deg, 50 raw = 10 deg
  flexAdvAdj: [40, 42, 44, 46, 48, 50],
  flexBoostBins: [0, 20, 40, 60, 80, 100],
  flexBoostAdj: [0, 0, 0, 0, 0, 0],
};

export default function FlexFuelSettings() {
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
  } = useTuningModule(FLEX_FIELDS, { fallbacks: FALLBACK_CONSTANTS });

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
       setPageData(infoX.pageId, {
          [infoX.key]: toRaw(newX, infoX.meta),
          [infoY.key]: toRaw(newY, infoY.meta),
       });
    } else {
       updateField(nameX, newX);
       updateField(nameY, newY);
    }
  };

  const flexEnabled = getValue("flexEnabled") === 1;
  const boostEnabled = getValue("boostEnabled") === 1;

  const GroupHeader = ({ title, icon: Icon, colorClass = "bg-neon-cyan shadow-glow-cyan" }) => (
    <div className="flex items-center gap-4 mb-6">
      <div className={`w-1.5 h-6 ${colorClass} rounded-full`} />
      <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
        {title}
      </h3>
      {Icon && <Icon className="ml-auto text-neon-cyan opacity-20" size={18} />}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-black select-none animate-in fade-in duration-700">
      <TuningHeader
        title="Flex Fuel System"
        icon={Droplet}
        description="Configure Ethanol sensor hardware and blended correction curves"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
        {!isReady && (
           <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <div className="text-[10px] font-black text-neon-cyan animate-pulse uppercase tracking-[0.4em]">
                Synchronizing Flex Fuel Maps...
              </div>
           </div>
        )}

        <div className="max-w-[1400px] mx-auto space-y-10 pb-20">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-8 rounded-[40px] glass-card border border-neon-cyan/20 bg-gradient-to-br from-bg-deep to-black">
              <GroupHeader title="Sensor Setup" icon={Settings} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                 {/* Master Switch as Toggle/Select */}
                 <div className="p-6 rounded-3xl bg-black/40 border border-white/10 group transition-all">
                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-4">Master System</span>
                    <select 
                      value={getValue("flexEnabled")}
                      onChange={(e) => updateField("flexEnabled", parseInt(e.target.value))}
                      className="w-full bg-transparent border-none text-[10px] font-orbitron font-black text-neon-cyan outline-none uppercase"
                    >
                      <option value={0} className="bg-bg-deep">Disabled</option>
                      <option value={1} className="bg-bg-deep">Enabled</option>
                    </select>
                 </div>
                 <div className="p-6 rounded-3xl bg-black/40 border border-white/10 group transition-all">
                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-4">Digital Filter</span>
                    <input 
                      type="number"
                      value={getValue("FILTER_FLEX")}
                      onChange={(e) => updateField("FILTER_FLEX", parseInt(e.target.value))}
                      className="w-full bg-transparent border-none text-2xl font-mono font-black text-white outline-none"
                    />
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-80" disabled={!flexEnabled}>
                <div className="p-6 rounded-3xl glass-card border border-white/5 space-y-2">
                   <h4 className="text-[8px] font-black text-gray-600 uppercase">E0 Target (Hz)</h4>
                   <input 
                      type="number"
                      value={getValue("flexFreqLow")}
                      onChange={(e) => updateField("flexFreqLow", parseInt(e.target.value))}
                      className="w-full bg-transparent border-none text-xl font-mono font-black text-white outline-none"
                   />
                </div>
                <div className="p-6 rounded-3xl glass-card border border-white/5 space-y-2">
                   <h4 className="text-[8px] font-black text-gray-600 uppercase">E100 Target (Hz)</h4>
                   <input 
                      type="number"
                      value={getValue("flexFreqHigh")}
                      onChange={(e) => updateField("flexFreqHigh", parseInt(e.target.value))}
                      className="w-full bg-transparent border-none text-xl font-mono font-black text-white outline-none"
                   />
                </div>
              </div>
            </div>

            <div className="p-8 rounded-[40px] border border-white/5 bg-black/40 flex flex-col justify-center gap-6 group overflow-hidden relative">
               <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-3xl pointer-events-none group-hover:bg-neon-cyan/10 transition-all" />
               <GroupHeader title="Information" icon={Info} colorClass="bg-white/10" />
               <p className="text-[10px] font-medium text-gray-500 uppercase leading-relaxed tracking-widest">
                 Flex Fuel adjusts fuel duration and ignition timing based on Ethanol percentage. Ensure your sensor frequency matches your sensor brand (GM vs Continental).
               </p>
               <div className="mt-4 flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-[8px] font-black text-white/20 uppercase">Ethanol Mix</span>
                  <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${flexEnabled ? 'bg-neon-cyan/20 text-neon-cyan animate-pulse' : 'bg-white/5 text-gray-600'}`}>
                    {flexEnabled ? 'MULTI-FUEL' : 'E0 GASOLINE'}
                  </div>
               </div>
            </div>
          </div>

          <div className="space-y-10" disabled={!flexEnabled}>
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden">
                   <GroupHeader title="Fuel Correction" icon={Flame} colorClass="bg-neon-red shadow-glow-red" />
                   <CurveEditor 
                      xValues={getValue("flexFuelBins")}
                      yValues={getValue("flexFuelAdj")}
                      theme="red"
                      xLabel="Ethanol %"
                      yLabel="Fuel Multiplier (%)"
                      xRange={{ min: 0, max: 100 }}
                      yRange={{ min: 50, max: 250 }}
                      onChange={(nx, ny) => updateCurve("flexFuelBins", "flexFuelAdj", nx, ny)}
                   />
                </div>
                <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden">
                   <GroupHeader title="Ignition Advance" icon={Zap} colorClass="bg-neon-orange shadow-glow-orange" />
                   <CurveEditor 
                      xValues={getValue("flexAdvBins")}
                      yValues={getValue("flexAdvAdj")}
                      theme="orange"
                      xLabel="Ethanol %"
                      yLabel="Timing Add (°)"
                      xRange={{ min: 0, max: 100 }}
                      yRange={{ min: 0, max: 20 }}
                      onChange={(nx, ny) => updateCurve("flexAdvBins", "flexAdvAdj", nx, ny)}
                   />
                </div>
                {boostEnabled && (
                  <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden lg:col-span-2">
                     <GroupHeader title="Boost Target Offset" icon={Gauge} colorClass="bg-neon-cyan shadow-glow-cyan" />
                     <CurveEditor 
                        xValues={getValue("flexBoostBins")}
                        yValues={getValue("flexBoostAdj")}
                        theme="cyan"
                        xLabel="Ethanol %"
                        yLabel="Boost Scale (%)"
                        xRange={{ min: 0, max: 100 }}
                        yRange={{ min: 0, max: 200 }}
                        onChange={(nx, ny) => updateCurve("flexBoostBins", "flexBoostAdj", nx, ny)}
                     />
                  </div>
                )}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
