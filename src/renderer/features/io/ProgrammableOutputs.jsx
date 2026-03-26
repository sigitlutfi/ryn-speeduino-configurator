import React, { useState, useMemo } from "react";
import { useStore } from "../../core/store";
import {
  Cpu,
  Settings2,
  Target,
  ShieldCheck,
  Info,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
} from "lucide-react";
import { programmableOutputsSchema } from "../shared/schemas";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import {
  SelectRow,
  InputField,
  ToggleRow,
  InfoCard,
} from "../shared/components/TuningComponents";

/**
 * Modernized Programmable Outputs Module
 * Uses standardized TuningComponents for consistent UI/UX.
 */
export default function ProgrammableOutputs() {
  const { parsedIni } = useStore();
  const [currentRule, setCurrentRule] = useState(0);

  // Constants mapping logic
  const {
    localConstants,
    setLocalField,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isConnected,
    isDirty,
    isReady,
  } = useTuningModule([0, 13], {
    onValidate: (data) => {
      if (!data[13]) return true;
      const result = programmableOutputsSchema.safeParse(data[13]);
      return result.success;
    },
  });

  // Handle both 0-indexed (legacy) and 1-indexed (Correct INI mapping)
  const boardData = localConstants[1] || localConstants[0] || {};
  const pageData = localConstants[13] || {};

  const getVal = (name) => pageData[`${name}${currentRule}`] ?? 0;
  const updateField = (name, val) =>
    setLocalField(13, `${name}${currentRule}`, val);

  // Metadata Extraction for consistent labels
  const iniOptions = useMemo(() => {
    const page13 = parsedIni?.constants?.pages?.[13] || {};

    const clean = (field) => {
      const opts = page13[field]?.options || [];
      return opts
        .map((label, index) => ({ label, index }))
        .filter((opt) => opt.label && opt.label.toUpperCase() !== "INVALID");
    };

    const firstDataIn = clean(`firstDataIn${currentRule}`);
    const secondDataIn = clean(`secondDataIn${currentRule}`);
    const pins = clean(`outputPin${currentRule}`);
    const firstComp = page13[`firstCompType${currentRule}`]?.options || [
      "==",
      "!=",
      ">",
      ">=",
      "<",
      "<=",
    ];
    const logic = clean(`bitwise${currentRule}`);

    return { firstDataIn, secondDataIn, pins, firstComp, logic };
  }, [parsedIni, currentRule]);

  const boardLayoutLabel = useMemo(() => {
    const def = parsedIni?.constants?.pages?.[1]?.pinLayout;
    if (def?.options && boardData.pinLayout !== undefined) {
      return def.options[boardData.pinLayout] || "Unknown Board";
    }
    return "Detecting Hardware...";
  }, [parsedIni, boardData.pinLayout]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 font-orbitron animate-pulse">
        Initializing Logic Engine...
      </div>
    );
  }

  const tabs = [1, 2, 3, 4, 5, 6, 7, 8];

  // Micro-UI Helper Components
  const SmallSelect = ({ label, value, options, onChange, theme = "cyan" }) => (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em] ml-1">
        {label}
      </span>
      <div className="relative group/select">
        <select
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className={`w-full bg-black/60 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-orbitron font-bold text-neon-${theme} outline-none focus:border-neon-${theme}/50 appearance-none cursor-pointer transition-all hover:bg-black/80`}
        >
          {options.map((opt, i) => (
            <option
              key={typeof opt === "string" ? i : opt.index}
              value={typeof opt === "string" ? i : opt.index}
              className="bg-bg-deep text-white"
            >
              {typeof opt === "string" ? opt : opt.label}
            </option>
          ))}
        </select>
        <div
          className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/10 group-hover/select:text-neon-${theme}`}
        >
          <ChevronDown size={10} />
        </div>
      </div>
    </div>
  );

  const SmallInput = ({
    label,
    value,
    onChange,
    units,
    theme = "cyan",
    step = 1,
  }) => (
    <div className="flex flex-col gap-1 w-24">
      <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em] ml-1">
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full bg-black/60 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-mono font-bold text-white outline-none focus:border-neon-cyan/50 text-center"
        />
        {units && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[7px] text-white/20 font-black">
            {units}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent select-none animate-in fade-in duration-700">
      <TuningHeader
        title="Programmable Outputs"
        description={`Hardware-aware Logic Engine — Current Board: ${boardLayoutLabel}`}
        icon={Cpu}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isDirty={isDirty}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        isConnected={isConnected}
        themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="max-w-[1400px] mx-auto space-y-4 pb-8">
          {/* Rules Navigation Bar */}
          <div className="bg-black/40 border border-white/5 rounded-2xl p-1 flex gap-1 mb-2">
            {tabs.map((num, idx) => (
              <button
                key={num}
                onClick={() => setCurrentRule(idx)}
                className={`flex-1 py-2 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all duration-300 relative ${
                  currentRule === idx
                    ? "bg-neon-cyan/10 border-neon-cyan/40 text-neon-cyan shadow-glow-cyan/10"
                    : "border-transparent text-white/30 hover:text-white hover:bg-white/5"
                }`}
              >
                Rule {num}
                {pageData[`outputPin${idx}`] > 0 && (
                  <div
                    className={`absolute top-1.5 right-1.5 w-1 h-1 rounded-full ${currentRule === idx ? "bg-neon-cyan neon-pulse" : "bg-white/20"}`}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-9 space-y-4">
              {/* Universal Hardware & Timing Bar */}
              <section className="p-5 rounded-[28px] glass-card border border-white/5 bg-black/20">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3 pr-6 border-r border-white/5">
                    <div className="w-1.5 h-6 bg-neon-cyan rounded-full shadow-glow-cyan" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                      Hardware & Timing
                    </span>
                  </div>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4">
                    <SmallSelect
                      label="Output Pin"
                      value={getVal("outputPin")}
                      options={iniOptions.pins}
                      onChange={(v) => updateField("outputPin", v)}
                    />
                    <SmallSelect
                      label="Logic Polarity"
                      value={getVal("outputInverted")}
                      options={["Normal", "Inverted"]}
                      onChange={(v) => updateField("outputInverted", v)}
                    />
                    <SmallInput
                      label="Activation Delay"
                      value={getVal("outputDelay") / 10}
                      units="s"
                      step={0.1}
                      onChange={(v) =>
                        updateField("outputDelay", Math.round(v * 10))
                      }
                    />
                    <SmallInput
                      label="Hysteresis"
                      value={getVal("hysteresis")}
                      onChange={(v) => updateField("hysteresis", v)}
                    />
                    <SmallInput
                      label="Time Limit"
                      value={getVal("outputTimeLimit") / 10}
                      units="s"
                      step={0.1}
                      onChange={(v) =>
                        updateField("outputTimeLimit", Math.round(v * 10))
                      }
                    />
                  </div>
                </div>
              </section>

              {/* Ultra-Compact Logic Engine */}
              <section className="p-5 rounded-[28px] glass-card border border-white/5 bg-black/20 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-1.5 h-6 bg-neon-blue rounded-full shadow-glow-blue" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">
                    Logic Engine
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Condition 1 */}
                  <div className="flex items-center gap-3 bg-black/40 p-4 rounded-xl border border-white/5 group/row">
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-white/5 text-[8px] font-black text-white/20">
                      01
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-7">
                        <SmallSelect
                          label="Source Variable"
                          value={getVal("firstDataIn")}
                          options={iniOptions.firstDataIn}
                          onChange={(v) => updateField("firstDataIn", v)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <SmallSelect
                          label="Operator"
                          value={getVal("firstCompType")}
                          options={iniOptions.firstComp}
                          onChange={(v) => updateField("firstCompType", v)}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <SmallInput
                          label="Threshold Value"
                          value={getVal("firstTarget")}
                          onChange={(v) => updateField("firstTarget", v)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Joiner */}
                  <div className="flex justify-center -my-3 relative z-10">
                    <select
                      value={getVal("bitwise")}
                      onChange={(e) =>
                        updateField("bitwise", parseInt(e.target.value))
                      }
                      className="bg-bg-deep border border-neon-purple/50 text-neon-purple rounded-lg px-6 py-1 text-[8px] font-orbitron font-black uppercase tracking-widest focus:outline-none shadow-glow-purple cursor-pointer hover:border-white transition-all appearance-none text-center"
                    >
                      {iniOptions.logic.map((opt) => (
                        <option key={opt.index} value={opt.index}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Condition 2 */}
                  {getVal("bitwise") > 0 ? (
                    <div className="flex items-center gap-3 bg-black/40 p-4 rounded-xl border border-white/5 animate-in slide-in-from-top-2">
                      <div className="w-6 h-6 rounded flex items-center justify-center bg-white/5 text-[8px] font-black text-white/20">
                        02
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-7">
                          <SmallSelect
                            label="Source Variable"
                            value={getVal("secondDataIn")}
                            options={iniOptions.secondDataIn}
                            onChange={(v) => updateField("secondDataIn", v)}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <SmallSelect
                            label="Operator"
                            value={getVal("secondCompType")}
                            options={iniOptions.firstComp}
                            onChange={(v) => updateField("secondCompType", v)}
                            theme="purple"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <SmallInput
                            label="Threshold Value"
                            value={getVal("secondTarget")}
                            onChange={(v) => updateField("secondTarget", v)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-white/5 border border-dashed border-white/10 rounded-xl flex items-center justify-center">
                      <span className="text-[8px] font-black text-white/10 uppercase tracking-widest">
                        Secondary condition disabled
                      </span>
                    </div>
                  )}
                </div>
              </section>
            </div>            {/* Micro-Sidebar */}
            <div className="xl:col-span-3 space-y-4">
               {(() => {
                 const getLabel = (list, val) => {
                   if (!list) return "None";
                   const found = list.find(opt => (typeof opt === 'object' ? opt.index === val : false));
                   if (found) return found.label;
                   return list[val] || "None"; // Fallback for simple string arrays
                 };

                 return (
                   <div className="p-5 rounded-[28px] border border-neon-cyan/20 bg-neon-cyan/5 text-neon-cyan space-y-4 shadow-glow-cyan/5">
                      <div className="flex items-center gap-2">
                         <Target size={14} />
                         <span className="text-[9px] font-black uppercase tracking-widest">Logic Preview</span>
                      </div>
                      <p className="text-[10px] font-mono leading-relaxed lowercase opacity-80 break-words">
                         if ({getLabel(iniOptions.firstDataIn, getVal("firstDataIn"))}{" "}
                         {getLabel(iniOptions.firstComp, getVal("firstCompType"))}{" "}
                         {getVal("firstTarget")})
                         {getVal("bitwise") > 0 && (
                            <> <br/>{getLabel(iniOptions.logic, getVal("bitwise"))} <br/> ({getLabel(iniOptions.secondDataIn, getVal("secondDataIn"))} {getLabel(iniOptions.firstComp, getVal("secondCompType"))} {getVal("secondTarget")})</>
                         )}
                      </p>
                   </div>
                 );
               })()}

               <div className="p-5 rounded-[28px] border border-white/5 bg-black/40 space-y-3">
                <div className="flex items-center gap-2 text-white/40">
                  <Cpu size={14} />
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    Hardware Info
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px]">
                    <span className="text-gray-500 uppercase font-black">
                      Current Board
                    </span>
                    <span className="text-white font-bold">
                      {boardLayoutLabel}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-gray-500 uppercase font-black">
                      Rule Status
                    </span>
                    <span
                      className={`font-bold ${getVal("outputPin") > 0 ? "text-neon-cyan" : "text-gray-700"}`}
                    >
                      {getVal("outputPin") > 0 ? "ENABLED" : "DISABLED"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
