import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Cpu, FileWarning, X } from "lucide-react";

export default function IniMismatchDialog({
  isOpen,
  onClose,
  onReview,
  details,
}) {
  if (!isOpen || !details) return null;

  const projectName = details.projectName || "Current Project";
  const projectSignature = details.projectSignature || "Unknown";
  const ecuSignature = details.ecuSignature || "Unknown";
  const iniPath = details.iniPath || "(embedded only)";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/82 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 18 }}
          className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-white/5 bg-[#0c1017]/95 shadow-2xl backdrop-blur-xl"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-neon-yellow/80 via-white/18 to-transparent" />

          <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-neon-yellow/10 to-neon-red/6 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neon-yellow bg-neon-yellow/10 text-neon-yellow">
                <AlertTriangle size={22} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-neon-yellow/75">
                  Compatibility Warning
                </div>
                <h2 className="mt-1 text-lg font-orbitron font-bold uppercase tracking-[0.16em] text-white">
                  INI Signature Mismatch
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="rounded-[24px] border border-yellow-200 bg-neon-yellow/8 px-5 py-4">
              <div className="flex items-start gap-3">
                <FileWarning
                  size={18}
                  className="mt-0.5 shrink-0 text-neon-yellow"
                />
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-white">
                    The connected ECU firmware does not match the INI embedded
                    in this project.
                  </div>
                  <p className="text-[11px] uppercase leading-relaxed tracking-[0.12em] text-white/48">
                    Automatic sync checks and output-channel polling were
                    skipped for safety. Review the project INI before writing,
                    burning, or trusting live decoded values.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-red-600 bg-white/[0.03] px-4 py-4">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.24em] text-white/35">
                  <Cpu size={12} className="text-neon-red/80" />
                  ECU Signature
                </div>
                <div className="mt-2 font-mono text-sm text-neon-red">
                  {ecuSignature}
                </div>
              </div>

              <div className="rounded-[22px] border border-neon-cyan bg-white/[0.03] px-4 py-4">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.24em] text-white/35">
                  <FileWarning size={12} className="text-neon-cyan/80" />
                  Project Signature
                </div>
                <div className="mt-2 font-mono text-sm text-neon-cyan">
                  {projectSignature}
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/6 bg-white/[0.03] px-4 py-4">
              <div className="text-[9px] font-black uppercase tracking-[0.24em] text-white/35">
                Project Source
              </div>
              <div className="mt-2 text-[11px] font-orbitron font-bold uppercase tracking-[0.14em] text-white">
                {projectName}
              </div>
              <div className="mt-2 break-all font-mono text-[11px] text-white/42">
                {iniPath}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={onClose}
                className="rounded-2xl  bg-red-500 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/72 transition-all hover:bg-white/10 hover:text-white"
              >
                Continue Carefully
              </button>
              <button
                onClick={onReview}
                className="inline-flex items-center justify-center gap-2 rounded-2xl  bg-neon-orange px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/72 transition-all hover:bg-neon-yellow/20"
              >
                Review Communications
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
