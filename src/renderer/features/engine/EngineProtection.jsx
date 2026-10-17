import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  Activity,
  Thermometer,
  Gauge,
  Droplets,
  AlertTriangle,
  Info,
  ChevronRight,
  Wind,
  Settings,
  Zap,
  Clock,
  Target,
  ArrowRight,
  Monitor,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import {
  GroupHeader,
  StatField,
  SelectField,
} from "../shared/components/TuningComponents";
import IniCurvePanel from "../shared/components/IniCurvePanel.jsx";
import { createIniSchema } from "../shared/utils/validation";
import { useStore } from "../../core/store";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const P1 = 1;
const P4 = 4;
const P6 = 6;
const P9 = 9;
const P10 = 10;
const P15 = 15;

// Default curve values as fallbacks when constants are missing from project state
const DEFAULT_CURVES = {
  coolantProtTemp: [-40, 0, 40, 80, 100, 110],
  coolantProtRPM: [8000, 8000, 8000, 8000, 6000, 4000],
  oilPressureProtRPM: [1000, 2000, 4000, 6000],
  oilPressureProtMins: [10, 20, 35, 45],
  rollingProtRPMDelta: [-300, -200, -100, -50],
  rollingProtCutPercent: [50, 65, 80, 95],
};

const EngineProtection = () => {
  const parsedIni = useStore((s) => s.parsedIni);
  const realtime = useStore((s) => s.realtime);
  const engine = realtime?.engine || {};

  const [validationErrors, setValidationErrors] = useState({});

  const {
    localConstants,
    setLocalField,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isConnected,
    isDirty,
  } = useTuningModule([P1, P4, P6, P9, P10, P15], {
    onValidate: (data) => {
      // Basic validation using INI rules
      const schemas = {
        [P4]: createIniSchema(parsedIni, P4, [
          "engineProtectMaxRPM",
          "SoftRevLim",
          "hardRevLim",
        ]),
        [P6]: createIniSchema(parsedIni, P6, ["boostLimit"]),
        [P9]: createIniSchema(parsedIni, P9, [
          "afrProtectMAP",
          "afrProtectRPM",
          "afrProtectTPS",
        ]),
        [P10]: createIniSchema(parsedIni, P10, [
          "oilPressureMin",
          "oilPressureMax",
        ]),
        [P15]: createIniSchema(parsedIni, P15, [
          "rollingProtRPMDelta",
          "rollingProtCutPercent",
        ]),
      };

      const errors = {};
      Object.entries(schemas).forEach(([page, schema]) => {
        const displayData = Object.fromEntries(Object.entries(data[page] || {}).map(([name, value]) => [name, toDisplay(value, parsedIni.constants.pages[page]?.[name])]));
        const res = schema.safeParse(displayData);
        if (!res.success) {
          res.error.issues.forEach((issue) => {
            errors[`${page}_${issue.path[0]}`] = issue.message;
          });
        }
      });

      setValidationErrors(errors);
      return Object.keys(errors).length === 0;
    },
  });

  const getMetadata = (name) => {
    if (!parsedIni?.constants?.pages) return null;
    for (const page of Object.values(parsedIni.constants.pages)) {
      if (page[name]) return page[name];
    }
    return null;
  };

  const getValue = (page, name) => {
    const val = localConstants[page]?.[name];
    const meta = getMetadata(name);
    const displayVal = toDisplay(val, meta);

    if (displayVal !== null && displayVal !== undefined) {
      if (meta?.type === "array" && !Array.isArray(displayVal)) {
        return DEFAULT_CURVES[name] || [displayVal];
      }
      return displayVal;
    }

    if (DEFAULT_CURVES[name]) return DEFAULT_CURVES[name];
    if (meta?.type === "array") return [];
    return meta?.defaultValue ?? 0;
  };

  const updateValue = (page, name, val) => {
    const meta = getMetadata(name);
    const rawVal = toRaw(val, meta);
    setLocalField(page, name, rawVal);
  };

  const fieldProps = { getValue, updateValue };

  const StatusBadge = ({ label, active, warning = false }) => (
    <div
      className={`px-4 py-2 rounded-full border transition-all flex items-center gap-3 ${
        active
          ? warning
            ? "bg-neon-red/10 border-neon-red text-neon-red shadow-glow-red"
            : "bg-neon-green/10 border-neon-green text-neon-green shadow-glow-green"
          : "bg-white/5 border-white/10 text-gray-500 opacity-50"
      }`}
    >
      <div
        className={`w-1.5 h-1.5 rounded-full ${active ? (warning ? "bg-neon-red" : "bg-neon-green animate-pulse") : "bg-gray-700"}`}
      />
      <span className="text-[9px] font-black uppercase tracking-widest">
        {label} {active ? "ACTIVE" : "OFF"}
      </span>
    </div>
  );

  const isRolling = getValue(P1, "hardCutType") === 1;

  return (
    <div className="flex flex-col h-full bg-transparent select-none animate-in fade-in duration-700">
      <TuningHeader
        title="Engine Protection"
        icon={ShieldAlert}
        description="Configure fail-safe mechanisms for RPM, Boost, AFR, and Oil Pressure limits"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="cyan"
      />

      {/* Live Status Indicators */}
      <div className="px-8 pb-1 flex flex-wrap gap-3">
        <StatusBadge
          label="Prot. Mode"
          active={
            engine.protectRPM ||
            engine.protectMAP ||
            engine.protectOil ||
            engine.protectAFR ||
            engine.protectCLT
          }
          warning
        />
        <StatusBadge
          label="Rev Limiter"
          active={engine.hardLimit || engine.softLimit}
        />
        <StatusBadge
          label="Boost Limit"
          active={engine.protectMAP || engine.boostCut}
        />
        <StatusBadge label="Oil Prot." active={engine.protectOil} />
        <StatusBadge label="AFR Prot." active={engine.protectAFR} />
        <StatusBadge label="Coolant Prot." active={engine.protectCLT} />
      </div>

      <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
        <div className="max-w-[1400px] mx-auto space-y-10 pb-20">
          {/* TOP SECTION: Protection Mode & Rev Limiters */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <GroupHeader title="Global Method" icon={Settings} />
              <div className="space-y-4">
                <SelectField
                  {...fieldProps}
                  page={P6}
                  name="engineProtectType"
                  label="Protection Cut"
                  icon={Zap}
                  options={["Off", "Spark Cut", "Fuel Cut", "Both"]}
                />
                <SelectField
                  {...fieldProps}
                  page={P1}
                  name="hardCutType"
                  label="Cut Strategy"
                  icon={Activity}
                  options={["Full Cut", "Rolling Cut"]}
                />
                <StatField
                  {...fieldProps}
                  page={P4}
                  name="engineProtectMaxRPM"
                  label="Limp Home Limit"
                  unit="RPM"
                  icon={ShieldAlert}
                  error={validationErrors[`${P4}_engineProtectMaxRPM`]}
                />
              </div>
            </div>

            <div className="lg:col-span-2 p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-64 h-64 bg-neon-cyan/5 blur-[100px] pointer-events-none" />
              <GroupHeader title="RPM Limiter" icon={Clock} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatField
                  {...fieldProps}
                  page={P4}
                  name="SoftRevLim"
                  label="Soft Limit Start"
                  unit="RPM"
                  icon={Activity}
                  error={validationErrors[`${P4}_SoftRevLim`]}
                />
                <StatField
                  {...fieldProps}
                  page={P4}
                  name="hardRevLim"
                  label="Hard Limit Floor"
                  unit="RPM"
                  icon={AlertTriangle}
                  error={validationErrors[`${P4}_hardRevLim`]}
                />
                <StatField
                  {...fieldProps}
                  page={P4}
                  name="SoftLimRetard"
                  label="Timing Retard"
                  unit="°"
                  icon={Zap}
                />
                <StatField
                  {...fieldProps}
                  page={P4}
                  name="SoftLimMax"
                  label="Max Permitted RPM"
                  unit="RPM"
                  icon={Activity}
                />
              </div>
            </div>
          </div>

          {/* ROLLING CUT SECTION - Conditionally Highlighted */}
          <div
            className={`p-8 rounded-[40px] glass-card border transition-all duration-700 min-h-[540px] ${isRolling ? "border-neon-cyan active-glow-cyan shadow-glow-cyan/10" : "border-white/10 opacity-60"}`}
          >
            <div className="flex items-center justify-between mb-8">
              <GroupHeader title="Rolling Cut Percent" icon={Activity} />
              {!isRolling && (
                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest italic">
                  Switch 'Cut Strategy' to Rolling to enable
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="min-w-0">
                <IniCurvePanel xName="rollingProtRPMDelta" yName="rollingProtCutPercent" title="Rolling Cut" theme="cyan" layout="stacked" />
              </div>
              <div className="space-y-4 flex flex-col justify-center">
                <div className="p-6 rounded-3xl bg-black/40 border border-white/5">
                  <p className="text-xs text-gray-400 leading-relaxed uppercase tracking-wider font-medium">
                    The rolling cut steps through all ignition/fuel outputs,
                    cutting only a percentage of events. This provides a
                    smoother limiter feel compared to a full hard cut.
                    <br />
                    <br />
                    <span className="text-neon-cyan">X-Axis:</span> Difference
                    from Hard Limit (RPM).
                    <br />
                    <span className="text-neon-cyan">Y-Axis:</span> Percentage
                    of ignition events to cut.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-white/5 mx-auto w-1/2" />

          {/* MIDDLE SECTION: Boost & AFR */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Boost Cut */}
            <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden">
              <GroupHeader title="Boost Protection" icon={Wind} />
              <div className="space-y-6">
                <SelectField
                  {...fieldProps}
                  page={P6}
                  name="boostCutEnabled"
                  label="Boost Cut State"
                  options={["Disabled", "Enabled"]}
                />
                <StatField
                  {...fieldProps}
                  page={P6}
                  name="boostLimit"
                  label="Maximum Boost"
                  unit="kPa"
                  icon={Gauge}
                  error={validationErrors[`${P6}_boostLimit`]}
                />
              </div>
            </div>

            {/* AFR Protection */}
            <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden">
              <GroupHeader title="AFR Protection" icon={Droplets} />
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <SelectField
                    {...fieldProps}
                    page={P9}
                    name="afrProtectEnabled"
                    label="AFR Protection Mode"
                    options={["Off", "Fixed mode", "Table mode"]}
                  />
                </div>
                <StatField
                  {...fieldProps}
                  page={P9}
                  name="afrProtectMAP"
                  label="Min MAP"
                  unit="kPa"
                  error={validationErrors[`${P9}_afrProtectMAP`]}
                />
                <StatField
                  {...fieldProps}
                  page={P9}
                  name="afrProtectRPM"
                  label="Min RPM"
                  unit="RPM"
                  error={validationErrors[`${P9}_afrProtectRPM`]}
                />
                <StatField
                  {...fieldProps}
                  page={P9}
                  name="afrProtectTPS"
                  label="Min TPS"
                  unit="%"
                  error={validationErrors[`${P9}_afrProtectTPS`]}
                />
                <StatField
                  {...fieldProps}
                  page={P9}
                  name="afrProtectDeviation"
                  label="Max Deviation"
                  unit="AFR"
                />
              </div>
            </div>
          </div>

          {/* BOTTOM SECTION: Curves (Coolant & Oil) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden bg-black/20 min-h-[500px]">
              <GroupHeader title="CLT Protection RPM" icon={Thermometer} />
              <div className="min-w-0">
                <IniCurvePanel xName="coolantProtTemp" yName="coolantProtRPM" title="Coolant Protection" theme="cyan" layout="stacked" />
              </div>
            </div>

            <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden bg-black/20 min-h-[500px]">
              <GroupHeader title="Min Oil Pressure" icon={Activity} />
              <div className="min-w-0">
                <IniCurvePanel xName="oilPressureProtRPM" yName="oilPressureProtMins" title="Oil Pressure Protection" theme="cyan" layout="stacked" />
              </div>
            </div>
          </div>

          <div className="p-8 rounded-[30px] bg-neon-cyan/5 border border-neon-cyan/10 flex gap-6 text-[10px] font-bold text-neon-cyan/60 uppercase leading-relaxed tracking-wider">
            <Info className="w-6 h-6 shrink-0 text-neon-cyan opacity-60" />
            <div className="space-y-1">
              <p>
                Failsafe methods can be configured as spark cut, fuel cut, or
                both. Use both for maximum safety on high-performance builds.
              </p>
              <p className="opacity-40">
                Changes must be burned to the ECU memory (Permanently) or saved
                to the project file (Locally).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EngineProtection;
