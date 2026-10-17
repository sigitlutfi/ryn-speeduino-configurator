import PinSelect from "../shared/components/PinSelect";
import React, { useState, useMemo } from "react";
import { useStore } from "../../core/store";
import {
  Cpu,
  Target,
  AlertTriangle,
} from "lucide-react";
import { programmableOutputsSchema } from "../shared/schemas";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import {
  SelectRow,
  InputField,
} from "../shared/components/TuningComponents";

const ARRAY_RULE_FIELDS = new Set([
  "outputDelay",
  "outputTimeLimit",
  "firstTarget",
  "secondTarget",
]);

const RULE_COUNT = 8;

const PROGRAMMABLE_OUTPUT_DEFAULTS = (() => {
  const defaults = {};
  defaults.outputDelay = new Array(RULE_COUNT).fill(0);
  defaults.outputTimeLimit = new Array(RULE_COUNT).fill(0);
  defaults.firstTarget = new Array(RULE_COUNT).fill(0);
  defaults.secondTarget = new Array(RULE_COUNT).fill(0);

  for (let i = 0; i < RULE_COUNT; i += 1) {
    defaults[`outputInverted${i}`] = 0;
    defaults[`kindOfLimiting${i}`] = 0;
    defaults[`outputPin${i}`] = 0;
    defaults[`firstDataIn${i}`] = 0;
    defaults[`secondDataIn${i}`] = 0;
    defaults[`firstCompType${i}`] = 0;
    defaults[`secondCompType${i}`] = 0;
    defaults[`bitwise${i}`] = 0;
  }
  return defaults;
})();

function getRuleFieldValue(pageData, name, ruleIndex) {
  if (ARRAY_RULE_FIELDS.has(name)) {
    const values = Array.isArray(pageData?.[name]) ? pageData[name] : [];
    return values[ruleIndex] ?? 0;
  }

  return pageData?.[`${name}${ruleIndex}`] ?? 0;
}

function setRuleFieldValue(pageDraft, name, ruleIndex, value) {
  if (ARRAY_RULE_FIELDS.has(name)) {
    const nextValues = Array.isArray(pageDraft?.[name])
      ? [...pageDraft[name]]
      : [...PROGRAMMABLE_OUTPUT_DEFAULTS[name]];
    nextValues[ruleIndex] = value;
    return {
      ...pageDraft,
      [name]: nextValues,
    };
  }

  return {
    ...pageDraft,
    [`${name}${ruleIndex}`]: value,
  };
}

function buildValidationPayload(pageData) {
  const payload = {};

  for (let i = 0; i < RULE_COUNT; i += 1) {
    payload[`outputInverted${i}`] = getRuleFieldValue(pageData, "outputInverted", i);
    payload[`kindOfLimiting${i}`] = getRuleFieldValue(pageData, "kindOfLimiting", i);
    payload[`outputPin${i}`] = getRuleFieldValue(pageData, "outputPin", i);
    payload[`outputDelay${i}`] = getRuleFieldValue(pageData, "outputDelay", i);
    payload[`firstDataIn${i}`] = getRuleFieldValue(pageData, "firstDataIn", i);
    payload[`secondDataIn${i}`] = getRuleFieldValue(pageData, "secondDataIn", i);
    payload[`outputTimeLimit${i}`] = getRuleFieldValue(pageData, "outputTimeLimit", i);
    payload[`firstTarget${i}`] = getRuleFieldValue(pageData, "firstTarget", i);
    payload[`secondTarget${i}`] = getRuleFieldValue(pageData, "secondTarget", i);
    payload[`firstCompType${i}`] = getRuleFieldValue(pageData, "firstCompType", i);
    payload[`secondCompType${i}`] = getRuleFieldValue(pageData, "secondCompType", i);
    payload[`bitwise${i}`] = getRuleFieldValue(pageData, "bitwise", i);
  }

  return payload;
}

/**
 * Modernized Programmable Outputs Module
 * Uses standardized TuningComponents for consistent UI/UX.
 */
