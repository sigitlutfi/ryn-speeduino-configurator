import React from "react";
import { useStore } from "../../core/store";
import {
  Image,
  Ghost,
  Sliders,
  Trash2,
  Camera,
  Activity,
  Volume2,
  FolderOpen,
  Palette,
  Database,
  Settings,
} from "lucide-react";

const GlobalPreferencesPage = () => {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const notify = useStore((s) => s.notify);
  const currentProject = useStore((s) => s.currentProject);
  const ini = currentProject?.ini;

  const handlePickImage = async () => {
    try {
      const path = await window.projects.pickImage();
      if (path) {
        updateSettings({ backgroundImage: path });
        notify("Background image updated", "success");
      }
    } catch (err) {
      notify("Failed to pick image", "error");
    }
  };

  const clearImage = () => {
    updateSettings({ backgroundImage: null });
    notify("Background image removed", "info");
  };

  const handlePickDirectory = async () => {
    const path = await window.projects.pickDirectory();
    if (path) {
      updateSettings({ logDirectory: path });
      notify("Log directory updated", "success");
    }
  };

  const handleBlurChange = (e) => {
    updateSettings({ backgroundBlur: parseInt(e.target.value) });
  };

  return (
    <div className="flex flex-col h-full bg-transparent select-none animate-in fade-in duration-700 font-inter">
      <div className="mx-8 mb-6 mt-6 rounded-[32px] border border-white/10 bg-white/[0.03] px-8 py-7 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan shadow-[0_0_20px_rgba(34,211,238,0.12)]">
            <Settings size={26} />
          </div>
          <div className="space-y-2">
            <div className="text-[11px] font-black uppercase tracking-[0.35em] text-neon-cyan/80">
              Configurator
            </div>
            <h1 className="font-orbitron text-2xl font-black uppercase tracking-[0.16em] text-white">
              Global Preferences
            </h1>
            <p className="max-w-3xl text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
              Unified configurator settings for environment, appearance, logging,
              and workspace behavior.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
        <div className="max-w-[800px] mx-auto space-y-8">
          <section className="p-8 rounded-[40px] glass-card border border-white/10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-6 bg-neon-cyan rounded-full shadow-glow-cyan" />
              <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
                Connectivity & Environment
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                type="button"
                onClick={() =>
                  updateSettings({ autoReconnect: !settings.autoReconnect })
                }
                className={`p-5 rounded-3xl border text-left transition-all ${
                  settings.autoReconnect
                    ? "border-neon-cyan/30 bg-neon-cyan/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Activity
                    size={16}
                    className={
                      settings.autoReconnect ? "text-neon-cyan" : "text-white/40"
                    }
                  />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">
                    Auto-Reconnect
                  </span>
                </div>
                <p className="text-[10px] text-white/40 leading-relaxed">
                  Restore connection automatically after temporary USB or serial dropouts.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  updateSettings({ soundEnabled: !settings.soundEnabled })
                }
                className={`p-5 rounded-3xl border text-left transition-all ${
                  settings.soundEnabled
                    ? "border-neon-cyan/30 bg-neon-cyan/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Volume2
                    size={16}
                    className={
                      settings.soundEnabled ? "text-neon-cyan" : "text-white/40"
                    }
                  />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">
                    Sound Notifications
                  </span>
                </div>
                <p className="text-[10px] text-white/40 leading-relaxed">
                  Play feedback sounds for system events and status changes.
                </p>
              </button>
            </div>

            <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <FolderOpen size={16} className="text-neon-cyan" />
                  <div>
                    <div className="text-[10px] font-black text-white uppercase tracking-widest">
                      Log Directory
                    </div>
                    <div className="text-[9px] text-white/35 uppercase tracking-wider">
                      CSV export destination
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePickDirectory}
                  className="px-4 py-2 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/30 rounded-xl text-[10px] font-black text-neon-cyan uppercase tracking-widest transition-all"
                >
                  Change
                </button>
              </div>
              <div className="px-4 py-3 bg-black/30 rounded-2xl border border-white/5">
                <p className="text-[10px] text-white/45 font-mono break-all leading-relaxed">
                  {settings.logDirectory || "Not set"}
                </p>
              </div>
            </div>
          </section>

          <section className="p-8 rounded-[40px] glass-card border border-white/10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-6 bg-neon-purple rounded-full shadow-glow-purple" />
              <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
                Theme Accent
              </h3>
            </div>

            <div className="flex flex-wrap gap-4">
              {[
                { id: "cyan", color: "bg-[#00d4ff]" },
                { id: "red", color: "bg-[#ff003c]" },
                { id: "green", color: "bg-[#00ffb4]" },
                { id: "purple", color: "bg-[#d672ff]" },
                { id: "orange", color: "bg-[#ff6600]" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => updateSettings({ accentColor: option.id })}
                  className={`w-12 h-12 rounded-full border-2 transition-all ${
                    settings.accentColor === option.id
                      ? "border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.35)]"
                      : "border-transparent opacity-50 hover:opacity-100"
                  } ${option.color}`}
                  title={option.id}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white/35 uppercase tracking-wider">
              <Palette size={14} />
              Accent color updates global highlights across the workspace.
            </div>
          </section>

          {/* Background Selection */}
          <section className="p-8 rounded-[40px] glass-card border border-white/10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-6 bg-neon-cyan rounded-full shadow-glow-cyan" />
              <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
                Background Environment
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div 
                onClick={handlePickImage}
                className="aspect-video rounded-3xl border-2 border-dashed border-white/10 hover:border-neon-cyan/50 hover:bg-neon-cyan/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group"
              >
                {settings.backgroundImage ? (
                  <div className="relative w-full h-full p-2">
                    <img 
                      src={`atom:///${settings.backgroundImage.replace(/\\/g, '/')}`} 
                      className="w-full h-full object-cover rounded-2xl opacity-60 group-hover:opacity-100 transition-opacity" 
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                       <Image className="text-white drop-shadow-lg" size={32} />
                    </div>
                  </div>
                ) : (
                  <>
                    <Image className="text-gray-600 group-hover:text-neon-cyan transition-colors" size={40} />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-neon-cyan transition-colors">
                      Select Image
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-col justify-center space-y-4">
                <button
                  onClick={handlePickImage}
                  className="w-full py-4 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-[10px] font-black uppercase tracking-widest hover:bg-neon-cyan/20 transition-all flex items-center justify-center gap-2"
                >
                  <Image size={16} />
                  Change Background
                </button>
                <button
                  onClick={clearImage}
                  disabled={!settings.backgroundImage}
                  className="w-full py-4 rounded-2xl bg-neon-red/5 border border-neon-red/10 text-neon-red/60 text-[10px] font-black uppercase tracking-widest hover:bg-neon-red/10 disabled:opacity-20 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Remove Image
                </button>
              </div>
            </div>
          </section>

          {/* Visual Effects */}
          <section className="p-8 rounded-[40px] glass-card border border-white/10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-6 bg-neon-purple rounded-full shadow-glow-purple" />
              <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
                Glassmorphism Intensity
              </h3>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Ghost size={14} /> Blur Level
                  </span>
                  <span className="text-neon-purple font-mono">{settings.backgroundBlur}px</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="60"
                  step="1"
                  value={settings.backgroundBlur}
                  onChange={handleBlurChange}
                  className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-neon-purple"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Sliders size={14} /> Background Brightness
                  </span>
                  <span className="text-neon-purple font-mono">{settings.backgroundOpacity}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.backgroundOpacity}
                  onChange={(e) => updateSettings({ backgroundOpacity: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-neon-purple shadow-glow-purple/20"
                />
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] text-gray-500 font-medium leading-relaxed italic">
                   Note: Higher blur values improve readability of glass windows but require more GPU power. 15-25px is the recommended "sweet spot" for a premium feel.
                </p>
              </div>
            </div>
          </section>

          {ini && (ini.signature || ini.path) && (
            <section className="p-8 rounded-[40px] glass-card border border-white/10 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-6 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.2)]" />
                <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
                  Firmware Context
                </h3>
              </div>

              <div className="p-5 rounded-3xl bg-black/30 border border-white/10 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] text-white/35 uppercase tracking-widest">
                    Signature
                  </span>
                  <span className="text-[10px] text-neon-cyan font-mono">
                    {ini.signature || "Unknown"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] text-white/35 uppercase tracking-widest">
                    INI Loader
                  </span>
                  <span className="text-[10px] text-white/50 font-mono text-right truncate max-w-[320px]">
                    {ini.path?.split(/[\\/]/).pop() || "None"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-white/25 uppercase tracking-wider pt-2">
                  <Database size={14} />
                  Read-only project firmware summary
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalPreferencesPage;
