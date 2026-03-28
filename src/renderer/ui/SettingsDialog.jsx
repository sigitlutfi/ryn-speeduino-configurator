import React from 'react';
import { useStore } from '../core/store.js';
import { X, Settings, Monitor, Database, Activity, Volume2, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function Toggle({ label, sublabel, icon: Icon, value, onChange }) {
  return (
    <div className="flex items-center justify-between p-4 glass border border-white/5 rounded-2xl hover:border-white/10 transition-all group">
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-lg transition-colors ${value ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-white/5 text-gray-500'}`}>
          <Icon size={18} />
        </div>
        <div>
          <div className="text-xs text-gray-200 font-bold uppercase tracking-wider">{label}</div>
          {sublabel && <div className="text-[9px] text-gray-500 uppercase tracking-widest">{sublabel}</div>}
        </div>
      </div>
      <button 
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full relative transition-all duration-300 ${value ? 'bg-neon-cyan/40' : 'bg-white/10'}`}
      >
        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 ${value ? 'right-1 bg-neon-cyan shadow-[0_0_10px_rgba(0,212,255,0.5)]' : 'left-1 bg-gray-600'}`} />
      </button>
    </div>
  );
}

export default function SettingsDialog({ isOpen, onClose }) {
  const { settings, updateSettings, currentProject } = useStore();
  const ini = currentProject?.ini;

  const handlePickDirectory = async () => {
    const path = await window.projects.pickDirectory();
    if (path) {
      updateSettings({ logDirectory: path });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-bg-deep/80 backdrop-blur-sm"
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-xl glass-strong rounded-[32px] border border-white/10 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neon-cyan/20 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan">
                <Settings size={20} />
              </div>
              <div>
                <h2 className="text-lg font-orbitron font-bold text-white uppercase tracking-widest">Global Preferences</h2>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">App-wide environment settings</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            
            {/* Environment Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-orbitron font-bold text-neon-cyan uppercase tracking-widest opacity-60">
                <Activity size={12} /> Connectivity & Environment
              </div>
              
              <Toggle 
                label="Auto-Reconnect" 
                sublabel="Restore connection on USB dropout"
                icon={Activity}
                value={settings.autoReconnect}
                onChange={(v) => updateSettings({ autoReconnect: v })}
              />

              <Toggle 
                label="Sound Notifications" 
                sublabel="Audio feedback for system events"
                icon={Volume2}
                value={settings.soundEnabled}
                onChange={(v) => updateSettings({ soundEnabled: v })}
              />

              {/* Log Directory Picker */}
              <div className="p-4 glass border border-white/5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-white/5 text-gray-400">
                      <FolderOpen size={18} />
                    </div>
                    <div>
                      <div className="text-xs text-gray-200 font-bold uppercase tracking-wider">Log Directory</div>
                      <div className="text-[9px] text-gray-500 uppercase tracking-widest">Where CSV logs are stored</div>
                    </div>
                  </div>
                  <button 
                    onClick={handlePickDirectory}
                    className="px-4 py-2 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/30 rounded-xl text-[10px] font-bold text-neon-cyan uppercase tracking-widest transition-all"
                  >
                    Change
                  </button>
                </div>
                {settings.logDirectory && (
                  <div className="px-3 py-2 bg-black/40 rounded-lg border border-white/5">
                    <p className="text-[9px] text-gray-400 font-mono break-all leading-relaxed">
                      {settings.logDirectory}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Appearance Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-orbitron font-bold text-neon-purple uppercase tracking-widest opacity-60">
                <Monitor size={12} /> Workspace Skin (Accent)
              </div>
              <div className="p-4 glass border border-white/5 rounded-2xl flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-300 uppercase tracking-wider font-bold">Accent Color</span>
                  <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Global Highlights</span>
                </div>
                <div className="flex gap-4">
                  {[
                    { id: 'cyan', color: 'bg-[#00d4ff]' },
                    { id: 'red', color: 'bg-[#ff003c]' },
                    { id: 'green', color: 'bg-[#00ffb4]' },
                    { id: 'purple', color: 'bg-[#d672ff]' },
                    { id: 'orange', color: 'bg-[#ff6600]' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => updateSettings({ accentColor: c.id })}
                      className={`w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                        settings.accentColor === c.id 
                          ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
                          : 'border-transparent opacity-40 hover:opacity-100 hover:scale-105'
                      } ${c.color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Firmware Info (Read-only Summary) */}
            {ini && (ini.signature || ini.path) && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest opacity-60">
                  <Database size={12} /> Background Firmware
                </div>
                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Signature</span>
                    <span className="text-[11px] text-neon-cyan font-mono">{ini.signature || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest overflow-hidden text-ellipsis whitespace-nowrap mr-4">INI Loader</span>
                    <span className="text-[9px] text-gray-400 font-mono text-right truncate max-w-[200px]" title={ini.path}>
                      {ini.path?.split(/[\\/]/).pop() || 'None'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-black/60 border-t border-white/5 flex justify-end items-center gap-4">
            <span className="text-[9px] text-gray-600 uppercase tracking-widest mr-auto">Settings saved automatically</span>
            <button
              onClick={onClose}
              className="px-10 py-3 bg-neon-cyan text-bg-deep text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all hover:opacity-90 shadow-[0_0_20px_rgba(0,212,255,0.3)]"
            >
              Finish
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
