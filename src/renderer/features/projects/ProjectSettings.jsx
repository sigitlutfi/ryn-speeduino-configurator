import React, { useState, useEffect } from "react";
import { useStore, DEFAULT_PROJECT_UNITS } from "../../core/store.js";
import {
  X,
  Settings,
  Cpu,
  Thermometer,
  Gauge,
  Zap,
  FileText,
  Database,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
 
const COLORS = [
  { id: "cyan", hex: "#00d4ff", class: "bg-neon-cyan" },
  { id: "purple", hex: "#bc13fe", class: "bg-neon-purple" },
  { id: "green", hex: "#00ffb4", class: "bg-neon-green" },
  { id: "orange", hex: "#ff6b35", class: "bg-neon-orange" },
  { id: "gold", hex: "#ffcc00", class: "bg-neon-yellow" },
];

// Small toggle-button group for unit selection
function UnitGroup({ options, value, onChange }) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
            value === opt.value
              ? "bg-neon-cyan/20 border-neon-cyan/60 text-neon-cyan"
              : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function ProjectSettings({ isOpen, onClose }) {
  const { currentProject, updateProjectField } = useStore();

  // Local state mirrors project fields — only committed on Save
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [displacement, setDisplacement] = useState("");
  const [cylinders, setCylinders] = useState("");
  const [engineType, setEngineType] = useState("");
  const [projectColor, setProjectColor] = useState("cyan");
  const [tempUnit, setTempUnit] = useState(DEFAULT_PROJECT_UNITS.temperature);
  const [pressUnit, setPressUnit] = useState(DEFAULT_PROJECT_UNITS.pressure);
  const [speedUnit, setSpeedUnit] = useState(DEFAULT_PROJECT_UNITS.speed);

  useEffect(() => {
    if (isOpen && currentProject) {
      setProjectName(currentProject.projectName ?? "");
      setDescription(currentProject.description ?? "");
      setProjectColor(currentProject.color ?? "cyan");
      setDisplacement(currentProject.engine?.displacement ?? "");
      setCylinders(currentProject.engine?.cylinders ?? "");
      setEngineType(currentProject.engine?.type ?? "");
      setTempUnit(
        currentProject.units?.temperature ?? DEFAULT_PROJECT_UNITS.temperature,
      );
      setPressUnit(
        currentProject.units?.pressure ?? DEFAULT_PROJECT_UNITS.pressure,
      );
      setSpeedUnit(currentProject.units?.speed ?? DEFAULT_PROJECT_UNITS.speed);
    }
  }, [isOpen, currentProject]);

  const handleSave = () => {
    updateProjectField("projectName", projectName.trim() || "Unnamed Project");
    updateProjectField("description", description);
    updateProjectField("color", projectColor);
    updateProjectField(
      "engine.displacement",
      displacement ? Number(displacement) : null,
    );
    updateProjectField(
      "engine.cylinders",
      cylinders ? Number(cylinders) : null,
    );
    updateProjectField("engine.type", engineType || null);
    updateProjectField("units.temperature", tempUnit);
    updateProjectField("units.pressure", pressUnit);
    updateProjectField("units.speed", speedUnit);
    onClose();
  };

  const handlePickIni = async () => {
    const path = await window.projects.pickIni();
    if (!path) return;
    const { updateIni } = useStore.getState();
    const result = await updateIni(path);
    if (!result.ok) {
      alert(`Failed to update INI: ${result.error}`);
    }
  };

  if (!isOpen) return null;

  const ini = currentProject?.ini;

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
                <h2 className="text-lg font-orbitron font-bold text-white uppercase tracking-widest">
                  Project Settings
                </h2>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">
                  {currentProject?.projectName || "Unnamed Project"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
            {/* Project Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-orbitron font-bold text-neon-cyan uppercase tracking-widest opacity-60">
                <FileText size={12} /> Project Info
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest block ml-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-neon-cyan outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest block ml-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Stage 2 tune, track setup"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-neon-cyan outline-none transition-all resize-none shadow-inner"
                  />
                </div>
                
                {/* Color Picker Addition */}
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest block ml-1">
                    Project Identity Color
                  </label>
                  <div className="flex gap-4 ml-1">
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
              </div>
            </div>

            {/* Engine */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-orbitron font-bold text-neon-orange uppercase tracking-widest opacity-60">
                <Cpu size={12} /> Engine
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest block ml-1">
                    Displacement (cc)
                  </label>
                  <input
                    type="number"
                    value={displacement}
                    onChange={(e) => setDisplacement(e.target.value)}
                    placeholder="e.g. 1800"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-neon-cyan outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest block ml-1">
                    Cylinders
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={cylinders}
                    onChange={(e) => setCylinders(e.target.value)}
                    placeholder="e.g. 4"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-neon-cyan outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest block ml-1">
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
              </div>
            </div>

            {/* Units */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-orbitron font-bold text-neon-green uppercase tracking-widest opacity-60">
                <Gauge size={12} /> Units
              </div>
              <div className="space-y-4 p-4 glass border border-white/5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Thermometer
                      size={14}
                      className="text-neon-orange opacity-60"
                    />
                    <span className="text-xs text-gray-300 uppercase tracking-wider">
                      Temperature
                    </span>
                  </div>
                  <UnitGroup
                    value={tempUnit}
                    onChange={setTempUnit}
                    options={[
                      { value: "celsius", label: "°C" },
                      { value: "fahrenheit", label: "°F" },
                    ]}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge size={14} className="text-neon-cyan opacity-60" />
                    <span className="text-xs text-gray-300 uppercase tracking-wider">
                      Pressure
                    </span>
                  </div>
                  <UnitGroup
                    value={pressUnit}
                    onChange={setPressUnit}
                    options={[
                      { value: "kpa", label: "kPa" },
                      { value: "psi", label: "PSI" },
                      { value: "bar", label: "BAR" },
                    ]}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-neon-purple opacity-60" />
                    <span className="text-xs text-gray-300 uppercase tracking-wider">
                      Speed
                    </span>
                  </div>
                  <UnitGroup
                    value={speedUnit}
                    onChange={setSpeedUnit}
                    options={[
                      { value: "kmh", label: "km/h" },
                      { value: "mph", label: "MPH" },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Firmware (read-only) */}
            {ini && (ini.path || ini.signature) && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest opacity-60">
                  <Database size={12} /> Firmware
                </div>
                <div className="p-4 glass border border-white/5 rounded-2xl space-y-4">
                  <div className="space-y-2">
                    {ini.signature && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                          Signature
                        </span>
                        <span className="text-[11px] text-neon-cyan font-mono">
                          {ini.signature}
                        </span>
                      </div>
                    )}
                    {ini.version && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                          MT Version
                        </span>
                        <span className="text-[11px] text-white font-mono">
                          {ini.version}
                        </span>
                      </div>
                    )}
                    {ini.path && (
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest shrink-0">
                          INI Path
                        </span>
                        <span
                          className="text-[9px] text-gray-400 font-mono text-right break-all max-w-[280px]"
                          title={ini.path}
                        >
                          {ini.path}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={handlePickIni}
                    className="w-full py-2 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/30 rounded-xl text-[10px] font-bold text-neon-cyan uppercase tracking-widest transition-all"
                  >
                    Change INI File
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-black/40 border-t border-white/5 flex justify-between items-center">
            <span className="text-[9px] text-gray-600 uppercase tracking-widest">
              Changes saved to project — use File &gt; Save to persist
            </span>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-8 py-3 bg-neon-cyan text-bg-deep text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all hover:opacity-90 shadow-[0_0_20px_rgba(0,212,255,0.3)]"
              >
                Save
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
