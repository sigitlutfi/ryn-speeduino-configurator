import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Download, Upload, GitCompare, X } from 'lucide-react';
import { useStore } from '../core/store.js';

export default function SyncDialog({ isOpen, onClose, diffResults }) {
  const { syncAllFromECU, uploadToECU, notify, operation } = useStore();
  const [loading, setLoading] = useState(false);

  if (!isOpen || !diffResults) return null;

  const { different, missing, matching, errors = [], pageStates = {} } = diffResults;
  const hasDifferences = different.length > 0 || missing.length > 0;
  const allPages = Object.keys(pageStates).map(Number).sort((a, b) => a - b);
  const mostlyMissing = missing.length > 0 && different.length <= 1 && missing.length >= matching.length;
  const recommendedAction = mostlyMissing ? "download" : "review";
  const activeOperation = operation?.scope === "sync" ? operation : null;
  const busy = loading || Boolean(activeOperation);
  const uploadDisabled = busy || (missing.length > 0 && different.length === 0);
  const totalSteps = Number.isFinite(activeOperation?.total) ? activeOperation.total : 0;
  const currentStep = Number.isFinite(activeOperation?.current) ? activeOperation.current : 0;
  const progressPercent = totalSteps > 0
    ? Math.max(0, Math.min(100, Math.round((currentStep / totalSteps) * 100)))
    : null;
  const stageLabelMap = {
    compare: "Comparing",
    read: "Reading",
    write: "Writing",
    verify: "Verifying",
    burn: "Burning",
    error: "Attention",
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      await syncAllFromECU();
      notify("Downloaded data from ECU successfully", "success");
      onClose();
    } catch (err) {
      notify(`Download failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    setLoading(true);
    try {
      // Upload only different pages
      const pagesToUpload = [...different];
      const result = await uploadToECU(pagesToUpload.length > 0 ? pagesToUpload : null);

      if (result.ok) {
        notify("Uploaded project to ECU successfully", "success");
        onClose();
      } else {
        notify("Upload completed with errors", "warning");
      }
    } catch (err) {
      notify(`Upload failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={busy ? undefined : onClose}
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl glass-strong rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-neon-yellow/10 to-neon-orange/10">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-neon-yellow" size={24} />
              <h2 className="text-lg font-orbitron font-bold text-white uppercase tracking-wider">
                ECU Sync Check
              </h2>
            </div>
            <button
              onClick={busy ? undefined : onClose}
              disabled={busy}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6">
            {activeOperation && (
              <div className="space-y-3 rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-orbitron font-bold uppercase tracking-widest text-neon-cyan/80">
                      {stageLabelMap[activeOperation.stage] || "Working"}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {activeOperation.label}
                    </div>
                  </div>
                  {totalSteps > 0 && (
                    <div className="text-right">
                      <div className="text-lg font-bold text-neon-cyan">{progressPercent}%</div>
                      <div className="text-xs text-gray-400">
                        {Math.min(currentStep, totalSteps)} / {totalSteps} pages
                      </div>
                    </div>
                  )}
                </div>

                {totalSteps > 0 && (
                  <div className="h-2 overflow-hidden rounded-full bg-black/30">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-green"
                      initial={false}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    />
                  </div>
                )}

                <div className="text-xs text-gray-300">
                  {activeOperation.type === "pull"
                    ? "Project sedang menarik data dari ECU. Tunggu sampai semua halaman selesai dibaca dan diverifikasi."
                    : activeOperation.type === "upload"
                      ? "Project sedang mengirim data ke ECU. Popup ini akan tetap terbuka sampai penulisan dan burn selesai."
                      : activeOperation.type === "write"
                        ? "Project sedang menulis perubahan ke RAM ECU dan melakukan verifikasi baca balik."
                        : "Operasi sinkronisasi ECU sedang berjalan."}
                </div>
              </div>
            )}

            {hasDifferences ? (
              <>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-neon-yellow/10 border border-neon-yellow/30">
                  <AlertTriangle className="text-neon-yellow flex-shrink-0 mt-0.5" size={20} />
                  <div className="text-sm text-gray-300">
                    <p className="font-semibold text-white mb-1">Data Mismatch Detected</p>
                    <p>
                      {recommendedAction === "download"
                        ? "This project looks new or incomplete. The safest next step is to pull data from the ECU into the project."
                        : "Your project file differs from ECU memory. Review the direction carefully before overwriting either side."}
                    </p>
                  </div>
                </div>

                {/* Status Summary */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-neon-green/10 border border-neon-green/30 text-center">
                    <div className="text-2xl font-bold text-neon-green">{matching.length}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Matching</div>
                  </div>
                  <div className="p-4 rounded-xl bg-neon-orange/10 border border-neon-orange/30 text-center">
                    <div className="text-2xl font-bold text-neon-orange">{different.length}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Different</div>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-500/10 border border-gray-500/30 text-center">
                    <div className="text-2xl font-bold text-gray-400">{missing.length}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Missing</div>
                  </div>
                  {errors.length > 0 && (
                    <div className="p-4 rounded-xl bg-neon-red/10 border border-neon-red/30 text-center">
                      <div className="text-2xl font-bold text-neon-red">{errors.length}</div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Errors</div>
                    </div>
                  )}
                </div>

                {/* Affected Pages */}
                {different.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-orbitron font-bold text-gray-500 uppercase tracking-widest">
                      Different Pages
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {different.map(pageId => (
                        <span
                          key={pageId}
                          className="px-3 py-1 rounded-lg bg-neon-orange/20 border border-neon-orange/40 text-neon-orange text-sm font-mono"
                        >
                          Page {pageId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {missing.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-orbitron font-bold text-gray-500 uppercase tracking-widest">
                      Missing Local Snapshots
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {missing.map(pageId => (
                        <span
                          key={pageId}
                          className="px-3 py-1 rounded-lg bg-gray-500/20 border border-gray-500/40 text-gray-200 text-sm font-mono"
                        >
                          Page {pageId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {allPages.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-orbitron font-bold text-gray-500 uppercase tracking-widest">
                      Page Status
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allPages.map((pageId) => {
                        const state = pageStates[pageId];
                        const tone =
                          state === "verified"
                            ? "bg-neon-green/20 border-neon-green/40 text-neon-green"
                            : state === "different"
                              ? "bg-neon-orange/20 border-neon-orange/40 text-neon-orange"
                              : state === "missing-local"
                                ? "bg-gray-500/20 border-gray-500/40 text-gray-300"
                                : "bg-neon-red/20 border-neon-red/40 text-neon-red";

                        return (
                          <span
                            key={pageId}
                            className={`px-3 py-1 rounded-lg border text-xs font-mono ${tone}`}
                          >
                            P{pageId}: {state}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-300">
                  {recommendedAction === "download" ? (
                    <p>
                      Recommendation: use <span className="text-neon-cyan font-semibold">Download from ECU</span>.
                      Missing local snapshots mean this project does not yet contain enough raw page data to safely push back.
                    </p>
                  ) : (
                    <p>
                      Recommendation: review the changed pages first. Use <span className="text-neon-cyan font-semibold">Download from ECU</span>
                      if the ECU holds the latest tune, or <span className="text-neon-yellow font-semibold">Upload to ECU</span>
                      only if this project is your intended source of truth.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleDownload}
                    disabled={busy}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed ${
                      recommendedAction === "download"
                        ? "bg-neon-cyan/20 border border-neon-cyan/50 shadow-[0_0_24px_rgba(0,255,255,0.12)]"
                        : "bg-neon-cyan/10 border border-neon-cyan/30 hover:bg-neon-cyan/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Download className="text-neon-cyan" size={20} />
                      <div className="text-left">
                        <div className="text-sm font-bold text-neon-cyan">
                          {busy && activeOperation?.type === "pull"
                            ? "Downloading from ECU..."
                            : `Download from ECU ${recommendedAction === "download" ? "(Recommended)" : ""}`}
                        </div>
                        <div className="text-xs text-gray-400">
                          Read ECU pages into the project and rebuild local snapshots safely
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={handleUpload}
                    disabled={uploadDisabled}
                    className="w-full flex items-center justify-between px-5 py-4 rounded-xl bg-neon-yellow/10 border border-neon-yellow/30 hover:bg-neon-yellow/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <Upload className="text-neon-yellow" size={20} />
                      <div className="text-left">
                        <div className="text-sm font-bold text-neon-yellow">
                          {busy && activeOperation?.type === "upload" ? "Uploading to ECU..." : "Upload to ECU"}
                        </div>
                        <div className="text-xs text-gray-400">
                          Overwrite ECU RAM with project data. Use only if this project is the intended source.
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={onClose}
                    disabled={busy}
                    className="w-full px-5 py-3 rounded-xl border border-gray-600/50 hover:border-gray-500/80 text-gray-400 hover:text-white transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? "Sync In Progress..." : "Ignore (Continue Anyway)"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-neon-green/10 border border-neon-green/30">
                  <GitCompare className="text-neon-green flex-shrink-0 mt-0.5" size={20} />
                  <div className="text-sm text-gray-300">
                    <p className="font-semibold text-white mb-1">Perfect Sync!</p>
                    <p>Your project file matches ECU memory perfectly. All {matching.length} pages are in sync.</p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-full px-5 py-3 rounded-xl bg-neon-green/10 border border-neon-green/30 hover:bg-neon-green/20 text-neon-green transition-all font-semibold"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
