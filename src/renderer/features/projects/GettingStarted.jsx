import React, { useState } from "react";
import { useStore } from "../../core/store.js";
import { parseIni } from "../../../shared/ini-parser.js";
import {
  Plus,
  FolderOpen,
  Clock,
  ChevronRight,
  HardDrive,
  Cpu,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion } from "framer-motion";

export default function GettingStarted() {
  const { setProject, saveProject, recentProjects } = useStore();
  const [view, setView] = useState("home"); // 'home' | 'create'

  // Create form state
  const [projectName, setProjectName] = useState("My Performance Build");
  const [description, setDescription] = useState("");
  const [iniPath, setIniPath] = useState("");
  const [iniSignature, setIniSignature] = useState("");
  const [displacement, setDisplacement] = useState("");
  const [cylinders, setCylinders] = useState("");
  const [engineType, setEngineType] = useState("");
  const [showEngine, setShowEngine] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePickIni = async () => {
    const path = await window.projects.pickIni();
    if (!path) return;
    setIniPath(path);
    setIniSignature("");
    try {
      const content = await window.projects.loadIni(path);
      if (typeof content === "string") {
        const parsed = parseIni(content);
        setIniSignature(parsed.info.signature ?? "");
      }
    } catch {}
  };

  const handleCreate = async () => {
    if (!projectName || !iniPath) return;
    setLoading(true);
    const savePath = await window.projects.pickSave(projectName);
    if (savePath) {
      const raw = {
        projectName,
        description,
        ini: { path: iniPath, signature: iniSignature, version: "" },
        engine: {
          displacement: displacement ? Number(displacement) : null,
          cylinders: cylinders ? Number(cylinders) : null,
          type: engineType || null,
        },
        filePath: savePath,
        created: new Date().toISOString(),
      };
      await setProject(raw);
      await saveProject();
    }
    setLoading(false);
  };

  const handleOpenExisting = async () => {
    const filePath = await window.projects.pickExisting();
    if (filePath) {
      const project = await window.projects.loadFile(filePath);
      if (project && !project.error) setProject({ ...project, filePath });
    }
  };

  const renderHome = () => (
    <div className="flex gap-8 max-w-6xl w-full">
      {/* Left: Primary Actions */}
      <div className="flex-1 space-y-4">
        <h2 className="text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest pl-1 mb-4">
          Quick Start
        </h2>

        <button
          onClick={() => setView("create")}
          className="w-full group relative overflow-hidden p-8 glass border border-white/10 rounded-3xl hover:border-neon-cyan/50 hover:bg-neon-cyan/5 transition-all text-left"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-neon-cyan/10 flex items-center justify-center text-neon-cyan border border-neon-cyan/20 group-hover:scale-110 transition-transform">
              <Plus size={32} strokeWidth={1.5} />
            </div>
            <div>
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
      <div className="w-[450px] space-y-4">
        <div className="flex items-center justify-between pl-1 mb-4">
          <h2 className="text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">
            Recent Activity
          </h2>
          {recentProjects.length > 0 && (
            <span className="text-[9px] text-neon-cyan/60 uppercase font-bold tracking-widest">
              Last {recentProjects.length} Sessions
            </span>
          )}
        </div>

        {recentProjects.length === 0 ? (
          <div className="h-[300px] border border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-gray-700">
            <Clock size={32} className="mb-2 opacity-20" />
            <span className="text-[10px] uppercase tracking-widest font-bold">
              No recent projects
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {recentProjects.map((p, i) => (
              <button
                key={i}
                onClick={() => setProject(p)}
                className="w-full group glass border border-white/5 rounded-2xl p-4 hover:border-neon-cyan/30 hover:bg-white/5 transition-all text-left flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-neon-cyan transition-colors border border-white/5">
                  <HardDrive size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-white uppercase tracking-wider truncate">
                    {p.projectName || p.name}
                  </div>
                  <div className="flex items-center gap-3 mt-1 opacity-50">
                    <span className="text-[9px] text-gray-400 flex items-center gap-1 uppercase">
                      <Calendar size={10} />{" "}
                      {new Date(p.lastOpened || p.created).toLocaleDateString()}
                    </span>
                    <span className="text-[9px] text-gray-500 truncate">
                      {p.filePath?.split(/[\\/]/).pop()}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderCreateForm = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass p-12 rounded-[40px] border border-white/10 shadow-2xl w-[600px] space-y-6"
    >
      <div className="flex items-center gap-4">
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
          disabled={loading || !projectName || !iniPath}
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
    <div className="flex-1 flex items-center justify-center p-12 bg-transparent font-inter relative overflow-hidden">
      <div className="neon-grid" />

      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-cyan/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neon-purple/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full flex flex-col items-center">
        {view === "home" && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center mb-16"
          >
            <div className="w-20 h-20 rounded-3xl bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center mb-6 box-glow-cyan">
              <Cpu
                size={40}
                className="text-neon-cyan glow-cyan"
                strokeWidth={1.5}
              />
            </div>
            <h1 className="text-4xl font-orbitron font-bold text-white uppercase tracking-[0.3em]">
              Ryn Config
            </h1>
            <div className="flex items-center gap-4 mt-4">
              <span className="h-[1px] w-8 bg-neon-cyan/30" />
              <p className="text-[12px] text-neon-cyan uppercase tracking-[0.5em] font-bold glow-cyan opacity-80">
                Professional Tuner Workspace
              </p>
              <span className="h-[1px] w-8 bg-neon-cyan/30" />
            </div>
          </motion.div>
        )}

        {view === "home" ? renderHome() : renderCreateForm()}

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