export default function ProgrammableOutputs() {
  const { parsedIni, currentProject } = useStore();
  const [currentRule, setCurrentRule] = useState(0);
  const [validationErrors, setValidationErrors] = useState({});
  const currentPage13 =
    currentProject?.constants?.decodedPages?.[13] ||
    currentProject?.constants?.decodedPages?.["13"] ||
    {};

  // Constants mapping logic
  const {
    pinPages,
    localConstants,
    setLocalPage,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isConnected,
    isDirty,
    isReady,
  } = useTuningModule([13], {
    onValidate: (data) => {
      const mergedPage13 = {
        ...PROGRAMMABLE_OUTPUT_DEFAULTS,
        ...currentPage13,
        ...(data[13] || {}),
      };
      const result = programmableOutputsSchema.safeParse(
        buildValidationPayload(mergedPage13),
      );
      if (!result.success) {
        const nextErrors = {};
        result.error.issues.forEach((issue) => {
          const fieldName = issue.path?.[0];
          if (fieldName) nextErrors[fieldName] = issue.message;
        });
        setValidationErrors(nextErrors);
        return false;
      }
      setValidationErrors({});
      return result.success;
    },
  });

  const pageData = {
    ...PROGRAMMABLE_OUTPUT_DEFAULTS,
    ...currentPage13,
    ...(localConstants[13] || {}),
  };
  const boardData =
    currentProject?.constants?.decodedPages?.[1] ||
    currentProject?.constants?.decodedPages?.[0] ||
    {};

  const getVal = (name) => getRuleFieldValue(pageData, name, currentRule);
  const normalizeValue = (val) => {
    if (typeof val === "number" && Number.isFinite(val)) return val;
    return 0;
  };
  const updateField = (name, val) => {
    const normalizedValue = normalizeValue(val);
    const nextPageDraft = setRuleFieldValue(
      pageData,
      name,
      currentRule,
      normalizedValue,
    );
    setLocalPage(13, nextPageDraft);
    setValidationErrors((prev) => {
      const fieldKey = `${name}${currentRule}`;
      if (!prev[fieldKey]) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };
  const getFieldError = (name) => validationErrors[`${name}${currentRule}`];

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
    const polarity = clean(`outputInverted${currentRule}`);
    const limiting = clean(`kindOfLimiting${currentRule}`);
    const firstComp = page13[`firstCompType${currentRule}`]?.options || [
      "==",
      "!=",
      ">",
      ">=",
      "<",
      "<=",
    ];
    const logic = clean(`bitwise${currentRule}`);

    return {
      firstDataIn,
      secondDataIn,
      polarity,
      limiting,
      firstComp,
      logic,
    };
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
            <div className="xl:col-span-9 space-y-4" style={{ WebkitAppRegion: "no-drag" }}>
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
                    <PinSelect fieldName={`outputPin${currentRule}`} decodedPages={pinPages} label="Output Pin"
                      value={getVal("outputPin")}
                      onChange={(v) => updateField("outputPin", v)}
                      description={getFieldError("outputPin")}
                    />
                    <SelectRow
                      label="Logic Polarity"
                      value={getVal("outputInverted")}
                      options={iniOptions.polarity}
                      onChange={(v) => updateField("outputInverted", v)}
                      description={getFieldError("outputInverted")}
                    />
                    <InputField
                      label="Activation Delay"
                      value={getVal("outputDelay") / 10}
                      units="s"
                      step={0.1}
                      onChange={(v) =>
                        updateField("outputDelay", Math.round(v * 10))
                      }
                      description={getFieldError("outputDelay")}
                    />
                    <SelectRow
                      label="Limit Mode"
                      value={getVal("kindOfLimiting")}
                      options={iniOptions.limiting}
                      onChange={(v) => updateField("kindOfLimiting", v)}
                      description={getFieldError("kindOfLimiting")}
                    />
                    <InputField
                      label="Time Limit"
                      value={getVal("outputTimeLimit") / 10}
                      units="s"
                      step={0.1}
                      onChange={(v) =>
                        updateField("outputTimeLimit", Math.round(v * 10))
                      }
                      description={getFieldError("outputTimeLimit")}
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
                        <SelectRow
                          label="Source Variable"
                          value={getVal("firstDataIn")}
                          options={iniOptions.firstDataIn}
                          onChange={(v) => updateField("firstDataIn", v)}
                          description={getFieldError("firstDataIn")}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <SelectRow
                          label="Operator"
                          value={getVal("firstCompType")}
                          options={iniOptions.firstComp}
                          onChange={(v) => updateField("firstCompType", v)}
                          description={getFieldError("firstCompType")}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <InputField
                          label="Threshold Value"
                          value={getVal("firstTarget")}
                          onChange={(v) => updateField("firstTarget", v)}
                          description={getFieldError("firstTarget")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Joiner */}
                  <div className="flex justify-center -my-3 relative z-10">
                    <div className="w-full max-w-xs">
                      <SelectRow
                        label="Join Logic"
                        value={getVal("bitwise")}
                        onChange={(v) => updateField("bitwise", v)}
                        options={iniOptions.logic}
                        description={getFieldError("bitwise")}
                      />
                    </div>
                  </div>
                  {/* Condition 2 */}
                  {getVal("bitwise") > 0 ? (
                    <div className="flex items-center gap-3 bg-black/40 p-4 rounded-xl border border-white/5 animate-in slide-in-from-top-2">
                      <div className="w-6 h-6 rounded flex items-center justify-center bg-white/5 text-[8px] font-black text-white/20">
                        02
                      </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-7">
                        <SelectRow
                          label="Source Variable"
                          value={getVal("secondDataIn")}
                          options={iniOptions.secondDataIn}
                          onChange={(v) => updateField("secondDataIn", v)}
                          description={getFieldError("secondDataIn")}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <SelectRow
                          label="Operator"
                          value={getVal("secondCompType")}
                          options={iniOptions.firstComp}
                          onChange={(v) => updateField("secondCompType", v)}
                          description={getFieldError("secondCompType")}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <InputField
                          label="Threshold Value"
                          value={getVal("secondTarget")}
                          onChange={(v) => updateField("secondTarget", v)}
                          description={getFieldError("secondTarget")}
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
            </div>{" "}
            {/* Micro-Sidebar */}
            <div className="xl:col-span-3 space-y-4">
              {(() => {
                const getLabel = (list, val) => {
                  if (!list) return "None";
                  const found = list.find((opt) =>
                    typeof opt === "object" ? opt.index === val : false,
                  );
                  if (found) return found.label;
                  return list[val] || "None"; // Fallback for simple string arrays
                };

                return (
                  <div className="p-5 rounded-[28px] border border-neon-cyan/20 bg-neon-cyan/5 text-neon-cyan space-y-4 shadow-glow-cyan/5">
                    <div className="flex items-center gap-2">
                      <Target size={14} />
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        Logic Preview
                      </span>
                    </div>
                    <p className="text-[10px] font-mono leading-relaxed lowercase opacity-80 break-words">
                      if (
                      {getLabel(iniOptions.firstDataIn, getVal("firstDataIn"))}{" "}
                      {getLabel(iniOptions.firstComp, getVal("firstCompType"))}{" "}
                      {getVal("firstTarget")})
                      {getVal("bitwise") > 0 && (
                        <>
                          {" "}
                          <br />
                          {getLabel(
                            iniOptions.logic,
                            getVal("bitwise"),
                          )} <br /> (
                          {getLabel(
                            iniOptions.secondDataIn,
                            getVal("secondDataIn"),
                          )}{" "}
                          {getLabel(
                            iniOptions.firstComp,
                            getVal("secondCompType"),
                          )}{" "}
                          {getVal("secondTarget")})
                        </>
                      )}
                    </p>
                  </div>
                );
              })()}

              {Object.keys(validationErrors).some((key) => key.endsWith(String(currentRule))) && (
                <div className="p-5 rounded-[28px] border border-neon-red/30 bg-neon-red/10 text-neon-red space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      Rule {currentRule + 1} Validation
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[10px] font-bold">
                    {Object.entries(validationErrors)
                      .filter(([key]) => key.endsWith(String(currentRule)))
                      .map(([key, message]) => (
                        <div key={key} className="leading-relaxed">
                          {key}: {message}
                        </div>
                      ))}
                  </div>
                </div>
              )}

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
