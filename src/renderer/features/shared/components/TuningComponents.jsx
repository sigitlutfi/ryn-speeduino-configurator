import React, { useEffect, useState } from "react";
import { ChevronDown, HelpCircle, AlertTriangle } from "lucide-react";

/**
 * Standard Select Row for Tuning Modules
 */
export const SelectRow = ({
  label,
  value,
  onChange,
  options = [],
  description,
  icon: Icon,
  disabled = false,
}) => {
  // Filter out INVALID options if they are just strings
  const cleanOptions = Array.isArray(options)
    ? options
        .map((opt, i) =>
          typeof opt === "string" ? { label: opt, index: i } : opt,
        )
        .filter((opt) => opt.label && opt.label.toUpperCase() !== "INVALID")
    : [];

  return (
    <div
      className={`group relative flex flex-col gap-4 p-5 rounded-[32px] bg-black/20 border border-white/5 hover:border-white/10 transition-all duration-500 ${disabled ? "opacity-40 pointer-events-none" : ""}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={14} className="text-white/30" />}
            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
              {label}
            </span>
          </div>
          {description && (
            <p className="text-[9px] text-gray-500 font-bold leading-relaxed">
              {description}
            </p>
          )}
        </div>

        <div className="relative w-full">
          <select
            value={value ?? 0}
            disabled={disabled}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            className="w-full bg-black/40 border border-white/10 rounded-2xl pl-5 pr-10 py-3.5 text-[11px] font-orbitron font-black text-neon-cyan outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-all appearance-none cursor-pointer hover:bg-black/60 shadow-xl"
          >
            {cleanOptions.map((opt) => (
              <option
                key={opt.index}
                value={opt.index}
                className="bg-bg-deep text-white"
              >
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 group-hover:text-neon-cyan transition-colors">
            <ChevronDown size={14} />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Standard Input Field for Tuning Modules
 */
export const InputField = ({
  label,
  value,
  onChange,
  onBlur,
  rawInput = false,
  units,
  description,
  icon: Icon,
  step = 1,
  disabled = false,
}) => {
  const [draft, setDraft] = useState(String(value ?? 0));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(value ?? 0));
    }
  }, [value, isFocused]);

  return (
    <div
      className={`group relative flex flex-col gap-4 p-5 rounded-[32px] bg-black/20 border border-white/5 hover:border-white/10 transition-all duration-500 ${disabled ? "opacity-40 pointer-events-none" : ""}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={14} className="text-white/30" />}
            <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">
              {label}
            </span>
          </div>
          {description && (
            <p className="text-[9px] text-gray-500 font-bold leading-relaxed">
              {description}
            </p>
          )}
        </div>

        <div className="relative flex items-center w-full">
          <input
            type="number"
            step={step}
            value={draft}
            disabled={disabled}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              const nextDraft = e.target.value;
              setDraft(nextDraft);
              onChange(
                rawInput
                  ? nextDraft
                  : (nextDraft === "" ? 0 : parseFloat(nextDraft)),
              );
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-[11px] font-orbitron font-black text-white outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-all text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none hover:bg-black/60 shadow-xl"
          />
          {units && (
            <span className="absolute right-4 text-[9px] font-orbitron font-black text-white/20 uppercase pointer-events-none">
              {units}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Standard Toggle Row
 */
export const ToggleRow = ({ label, value, onChange, description }) => {
  const active = !!value;
  return (
    <div
      onClick={() => onChange(active ? 0 : 1)}
      className="group relative flex items-center justify-between p-6 rounded-[32px] bg-black/20 border border-white/5 hover:border-white/10 transition-all duration-500 cursor-pointer overflow-hidden"
    >
      <div
        className={`absolute inset-y-0 left-0 w-1 transition-all duration-500 ${active ? "bg-neon-cyan shadow-glow-cyan" : "bg-transparent"}`}
      />

      <div className="flex-1 pr-6">
        <span
          className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${active ? "text-white" : "text-white/40"}`}
        >
          {label}
        </span>
        {description && (
          <p className="text-[9px] text-gray-500 font-bold leading-relaxed mt-1">
            {description}
          </p>
        )}
      </div>

      <div
        className={`w-12 h-6 rounded-full p-1 transition-all duration-500 relative flex items-center ${active ? "bg-neon-cyan/20 border border-neon-cyan/40" : "bg-black/40 border border-white/10"}`}
      >
        <div
          className={`w-4 h-4 rounded-full transition-all duration-500 transform ${active ? "translate-x-6 bg-neon-cyan shadow-glow-cyan" : "translate-x-0 bg-white/10"}`}
        />
      </div>
    </div>
  );
};

/**
 * Professional Info Card
 */
export const InfoCard = ({ title, children, icon: Icon, theme = "cyan" }) => {
  const themes = {
    cyan: "border-neon-cyan/20 bg-neon-cyan/5 text-neon-cyan box-glow-cyan",
    yellow:
      "border-neon-yellow/20 bg-neon-yellow/5 text-neon-yellow box-glow-yellow",
    magenta:
      "border-neon-magenta/20 bg-neon-magenta/5 text-neon-magenta box-glow-magenta",
    purple:
      "border-neon-purple/20 bg-neon-purple/5 text-neon-purple box-glow-purple",
    gray: "border-white/10 bg-white/5 text-white/40",
  };

  return (
    <div
      className={`p-6 rounded-[32px] border ${themes[theme]} transition-all duration-500 hover:scale-[1.02]`}
    >
      <div className="flex items-center gap-3 mb-3">
        {Icon && <Icon size={18} />}
        <span className="text-[10px] font-orbitron font-black uppercase tracking-widest">
          {title}
        </span>
      </div>
      <div className="text-[9px] font-bold leading-relaxed opacity-80 uppercase tracking-wider">
        {children}
      </div>
    </div>
  );
};
