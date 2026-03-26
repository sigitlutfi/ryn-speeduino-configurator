import React, { useState } from "react";
import { useStore } from "../core/store.js";
import {
  FileText,
  Edit2,
  Layout,
  Github,
  Settings,
  Power,
  Database,
  RefreshCcw,
  FolderOpen,
  Save,
  XCircle,
  HelpCircle,
  Monitor,
  Maximize,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SettingsDialog from "./SettingsDialog.jsx";
import ProjectSettings from "../features/projects/ProjectSettings.jsx";

const MenuButton = ({ label, children, isOpen, onClick }) => (
  <div className="relative">
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all rounded-md flex items-center gap-1.5 ${
        isOpen
          ? "bg-white/10 text-white"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      }`}
    >
      {label}
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          className="absolute top-full left-0 mt-1 min-w-[200px] glass-strong rounded-xl border border-white/10 shadow-2xl z-50 p-1.5 overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const MenuItem = ({ icon: Icon, label, shortcut, onClick, danger }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] transition-all bg-gray-700 ${
      danger
        ? "text-neon-red hover:bg-neon-red/70"
        : "text-gray-300 hover:bg-gray-500/70 hover:text-white"
    }`}
  >
    <div className="flex items-center gap-2.5">
      {Icon && (
        <Icon
          size={14}
          className={danger ? "text-neon-red" : "text-gray-500"}
        />
      )}
      <span className="font-medium tracking-wide">{label}</span>
    </div>
    {shortcut && (
      <span className="text-[9px] text-gray-600 font-mono ml-4">
        {shortcut}
      </span>
    )}
  </button>
);

const Divider = () => <div className="h-[1px] bg-white/5 my-1 mx-1.5" />;

export default function AppToolbar() {
  const [openMenu, setOpenMenu] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const { currentProject, closeProject, connection } = useStore();

  const handleMenuClick = (menu) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  const closeMenus = () => setOpenMenu(null);

  const handleNewProject = async () => {
    closeMenus();
    closeProject();
  };

  const handleOpenProject = async () => {
    closeMenus();
    const filePath = await window.projects.pickExisting();
    if (filePath) {
      const proj = await window.projects.loadFile(filePath);
      if (proj && !proj.error) useStore.getState().setProject(proj);
    }
  };

  const handleSave = () => {
    closeMenus();
    useStore.getState().saveProject();
  };

  const handleSaveAs = () => {
    closeMenus();
    useStore.getState().saveProjectAs();
  };

  return (
    <>
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <ProjectSettings
        isOpen={isProjectSettingsOpen}
        onClose={() => setIsProjectSettingsOpen(false)}
      />

      {/* Invisible backdrop to close menus */}
      {openMenu && <div className="fixed inset-0 z-40" onClick={closeMenus} />}

      <div
        className="relative z-50 flex items-center h-10 px-3 bg-bg-deep/40 border-b border-white/5 backdrop-blur-md gap-1 select-none"
        style={{ WebkitAppRegion: "drag" }}
      >
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: "no-drag" }}
        >
          <MenuButton
            label="File"
            isOpen={openMenu === "file"}
            onClick={() => handleMenuClick("file")}
          >
            <MenuItem
              icon={FileText}
              label="New Project…"
              shortcut="Ctrl+N"
              onClick={handleNewProject}
            />
            <MenuItem
              icon={FolderOpen}
              label="Open Project…"
              shortcut="Ctrl+O"
              onClick={handleOpenProject}
            />
            <Divider />
            <MenuItem
              icon={Save}
              label="Save Project"
              shortcut="Ctrl+S"
              onClick={handleSave}
            />
            <MenuItem icon={Save} label="Save As…" onClick={handleSaveAs} />
            <Divider />
            {currentProject && (
              <MenuItem
                icon={SlidersHorizontal}
                label="Project Settings…"
                onClick={() => {
                  setIsProjectSettingsOpen(true);
                  closeMenus();
                }}
              />
            )}
            <MenuItem
              icon={Settings}
              label="Preferences…"
              shortcut="Ctrl+,"
              onClick={() => {
                setIsSettingsOpen(true);
                closeMenus();
              }}
            />
            <Divider />
            <MenuItem
              icon={XCircle}
              label="Close Project"
              onClick={() => {
                closeProject();
                closeMenus();
              }}
            />
            <Divider />
            <MenuItem
              icon={Power}
              label="Exit"
              danger
              onClick={() => window.close()}
            />
          </MenuButton>

          <MenuButton
            label="Edit"
            isOpen={openMenu === "edit"}
            onClick={() => handleMenuClick("edit")}
          >
            <MenuItem icon={RefreshCcw} label="Undo" shortcut="Ctrl+Z" />
            <MenuItem icon={RefreshCcw} label="Redo" shortcut="Ctrl+Y" />
            <Divider />
            <MenuItem
              icon={Settings}
              label="Preferences…"
              shortcut="Ctrl+,"
              onClick={() => {
                setIsSettingsOpen(true);
                closeMenus();
              }}
            />
          </MenuButton>

          <MenuButton
            label="View"
            isOpen={openMenu === "view"}
            onClick={() => handleMenuClick("view")}
          >
            <MenuItem icon={Monitor} label="Main Dashboard" />
            <MenuItem icon={Database} label="Tuning Tables" />
            <MenuItem icon={Layout} label="Analysis Charts" />
            <Divider />
            <MenuItem
              icon={Maximize}
              label="Toggle Fullscreen"
              shortcut="F11"
            />
          </MenuButton>

          <MenuButton
            label="Communications"
            isOpen={openMenu === "comm"}
            onClick={() => handleMenuClick("comm")}
          >
            <MenuItem icon={RefreshCcw} label="Settings…" />
            <Divider />
            <MenuItem label="Connect" onClick={closeMenus} />
            <MenuItem label="Disconnect" danger onClick={closeMenus} />
          </MenuButton>

          <MenuButton
            label="Help"
            isOpen={openMenu === "help"}
            onClick={() => handleMenuClick("help")}
          >
            <MenuItem icon={ExternalLink} label="Online Documentation" />
            <MenuItem icon={Github} label="Source Code (GitHub)" />
            <Divider />
            <MenuItem icon={HelpCircle} label="Check for Updates…" />
            <MenuItem icon={HelpCircle} label="About Ryn Config" />
          </MenuButton>
        </div>

        <div className="flex-1 flex justify-center pointer-events-none">
          {currentProject && (
            <span className="text-[10px] font-orbitron font-bold text-gray-600 uppercase tracking-[0.3em]">
              {currentProject.projectName || currentProject.name} — Workspace
            </span>
          )}
        </div>

        <div
          className="flex items-center gap-4 px-3"
          style={{ WebkitAppRegion: "no-drag" }}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${connection.status === "connected" ? "bg-neon-green animate-pulse" : "bg-gray-700"}`}
            />
            <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest">
              {connection.status}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
