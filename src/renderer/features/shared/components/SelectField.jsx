import React from "react";
import PinSelect from './PinSelect';
import { isPinAssignmentField } from '../utils/pinRegistry.js';

function normalizeOptionItem(opt, index) {
  if (typeof opt === "string") {
    return { label: opt, value: index };
  }
  if (!opt || typeof opt !== "object") {
    return null;
  }
  const label =
    opt.label ?? opt.name ?? (opt.value !== undefined ? String(opt.value) : "");
  const value = opt.value ?? opt.index ?? index;
  return { ...opt, label, value };
}

/**
 * Standard Neon SelectField for Tuning Modules.
 * Ensures consistent mapping of labels/options from INI metadata.
 */
export const SelectField = ({
  page,
  name,
  label,
  description,
  icon: Icon,
  disabled = false,
  theme = "cyan",
  getValue,
  getFieldInfo,
  updateValue,
  value: propValue,
  onChange: propOnChange,
  options: propOptions,
  error,
  className = "",
  pinPages,
}) => {
  const val = getValue
    ? page !== undefined
      ? getValue(page, name)
      : getValue(name)
    : propValue;
  const info = getFieldInfo ? getFieldInfo(name) : null;

  const handleChange = (nextVal) => {
    if (updateValue) {
      if (page !== undefined) {
        updateValue(page, name, nextVal);
      } else {
        updateValue(name, nextVal);
      }
      return;
    }
    propOnChange?.(nextVal);
  };

  if (name && isPinAssignmentField(name, info?.meta)) {
    return (
      <PinSelect
        fieldName={name}
        label={label}
        description={description}
        icon={Icon}
        value={val}
        className={className}
        onChange={handleChange}
        disabled={disabled}
        decodedPages={pinPages}
      />
    );
  }

  // Handle mapping from INI metadata or explicit options prop
  const availableOptions =
    propOptions || info?.meta?.options || info?.meta?.labels || [];

  // CRITICAL: Preserve original indices! Don't re-index after filtering
  const filteredOptions = availableOptions
    .map(normalizeOptionItem)
    .filter((o) => o && o.label && o.label.toUpperCase() !== "INVALID");

  return (
    <div
      className={`p-6 rounded-3xl glass-card border transition-all ${
        error
          ? "border-neon-red shadow-glow-red/20"
          : "border-white/10"
      } ${
        disabled
          ? "opacity-20 grayscale pointer-events-none"
          : `hover:border-neon-${theme}/30`
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
          {Icon && <Icon size={12} className={`text-neon-${theme} opacity-40`} />}
          {label}
        </span>
      </div>
      <select
        aria-label={label}
        value={val ?? 0}
        disabled={disabled}
        onChange={(e) => handleChange(parseInt(e.target.value, 10))}
        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-[10px] font-orbitron font-black uppercase text-white outline-none focus:border-neon-cyan/50 transition-all appearance-none cursor-pointer"
      >
        {filteredOptions.length > 0 && !filteredOptions.some(opt => Number(opt.value) === Number(val)) &&
          <option value={val ?? 0} disabled>Unavailable (INI value {val ?? 0})</option>}
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={opt.disabled}
              className="bg-bg-deep text-white"
            >
              {opt.label}
            </option>
          ))
        ) : (
          <option value={val ?? 0}>No Options Def</option>
        )}
      </select>
      {description && (
        <p className="text-[8px] text-gray-500 font-bold uppercase mt-2 leading-tight">
          {description}
        </p>
      )}
      {error && (
        <p className="mt-2 text-[8px] font-black text-neon-red uppercase">
          {error}
        </p>
      )}
    </div>
  );
};
