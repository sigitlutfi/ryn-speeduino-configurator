import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronUp, Download, Upload, GitCompare, X } from 'lucide-react';
import { useStore } from '../core/store.js';

export default function SyncDialog({ isOpen, onClose, diffResults }) {
  const { syncAllFromECU, uploadToECU, notify, operation } = useStore();
  const [loading, setLoading] = useState(false);
  const [expandedDiffPage, setExpandedDiffPage] = useState(null);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => { if (!isOpen) setUploadError(''); }, [isOpen]);

  if (!isOpen || !diffResults) return null;

  const {
    different,
    generated = [],
    missing,
    matching,
    errors = [],
    pageStates = {},
    pageDiffs = {},
  } = diffResults;
  const hasDifferences =
    different.length > 0 ||
    generated.length > 0 ||
    missing.length > 0 ||
    errors.length > 0;
  const allPages = Object.keys(pageStates).map(Number).sort((a, b) => a - b);
  const hasErrors = errors.length > 0;
  const generatedDiffs = generated
    .map((pageId) => pageDiffs[pageId])
    .filter(Boolean);
  const generatedBlankCount = generatedDiffs.filter((diff) => diff.ecuLooksBlank).length;
  const generatedNonBlankCount = generatedDiffs.length - generatedBlankCount;
  const mostlyMissing =
    missing.length > 0 &&
    different.length <= 1 &&
    generated.length === 0 &&
    missing.length >= matching.length;
  const generatedOnly = generated.length > 0 && different.length === 0 && missing.length === 0;
  const generatedBiasTowardUpload =
    generated.length > 0 &&
    generatedBlankCount >= generatedNonBlankCount &&
    different.length === 0 &&
    missing.length === 0;
  const generatedBiasTowardDownload =
    generated.length > 0 &&
    (generatedNonBlankCount > generatedBlankCount || missing.length > 0);
  const recommendedAction = hasErrors
    ? 'review'
    : generatedBiasTowardUpload
      ? 'upload'
      : mostlyMissing || generatedBiasTowardDownload
        ? 'download'
        : 'review';
  const activeOperation = operation?.scope === "sync" ? operation : null;
  const busy = loading || Boolean(activeOperation);
  const uploadPages = [...new Set([...different, ...generated])];
  const uploadDisabled = busy || hasErrors || uploadPages.length === 0;
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
  const totalStatusCount = allPages.length;

  const toggleDiffPage = (pageId) => {
    setExpandedDiffPage((current) => (current === pageId ? null : pageId));
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const result = await syncAllFromECU();
      if (!result?.ok) {
        notify(`Download failed: ${result?.error || result?.errors?.[0]?.error || 'Unknown error'}`, 'error');
        return;
      }

      notify("Downloaded ECU data. Save the project to keep it in the .rynproj file.", "success");
      onClose();
    } catch (err) {
      notify(`Download failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    setUploadError('');
    setLoading(true);
    try {
      const result = await uploadToECU(uploadPages.length > 0 ? uploadPages : null);

      if (result.ok) {
        notify("Uploaded project to ECU successfully", "success");
        onClose();
      } else {
        const firstError = result?.errors?.[0];
        const detail =
          firstError?.pageId !== undefined
            ? ` Page ${firstError.pageId}: ${firstError.error}`
            : ` ${firstError?.error || result?.error || 'Unknown issue'}`;
        const message = `Upload failed.${detail}`;
        setUploadError(message);
        notify(message, "error", 12000);
      }
    } catch (err) {
      setUploadError(`Upload failed: ${err.message}`);
      notify(`Upload failed: ${err.message}`, "error", 12000);
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
          <div className="px-6 py-5 space-y-5">
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

            {uploadError && (
              <div role="alert" className="p-4 rounded-xl bg-neon-red/10 border border-neon-red/30 text-sm text-neon-red">
                {uploadError}
              </div>
            )}

            {hasDifferences ? (
              <>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-neon-yellow/10 border border-neon-yellow/30">
                  <AlertTriangle className="text-neon-yellow flex-shrink-0 mt-0.5" size={20} />
                  <div className="text-sm text-gray-300">
                    <p className="font-semibold text-white mb-1">Data Mismatch Detected</p>
                    <p>
                      {hasErrors
                        ? "The sync check hit one or more read/verify errors. Treat this state as unsafe until you pull fresh data from the ECU or re-run the check successfully."
                        : recommendedAction === "upload" && generatedOnly
                        ? "This project still contains generated local pages, while the ECU appears mostly blank or freshly flashed. Uploading the project is a reasonable way to establish the initial baseline."
                        : recommendedAction === "download"
                        ? generated.length > 0
                          ? "This project still contains generated local pages and the ECU appears to hold a real baseline. Pull from the ECU first so the project is based on real controller data."
                          : "Project baseline is incomplete. Pull once from the ECU to finish synchronization and capture the remaining pages."
                        : "Your project file differs from ECU memory. Review the direction carefully before overwriting either side."}
                    </p>
                  </div>
                </div>

                {/* Status Summary */}
                <div className={`grid gap-2 ${errors.length > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
                  <div className="rounded-xl bg-neon-green/10 border border-neon-green/30 px-3 py-2.5 text-center">
                    <div className="text-xl font-bold text-neon-green">{matching.length}</div>
                    <div className="mt-0.5 text-[10px] text-gray-400 uppercase tracking-[0.24em]">Matching</div>
                  </div>
                  <div className="rounded-xl bg-neon-orange/10 border border-neon-orange/30 px-3 py-2.5 text-center">
                    <div className="text-xl font-bold text-neon-orange">{different.length}</div>
                    <div className="mt-0.5 text-[10px] text-gray-400 uppercase tracking-[0.24em]">Different</div>
                  </div>
                  <div className="rounded-xl bg-neon-yellow/10 border border-neon-yellow/30 px-3 py-2.5 text-center">
                    <div className="text-xl font-bold text-neon-yellow">{generated.length}</div>
                    <div className="mt-0.5 text-[10px] text-gray-400 uppercase tracking-[0.24em]">Generated</div>
                  </div>
                  <div className="rounded-xl bg-gray-500/10 border border-gray-500/30 px-3 py-2.5 text-center">
                    <div className="text-xl font-bold text-gray-400">{missing.length}</div>
                    <div className="mt-0.5 text-[10px] text-gray-400 uppercase tracking-[0.24em]">Missing</div>
                  </div>
                  {errors.length > 0 && (
                    <div className="rounded-xl bg-neon-red/10 border border-neon-red/30 px-3 py-2.5 text-center">
                      <div className="text-xl font-bold text-neon-red">{errors.length}</div>
                      <div className="mt-0.5 text-[10px] text-gray-400 uppercase tracking-[0.24em]">Errors</div>
                    </div>
                  )}
                </div>

                {allPages.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-orbitron font-bold text-gray-500 uppercase tracking-widest">
                        Page Status
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {totalStatusCount} page checks
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {allPages.map((pageId) => {
                        const state = pageStates[pageId];
                        const diff = pageDiffs[pageId];
                        const isExpanded = expandedDiffPage === pageId;
                        const tone =
                          state === "verified"
                            ? "bg-neon-green/15 border-neon-green/35 text-neon-green"
                            : state === "different"
                              ? "bg-neon-orange/15 border-neon-orange/35 text-neon-orange"
                              : state === "generated-local"
                                ? "bg-neon-yellow/15 border-neon-yellow/35 text-neon-yellow"
                              : state === "missing-local"
                                ? "bg-gray-500/15 border-gray-500/35 text-gray-300"
                                : "bg-neon-red/15 border-neon-red/35 text-neon-red";

                        return (
                          <div key={pageId} className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-mono ${tone}`}
                              >
                                P{pageId} · {state}
                              </span>
                              {(state === 'different' || state === 'generated-local') && diff && (
                                <button
                                  type="button"
                                  onClick={() => toggleDiffPage(pageId)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                  Diff
                                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                              )}
                            </div>

                            {(state === 'different' || state === 'generated-local') && diff && isExpanded && (
                              <div className="w-full max-w-xl rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] text-gray-300">
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-400">
                                  <span>Offset: <span className="font-mono text-white">{diff.offset}</span></span>
                                  <span>Bytes: <span className="font-mono text-white">{diff.length}</span></span>
                                  {state === 'generated-local' && (
                                    <span>Basis: <span className="font-mono text-white">{diff.ecuLooksBlank ? 'ECU looks blank' : 'ECU has real data'}</span></span>
                                  )}
                                  {diff.localCRC && (
                                    <span>Local CRC: <span className="font-mono text-white">{diff.localCRC}</span></span>
                                  )}
                                  {diff.ecuCRC && (
                                    <span>ECU CRC: <span className="font-mono text-white">{diff.ecuCRC}</span></span>
                                  )}
                                </div>
                                <div className="mt-2 text-gray-400">{diff.summary}</div>
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                  <div className="rounded-lg border border-white/8 bg-white/5 px-2.5 py-2">
                                    <div className="mb-1 text-[10px] uppercase tracking-[0.24em] text-gray-500">Local</div>
                                    <div className="font-mono text-[11px] text-neon-yellow/90">{diff.localHex || '-'}</div>
                                  </div>
                                  <div className="rounded-lg border border-white/8 bg-white/5 px-2.5 py-2">
                                    <div className="mb-1 text-[10px] uppercase tracking-[0.24em] text-gray-500">ECU</div>
                                    <div className="font-mono text-[11px] text-neon-cyan/90">{diff.ecuHex || '-'}</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-300">
                  {hasErrors ? (
                    <p>
                      Recommendation: resolve the read/verify errors first. Prefer <span className="text-neon-cyan font-semibold">Download from ECU</span> after the connection is stable, then re-check sync before considering any upload.
                    </p>
                  ) : recommendedAction === "upload" ? (
                    <p>
                      Recommendation: use <span className="text-neon-yellow font-semibold">Upload to ECU</span>.
                      These pages are still project-generated and the ECU looks mostly blank or freshly flashed, so pushing the project as the initial baseline is reasonable.
                    </p>
                  ) : recommendedAction === "download" ? (
                    <p>
                      Recommendation: use <span className="text-neon-cyan font-semibold">Download from ECU</span>.
                      {generated.length > 0
                        ? "Generated local pages are provisional. Pull the ECU data first so the project is grounded in real controller memory before you overwrite anything."
                        : "Your initialized base tune pages already align, but the project baseline is not complete yet. Pull once from the ECU to capture the remaining pages and finish synchronization."}
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
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed ${
                      recommendedAction === "upload"
                        ? "bg-neon-yellow/20 border border-neon-yellow/50 shadow-[0_0_24px_rgba(255,204,0,0.12)]"
                        : "bg-neon-yellow/10 border border-neon-yellow/30 hover:bg-neon-yellow/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Upload className="text-neon-yellow" size={20} />
                      <div className="text-left">
                        <div className="text-sm font-bold text-neon-yellow">
                          {busy && activeOperation?.type === "upload"
                            ? "Uploading to ECU..."
                            : `Upload to ECU ${recommendedAction === "upload" ? "(Recommended)" : ""}`}
                        </div>
                        <div className="text-xs text-gray-400">
                          {hasErrors
                            ? "Upload is disabled until the read or verify errors are resolved."
                            : uploadPages.length === 0
                              ? "There are no generated or different local pages available to upload yet."
                            : generated.length > 0
                              ? "Only generated and different local pages will be written. Missing pages stay untouched, which is appropriate for a fresh project."
                              : "Overwrite ECU RAM with project data. Use only if this project is the intended source."}
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
