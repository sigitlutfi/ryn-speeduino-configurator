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

/**
 * Premium Tuning Header Component
 * Inspired by high-end racing dashboards.
 */
export default function TuningHeader({
  title,
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
  const themes = {
    cyan: {
      text: "#00d4ff",
      bg: "rgba(0, 212, 255, 0.1)",
      border: "rgba(0, 212, 255, 0.3)",
      glow: "shadow-[0_0_15px_rgba(0,212,255,0.2)]",
      btn: "bg-[#00d4ff] text-black hover:bg-white",
    },
    orange: {
      text: "#f97316",
      bg: "rgba(249, 115, 22, 0.1)",
      border: "rgba(249, 115, 22, 0.3)",
      glow: "shadow-[0_0_15px_rgba(249,115,22,0.2)]",
      btn: "bg-[#f97316] text-white hover:bg-white hover:text-black",
    },
    red: {
      text: "#ef4444",
      bg: "rgba(239, 68, 68, 0.1)",
      border: "rgba(239, 68, 68, 0.3)",
      glow: "shadow-[0_0_15px_rgba(239,68,68,0.2)]",
      btn: "bg-[#ef4444] text-white hover:bg-white hover:text-black",
    },
    green: {
      text: "#10b981",
      bg: "rgba(16, 185, 129, 0.1)",
      border: "rgba(16, 185, 129, 0.3)",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.2)]",
      btn: "bg-[#10b981] text-black hover:bg-white",
    },
  };

  const theme = themes[themeColor] || themes.cyan;
  const isBusy = !!isSaving;
  const saveLabel = isBusy ? "Saving..." : "Save";
  const burnLabel = isBusy ? "Working..." : isConnected ? "Burn" : "Offline";
  const discardLabel = isBusy ? "Locked" : "Discard";
  const statusTone =
    saveStatus === "success"
      ? "text-neon-green"
      : saveStatus === "error"
        ? "text-red-500"
        : isBusy
          ? "text-neon-cyan"
          : "text-gray-500";
  const statusCopy =
    saveStatus === "success"
      ? "Synced"
      : saveStatus === "error"
        ? "Failed"
        : isBusy
          ? "Working"
          : isDirty
            ? "Pending"
            : "Ready";

  return (
    <div className="relative mx-8 mb-6 mt-6">
      {/* Background Glass Plate */}
      <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-md rounded-3xl border border-white/5 shadow-2xl pointer-events-none" />

      <div className="relative px-8 py-6 flex flex-col lg:flex-row justify-between items-center gap-6">
        {/* Title & Description Section */}
        <div className="flex items-center gap-6 w-full lg:w-auto">
          <div
            className={`p-4 rounded-2xl ${theme.border ? "border" : ""} ${theme.glow} transition-all duration-500`}
            style={{ 
              backgroundColor: theme.bg,
              borderColor: theme.border 
            }}
          >
            {Icon ? (
              <Icon className="w-8 h-8" style={{ color: theme.text }} />
            ) : (
              <Cpu className="w-8 h-8" style={{ color: theme.text }} />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-orbitron font-black text-white uppercase tracking-[0.2em] leading-none">
                {title}
              </h1>

              {isDirty && (
                <div className="px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 animate-in zoom-in duration-300">
                  <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 animate-pulse">
                    Modified
                  </span>
                </div>
              )}
            </div>

            {description && (
              <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] opacity-60 font-medium max-w-xl">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Global Hardware Status (Center)
        <div className="hidden xl:flex items-center gap-8 px-8 border-x border-white/5 h-12">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">
              ECU STATUS
            </span>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? "bg-neon-green shadow-[0_0_8px_#39ff14]" : "bg-red-500 shadow-[0_0_8px_#ff0000]"} animate-pulse`}
              />
              <span
                className={`text-[10px] font-orbitron font-bold uppercase tracking-widest ${isConnected ? "text-neon-green" : "text-red-500"}`}
              >
                {isConnected ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          </div>
          {!isConnected && (
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
              <Unplug size={16} />
            </div>
          )}
        </div> */}

        {/* Action Buttons Section */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
          {/* Status Indicators */}
          <div className="flex items-center transition-all duration-500 overflow-hidden mr-2">
            <div className={`flex items-center gap-2 ${statusTone}`}>
              {saveStatus === "success" ? (
                <CheckCircle2 size={16} />
              ) : saveStatus === "error" ? (
                <AlertCircle size={16} />
              ) : isBusy ? (
                <Save size={16} className="animate-spin" />
              ) : (
                <div className={`w-2 h-2 rounded-full ${isDirty ? "bg-neon-orange animate-pulse" : "bg-white/20"}`} />
              )}
              <span className="text-[9px] font-orbitron font-black uppercase tracking-widest">
                {statusCopy}
              </span>
            </div>
          </div>

          <button
            onClick={onDiscard}
            disabled={isBusy || !isDirty}
            className="group flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed active:scale-95"
          >
            <RotateCcw className="w-4 h-4 group-hover:rotate-[-45deg] transition-transform" />
            <span className="text-[10px] font-orbitron font-black uppercase tracking-widest">
              {discardLabel}
            </span>
          </button>

          <button
            onClick={onSave}
            disabled={isBusy || !isDirty}
            className={`group flex items-center gap-2 px-5 py-3 rounded-xl border transition-all active:scale-95 ${
              !isBusy && isDirty
                ? "bg-white/10 border-white/20 text-white shadow-xl hover:bg-white/20"
                : "bg-white/5 border-white/5 text-gray-500 opacity-50 cursor-not-allowed"
            }`}
          >
            <Save
              size={16}
              className={isBusy ? "animate-spin" : ""}
            />
            <span className="text-[10px] font-orbitron font-black uppercase tracking-widest">
              {saveLabel}
            </span>
          </button>

          <button
            onClick={onBurn}
            disabled={isBusy || !isConnected || !isDirty}
            className={`flex items-center gap-3 px-8 py-3 rounded-xl font-orbitron font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-95 border border-white/20 ${
              !isBusy && isConnected && isDirty
                ? `${theme.btn} shadow-${themeColor}-500/20`
                : "bg-white/5 text-white/20 cursor-not-allowed border-white/5 grayscale"
            }`}
          >
            {isConnected ? (
              <>
                <Zap
                  size={16}
                  className={`${isConnected ? "fill-current" : ""} ${isBusy ? "animate-pulse" : ""}`}
                />
                {burnLabel}
              </>
            ) : (
              <>
                <Unplug size={16} />
                {burnLabel}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Edge Accent (Neon line at the bottom) */}
      <div
        className={`absolute bottom-0 left-8 right-8 h-[2px] ${theme.bg} rounded-full blur-[1px] opacity-50`}
      />
      <div
        className={`absolute bottom-0 left-12 right-12 h-[1px] ${theme.bg.replace("/10", "/30")} rounded-full`}
      />
    </div>
  );
}
