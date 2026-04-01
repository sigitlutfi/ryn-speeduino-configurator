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
import PinSelect from "../shared/components/PinSelect";
import {
  SelectRow,
  InputField,
  InfoCard,
} from "../shared/components/TuningComponents";
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

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden h-screen animate-in fade-in duration-700">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neon-red/18 via-neon-red/8 to-transparent" />
      <div className="pointer-events-none absolute -top-16 right-[-8rem] h-64 w-64 rounded-full bg-neon-red/10 blur-[120px]" />
      <div className="pointer-events-none absolute left-[-6rem] top-40 h-56 w-56 rounded-full bg-neon-red/6 blur-[110px]" />
      <div className="pointer-events-none relative z-10 h-2 w-full bg-gradient-to-r from-neon-red/80 via-neon-red to-neon-orange/70" />
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
                <SelectRow
                  label="Master Switch"
                  value={getValue("wmiEnabled")}
                  onChange={(val) => updateValue("wmiEnabled", val)}
                  options={getFieldInfo("wmiEnabled")?.meta?.options}
                />
                <SelectRow
                  label="Control Mode"
                  value={getValue("wmiMode")}
                  onChange={(val) => updateValue("wmiMode", val)}
                  options={getFieldInfo("wmiMode")?.meta?.options}
                />
                <PinSelect
                  label="PWM Output Pin"
                  fieldName="vvt2Pin"
                  value={getValue("vvt2Pin")}
                  onChange={(val) => updateValue("vvt2Pin", val)}
                  description="WMI PWM output only allows free output-capable pins"
                  icon={Wind}
                  disabled={wmiEnabled === 0}
                />
                <InputField
                  label="PWM Freq"
                  value={getValue("vvtFreq")}
                  onChange={(val) => updateValue("vvtFreq", val)}
                  units="Hz"
                  disabled={wmiEnabled === 0}
                />
              </div>
            </div>

            {/* Arming Pin */}
            <div
              className={`lg:col-span-4 p-6 rounded-3xl glass-card border border-white/5 bg-black/40 transition-all ${wmiEnabled === 0 ? "opacity-30 grayscale" : ""}`}
            >
              <SectionHeader title="Arming Interface" icon={Zap} theme="blue" />
              <PinSelect
                label="Enable / Arm Pin"
                fieldName="wmiEnabledPin"
                value={getValue("wmiEnabledPin")}
                onChange={(val) => updateValue("wmiEnabledPin", val)}
                description="Only unclaimed input pins can be used for WMI arming"
                icon={Zap}
                disabled={wmiEnabled === 0}
              />
              <div className="mt-3">
                <InfoCard title="Arming Note" theme="blue">
                  External switch required for activation.
                </InfoCard>
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
                <InputField
                  label="Min TPS"
                  value={getValue("wmiTPS")}
                  onChange={(val) => updateValue("wmiTPS", val)}
                  units="%"
                />
                <InputField
                  label="Min RPM"
                  value={getValue("wmiRPM")}
                  onChange={(val) => updateValue("wmiRPM", val)}
                  units="RPM"
                />
                <InputField
                  label="Min MAP"
                  value={getValue("wmiMAP")}
                  onChange={(val) => updateValue("wmiMAP", val)}
                  units="kPa"
                />
                <InputField
                  label="Max MAP"
                  value={getValue("wmiMAP2")}
                  onChange={(val) => updateValue("wmiMAP2", val)}
                  units="kPa"
                />
                <InputField
                  label="Min IAT"
                  value={getValue("wmiIAT")}
                  onChange={(val) => updateValue("wmiIAT", val)}
                  units="°C"
                />
                <InputField
                  label="PWM Offset"
                  value={getValue("wmiOffset")}
                  onChange={(val) => updateValue("wmiOffset", val)}
                  units="ms"
                />
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
                  <SelectRow
                    label="Empty Status"
                    value={getValue("wmiEmptyEnabled")}
                    onChange={(val) => updateValue("wmiEmptyEnabled", val)}
                    options={getFieldInfo("wmiEmptyEnabled")?.meta?.options}
                  />
                  <PinSelect
                    label="Input Pin"
                    fieldName="wmiEmptyPin"
                    value={getValue("wmiEmptyPin")}
                    onChange={(val) => updateValue("wmiEmptyPin", val)}
                    description="Reserve one free input pin for empty-tank sensing"
                    icon={AlertTriangle}
                    disabled={wmiEnabled === 0}
                  />
                  <SelectRow
                    label="Input Polarity"
                    value={getValue("wmiEmptyPolarity")}
                    onChange={(val) => updateValue("wmiEmptyPolarity", val)}
                    options={getFieldInfo("wmiEmptyPolarity")?.meta?.options}
                    disabled={wmiEnabled === 0}
                  />
                </div>
                <div className="space-y-4">
                  <span className="text-[7px] font-black text-white/30 uppercase tracking-widest pl-2 block">
                    Status Indicator
                  </span>
                  <SelectRow
                    label="Indicator LED"
                    value={getValue("wmiIndicatorEnabled")}
                    onChange={(val) => updateValue("wmiIndicatorEnabled", val)}
                    options={getFieldInfo("wmiIndicatorEnabled")?.meta?.options}
                  />
                  <PinSelect
                    label="Output Pin"
                    fieldName="wmiIndicatorPin"
                    value={getValue("wmiIndicatorPin")}
                    onChange={(val) => updateValue("wmiIndicatorPin", val)}
                    description="Indicator output is locked away from other active owners"
                    icon={CircleDot}
                    disabled={wmiEnabled === 0}
                  />
                  <SelectRow
                    label="Output Polarity"
                    value={getValue("wmiIndicatorPolarity")}
                    onChange={(val) => updateValue("wmiIndicatorPolarity", val)}
                    options={
                      getFieldInfo("wmiIndicatorPolarity")?.meta?.options
                    }
                    disabled={wmiEnabled === 0}
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
                <SelectRow
                  label="Advance Correction"
                  value={getValue("wmiAdvEnabled")}
                  onChange={(val) => updateValue("wmiAdvEnabled", val)}
                  options={getFieldInfo("wmiAdvEnabled")?.meta?.options}
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

          <InfoCard
            title="Chemical Safety Lock Active"
            icon={ShieldAlert}
            theme="cyan"
          >
            WMI Duty Cycle is logged as 'WMI duty' in Status Page 4.
          </InfoCard>
        </div>
      </div>
    </div>
  );
};

export default WMI;
