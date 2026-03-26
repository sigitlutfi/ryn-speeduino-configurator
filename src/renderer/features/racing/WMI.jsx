import React, { useState } from "react";
import {
  FlaskConical,
  Wind,
  Zap,
  Activity,
  ShieldAlert,
  Settings,
  CircleDot,
  MousePointer2,
  Lock,
  Thermometer,
  Trophy,
  Gauge,
  Droplets,
  AlertTriangle,
  Beaker,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import CurveEditor from "../../ui/CurveEditor";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const WMI_FIELDS = [
  "wmiEnabled",
  "wmiMode",
  "wmiAdvEnabled",
  "wmiTPS",
  "wmiRPM",
  "wmiMAP",
  "wmiMAP2",
  "wmiIAT",
  "wmiOffset",
  "vvt2Pin",
  "vvtFreq",
  "wmiEnabledPin",
  "wmiIndicatorEnabled",
  "wmiIndicatorPin",
  "wmiIndicatorPolarity",
  "wmiEmptyEnabled",
  "wmiEmptyPin",
  "wmiEmptyPolarity",
  "wmiAdvBins",
  "wmiAdvAdj",
];

const WMI = () => {
  const [activePoint, setActivePoint] = useState(null);

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
  } = useTuningModule(WMI_FIELDS, {});

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 font-orbitron animate-pulse">
        Initializing WMI System...
      </div>
    );
  }

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return (
      toDisplay(rawVal, info?.meta) ??
      rawVal ??
      (Array.isArray(rawVal) ? [] : 0)
    );
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const getMetadata = (name) => getFieldInfo(name)?.meta || null;

  const wmiEnabled = getValue("wmiEnabled");
  const wmiAdvEnabled = getValue("wmiAdvEnabled");

  // Robust array sanitization to prevent NaN in CurveEditor
  const rawBins = getValue("wmiAdvBins");
  const wmiAdvBins = (
    Array.isArray(rawBins) && rawBins.length === 6
      ? rawBins
      : [0, 100, 200, 300, 400, 500]
  ).map((v) => (v === undefined || isNaN(v) ? 0 : v));

  const rawAdj = getValue("wmiAdvAdj");
  const wmiAdvAdj = (
    Array.isArray(rawAdj) && rawAdj.length === 6 ? rawAdj : [0, 0, 0, 0, 0, 0]
  ).map((v) => (v === undefined || isNaN(v) ? 0 : v));

  const SectionHeader = ({ title, icon: Icon, theme = "cyan" }) => (
    <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
      <div
        className={`w-1 h-3 bg-neon-${theme} shadow-glow-${theme} rounded-full`}
      />
      <span className="text-[9px] font-black text-white/80 uppercase tracking-[0.2em]">
        {title}
      </span>
      {Icon && (
        <Icon size={12} className={`ml-auto text-neon-${theme} opacity-30`} />
      )}
    </div>
  );

  const FormField = ({
    name,
    label,
    unit,
    type = "number",
    theme = "cyan",
    disabled = false,
    step = 1,
  }) => {
    const val = getValue(name);
    const info = getFieldInfo(name);

    return (
      <div
        className={`flex flex-col gap-1.5 p-2.5 rounded-xl transition-all ${disabled ? "opacity-20 select-none cursor-not-allowed grayscale" : "hover:bg-white/5"}`}
      >
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
            {info?.meta?.options?.map(
              (opt, i) =>
                opt !== "INVALID" && (
                  <option key={i} value={i} className="bg-bg-deep text-white">
                    {opt}
                  </option>
                ),
            )}
          </select>
        ) : (
          <input
            type="number"
            step={step}
            value={val}
            onChange={(e) => updateValue(name, parseFloat(e.target.value))}
            className={`bg-transparent text-sm font-mono font-black text-white outline-none border-none focus:text-neon-${theme}`}
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden h-screen animate-in fade-in duration-700">
      <TuningHeader
        title="WMI Control"
        icon={FlaskConical}
        description="Water Methanol Injection: Chemical cooling and knock suppression"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Core & Logic */}
            <div className="lg:col-span-8 p-6 rounded-3xl glass-card border border-white/5 bg-gradient-to-br from-neon-cyan/[0.05] to-transparent">
              <SectionHeader
                title="System Foundation"
                icon={Settings}
                theme="cyan"
              />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  name="wmiEnabled"
                  label="Master Switch"
                  type="select"
                />
                <FormField name="wmiMode" label="Control Mode" type="select" />
                <FormField
                  name="vvt2Pin"
                  label="PWM Output Pin"
                  type="select"
                  disabled={wmiEnabled === 0}
                />
                <FormField
                  name="vvtFreq"
                  label="PWM Freq"
                  unit="Hz"
                  disabled={wmiEnabled === 0}
                />
              </div>
            </div>

            {/* Arming Pin */}
            <div
              className={`lg:col-span-4 p-6 rounded-3xl glass-card border border-white/5 bg-black/40 transition-all ${wmiEnabled === 0 ? "opacity-30 grayscale" : ""}`}
            >
              <SectionHeader title="Arming Interface" icon={Zap} theme="blue" />
              <FormField
                name="wmiEnabledPin"
                label="Enable / Arm Pin"
                type="select"
                theme="blue"
                disabled={wmiEnabled === 0}
              />
              <div className="mt-2 text-[8px] font-bold text-white/20 uppercase italic px-2">
                External switch required for activation
              </div>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 lg:grid-cols-12 gap-6 transition-all ${wmiEnabled === 0 ? "opacity-30 grayscale pointer-events-none" : ""}`}
          >
            {/* Engagement Conditions */}
            <div className="lg:col-span-12 p-6 rounded-[32px] glass-card border border-white/5">
              <SectionHeader
                title="Engagement Thresholds"
                icon={Thermometer}
                theme="cyan"
              />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                <FormField name="wmiTPS" label="Min TPS" unit="%" />
                <FormField name="wmiRPM" label="Min RPM" unit="RPM" />
                <FormField name="wmiMAP" label="Min MAP" unit="kPa" />
                <FormField name="wmiMAP2" label="Max MAP" unit="kPa" />
                <FormField name="wmiIAT" label="Min IAT" unit="°C" />
                <FormField name="wmiOffset" label="PWM Offset" unit="ms" />
              </div>
            </div>

            {/* Tank Monitoring */}
            <div className="lg:col-span-6 p-6 rounded-[32px] glass-card border border-white/5 bg-black/40">
              <SectionHeader
                title="Fluid Management"
                icon={Beaker}
                theme="blue"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
                <div className="space-y-4 border-r border-white/5 pr-6">
                  <span className="text-[7px] font-black text-white/30 uppercase tracking-widest pl-2 block">
                    Tank Empty Input
                  </span>
                  <FormField
                    name="wmiEmptyEnabled"
                    label="Empty Status"
                    type="select"
                    theme="blue"
                  />
                  <FormField
                    name="wmiEmptyPin"
                    label="Input Pin"
                    type="select"
                    theme="blue"
                  />
                  <FormField
                    name="wmiEmptyPolarity"
                    label="Input Polarity"
                    type="select"
                    theme="blue"
                  />
                </div>
                <div className="space-y-4">
                  <span className="text-[7px] font-black text-white/30 uppercase tracking-widest pl-2 block">
                    Status Indicator
                  </span>
                  <FormField
                    name="wmiIndicatorEnabled"
                    label="Indicator LED"
                    type="select"
                    theme="cyan"
                  />
                  <FormField
                    name="wmiIndicatorPin"
                    label="Output Pin"
                    type="select"
                    theme="cyan"
                  />
                  <FormField
                    name="wmiIndicatorPolarity"
                    label="Output Polarity"
                    type="select"
                    theme="cyan"
                  />
                </div>
              </div>
            </div>

            {/* Ignition Correction */}
            <div className="lg:col-span-6 p-6 rounded-[32px] glass-card border border-white/5 bg-gradient-to-tr from-neon-blue/[0.05] to-transparent">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader
                  title="Ignition Advance Logic"
                  icon={Activity}
                  theme="blue"
                />
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[7px] font-black text-white/40 uppercase">
                    Advance Status
                  </span>
                  <div
                    className={`px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest ${wmiAdvEnabled ? "bg-neon-blue/20 text-neon-blue" : "bg-white/5 text-white/10"}`}
                  >
                    {wmiAdvEnabled ? "IGN CORRECTION ACTIVE" : "DISABLED"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <FormField
                  name="wmiAdvEnabled"
                  label="Advance Correction"
                  type="select"
                  theme="blue"
                />

                <div
                  className={`p-4 rounded-2xl border transition-all ${wmiAdvEnabled ? "bg-neon-blue/5 border-neon-blue/20 shadow-glow-blue/5" : "bg-white/5 border-white/5 opacity-30 grayscale"}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-neon-blue/10 flex items-center justify-center border border-neon-blue/20">
                      <Activity className="text-neon-blue" size={16} />
                    </div>
                    <h5 className="text-[10px] font-black text-white/80 uppercase tracking-widest">
                      MAP Based Advance Profile
                    </h5>
                  </div>

                  <div className="h-[300px] mb-6">
                    <CurveEditor
                      xValues={wmiAdvBins}
                      yValues={wmiAdvAdj}
                      theme="blue"
                      xLabel="MAP (kPa)"
                      yLabel="Adv Deg"
                      xRange={{ min: 0, max: 511 }}
                      yRange={{ min: -40, max: 40 }}
                      activeIdx={activePoint}
                      onHoverPoint={setActivePoint}
                      onChange={(newX, newY) => {
                        setFieldValue(
                          "wmiAdvBins",
                          toRaw(newX, getMetadata("wmiAdvBins")),
                        );
                        setFieldValue(
                          "wmiAdvAdj",
                          toRaw(newY, getMetadata("wmiAdvAdj")),
                        );
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {wmiAdvBins.map((bin, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${activePoint === i ? "border-neon-blue/40 bg-neon-blue/10" : "border-white/5 bg-black/20"}`}
                      >
                        <span className="text-[6px] font-bold text-white/30 uppercase">
                          {bin} kPa
                        </span>
                        <input
                          type="number"
                          value={wmiAdvAdj[i]}
                          onChange={(e) => {
                            const next = [...wmiAdvAdj];
                            next[i] = parseFloat(e.target.value);
                            setFieldValue(
                              "wmiAdvAdj",
                              toRaw(next, getMetadata("wmiAdvAdj")),
                            );
                          }}
                          className="w-full bg-transparent border-none text-[10px] font-mono font-black text-neon-blue text-center outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-dashed border-white/5 flex items-center justify-between group hover:border-neon-cyan/20 transition-all">
            <div className="flex items-center gap-4">
              <ShieldAlert
                size={16}
                className="text-white/20 group-hover:text-neon-cyan transition-colors"
              />
              <p className="text-[9px] font-medium text-white/20 uppercase tracking-widest group-hover:text-white/40">
                WMI Duty Cycle is logged as 'WMI duty' in Status Page 4
              </p>
            </div>
            <div className="text-[8px] font-black text-white/10 uppercase tracking-[0.4em]">
              Chemical Safety Lock Active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WMI;
