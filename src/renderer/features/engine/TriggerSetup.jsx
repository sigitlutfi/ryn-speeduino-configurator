import React, { useState } from "react";
import { useStore } from "../../core/store";
import {
  Zap,
  Activity,
  ShieldAlert,
  Target,
  AlertTriangle,
  Info,
  ChevronRight,
  Settings2,
  Cpu,
  RefreshCw,
  Clock,
  Waves,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import { createIniSchema } from "../shared/utils/validation";
import { evaluateCondition } from "../shared/utils/evaluator";

export default function TriggerSetup() {
  const currentProject = useStore((s) => s.currentProject);
  const parsedIni = useStore((s) => s.parsedIni);
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
  } = useTuningModule(0, {
    onValidate: (data) => {
      const page0 = data[0] || {};
      const fields = [
        "TrigPattern",
        "numTeeth",
        "TrigSpeed",
        "missingTeeth",
        "TrigAngMul",
        "TrigAng",
        "SkipCycles",
        "TrigEdge",
        "TrigEdgeSec",
        "trigPatternSec",
        "TrigFilter",
        "useResync",
      ];

      const triggerSetupSchema = createIniSchema(parsedIni, 0, fields);
      const result = triggerSetupSchema.safeParse(page0);

      const errors = {};

      // Cross-field logic: Missing tooth pattern (TrigPattern=0) MUST have missing teeth > 0
      if (page0.TrigPattern === 0 && page0.missingTeeth === 0) {
        errors.missingTeeth =
          "Missing tooth pattern requires at least 1 missing tooth";
      }

      if (!result.success) {
        result.error.issues.forEach((issue) => {
          errors[issue.path[0]] = issue.message;
        });
      }

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return false;
      }

      setValidationErrors({});
      return true;
    },
  });

  if (!parsedIni) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 font-orbitron text-xs">
        No INI definition loaded
      </div>
    );
  }

  const constantsDef = parsedIni.constants?.pages || {};
  const constants = localConstants[0] || {};

  const getConstantDef = (name) => {
    for (const page in constantsDef) {
      const def = constantsDef[page][name];
      if (def) return { ...def, name, page };
    }
    return null;
  };

  const handleFieldChange = (name, value) => {
    setLocalField(0, name, value);
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const getValue = (name) => {
    const def = getConstantDef(name);
    if (!def) return 0;
    return constants[name] ?? def.defaultValue ?? 0;
  };

  const getIsFieldEnabled = (name) => {
    // 1. Check if we have metadata for this field from [Dialog] in INI
    const meta = parsedIni.dialogs?.[name];
    if (!meta || !meta.condition) return true;

    // 2. Prepare context (Flattened constants across all pages for cross-page conditions)
    const context = {
      ...(localConstants[0] || {}),
      ...(localConstants[1] || {}),
      ...(localConstants[2] || {}),
    };

    // 3. evaluate the condition string using our dynamic evaluator
    return evaluateCondition(meta.condition, context);
  };

  const renderField = (name, customLabel = null, theme = "cyan") => {
    const def = getConstantDef(name);
    if (!def) return null;

    const currentValue = constants[name] ?? def.defaultValue ?? 0;
    const error = validationErrors[name];
    const disabled = getIsFieldEnabled(name) === false;

    return (
      <div
        key={name}
        className={`group py-4 px-2 hover:bg-white/[0.03] rounded-2xl transition-all duration-300 ${disabled ? "opacity-20 pointer-events-none" : "opacity-100"}`}
      >
        <div className="flex flex-col gap-1 mb-3 px-2">
          <div className="flex justify-between items-start">
            <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">
              {customLabel || def.label || name}
            </label>
            {def.units && (
              <span className="text-[8px] text-white/20 font-black uppercase">
                {def.units}
              </span>
            )}
          </div>
          {error && (
            <span className="text-[8px] text-neon-red font-black uppercase animate-pulse">
              {error}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {def.type === "bits" ? (
            <div className="flex-1 relative">
              <select
                value={currentValue}
                onChange={(e) =>
                  handleFieldChange(name, parseInt(e.target.value))
                }
                className={`w-full bg-black/60 border rounded-xl px-4 py-3 text-[11px] font-bold transition-all cursor-pointer appearance-none hover:bg-black/80 ${
                  error
                    ? "border-neon-red text-neon-red shadow-glow-red/20"
                    : `border-white/10 text-white focus:border-neon-${theme} shadow-inner`
                }`}
              >
                {def.options?.map((opt, idx) => (
                  <option key={idx} value={idx} className="bg-bg-card">
                    {opt}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                <ChevronRight size={14} className="rotate-90" />
              </div>
            </div>
          ) : (
            <input
              type="number"
              step={def.scale || 1}
              value={currentValue}
              onChange={(e) =>
                handleFieldChange(name, parseFloat(e.target.value))
              }
              className={`w-full bg-black/60 border rounded-xl px-4 py-3 text-[11px] font-mono font-black transition-all ${
                error
                  ? "border-neon-red text-neon-red shadow-glow-red/20"
                  : `border-white/10 text-white focus:border-neon-${theme} shadow-inner`
              }`}
            />
          )}
        </div>
      </div>
    );
  };

  const GroupHeader = ({ title, icon: Icon, theme = "cyan" }) => (
    <div className="flex items-center gap-4 mb-8">
      <div
        className={`w-1.5 h-6 bg-neon-${theme} rounded-full shadow-glow-${theme}`}
      />
      <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
        {title}
      </h3>
      {Icon && (
        <Icon className={`ml-auto text-neon-${theme} opacity-40`} size={20} />
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent select-none animate-in fade-in duration-700">
      <TuningHeader
        title="Sync Strategy"
        icon={Cpu}
        description="Configure engine position decoding and high-speed crankshaft trigger logic"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 xl:grid-cols-2 gap-10 pb-20">
          {/* PRIMARY TRIGGER COLUMN */}
          <div className="space-y-10">
            <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-64 h-64 bg-neon-cyan/5 blur-[100px] pointer-events-none" />
              <GroupHeader title="Primary Decoder" icon={Target} theme="cyan" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("TrigPattern", "Pattern Type", "cyan")}
                {renderField("numTeeth", "Base Teeth", "cyan")}
                {renderField("TrigSpeed", "Trigger Speed", "cyan")}
                {renderField("missingTeeth", "Missing Teeth", "cyan")}
                {renderField("TrigAngMul", "Multiplier", "cyan")}
                {renderField("TrigAng", "Trigger Angle", "cyan")}
              </div>

              <div className="mt-8 p-6 rounded-3xl bg-neon-cyan/5 border border-neon-cyan/10 flex gap-4 items-start">
                <Info size={18} className="text-neon-cyan shrink-0" />
                <p className="text-[10px] text-gray-400 font-bold uppercase leading-relaxed tracking-wider">
                  Angle ATDC when tooth #1 passes sensor. Crucial for base
                  timing accuracy.
                </p>
              </div>
            </div>

            <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden">
              <GroupHeader
                title="Signal attributes"
                icon={Activity}
                theme="cyan"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("SkipCycles", "Skip Revs", "cyan")}
                {renderField("TrigEdge", "Primary Edge", "cyan")}
                {renderField("TrigFilter", "Filtering", "cyan")}
                {renderField("useResync", "Full Re-sync", "cyan")}
              </div>
              <div className="mt-8 text-[9px] text-white/20 font-black uppercase tracking-widest text-center italic">
                Stabilize readings before firing ignition coils
              </div>
            </div>
          </div>

          {/* SECONDARY & SAFETY COLUMN */}
          <div className="space-y-10">
            <div className="p-8 rounded-[40px] glass-card border border-neon-purple/20 relative overflow-hidden group shadow-glow-purple/5">
              <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/10 blur-[100px] pointer-events-none" />
              <GroupHeader
                title="Cam / Secondary"
                icon={RefreshCw}
                theme="purple"
              />
              <div className="space-y-2">
                {renderField("TrigEdgeSec", "Secondary Edge", "purple")}
                {renderField("trigPatternSec", "Secondary Type", "purple")}
              </div>
            </div>

            <div className="p-8 rounded-[40px] glass-card border border-neon-red/20 relative overflow-hidden bg-neon-red/5">
              <GroupHeader
                title="Hardware Safety"
                icon={ShieldAlert}
                theme="red"
              />
              <div className="space-y-6">
                <div className="flex items-center gap-6 p-6 rounded-3xl bg-black/40 border border-neon-red/20">
                  <AlertTriangle
                    size={32}
                    className="text-neon-red animate-pulse shrink-0 shadow-glow-red"
                  />
                  <div className="space-y-1">
                    <span className="text-[11px] font-black text-neon-red uppercase tracking-widest block">
                      Timing Critical Area
                    </span>
                    <p className="text-[10px] text-gray-500 leading-relaxed font-bold uppercase">
                      Incorrect settings can cause KICKBACK. Verified with
                      timing light.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 rounded-3xl bg-black/40 border border-white/5 group hover:border-white/20 transition-all">
                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest block mb-1">
                      Cranking Dwell
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-mono font-black text-white">
                        {getValue("dwellcrank")}
                      </span>
                      <span className="text-[9px] text-white/20 font-bold uppercase">
                        ms
                      </span>
                    </div>
                  </div>
                  <div className="p-6 rounded-3xl bg-black/40 border border-white/5 group hover:border-white/20 transition-all">
                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest block mb-1">
                      Crank Speed Limit
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-mono font-black text-white">
                        {getValue("crankRPM") * 10}
                      </span>
                      <span className="text-[9px] text-white/20 font-bold uppercase">
                        RPM
                      </span>
                    </div>
                  </div>
                </div>

                <button className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/40 text-[9px] font-black uppercase tracking-[0.2em] transition-all">
                  View Decoder Documentation
                </button>
              </div>
            </div>

            {/* Signal Visualizer Simulation Placeholder */}
            <div className="p-8 rounded-[40px] glass-card border border-white/10 flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden group">
              <Waves className="text-neon-cyan opacity-20 absolute scale-[4] rotate-12 blur-sm" />
              <Waves
                className="text-neon-cyan/20 animate-pulse pointer-events-none"
                size={48}
              />
              <span className="mt-6 text-[10px] font-orbitron font-black text-white opacity-40 uppercase tracking-[0.4em]">
                Signal Simulator
              </span>
              <span className="mt-2 text-[8px] font-black text-gray-600 uppercase tracking-widest">
                Logic Analyzer Mode Offline
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
