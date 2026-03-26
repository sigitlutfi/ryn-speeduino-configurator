import React from "react";
import { useStore } from "../../core/store";
import { Image, Ghost, Sliders, Trash2, Camera } from "lucide-react";
import TuningHeader from "../shared/components/TuningHeader";

const AppearanceSettings = () => {
  const { settings, updateSettings, notify } = useStore();

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

  const handleBlurChange = (e) => {
    updateSettings({ backgroundBlur: parseInt(e.target.value) });
  };

  return (
    <div className="flex flex-col h-full bg-transparent select-none animate-in fade-in duration-700 font-inter">
      <TuningHeader
        title="Appearance"
        icon={Camera}
        description="Customize your workspace atmosphere with background images and glassmorphism effects"
        themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
        <div className="max-w-[800px] mx-auto space-y-8">
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
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;
