import React, { useState, useMemo } from "react";
import {
  Settings,
  Activity,
  Cpu,
  Calculator,
  ShieldAlert,
  Info,
  Disc,
  Zap,
  Flame,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import { useStore } from "../../core/store.js";
import TuningHeader from "../shared/components/TuningHeader";
import { toDisplay, toRaw } from "../shared/utils/normalization";
import ReqFuelCalculator from "./ReqFuelCalculator.jsx";

const ENGINE_FIELDS = [
  "nCylinders",
  "nInjectors",
  "engineType",
  "stoich",
  "reqFuel",
  "divider",
  "injLayout",
  "mapSample",
  "algorithm",
  "sparkMode",
  "pinLayout",
  "injType",
  "alternate",
  "twoStroke",
  "injOpen",
];

const EngineSettings = () => {
  const [showReqFuelCalc, setShowReqFuelCalc] = useState(false);
  const { currentProject, updateProjectField } = useStore();

  const {
    getFieldValue,
    setFieldValue,
    setLocalPage,
    getFieldInfo,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isConnected,
    isDirty,
    isReady,
  } = useTuningModule(ENGINE_FIELDS, {});

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const reqFuelCalcPrefs = currentProject?.engine?.reqFuelCalc || {};

  const GroupHeader = ({
    title,
    icon: Icon,
    colorClass = "bg-neon-red shadow-glow-red",
  }) => (
    <div className="flex items-center gap-4 mb-6">
      <div className={`w-1.5 h-6 ${colorClass} rounded-full`} />
      <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
        {title}
      </h3>
      {Icon && <Icon className="ml-auto text-neon-red opacity-10" size={18} />}
    </div>
  );

  const StatField = ({
    name,
    label,
    icon: Icon,
    unit,
    step = 1,
    disabled = false,
    theme = "red",
    description,
  }) => {
    const val = getValue(name);
    return (
      <div
        className={`p-6 rounded-3xl glass-card border border-white/10 transition-all ${disabled ? "opacity-20 grayscale pointer-events-none" : "hover:border-neon-red/30"}`}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
            {Icon && (
              <Icon size={12} className={`text-neon-${theme} opacity-40`} />
            )}
            {label}
          </span>
          {unit && (
            <span className="text-[8px] font-black text-white/20 uppercase">
              {unit}
            </span>
          )}
        </div>
        <input
          type="number"
          step={step}
          value={val}
          onChange={(e) => updateValue(name, parseFloat(e.target.value))}
          className={`w-full bg-black/40 border-none text-2xl font-mono font-black text-white focus:text-neon-${theme} outline-none transition-colors duration-300`}
        />
        {description && (
          <p className="text-[7px] text-gray-600 font-bold uppercase mt-2 leading-tight">
            {description}
          </p>
        )}
      </div>
    );
  };

  const SelectField = ({
    name,
    label,
    icon: Icon,
    disabled = false,
    theme = "white",
  }) => {
    const val = getValue(name);
    const info = getFieldInfo(name);

    // Handle filtering "INVALID" while maintaining original mapping index
    const availableOptions = info?.meta?.options || [];
    const filteredOptions = availableOptions
      .map((opt, i) => ({ label: opt, value: i }))
      .filter((o) => o.label && o.label !== "INVALID");

    return (
      <div
        className={`p-6 rounded-3xl glass-card border border-white/10 transition-all ${disabled ? "opacity-20 grayscale pointer-events-none" : "hover:border-gray-500/30 font-bold"}`}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            {Icon && <Icon size={12} className="text-white opacity-40" />}
            {label}
          </span>
        </div>
        <select
          value={val}
          onChange={(e) => updateValue(name, parseInt(e.target.value))}
          className={`w-full bg-black/40 border-none text-[10px] font-orbitron font-black uppercase text-white outline-none py-1 appearance-none cursor-pointer`}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                className="bg-bg-deep text-white"
              >
                {opt.label}
              </option>
            ))
          ) : (
            <option value={val}>Loading...</option>
          )}
        </select>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full  select-none animate-in fade-in duration-700">
      <TuningHeader
        title="Engine Strategy"
        icon={Settings}
        description="Core power management and thermodynamic constants"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="white"
      />

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
        {!isReady && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="text-[10px] font-black text-white animate-pulse uppercase tracking-[0.4em]">
              Synchronizing Engine definitions...
            </div>
          </div>
        )}

        <div className="max-w-[1400px] mx-auto space-y-10 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-8 rounded-[40px] glass-card border border-white/5 bg-gradient-to-br from-bg-deep to-black">
              <GroupHeader
                title="Core Constants"
                icon={Cpu}
                colorClass="bg-white"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                <div className="md:col-span-2 p-6 rounded-3xl bg-neon-red/5 border border-neon-red/20 relative group">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[8px] font-black text-neon-red uppercase tracking-widest flex items-center gap-2">
                      <Calculator size={14} className="animate-pulse" />
                      Required Fuel (Base Duration)
                    </span>
                    <button
                      onClick={() => setShowReqFuelCalc(true)}
                      className="text-[8px] font-black text-white bg-neon-red/20 px-4 py-1.5 rounded-full hover:bg-neon-red hover:text-white transition-all uppercase tracking-widest shadow-glow-red"
                    >
                      Recalculate
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={getValue("reqFuel")}
                    onChange={(e) =>
                      updateValue("reqFuel", parseFloat(e.target.value))
                    }
                    className="w-full bg-transparent border-none text-[64px] font-mono font-black text-neon-red outline-none tracking-tighter"
                  />
                  <span className="absolute right-8 bottom-8 text-[10px] font-black text-neon-red/40 uppercase">
                    ms
                  </span>
                </div>

                <StatField
                  name="stoich"
                  label="Stoichiometric Ratio"
                  unit="AFR"
                />
                <SelectField
                  name="pinLayout"
                  label="Speeduino Board"
                  icon={Cpu}
                />
                <SelectField
                  name="nCylinders"
                  label="Cylinder Count"
                  icon={Activity}
                />
                <StatField
                  name="nInjectors"
                  label="Injector Count"
                  icon={Zap}
                />
                <SelectField name="twoStroke" label="Stroke Cycle" />
                <SelectField name="engineType" label="Engine Stroke" />
              </div>
            </div>

            <div className="flex flex-col gap-8">
              <div className="p-8 rounded-[40px] glass-card border border-white/10">
                <GroupHeader
                  title="Fueling Strategy"
                  icon={Flame}
                  colorClass="bg-neon-cyan shadow-glow-cyan"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SelectField
                    name="algorithm"
                    label="Control Algorithm"
                    icon={ShieldAlert}
                  />
                  <StatField
                    name="divider"
                    label="Squirts per Cycle"
                    description="Firing events per cycle (720°)"
                  />
                  <SelectField name="injType" label="Injection Type" />
                  <SelectField name="alternate" label="Injektor Timing" />
                  <StatField
                    name="injOpen"
                    label="Injector Open Time"
                    unit="ms"
                    step={0.1}
                  />
                  <SelectField name="mapSample" label="MAP Sampling" />
                </div>
              </div>

              <div className="p-8 rounded-[40px] bg-white/5 border border-white/10 flex items-center gap-6">
                <div className="p-4 rounded-3xl bg-white/10">
                  <Info size={24} className="text-white/40" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest">
                    Setup Warning
                  </h4>
                  <p className="text-[8px] text-gray-500 font-medium uppercase mt-1 leading-relaxed">
                    Changing Required Fuel will rescale your whole VE table.
                    Only recalculate if you changed injectors or fuel type.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-[40px] glass-card border border-white/10">
            <GroupHeader
              title="Ignition / Sync"
              icon={Zap}
              colorClass="bg-neon-orange shadow-glow-orange"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <SelectField name="sparkMode" label="Spark Mode" theme="orange" />
            </div>
          </div>
        </div>
      </div>

      {showReqFuelCalc && (
        <ReqFuelCalculator
          isOpen={true}
          onClose={() => setShowReqFuelCalc(false)}
          currentReqFuel={getValue("reqFuel")}
          initialDisplacement={
            reqFuelCalcPrefs.displacement ??
            currentProject?.engine?.displacement ??
            2000
          }
          initialDisplacementUnit={reqFuelCalcPrefs.displacementUnit ?? "cc"}
          initialCylinders={getValue("nCylinders")}
          initialInjectorFlow={reqFuelCalcPrefs.injectorFlow ?? 440}
          initialInjectorUnit={reqFuelCalcPrefs.injectorUnit ?? "ccmin"}
          initialSquirts={getValue("divider")}
          initialStoich={getValue("stoich")}
          onApply={(data) => {
            const reqFuelInfo = getFieldInfo("reqFuel");
            const nCylInfo = getFieldInfo("nCylinders");
            const dividerInfo = getFieldInfo("divider");
            const stoichInfo = getFieldInfo("stoich");

            updateProjectField("engine.reqFuelCalc", {
              displacement: data.displacement,
              displacementUnit: data.displacementUnit,
              injectorFlow: data.injectorFlow,
              injectorUnit: data.injectorUnit,
              stoich: data.stoich,
            });

            if (
              reqFuelInfo &&
              nCylInfo &&
              dividerInfo &&
              stoichInfo &&
              reqFuelInfo.pageId === nCylInfo.pageId &&
              reqFuelInfo.pageId === dividerInfo.pageId &&
              reqFuelInfo.pageId === stoichInfo.pageId
            ) {
              setLocalPage(reqFuelInfo.pageId, {
                [reqFuelInfo.key]: toRaw(data.reqFuel, reqFuelInfo.meta),
                [nCylInfo.key]: toRaw(data.cylinders, nCylInfo.meta),
                [dividerInfo.key]: toRaw(data.squirts, dividerInfo.meta),
                [stoichInfo.key]: toRaw(data.stoich, stoichInfo.meta),
              });
            } else {
              // Fallback if INI mappings ever diverge across pages.
              updateValue("reqFuel", data.reqFuel);
              updateValue("nCylinders", data.cylinders);
              updateValue("divider", data.squirts);
              updateValue("stoich", data.stoich);
            }

            setShowReqFuelCalc(false);
          }}
        />
      )}
    </div>
  );
};

export default EngineSettings;
