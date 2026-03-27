import React from "react";

/**
 * Standard Neon SelectField for Tuning Modules.
 * Ensures consistent mapping of labels/options from INI metadata.
 */
export const SelectField = ({
  name,
  label,
  icon: Icon,
  disabled = false,
  theme = "cyan",
  getValue,
  getFieldInfo,
  updateValue,
  className = "",
}) => {
  const val = getValue(name);
  const info = getFieldInfo(name);

  // Handle mapping from INI metadata
  // info.meta.options or info.meta.labels are standard for bitfields
  const availableOptions = info?.meta?.options || info?.meta?.labels || [];
  const filteredOptions = availableOptions
    .map((opt, i) => ({ label: opt, value: i }))
    .filter((o) => o.label && o.label.toUpperCase() !== "INVALID");

  return (
    <div
      className={`p-6 rounded-3xl glass-card border border-white/5 transition-all ${
        disabled ? "opacity-20 grayscale pointer-events-none" : `hover:border-neon-${theme}/30`
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
          {Icon && <Icon size={12} className={`text-neon-${theme} opacity-40`} />}
          {label}
        </span>
      </div>
      <select
        value={val}
        onChange={(e) => updateValue(name, parseInt(e.target.value, 10))}
        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-white outline-none focus:border-neon-cyan/50 transition-all appearance-none cursor-pointer"
      >
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-bg-deep text-white">
              {opt.label}
            </option>
          ))
        ) : (
          <option value={val}>No Options Def</option>
        )}
      </select>
    </div>
  );
};
