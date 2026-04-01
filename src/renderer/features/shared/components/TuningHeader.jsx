import React from "react";
import {
  Save,
  RotateCcw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Unplug,
} from "lucide-react";

const THEME_MAP = {
  white: {
    iconWrap:
      "border-white/15 bg-white/8 text-white shadow-[0_18px_48px_rgba(255,255,255,0.08)]",
    accent: "from-white/70 via-white/25 to-transparent",
    chip: "border-white/15 bg-white/8 text-white/80",
    burnBtn: "border-white/30 bg-white text-black hover:bg-white/90",
  },
  cyan: {
    iconWrap:
      "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan shadow-[0_18px_48px_rgba(59,231,255,0.12)]",
    accent: "from-neon-cyan/80 via-neon-cyan/25 to-transparent",
    chip: "border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan",
    burnBtn: "border-neon-cyan/35 bg-neon-cyan text-black hover:bg-[#7ff1ff]",
  },
  blue: {
    iconWrap:
      "border-neon-blue/25 bg-neon-blue/10 text-neon-blue shadow-[0_18px_48px_rgba(77,124,255,0.14)]",
    accent: "from-neon-blue/80 via-neon-blue/25 to-transparent",
    chip: "border-neon-blue/20 bg-neon-blue/10 text-neon-blue",
    burnBtn: "border-neon-blue/35 bg-neon-blue text-white hover:bg-[#6b8dff]",
  },
  green: {
    iconWrap:
      "border-neon-green/25 bg-neon-green/10 text-neon-green shadow-[0_18px_48px_rgba(105,240,174,0.12)]",
    accent: "from-neon-green/80 via-neon-green/25 to-transparent",
    chip: "border-neon-green/20 bg-neon-green/10 text-neon-green",
    burnBtn: "border-neon-green/35 bg-neon-green text-black hover:bg-[#93f5c1]",
  },
  yellow: {
    iconWrap:
      "border-neon-yellow/25 bg-neon-yellow/10 text-neon-yellow shadow-[0_18px_48px_rgba(255,209,102,0.12)]",
    accent: "from-neon-yellow/80 via-neon-yellow/25 to-transparent",
    chip: "border-neon-yellow/20 bg-neon-yellow/10 text-neon-yellow",
    burnBtn:
      "border-neon-yellow/35 bg-neon-yellow text-black hover:bg-[#ffe19a]",
  },
  orange: {
    iconWrap:
      "border-neon-orange/25 bg-neon-orange/10 text-neon-orange shadow-[0_18px_48px_rgba(255,138,61,0.14)]",
    accent: "from-neon-orange/80 via-neon-orange/25 to-transparent",
    chip: "border-neon-orange/20 bg-neon-orange/10 text-neon-orange",
    burnBtn:
      "border-neon-orange/35 bg-neon-orange text-white hover:bg-[#ff9f66]",
  },
  red: {
    iconWrap:
      "border-neon-red/25 bg-neon-red/10 text-neon-red shadow-[0_18px_48px_rgba(255,95,87,0.14)]",
    accent: "from-neon-red/80 via-neon-red/25 to-transparent",
    chip: "border-neon-red/20 bg-neon-red/10 text-neon-red",
    burnBtn: "border-neon-red/35 bg-neon-red text-white hover:bg-[#ff7d77]",
  },
  purple: {
    iconWrap:
      "border-neon-purple/25 bg-neon-purple/10 text-neon-purple shadow-[0_18px_48px_rgba(168,85,247,0.14)]",
    accent: "from-neon-purple/80 via-neon-purple/25 to-transparent",
    chip: "border-neon-purple/20 bg-neon-purple/10 text-neon-purple",
    burnBtn:
      "border-neon-purple/35 bg-neon-purple text-white hover:bg-[#c084fc]",
  },
  magenta: {
    iconWrap:
      "border-neon-magenta/25 bg-neon-magenta/10 text-neon-magenta shadow-[0_18px_48px_rgba(217,70,239,0.14)]",
    accent: "from-neon-magenta/80 via-neon-magenta/25 to-transparent",
    chip: "border-neon-magenta/20 bg-neon-magenta/10 text-neon-magenta",
    burnBtn:
      "border-neon-magenta/35 bg-neon-magenta text-white hover:bg-[#e879f9]",
  },
};

function getStatusMeta({ saveStatus, isBusy, isDirty }) {
  if (saveStatus === "success") {
    return {
      icon: CheckCircle2,
      tone: "text-neon-green",
      label: "Saved",
    };
  }

  if (saveStatus === "error") {
    return {
      icon: AlertCircle,
      tone: "text-neon-red",
      label: "Failed",
    };
  }

  if (isBusy) {
    return {
      icon: Save,
      tone: "text-neon-cyan",
      label: "Working",
      iconClass: "animate-spin",
    };
  }

  return {
    icon: null,
    tone: isDirty ? "text-neon-orange" : "text-white/35",
    label: isDirty ? "Pending" : "Ready",
  };
}

