import React, { useState, useEffect } from "react";
import { useStore } from "../../core/store.js";
import { parseIni } from "../../../shared/ini-parser.js";
import {
  buildProjectInitialization,
  getBoardLayoutChoices,
} from "./projectInitialization.js";
import {
  Plus,
  FolderOpen,
  Clock,
  ChevronRight,
  HardDrive,
  Cpu,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileJson,
  Play,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  { id: "cyan", hex: "#00d4ff", class: "bg-neon-cyan" },
  { id: "purple", hex: "#bc13fe", class: "bg-neon-purple" },
  { id: "green", hex: "#00ffb4", class: "bg-neon-green" },
  { id: "orange", hex: "#ff6b35", class: "bg-neon-orange" },
  { id: "gold", hex: "#ffcc00", class: "bg-neon-yellow" },
];

function formatRelativeTime(date) {
  const diff = (new Date() - new Date(date)) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

function getRecentProjectStatus(project) {
  const syncState = project?.ecu?.sync?.state;
  const pageSnapshots = project?.constants?.pages || {};
  const hasPendingBurn = Object.values(pageSnapshots).some(
    (snapshot) => snapshot?.syncState === "burn-pending",
  );

  if (hasPendingBurn) {
    return {
      label: "Needs Burn",
      className: "text-neon-yellow bg-neon-yellow/10 border-neon-yellow/20",
      icon: Flame,
    };
  }

  if (syncState === "fully-verified") {
    return {
      label: "ECU OK",
      className: "text-neon-green bg-neon-green/10 border-neon-green/20",
      icon: CheckCircle2,
    };
  }

  return {
    label: "Needs Check",
    className: "text-neon-orange bg-neon-orange/10 border-neon-orange/20",
    icon: AlertTriangle,
  };
}

export default function GettingStarted() {
  const {
    setProject,
    saveProject,
    updateConstants,
    updateProjectField,
    recentProjects,
    removeRecentProject,
    notify,
  } =
    useStore();
  const [view, setView] = useState("home"); // 'home' | 'create'
  const [projectColor, setProjectColor] = useState("cyan");
  const [availablePorts, setAvailablePorts] = useState([]);

  // Create form state
  const [projectName, setProjectName] = useState("My Performance Build");
  const [isDragging, setIsDragging] = useState(false);
  const [description, setDescription] = useState("");
  const [iniPath, setIniPath] = useState("");
  const [iniContent, setIniContent] = useState("");
  const [iniSignature, setIniSignature] = useState("");
  const [parsedIniPreview, setParsedIniPreview] = useState(null);
  const [boardLayoutChoices, setBoardLayoutChoices] = useState([]);
  const [boardLayoutValue, setBoardLayoutValue] = useState("");
  const [initBaseTune, setInitBaseTune] = useState(true);
  const [displacement, setDisplacement] = useState("2000");
  const [cylinders, setCylinders] = useState("4");
  const [engineType, setEngineType] = useState("inline");
  const [showEngine, setShowEngine] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingRemovePath, setPendingRemovePath] = useState(null);
  const recentProject = recentProjects[0];

  const handlePickIni = async () => {
    const path = await window.projects.pickIni();
    if (!path) return;
    setIniPath(path);
    setIniContent("");
    setIniSignature("");
    setParsedIniPreview(null);
    setBoardLayoutChoices([]);
    setBoardLayoutValue("");
    try {
      const content = await window.projects.loadIni(path);
      if (typeof content === "string") {
        const parsed = parseIni(content);
        setIniContent(content);
        setIniSignature(parsed.info.signature ?? "");
        setParsedIniPreview(parsed);
        setBoardLayoutChoices(getBoardLayoutChoices(parsed));
      } else {
        notify("Failed to read selected INI", "error");
      }
    } catch (error) {
      notify(`INI parse failed: ${error.message}`, "error");
    }
  };

  useEffect(() => {
    if (view !== "home") return;

    const checkPorts = async () => {
      try {
        const ports = await window.serial.listPorts();
        // Filter out MOCK and generic "ghost" ports with no manufacturer/IDs
        const realHardware = ports.filter(
          (p) =>
            p.path !== "MOCK" &&
            (p.manufacturer || p.vendorId || p.productId || p.pnpId),
        );
        setAvailablePorts(realHardware);
      } catch (e) {
        console.error("Failed to list ports:", e);
      }
    };

    checkPorts();
    const interval = setInterval(checkPorts, 3000);
    return () => clearInterval(interval);
  }, [view]);

  const handleCreate = async () => {
    if (!projectName || !iniPath) return;
    if (boardLayoutChoices.length > 0 && boardLayoutValue === "") {
      notify("Board layout is required for this INI", "warning");
      return;
    }

    setLoading(true);
    try {
      const savePath = await window.projects.pickSave(projectName);
      if (!savePath) {
        setLoading(false);
        return;
      }

      const initializationPlan = buildProjectInitialization({
        parsedIni: parsedIniPreview,
        selectedBoardLayout: boardLayoutValue,
        engine: {
          displacement: displacement ? Number(displacement) : null,
          cylinders: cylinders ? Number(cylinders) : null,
          type: engineType || null,
        },
        initBaseTune,
      });

      const raw = {
        projectName,
        description,
        color: projectColor,
        ini: {
          path: iniPath,
          signature: iniSignature,
          version: parsedIniPreview?.info?.mtVersion ?? "",
          content: iniContent || null,
        },
        engine: {
          displacement: displacement ? Number(displacement) : null,
          cylinders: cylinders ? Number(cylinders) : null,
          type: engineType || null,
        },
        initialization: {
          iniSignature: iniSignature || parsedIniPreview?.info?.signature || "",
          boardLayout: initializationPlan.metadata.boardLayout,
          baseTune: {
            requested: !!initBaseTune,
            applied: false,
            providerId: initializationPlan.metadata.providerId,
            providerOwner: initializationPlan.metadata.providerOwner,
            appliedFields: [],
            warningCount: 0,
          },
        },
        filePath: savePath,
        created: new Date().toISOString(),
      };

      await setProject(raw);
      if (Object.keys(initializationPlan.pages).length > 0) {
        await updateConstants({ pages: initializationPlan.pages });
      }

      updateProjectField("initialization", {
        iniSignature: iniSignature || parsedIniPreview?.info?.signature || "",
        boardLayout: initializationPlan.metadata.boardLayout,
        baseTune: {
          requested: !!initBaseTune,
          applied: initializationPlan.metadata.applied,
          providerId: initializationPlan.metadata.providerId,
          providerOwner: initializationPlan.metadata.providerOwner,
          appliedFields: initializationPlan.metadata.appliedFields,
          warningCount: initializationPlan.warnings.length,
        },
      });

      const saveResult = await saveProject();
      if (!saveResult?.ok) {
        throw new Error(saveResult?.error || "Failed to save created project");
      }

      if (initBaseTune) {
        notify(
          `Project created with base tune: ${initializationPlan.metadata.appliedFields.length} field(s) applied`,
          "success",
        );
      } else {
        notify("Project created successfully", "success");
      }

      if (initializationPlan.warnings.length > 0) {
        notify(
          `Base tune warnings: ${initializationPlan.warnings[0]}`,
          "warning",
          4500,
        );
      }
    }
    catch (error) {
      notify(`Create project failed: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRecent = (e, filePath) => {
    e.stopPropagation();
    setPendingRemovePath(filePath);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're actually leaving the container (not entering a child)
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleFileDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".rynproj")) {
      const project = await window.projects.loadFile(file.path);
      if (project && !project.error)
        setProject({ ...project, filePath: file.path });
    }
  };

  const handleOpenExisting = async () => {
    const filePath = await window.projects.pickExisting();
    if (filePath) {
      const project = await window.projects.loadFile(filePath);
      if (project && !project.error) setProject({ ...project, filePath });
    }
  };

  const renderHome = () => (
    <div className="flex w-full max-w-[1240px] gap-8 xl:gap-10">
      {/* Left: Primary Actions */}
      <div className="flex-1 space-y-4">
        {/* Hardware Status Bar */}
        <div className="relative mb-6 overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.03] px-6 py-4 backdrop-blur-md">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-neon-cyan/70 via-white/20 to-transparent" />
          <div className="flex items-center gap-3 relative z-10">
            {availablePorts.length > 0 ? (
              <div className="w-2.5 h-2.5 rounded-full bg-neon-green animate-pulse box-glow-green" />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
            )}
            <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest text-white/80">
              {availablePorts.length > 0
                ? availablePorts.length === 1
                  ? "1 serial device found"
                  : `${availablePorts.length} serial devices found`
                : "Scanning serial ports..."}
            </span>
          </div>

          <div className="flex items-center gap-4 relative z-10">
            {recentProject && (
              <button
                onClick={() => setProject(recentProject)}
                className="rounded-full border border-neon-cyan/20 bg-neon-cyan/10 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] text-neon-cyan transition-all hover:border-neon-cyan/30 hover:bg-neon-cyan/16"
                title={`Open ${recentProject.projectName || "Recent Project"}`}
              >
                Open Last Project
              </button>
            )}
            <span className="text-[9px] text-white/30 uppercase font-mono">
              {availablePorts.length > 0
                ? "Check in Communications"
                : "Port scan active"}
            </span>
          </div>

          {/* Animated scan line effect moved behind content */}
          {availablePorts.length === 0 && (
            <motion.div
              animate={{ left: ["-100%", "100%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 bottom-0 w-32 bg-gradient-to-r from-transparent via-neon-cyan/5 to-transparent skew-x-[45deg]"
            />
          )}
        </div>

        <div className="mb-4 flex items-end justify-between gap-4 pl-1">
          <div>
            <h2 className="text-[10px] font-orbitron font-bold uppercase tracking-[0.24em] text-white/40">
              Quick Start
            </h2>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/28">
              Choose the fastest path back into tuning.
            </p>
          </div>
          <div className="hidden text-[9px] font-bold uppercase tracking-[0.2em] text-neon-cyan/55 lg:block">
            Home Base
          </div>
        </div>

        {recentProject && (
          <button
            onClick={() => setProject(recentProject)}
            className="group relative w-full overflow-hidden rounded-[32px] border border-neon-green/22 bg-gradient-to-r from-neon-green/12 to-transparent p-8 text-left backdrop-blur-xl transition-all hover:border-neon-green/40 hover:bg-neon-green/15"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-neon-green/80 via-white/25 to-transparent" />
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-neon-green/10 flex items-center justify-center text-neon-green border border-neon-green/20 group-hover:scale-110 transition-transform">
                <Play size={28} strokeWidth={1.8} className="translate-x-0.5" />
              </div>
              <div>
                <div className="mb-2 text-[8px] font-black uppercase tracking-[0.24em] text-neon-green/75">
                  Recommended
                </div>
                <div className="text-lg font-orbitron font-bold text-white uppercase tracking-wider">
                  Resume Last Project
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-widest mt-1 opacity-70">
                  {recentProject.projectName || recentProject.name}
                </div>
              </div>
              <ChevronRight className="ml-auto text-gray-700 group-hover:text-neon-green transition-colors" />
            </div>
          </button>
        )}

        <button
          onClick={() => setView("create")}
          className="w-full group relative overflow-hidden p-8 glass border border-white/10 rounded-3xl hover:border-neon-cyan/50 hover:bg-neon-cyan/5 transition-all text-left"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-neon-cyan/10 flex items-center justify-center text-neon-cyan border border-neon-cyan/20 group-hover:scale-110 transition-transform">
              <Plus size={32} strokeWidth={1.5} />
            </div>
            <div>
              <div className="mb-2 text-[8px] font-black uppercase tracking-[0.24em] text-neon-cyan/70">
                Fresh Build
              </div>
              <div className="text-lg font-orbitron font-bold text-white uppercase tracking-wider">
                New Project
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mt-1 opacity-70">
                Initialize a fresh Speeduino configuration
              </div>
            </div>
            <ChevronRight className="ml-auto text-gray-700 group-hover:text-neon-cyan transition-colors" />
          </div>
        </button>

        <button
          onClick={handleOpenExisting}
          className="w-full group relative overflow-hidden p-8 glass border border-white/10 rounded-3xl hover:border-neon-purple/50 hover:bg-neon-purple/5 transition-all text-left"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-neon-purple/10 flex items-center justify-center text-neon-purple border border-neon-purple/20 group-hover:scale-110 transition-transform">
              <FolderOpen size={32} strokeWidth={1.5} />
            </div>
            <div>
              <div className="mb-2 text-[8px] font-black uppercase tracking-[0.24em] text-neon-purple/70">
                Existing Workspace
              </div>
              <div className="text-lg font-orbitron font-bold text-white uppercase tracking-wider">
                Open Project
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mt-1 opacity-70">
                Load an existing .rynproj workspace
              </div>
            </div>
            <ChevronRight className="ml-auto text-gray-700 group-hover:text-neon-purple transition-colors" />
          </div>
        </button>
      </div>

      {/* Right: Recent Projects */}
      <div className="w-[420px] space-y-4 xl:w-[450px]">
        <div className="mb-4 flex items-center justify-between pl-1">
          <h2 className="text-[10px] font-orbitron font-bold uppercase tracking-[0.24em] text-white/40">
            Recent Activity
          </h2>
          {recentProjects.length > 0 && (
            <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-neon-cyan/60">
              Last {recentProjects.length} Sessions
            </span>
          )}
        </div>

        {recentProjects.length === 0 ? (
          <div className="flex h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/8 bg-white/[0.02] text-gray-700">
            <Clock size={32} className="mb-2 opacity-20" />
            <span className="text-[10px] uppercase tracking-widest font-bold">
              No recent projects
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {recentProjects.map((p, i) => (
                <motion.div
                  key={p.filePath || i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative group"
                >
                  <button
                    onClick={() => setProject(p)}
                    className={`w-full glass border border-white/5 rounded-[24px] p-4 hover:bg-white/5 hover:backdrop-blur-md transition-all text-left flex items-center gap-4 ${
                      p.color === "cyan"
                        ? "hover:border-neon-cyan/30"
                        : p.color === "purple"
                          ? "hover:border-neon-purple/30"
                          : p.color === "green"
                            ? "hover:border-neon-green/30"
                            : p.color === "orange"
                              ? "hover:border-neon-orange/30"
                              : p.color === "gold"
                                ? "hover:border-neon-yellow/30"
                                : "hover:border-neon-cyan/30"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center transition-colors border border-white/5 ${
                        p.color === "cyan"
                          ? "text-neon-cyan"
                          : p.color === "purple"
                            ? "text-neon-purple"
                            : p.color === "green"
                              ? "text-neon-green"
                              : p.color === "orange"
                                ? "text-neon-orange"
                                : p.color === "gold"
                                  ? "text-neon-yellow"
                                  : "text-gray-500"
                      }`}
                    >
                      <HardDrive size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-white uppercase tracking-wider truncate flex items-center gap-2">
                        {p.projectName || p.name}
                        {p.ini?.signature && (
                          <span className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded text-gray-400 font-mono">
                            {p.ini.signature}
                          </span>
                        )}
                        {(() => {
                          const status = getRecentProjectStatus(p);
                          const StatusIcon = status.icon;
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-black uppercase tracking-widest ${status.className}`}
                            >
                              <StatusIcon size={10} />
                              {status.label}
                            </span>
                          );
                        })()}
                      </div>
                      {p.description && (
                        <div className="text-[9px] text-gray-500 mt-0.5 truncate opacity-70 italic">
                          {p.description}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1 opacity-50">
                        <span className="text-[9px] text-gray-400 flex items-center gap-1 uppercase">
                          <Clock size={10} />{" "}
                          {formatRelativeTime(p.lastOpened || p.created)}
                        </span>
                        <span className="text-[9px] text-gray-500 truncate">
                          {p.filePath?.split(/[\\/]/).pop()}
                        </span>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => handleRemoveRecent(e, p.filePath)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all z-20"
                    title="Remove from recent"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );

  const renderCreateForm = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass w-[700px] rounded-[40px] border border-white/10 p-10 shadow-2xl space-y-6"
    >
      <div className="flex items-center gap-4 border-b border-white/6 pb-5">
        <div className="w-12 h-12 rounded-2xl bg-neon-cyan/20 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan">
          <Cpu size={24} />
        </div>
        <div>
          <h2 className="text-xl font-orbitron font-bold text-white uppercase tracking-widest">
            Initialize Build
          </h2>
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">
            Set up your ECU configuration
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid gap-3 rounded-[28px] border border-white/8 bg-white/[0.03] p-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
            <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
              Build Status
            </div>
            <div className="mt-2 text-[11px] font-orbitron font-bold uppercase tracking-[0.18em] text-white">
              {iniPath ? 'Configuration Loaded' : 'Awaiting INI'}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
              {iniPath ? 'Core metadata ready for initialization' : 'Select firmware definition first'}
            </div>
          </div>
          <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
            <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
              Base Tune
            </div>
            <div className="mt-2 text-[11px] font-orbitron font-bold uppercase tracking-[0.18em] text-white">
              {initBaseTune ? 'Enabled' : 'Manual Setup'}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
              {initBaseTune ? 'Applies safe starter defaults where supported' : 'Create project without automatic defaults'}
            </div>
          </div>
          <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
            <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
              Engine Profile
            </div>
            <div className="mt-2 text-[11px] font-orbitron font-bold uppercase tracking-[0.18em] text-white">
              {displacement || '2000'}cc / {cylinders || '4'} Cyl
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
              {engineType || 'inline'} layout target
            </div>
          </div>
        </div>

        {/* Project Name */}
        <div className="space-y-2">
          <label className="text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest block ml-1">
            Project Name
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-neon-cyan outline-none transition-all shadow-inner"
            placeholder="e.g. Mazda MX-5 Turbo"
          />
        </div>

        {/* Color Picker */}
        <div className="space-y-2">
          <label className="text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest block ml-1">
            Project Identity Color
          </label>
          <div className="ml-1 flex gap-4">
            {COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => setProjectColor(c.id)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  projectColor === c.id
                    ? "border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                    : "border-transparent opacity-50 hover:opacity-100"
                } ${c.class}`}
              />
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest block ml-1">
            Description <span className="opacity-40">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-neon-cyan outline-none transition-all shadow-inner"
            placeholder="e.g. Stage 2 tune, track setup"
          />
        </div>

        {/* INI File */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <div className="space-y-2">
            <label className="text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest block ml-1">
              Configuration (.INI)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={iniPath}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-xs outline-none cursor-default truncate opacity-80"
                placeholder="No file selected"
              />
              <button
                onClick={handlePickIni}
                className="px-6 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/30 rounded-2xl text-[10px] font-bold text-neon-cyan uppercase tracking-widest transition-all"
              >
                Pick
              </button>
            </div>
            {iniSignature && (
              <div className="ml-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green" />
                <span className="text-[10px] text-neon-green font-mono">
                  {iniSignature}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest block ml-1">
              Board Layout
              {boardLayoutChoices.length > 0 && (
                <span className="ml-2 text-neon-orange/70">(required)</span>
              )}
            </label>
            <select
              value={boardLayoutValue}
              onChange={(e) => setBoardLayoutValue(e.target.value)}
              disabled={!iniPath || boardLayoutChoices.length === 0}
              className="w-full bg-[#1a1a2e] border border-white/10 rounded-2xl px-5 py-4 text-white text-xs focus:border-neon-cyan outline-none disabled:opacity-40"
            >
              <option value="">
                {boardLayoutChoices.length > 0
                  ? "Select board layout"
                  : iniPath
                    ? "No board layout selector in this INI"
                    : "Pick an INI first"}
              </option>
              {boardLayoutChoices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
            <p className="ml-1 text-[10px] leading-relaxed text-white/35">
              Board layout sets the default pin routing for this project. You can still change it later in Engine
              Constants.
            </p>
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 cursor-pointer hover:bg-white/[0.05] transition-all">
          <input
            type="checkbox"
            checked={initBaseTune}
            onChange={(e) => setInitBaseTune(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40 text-neon-cyan focus:ring-neon-cyan/30"
          />
          <div className="min-w-0">
            <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.18em] text-white">
              Init Base Tune
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-white/40">
              Applies a minimal functional configuration for the selected firmware and board layout. Unsupported
              fields are skipped with warnings.
            </p>
          </div>
        </label>

        {/* Engine Details (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowEngine(!showEngine)}
            className="flex items-center gap-2 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest ml-1 hover:text-gray-300 transition-colors"
          >
            {showEngine ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Engine Details <span className="opacity-40">(optional)</span>
          </button>

          {showEngine && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 grid grid-cols-3 gap-3"
            >
              <div className="space-y-1">
                <label className="text-[9px] text-gray-600 uppercase tracking-widest block ml-1">
                  Displacement (cc)
                </label>
                <input
                  type="number"
                  value={displacement}
                  onChange={(e) => setDisplacement(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-neon-cyan outline-none"
                  placeholder="e.g. 1800"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-gray-600 uppercase tracking-widest block ml-1">
                  Cylinders
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={cylinders}
                  onChange={(e) => setCylinders(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-neon-cyan outline-none"
                  placeholder="e.g. 4"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-gray-600 uppercase tracking-widest block ml-1">
                  Type
                </label>
                <select
                  value={engineType}
                  onChange={(e) => setEngineType(e.target.value)}
                  className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-neon-cyan outline-none"
                >
                  <option value="">—</option>
                  <option value="inline">Inline</option>
                  <option value="v">V-type</option>
                  <option value="flat">Flat / Boxer</option>
                  <option value="rotary">Rotary</option>
                </select>
              </div>
            </motion.div>
          )}
          {!showEngine && (
            <div className="mt-2 ml-1 text-[10px] text-white/35 uppercase tracking-[0.12em]">
              Default: 2000cc / 4 cylinders / inline
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4 pt-2">
        <button
          onClick={() => setView("home")}
          className="px-8 py-5 border border-white/10 hover:bg-white/5 text-gray-400 font-bold rounded-2xl uppercase tracking-widest text-[10px] transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={
            loading ||
            !projectName ||
            !iniPath ||
            (boardLayoutChoices.length > 0 && boardLayoutValue === "")
          }
          className="flex-1 py-5 bg-neon-cyan text-bg-deep font-orbitron font-bold rounded-2xl uppercase tracking-[0.3em] shadow-[0_0_30px_rgba(0,212,255,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-3"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-bg-deep/30 border-t-bg-deep rounded-full animate-spin" />
          ) : (
            "Ready for Launch"
          )}
        </button>
      </div>
    </motion.div>
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
      className="flex-1 flex items-center justify-center p-12 bg-transparent font-inter relative overflow-hidden"
    >
      {/* Visual cue for drag and drop */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-bg-deep/80 backdrop-blur-md border-4 border-dashed border-neon-cyan/40 m-8 rounded-[40px] pointer-events-none"
          >
            <div className="flex flex-col items-center animate-pulse">
              <FileJson size={80} className="text-neon-cyan mb-6" />
              <h3 className="text-2xl font-orbitron font-bold text-white uppercase tracking-[0.4em]">
                Ready for Import
              </h3>
              <p className="text-neon-cyan/60 text-[10px] uppercase tracking-[0.2em] font-bold mt-2">
                Release file to open project
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="neon-grid" />

      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-cyan/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neon-purple/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full flex flex-col items-center">
        {view === "home" && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 flex w-full max-w-[1240px] items-end justify-between gap-10 xl:flex-row"
          >
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div className="absolute inset-0 rounded-[32px] bg-neon-cyan/16 blur-2xl opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
                <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-neon-cyan/16 to-neon-purple/12 backdrop-blur-sm">
                  <img
                    src={new URL("../../assets/logo.png", import.meta.url).href}
                    alt="RYN CONFIGURATOR"
                    className="h-24 w-24 object-contain drop-shadow-[0_0_15px_rgba(0,212,255,0.35)]"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-[9px] font-black uppercase tracking-[0.28em] text-neon-cyan/70">
                  Project Workspace
                </div>
                <h1 className="text-4xl font-orbitron font-black uppercase tracking-[0.28em] text-white xl:text-5xl">
                  RYN <span className="text-neon-cyan">Configurator</span>
                </h1>
                <p className="max-w-[620px] text-[11px] uppercase tracking-[0.16em] text-white/35">
                  Reopen your last tune, start a fresh build, or import an existing workspace without leaving the
                  launch bay.
                </p>
              </div>
            </div>

            <div className="grid w-full max-w-[360px] gap-3 sm:grid-cols-2 xl:w-[360px] xl:grid-cols-1">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-4 backdrop-blur-md">
                <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
                  Launch Flow
                </div>
                <div className="mt-2 text-[11px] font-orbitron font-bold uppercase tracking-[0.18em] text-white">
                  Resume, create, import
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                  Recent project history stays on the right rail
                </div>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-4 backdrop-blur-md">
                <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
                  Quick Import
                </div>
                <div className="mt-2 text-[11px] font-orbitron font-bold uppercase tracking-[0.18em] text-white">
                  Drag and drop .rynproj
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                  Drop a project file anywhere on this screen to open it instantly
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === "home" ? renderHome() : renderCreateForm()}

        {view === "home" && (
          <div className="mt-8 text-[10px] text-gray-600 uppercase tracking-[0.28em] font-bold">
            Drop .rynproj anywhere to open
          </div>
        )}

        <AnimatePresence>
          {pendingRemovePath && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="fixed bottom-16 right-8 z-[120] flex items-center gap-3 px-4 py-3 rounded-2xl glass-strong border border-white/10 shadow-2xl"
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/80">
                Remove from recent?
              </div>
              <button
                onClick={() => setPendingRemovePath(null)}
                className="px-3 py-1.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-[9px] font-bold uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  removeRecentProject(pendingRemovePath);
                  setPendingRemovePath(null);
                }}
                className="px-3 py-1.5 rounded-xl border border-red-400/20 bg-red-400/10 text-red-300 hover:bg-red-400 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-all"
              >
                Remove
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {view === "home" && (
          <p className="fixed bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-gray-700 uppercase tracking-[0.4em]">
            Standalone Edition <span className="mx-2 text-white/10">|</span>{" "}
            v1.1.0-RC
          </p>
        )}
      </div>
    </div>
  );
}
