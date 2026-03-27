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
      text: "text-neon-cyan",
      bg: "bg-neon-cyan/10",
      border: "border-neon-cyan/30",
      glow: "shadow-[0_0_15px_rgba(0,255,249,0.2)]",
      btn: "bg-neon-cyan text-black hover:bg-white",
    },
    purple: {
      text: "text-neon-purple",
      bg: "bg-neon-purple/10",
      border: "border-neon-purple/30",
      glow: "shadow-[0_0_15px_rgba(168,85,247,0.2)]",
      btn: "bg-neon-purple text-white hover:bg-white hover:text-black",
    },
    yellow: {
      text: "text-yellow-400",
      bg: "bg-yellow-400/10",
      border: "border-yellow-400/30",
      glow: "shadow-[0_0_15px_rgba(250,204,21,0.2)]",
      btn: "bg-yellow-400 text-black hover:bg-white",
    },
    green: {
      text: "text-neon-green",
      bg: "bg-neon-green/10",
      border: "border-neon-green/30",
      glow: "shadow-[0_0_15px_rgba(57,255,20,0.2)]",
      btn: "bg-neon-green text-black hover:bg-white",
    },
  };

  const theme = themes[themeColor] || themes.cyan;

  return (
    <div className="relative mx-8 mb-6 mt-6">
      {/* Background Glass Plate */}
      <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-md rounded-3xl border border-white/5 shadow-2xl pointer-events-none" />

      <div className="relative px-8 py-6 flex flex-col lg:flex-row justify-between items-center gap-6">
        {/* Title & Description Section */}
        <div className="flex items-center gap-6 w-full lg:w-auto">
          <div
            className={`p-4 rounded-2xl ${theme.bg} ${theme.border} ${theme.glow} transition-all duration-500`}
          >
            {Icon ? (
              <Icon className={`w-8 h-8 ${theme.text}`} />
            ) : (
              <Cpu className={`w-8 h-8 ${theme.text}`} />
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
          <div className="flex items-center transition-all duration-500 overflow-hidden">
            {saveStatus === "success" && (
              <div className="flex items-center gap-2 text-neon-green mr-4 animate-in slide-in-from-right-4">
                <CheckCircle2 size={16} />
                <span className="text-[9px] font-orbitron font-black uppercase tracking-widest">
                  Synced
                </span>
              </div>
            )}
            {saveStatus === "error" && (
              <div className="flex items-center gap-2 text-red-500 mr-4 animate-in slide-in-from-right-4">
                <AlertCircle size={16} />
                <span className="text-[9px] font-orbitron font-black uppercase tracking-widest">
                  Error
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onDiscard}
            disabled={isSaving || !isDirty}
            className="group flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20 active:scale-95"
          >
            <RotateCcw className="w-4 h-4 group-hover:rotate-[-45deg] transition-transform" />
            <span className="text-[10px] font-orbitron font-black uppercase tracking-widest">
              Discard
            </span>
          </button>

          <button
            onClick={onSave}
            disabled={isSaving}
            className={`group flex items-center gap-2 px-5 py-3 rounded-xl border transition-all active:scale-95 ${
              isDirty
                ? "bg-white/10 border-white/20 text-white shadow-xl hover:bg-white/20"
                : "bg-white/5 border-white/5 text-gray-500 opacity-50"
            }`}
          >
            <Save
              size={16}
              className={isSaving && !isConnected ? "animate-spin" : ""}
            />
            <span className="text-[10px] font-orbitron font-black uppercase tracking-widest">
              Save
            </span>
          </button>

          <button
            onClick={onBurn}
            disabled={isSaving || !isConnected}
            className={`flex items-center gap-3 px-8 py-3 rounded-xl font-orbitron font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-95 border border-white/20 ${
              isConnected
                ? `${theme.btn} shadow-${themeColor}-500/20`
                : "bg-white/5 text-white/20 cursor-not-allowed border-white/5 grayscale"
            }`}
          >
            {isConnected ? (
              <>
                <Zap
                  size={16}
                  className={`${isConnected ? "fill-current" : ""} ${isSaving ? "animate-pulse" : ""}`}
                />
                Burn
              </>
            ) : (
              <>
                <Unplug size={16} />
                Offline
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
