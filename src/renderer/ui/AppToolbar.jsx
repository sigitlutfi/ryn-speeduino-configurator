import { useLocation } from "wouter";
import { useStore } from "../core/store.js";
import { ROUTES } from "../routes.js";
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
  Zap,
  SlidersHorizontal,
  SlidersHorizontalIcon,
  Activity,
  GitCompare,
  Download,
  CheckCircle2,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import SettingsDialog from "./SettingsDialog.jsx";
import ProjectSettings from "../features/projects/ProjectSettings.jsx";
import { useState } from "react";

const MenuButton = ({ label, children, isOpen, onClick }) => (
  <div className="relative">
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[11px] font-orbitron font-bold uppercase tracking-[0.2em] transition-all rounded-lg flex items-center gap-1.5 ${
        isOpen
          ? "bg-neon-cyan/20 text-neon-cyan shadow-glow-cyan/10 border border-neon-cyan/30"
          : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
      }`}
    >
      {label}
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          className="absolute top-full left-0 mt-2 min-w-[240px] glass-strong rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 p-2 overflow-hidden backdrop-blur-2xl ring-1 ring-white/5"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const MenuItem = ({ icon: Icon, label, shortcut, onClick, danger, active }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[11px] transition-all group ${
      active
        ? "bg-neon-cyan/10 text-neon-cyan"
        : danger
          ? "text-neon-red/70 hover:bg-neon-red/10 hover:text-neon-red"
          : "text-gray-400 hover:bg-white/5 hover:text-white"
    }`}
  >
    <div className="flex items-center gap-3">
      {Icon && (
        <Icon
          size={14}
          className={`transition-colors ${
            active
              ? "text-neon-cyan"
              : danger
                ? "text-neon-red/50 group-hover:text-neon-red"
                : "text-gray-500 group-hover:text-neon-cyan"
          }`}
        />
      )}
      <span className="font-medium tracking-wide">{label}</span>
    </div>
    {shortcut && (
      <span className="text-[9px] text-gray-600 font-mono font-bold group-hover:text-gray-400 transition-colors">
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
  const {
    currentProject,
    closeProject,
    connection,
    toggleIndicatorTray,
    showIndicatorTray,
    sidebarCollapsed,
    toggleSidebar,
    recentProjects,
    notify,
    operation,
  } = useStore();
  const [, navigate] = useLocation();
  const isSyncing = operation?.type === "pull" || operation?.type === "compare";
  const isBurning = operation?.type === "burn";
  const isCommBusy = !!operation;
  const syncState = currentProject?.ecu?.sync?.state;
  const pageSnapshots = currentProject?.constants?.pages || {};
  const hasPendingBurn = Object.values(pageSnapshots).some(
    (snapshot) => snapshot?.syncState === "burn-pending",
  );
  const needsPullCta =
    connection.status === "connected" &&
    syncState !== "fully-verified";

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

  const handleToolbarSync = async () => {
    if (isCommBusy) return;
    await useStore.getState().syncAllFromECU();
  };

  const handleToolbarBurn = async () => {
    if (isCommBusy) return;
    try {
      const result = await useStore.getState().burnPendingPages();
      if (result?.ok) {
        const burned = result.pages?.length || 0;
        notify(
          burned > 0
            ? `Burned ${burned} page(s)`
            : "Nothing to burn",
          burned > 0 ? "success" : "info",
        );
      } else {
        notify(
          `Burn completed with ${result?.errors?.length || 1} issue(s)`,
          "warning",
        );
      }
    } catch (err) {
      notify(`Burn error: ${err.message}`, "error");
    }
  };

  const handleToggleFullscreen = () => {
    closeMenus();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        notify(
          `Error attempting to enable fullscreen: ${err.message}`,
          "error",
        );
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
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
        className="sticky top-0 z-[100] flex items-center h-11 px-4 glass-toolbar glass-noise gap-1 select-none"
        style={{ WebkitAppRegion: "drag" }}
      >
        {/* Subtle top reflection line */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-white/10 z-10" />
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: "no-drag" }}
        >
          <MenuButton
            label="File"
            isOpen={openMenu === "file"}
            onClick={() => handleMenuClick("file")}
          >
            <div className="px-2 py-1.5 mb-1 text-[9px] font-orbitron font-black text-gray-600 uppercase tracking-widest">
              Project Management
            </div>
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
            {recentProjects.length > 0 && (
              <div className="relative group/recent">
                <MenuItem
                  icon={RefreshCcw}
                  label="Recent Projects"
                  onClick={() => {}}
                />
                <div className="absolute left-full top-0 ml-1 hidden group-hover/recent:block">
                  <div className="glass-strong rounded-2xl border border-white/10 shadow-2xl p-2 min-w-[200px]">
                    {recentProjects.slice(0, 5).map((p) => (
                      <MenuItem
                        key={p.filePath}
                        label={p.projectName}
                        onClick={async () => {
                          const proj = await window.projects.loadFile(
                            p.filePath,
                          );
                          if (proj && !proj.error)
                            useStore.getState().setProject(proj);
                          closeMenus();
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Divider />

            <div className="px-2 py-1.5 mb-1 text-[9px] font-orbitron font-black text-gray-600 uppercase tracking-widest">
              Save Actions
            </div>
            <MenuItem
              icon={Save}
              label="Save Project"
              shortcut="Ctrl+S"
              onClick={handleSave}
            />
            <MenuItem icon={Save} label="Save As…" onClick={handleSaveAs} />

            <Divider />

            <MenuItem
              icon={SlidersHorizontalIcon}
              label="Project Settings…"
              onClick={() => {
                setIsProjectSettingsOpen(true);
                closeMenus();
              }}
            />
            <MenuItem
              icon={Settings}
              label="Global Preferences…"
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
            <MenuItem
              icon={Power}
              label="Exit App"
              danger
              onClick={() => window.close()}
            />
          </MenuButton>

          <MenuButton
            label="Edit"
            isOpen={openMenu === "edit"}
            onClick={() => handleMenuClick("edit")}
          >
            <div className="px-2 py-1.5 mb-1 text-[9px] font-orbitron font-black text-gray-600 uppercase tracking-widest">
              History
            </div>
            <MenuItem icon={RefreshCcw} label="Undo" shortcut="Ctrl+Z" />
            <MenuItem icon={RefreshCcw} label="Redo" shortcut="Ctrl+Y" />

            <Divider />

            <div className="px-2 py-1.5 mb-1 text-[9px] font-orbitron font-black text-gray-600 uppercase tracking-widest">
              Tuning Operations
            </div>
            <MenuItem icon={Edit2} label="Copy Table Data" shortcut="Ctrl+C" />
            <MenuItem icon={Edit2} label="Paste & Merge" shortcut="Ctrl+V" />
            <MenuItem icon={SlidersHorizontal} label="Scale Selection..." />
            <MenuItem icon={SlidersHorizontal} label="Interpolate Range" />
          </MenuButton>

          <MenuButton
            label="View"
            isOpen={openMenu === "view"}
            onClick={() => handleMenuClick("view")}
          >
            {currentProject ? (
              <>
                <div className="px-2 py-1.5 mb-1 text-[9px] font-orbitron font-black text-gray-600 uppercase tracking-widest">
                  Workspace Layout
                </div>
                <MenuItem
                  icon={Layout}
                  label={sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
                  onClick={() => {
                    toggleSidebar();
                    closeMenus();
                  }}
                />
                <MenuItem
                  icon={Activity}
                  label={
                    showIndicatorTray ? "Hide Status Bar" : "Show Status Bar"
                  }
                  onClick={() => {
                    toggleIndicatorTray();
                    closeMenus();
                  }}
                  active={showIndicatorTray}
                />

                <Divider />
              </>
            ) : null}

            <div className="px-2 py-1.5 mb-1 text-[9px] font-orbitron font-black text-gray-600 uppercase tracking-widest">
              Atmosphere
            </div>
            <MenuItem
              icon={Maximize}
              label="Toggle Fullscreen"
              shortcut="F11"
              onClick={handleToggleFullscreen}
            />
          </MenuButton>

          <MenuButton
            label="Communications"
            isOpen={openMenu === "comm"}
            onClick={() => handleMenuClick("comm")}
          >
            {currentProject ? (
              <>
                <div className="px-2 py-1.5 mb-1 text-[9px] font-orbitron font-black text-gray-600 uppercase tracking-widest">
                  Connection Control
                </div>
                <MenuItem
                  icon={Activity}
                  label="Connect to ECU"
                  onClick={() => {
                    navigate(ROUTES.COMM);
                    closeMenus();
                  }}
                />
                <MenuItem
                  icon={Power}
                  label="Disconnect"
                  danger
                  onClick={async () => {
                    await window.serial.disconnect();
                    closeMenus();
                  }}
                />

                <Divider />

                <MenuItem
                  icon={RefreshCcw}
                  label="Pull All From ECU"
                  onClick={() => {
                    useStore.getState().syncAllFromECU();
                    closeMenus();
                  }}
                />
                <MenuItem
                  icon={GitCompare}
                  label="Check Sync Status..."
                  onClick={async () => {
                    closeMenus();
                    const {
                      compareWithECU,
                      openSyncDialog,
                      notify,
                      connection,
                    } = useStore.getState();
                    if (connection.status !== "connected") {
                      notify("Connect to ECU first", "error");
                      return;
                    }
                    notify("Checking ECU synchronization...", "info");
                    const results = await compareWithECU();
                    if (!results.error) {
                      openSyncDialog(results);
                    } else {
                      notify(`Sync Check Error: ${results.error}`, "error");
                    }
                  }}
                />
              </>
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-[10px] text-gray-500 font-orbitron uppercase tracking-widest leading-relaxed">
                  Open Project to Enable
                  <br />
                  ECU Communications
                </p>
              </div>
            )}
          </MenuButton>

          <MenuButton
            label="Help"
            isOpen={openMenu === "help"}
            onClick={() => handleMenuClick("help")}
          >
            <MenuItem
              icon={ExternalLink}
              label="Online Documentation"
              onClick={() => {
                window.open("https://speeduino.com/wiki", "_blank");
                closeMenus();
              }}
            />
            <MenuItem
              icon={Github}
              label="Source Code (GitHub)"
              onClick={() => {
                window.open(
                  "https://github.com/sigitlutfi/ryn-speeduino-configurator",
                  "_blank",
                );
                closeMenus();
              }}
            />

            <Divider />

            <MenuItem
              icon={RefreshCcw}
              label="Check for Updates…"
              onClick={() => {
                notify("Checking for regional server updates...", "info");
                setTimeout(
                  () =>
                    notify(
                      "You are running the latest version: v2.4.0-neon",
                      "success",
                    ),
                  1500,
                );
                closeMenus();
              }}
            />
            <MenuItem
              icon={HelpCircle}
              label="About RYN CONFIGURATOR"
              onClick={() => {
                notify("RYN CONFIGURATOR v2.4.0 — Tuning Can Be Fun", "info");
                closeMenus();
              }}
            />
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
          {connection.status === "connected" && (
            <div className="flex items-center gap-2">
              {needsPullCta ? (
                <button
                  onClick={handleToolbarSync}
                  disabled={isCommBusy}
                  className="group flex items-center gap-2 px-3 py-1.5 bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg text-neon-cyan hover:bg-neon-cyan hover:text-black transition-all duration-300 shadow-glow-cyan/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-neon-cyan/10 disabled:hover:text-neon-cyan"
                  title="Pull all settings from ECU RAM"
                >
                  <Download size={12} className={isSyncing ? "animate-bounce" : "group-hover:translate-y-0.5 transition-transform"} />
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    {isSyncing ? "Pulling" : "Pull"}
                  </span>
                </button>
              ) : (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 bg-neon-green/10 border border-neon-green/25 rounded-lg text-neon-green"
                  title="Project matches ECU"
                >
                  <CheckCircle2 size={12} />
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    ECU OK
                  </span>
                </div>
              )}

              {hasPendingBurn || isBurning ? (
                <button
                  onClick={handleToolbarBurn}
                  disabled={isCommBusy}
                  className="group flex items-center gap-2 px-3 py-1.5 bg-neon-yellow/10 border border-neon-yellow/30 rounded-lg text-neon-yellow hover:bg-neon-yellow hover:text-black transition-all duration-300 shadow-glow-yellow/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-neon-yellow/10 disabled:hover:text-neon-yellow"
                  title="Save pending changes permanently to ECU"
                >
                  <Zap size={12} className={`fill-current ${isBurning ? "animate-pulse" : ""}`} />
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    {isBurning ? "Burning" : "Burn"}
                  </span>
                </button>
              ) : (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-400"
                  title="No permanent-save action pending"
                >
                  <span className="w-2 h-2 rounded-full bg-white/20" />
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    Saved
                  </span>
                </div>
              )}
            </div>
          )}

          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate(ROUTES.COMM)}
            title="Click to manage ECU connection"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${connection.status === "connected" ? "bg-neon-green animate-pulse" : "bg-gray-700"}`}
            />
            <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest">
              {connection.status}
            </span>
          </div>

          <button
            onClick={toggleIndicatorTray}
            className={`p-1.5 rounded-lg transition-all flex items-center gap-2 group ${showIndicatorTray ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 shadow-glow-cyan/20" : "text-gray-500 hover:text-white hover:bg-white/5 border border-transparent"}`}
            title="Toggle Engine Indicators"
          >
            <Activity
              size={14}
              className={showIndicatorTray ? "animate-pulse" : ""}
            />
            <span className="text-[9px] font-black uppercase tracking-widest hidden lg:block">
              Status
            </span>
          </button>
        </div>

        {operation && (
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-neon-cyan via-neon-green to-neon-yellow transition-all duration-300"
              style={{
                width:
                  operation.total && operation.total > 0
                    ? `${Math.max(8, Math.min(100, (operation.current / operation.total) * 100))}%`
                    : "35%",
              }}
            />
          </div>
        )}
      </div>
      {operation && (
        <div className="sticky top-11 z-[99] px-4 -mt-px">
          <div className="mx-auto max-w-full flex items-center justify-between gap-3 px-3 py-1.5 bg-black/40 border-x border-b border-white/10 rounded-b-xl backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/85">
              <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
              <span>{operation.label}</span>
            </div>
            <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400">
              {operation.total && operation.total > 0
                ? `${Math.min(operation.current, operation.total)}/${operation.total}`
                : operation.stage}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
