import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ChevronDown, Lock, Pin, Waypoints } from "lucide-react";
import { useStore } from "../../../core/store.js";
import { buildPinRegistry, getPinOptionsForField } from "../utils/pinRegistry";
import { getDecodedPages } from "../utils/projectConstants.js";

function formatOptionTitle(option) {
  if (!option) return "Unavailable";
  if (option.stateLabel === "Assigned Pin") return `Pin ${option.label}`;
  return option.label;
}

export default function PinSelect({
  label,
  fieldName,
  value,
  onChange,
  description,
  icon: Icon,
  disabled = false,
}) {
  const parsedIni = useStore((s) => s.parsedIni);
  const currentProject = useStore((s) => s.currentProject);
  const decodedPages = useMemo(
    () => getDecodedPages(currentProject?.constants, parsedIni),
    [currentProject?.constants, parsedIni],
  );

  const registry = useMemo(
    () => buildPinRegistry(parsedIni, decodedPages),
    [parsedIni, decodedPages],
  );

  const options = useMemo(
    () =>
      getPinOptionsForField(
        fieldName,
        parsedIni,
        decodedPages,
        registry,
        value,
      ),
    [decodedPages, fieldName, parsedIni, registry, value],
  );

  const currentOption =
    options.find((option) => option.index === Number(value)) || options[0];
  const currentOwners = currentOption?.owners || [];
  const availableCount = options.filter((option) => !option.disabled).length;
  const usedOptions = options.filter((option) => option.owners.length > 0);
  const reservedPreview = usedOptions.slice(0, 6);

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      const clickedInsideContainer = containerRef.current?.contains(
        event.target,
      );
      const clickedInsideMenu = menuRef.current?.contains(event.target);
      if (!clickedInsideContainer && !clickedInsideMenu) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return undefined;

    const updatePosition = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const availableBelow = viewportHeight - rect.bottom - 12;
      const maxHeight = Math.min(288, Math.max(180, availableBelow));

      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const selectionTone =
    currentOwners.length > 0
      ? "border-[#7f1d1d] bg-[#3f0d12] text-[#fecaca]"
      : currentOption?.assignmentState === "default"
        ? "border-[#164e63] bg-[#083344] text-[#a5f3fc]"
        : currentOption?.assignmentState === "none"
          ? "border-[#27272a] bg-[#18181b] text-[#a1a1aa]"
          : "border-[#14532d] bg-[#052e16] text-[#bbf7d0]";

  const handleSelect = (option) => {
    if (
      disabled ||
      option?.disabled ||
      (option?.owners?.length > 0 && option.index !== Number(value))
    ) {
      return;
    }
    onChange(option.index);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`group relative isolate flex flex-col gap-4 rounded-[28px] border border-[#1f2937] bg-[#050505] p-4 transition-all duration-300 hover:border-[#2a3441] ${disabled ? "pointer-events-none opacity-40" : ""}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={14} className="text-white/30" />}
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#71717a]">
              {label}
            </span>
          </div>
          {description && (
            <p className="text-[9px] font-bold leading-relaxed text-[#71717a]">
              {description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] ${selectionTone}`}
            >
              {currentOption?.stateLabel || "Unavailable"}
            </span>
            <span className="rounded-full border border-[#27272a] bg-[#111111] px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-[#71717a]">
              {availableCount} selectable
            </span>
            {usedOptions.length > 0 && (
              <span className="rounded-full border border-[#78350f] bg-[#451a03] px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-[#fde68a]">
                {usedOptions.length} reserved
              </span>
            )}
          </div>
        </div>

        <div className="relative w-full">
          <button
            ref={triggerRef}
            type="button"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
            className={`w-full rounded-2xl border border-[#27272a] bg-black px-4 py-3 text-left outline-none transition-all hover:border-[#3f3f46] hover:bg-[#0b0b0b] focus:border-[#155e75] ${isOpen ? "border-[#0e7490]" : ""}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[11px] font-orbitron font-black uppercase text-[#e4e4e7]">
                  {formatOptionTitle(currentOption)}
                </div>
                {currentOwners.length > 0 && (
                  <div className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#fca5a5]">
                    Assigned to{" "}
                    {currentOwners
                      .map((owner) => owner.displayLabel)
                      .join(", ")}
                  </div>
                )}
              </div>
              <ChevronDown
                size={14}
                className={`shrink-0 text-[#71717a] transition-transform transition-colors group-hover:text-[#d4d4d8] ${isOpen ? "rotate-180 text-[#d4d4d8]" : ""}`}
              />
            </div>
          </button>

          {isOpen &&
            menuStyle &&
            createPortal(
              <div
                ref={menuRef}
                style={menuStyle}
                className="z-[9999] overflow-y-auto rounded-2xl border border-[#27272a] bg-black p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.98)]"
              >
                <div className="space-y-1" role="listbox" aria-label={label}>
                  {options.map((option) => {
                    const isCurrent = option.index === Number(value);
                    const title = formatOptionTitle(option);
                    const hasOwners = option.owners.length > 0;
                    const isLocked =
                      option.disabled || (hasOwners && !isCurrent);
                    const ownerText = option.owners
                      .map(
                        (owner) =>
                          `${owner.displayLabel}${owner.isActive ? "" : " (inactive)"}`,
                      )
                      .join(", ");

                    return (
                      <button
                        key={option.index}
                        type="button"
                        role="option"
                        aria-selected={isCurrent}
                        disabled={isLocked}
                        onClick={() => handleSelect(option)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all ${
                          isLocked
                            ? "cursor-not-allowed border-[#7f1d1d] bg-[#3f0d12] opacity-100"
                            : hasOwners
                              ? "border-[#78350f] bg-[#451a03]"
                              : isCurrent
                                ? "border-[#155e75] bg-[#083344]"
                                : "border-[#18181b] bg-[#090909] hover:border-[#27272a] hover:bg-[#101010]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {option.assignmentState === "explicit" ? (
                                <Pin
                                  size={12}
                                  className={
                                    isLocked
                                      ? "text-[#fecaca]"
                                      : "text-[#d4d4d8]"
                                  }
                                />
                              ) : (
                                <Waypoints
                                  size={12}
                                  className="text-[#71717a]"
                                />
                              )}
                              <span
                                className={`truncate text-[11px] font-orbitron font-black uppercase ${isLocked ? "text-[#fff1f2]" : "text-[#f4f4f5]"}`}
                              >
                                {title}
                              </span>
                            </div>
                            {hasOwners && (
                              <div
                                className={`mt-1 text-[9px] font-bold uppercase tracking-[0.12em] ${isLocked ? "text-[#fecdd3]" : "text-[#fde68a]"}`}
                              >
                                Assigned to: {ownerText}
                              </div>
                            )}
                            {!hasOwners &&
                              option.assignmentState === "explicit" && (
                                <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#71717a]">
                                  Available pin
                                </div>
                              )}
                          </div>

                          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                            {isCurrent && (
                              <span className="rounded-full border border-[#155e75] bg-[#083344] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#a5f3fc]">
                                Current
                              </span>
                            )}
                            {isLocked && !isCurrent && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#991b1b] bg-[#450a0a] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#fecaca]">
                                <Lock size={9} />
                                Locked
                              </span>
                            )}
                            {hasOwners && (
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] ${
                                  isLocked
                                    ? "border-[#be123c] bg-[#4c0519] text-[#fecdd3]"
                                    : "border-[#78350f] bg-[#451a03] text-[#fde68a]"
                                }`}
                              >
                                In Use
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>,
              document.body,
            )}
        </div>
      </div>

      {/* Temporarily hidden:
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="rounded-2xl border border-[#27272a] bg-[#0a0a0a] px-4 py-3">
          <div className="flex items-center gap-2">
            <Info size={13} className="text-[#71717a]" />
            <span className="text-[8px] font-black uppercase tracking-[0.18em] text-[#71717a]">
              Current Selection
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-orbitron font-black uppercase text-[#f4f4f5]">
              {currentOption?.assignmentState === "explicit" ? `Pin ${currentOption.label}` : currentOption?.label || "Unavailable"}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] ${selectionTone}`}>
              {currentOption?.stateLabel || "Unavailable"}
            </span>
          </div>
          {currentOwners.length > 0 && (
            <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#fca5a5]">
              Assigned to: {currentOwners.map((owner) => owner.displayLabel).join(", ")}
            </p>
          )}
          {currentOwners.length === 0 && currentOption?.assignmentState === "none" && (
            <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#71717a]">
              No physical pin is claimed for this mode.
            </p>
          )}
          {currentOwners.length === 0 && currentOption?.assignmentState === "default" && (
            <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#71717a]">
              Routing follows the active board default instead of an explicit manual pin.
            </p>
          )}
        </div>

        {usedOptions.length > 0 && (
          <div className="rounded-2xl border border-[#78350f] bg-[#1c1303] px-4 py-3">
            <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[#fde68a]">
              Reserved Pins
            </div>
            <div className="mt-2 space-y-1.5">
              {reservedPreview.map((option) => (
                <div key={option.index} className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#fef3c7]">
                  Pin {option.label}: used by {option.owners.map((owner) => owner.displayLabel).join(", ")}
                </div>
              ))}
              {usedOptions.length > reservedPreview.length && (
                <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#a16207]">
                  +{usedOptions.length - reservedPreview.length} more reserved pins
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#27272a] bg-[#0a0a0a] px-4 py-3">
        <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[#71717a]">
          Selection Rules
        </div>
        <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#71717a]">
          Reserved pins are locked in the dropdown. If this field already holds a conflicting pin, that current value stays visible so you can see the conflict and move away from it safely.
        </p>
      </div>
      */}

      {currentOwners.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#7f1d1d] bg-[#3f0d12] px-4 py-3 text-[#fecaca]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.18em]">
              Existing conflict
            </div>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#ffe4e6]">
              {currentOption?.label} is already used by{" "}
              {currentOwners.map((owner) => owner.displayLabel).join(", ")}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