export default function TuningHeader({
  title,
  subtitle,
  icon: Icon,
  description,
  isSaving,
  saveStatus,
  isConnected,
  onSave,
  onBurn,
  onDiscard,
  isDirty,
  themeColor = "cyan",
}) {
  const theme = THEME_MAP[themeColor] || THEME_MAP.cyan;
  const isBusy = !!isSaving;
  const statusMeta = getStatusMeta({ saveStatus, isBusy, isDirty });
  const StatusIcon = statusMeta.icon;
  const descriptionCopy = description || subtitle;

  const saveLabel = isBusy ? "Saving..." : "Save";
  const burnLabel = isBusy ? "Working..." : isConnected ? "Burn" : "Offline";
  const discardLabel = isBusy ? "Locked" : "Discard";

  return (
    <div className="relative mx-8 mb-6 mt-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px] border border-white/5 bg-white/[0.03] backdrop-blur-md shadow-[0_24px_80px_rgba(0,0,0,0.26)]">
        <div
          className={`absolute inset-0 `}
          style={{
            "--header-accent":
              themeColor === "white"
                ? "rgba(0, 0, 0, 0.17)"
                : themeColor === "cyan"
                  ? "rgba(59,231,255,0.18)"
                  : themeColor === "blue"
                    ? "rgba(77,124,255,0.18)"
                    : themeColor === "green"
                      ? "rgba(105,240,174,0.18)"
                      : themeColor === "yellow"
                        ? "rgba(255,209,102,0.18)"
                        : themeColor === "orange"
                          ? "rgba(255,138,61,0.18)"
                          : themeColor === "red"
                            ? "rgba(255,95,87,0.18)"
                            : themeColor === "purple"
                              ? "rgba(168,85,247,0.18)"
                              : themeColor === "magenta"
                                ? "rgba(217,70,239,0.18)"
                                : "rgba(59,231,255,0.18)",
          }}
        />
      </div>

      <div className="relative flex flex-col gap-5 px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border ${theme.iconWrap}`}
            >
              {Icon ? (
                <Icon className="h-8 w-8" />
              ) : (
                <Cpu className="h-8 w-8" />
              )}
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-orbitron font-black uppercase tracking-[0.18em] text-white sm:text-xl xl:text-2xl">
                  {title}
                </h1>
                {isDirty && (
                  <span className="rounded-full border border-neon-orange/20 bg-neon-orange/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-neon-orange">
                    Modified
                  </span>
                )}
              </div>

              {descriptionCopy && (
                <p className="max-w-3xl text-[10px] font-medium uppercase tracking-[0.18em] text-white/42">
                  {descriptionCopy}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:min-w-[460px] xl:items-end">
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <div className={`flex items-center gap-2 ${statusMeta.tone}`}>
              {StatusIcon ? (
                <StatusIcon
                  className={`h-4 w-4 ${statusMeta.iconClass || ""}`}
                />
              ) : (
                <div
                  className={`h-2 w-2 rounded-full ${
                    isDirty ? "bg-neon-orange animate-pulse" : "bg-white/20"
                  }`}
                />
              )}
              <span className="text-[9px] font-orbitron font-black uppercase tracking-[0.16em]">
                {statusMeta.label}
              </span>
            </div>

            <button
              type="button"
              onClick={onDiscard}
              disabled={isBusy || !isDirty}
              className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/55 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
            >
              <RotateCcw className="h-4 w-4 transition-transform group-hover:rotate-[-45deg]" />
              <span className="text-[10px] font-orbitron font-black uppercase tracking-[0.16em]">
                {discardLabel}
              </span>
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={isBusy || !isDirty}
              className={`group flex items-center gap-2 rounded-xl border px-4 py-3 transition-all ${
                !isBusy && isDirty
                  ? "border-white/20 bg-white/10 text-white hover:border-white/30 hover:bg-white/16"
                  : "cursor-not-allowed border-white/5 bg-white/5 text-white/28"
              }`}
            >
              <Save className={`h-4 w-4 ${isBusy ? "animate-spin" : ""}`} />
              <span className="text-[10px] font-orbitron font-black uppercase tracking-[0.16em]">
                {saveLabel}
              </span>
            </button>

            {isConnected && (
              <button
                type="button"
                onClick={onBurn}
                disabled={isBusy || !isDirty}
                className={`flex items-center gap-2 rounded-xl border px-6 py-3 transition-all ${
                  !isBusy && isDirty
                    ? `${theme.burnBtn} shadow-[0_18px_48px_rgba(0,0,0,0.18)]`
                    : "cursor-not-allowed border-white/5 bg-white/5 text-white/20 grayscale"
                }`}
              >
                <Zap className={`h-4 w-4 ${isBusy ? "animate-pulse" : ""}`} />
                <span className="text-[10px] font-orbitron font-black uppercase tracking-[0.18em]">
                  {burnLabel}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
