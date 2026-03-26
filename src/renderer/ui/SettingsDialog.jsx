import React from 'react';
import { useStore } from '../core/store.js';
import { X, Settings, Monitor, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsDialog({ isOpen, onClose }) {
  const { currentProject } = useStore();
  const ini = currentProject?.ini;

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
                <h2 className="text-lg font-orbitron font-bold text-white uppercase tracking-widest">Preferences</h2>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">App workspace settings</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-8 space-y-8">
            {/* Appearance */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-orbitron font-bold text-neon-purple uppercase tracking-widest opacity-60">
                <Monitor size={12} /> Appearance
              </div>
              <div className="p-4 glass border border-white/5 rounded-2xl">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-300 uppercase tracking-wider">Theme</span>
                  <span className="text-[10px] font-mono text-neon-cyan px-3 py-1 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">Neon Dark</span>
                </div>
              </div>
            </div>

            {/* Firmware info (only when project is open and has INI data) */}
            {ini && (ini.signature || ini.path) && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest opacity-60">
                  <Database size={12} /> Firmware
                </div>
                <div className="p-4 glass border border-white/5 rounded-2xl space-y-2">
                  {ini.signature && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest">Signature</span>
                      <span className="text-[11px] text-neon-cyan font-mono">{ini.signature}</span>
                    </div>
                  )}
                  {ini.version && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest">MT Version</span>
                      <span className="text-[11px] text-white font-mono">{ini.version}</span>
                    </div>
                  )}
                  {ini.path && (
                    <div className="flex justify-between items-start gap-4">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest shrink-0">INI Path</span>
                      <span className="text-[9px] text-gray-400 font-mono text-right max-w-[280px] truncate" title={ini.path}>
                        {ini.path}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!currentProject && (
              <p className="text-[10px] text-gray-600 uppercase tracking-widest text-center py-4">
                Open a project to see unit & firmware settings
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-black/40 border-t border-white/5 flex justify-end">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all border border-white/10"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
