import React, { useState } from "react";
import {
  FlaskConical,
  Flag,
  Activity,
  Database,
  Flame,
  Target,
  Settings,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Radio,
  ChevronDown,
  Thermometer,
  Droplets,
  Zap,
  Plug,
  Terminal,
  ShieldAlert,
  Clock,
  Wrench,
  BarChart2,
  Snail,
  Table,
  Ratio,
  FileX,
  Table2,
  Fuel,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ROUTES } from "../routes.js";
import { useStore } from "../core/store.js";

/**
 * Modern Neon Sidebar Configuration
 * Each category has its own theme color for better visual hierarchy.
 */
const NAV_CONFIG = [
  {
    category: "MONITOR & LOGS",
    icon: Activity,
    theme: "cyan",
    items: [
      { path: ROUTES.DASHBOARD, label: "Realtime View", icon: Activity },
      {
        path: ROUTES.RACING_PROFILES,
        label: "Runtime Profiles",
        icon: ShieldAlert,
        theme: "cyan",
      },
      { path: ROUTES.ANALYSIS, label: "Telemetries", icon: BarChart2 },
    ],
  },
  {
    category: "ENGINE FUNDAMENTALS",
    icon: Cpu,
    theme: "white",
    items: [
      { path: ROUTES.SETTINGS_ENGINE, label: "Master Setup", icon: Cpu },
      {
        path: ROUTES.SETTINGS_CALIBRATION,
        label: "Sensor Calibrations",
        icon: Wrench,
      },
      {
        path: ROUTES.SETTINGS_INJECTOR,
        label: "Injector Char",
        icon: Droplets,
      },
      { path: ROUTES.SETTINGS_TRIGGER, label: "Trigger Setup", icon: Zap },
      { path: ROUTES.SETTINGS_BOOST, label: "Boost Control", icon: Snail },
      { path: ROUTES.SETTINGS_VVT, label: "VVT Control", icon: Settings },
      {
        path: ROUTES.SETTINGS_PROTECTION,
        label: "Safety / Cut",
        icon: ShieldAlert,
      },
    ],
  },
  {
    category: "FUEL TUNING",
    icon: Fuel,
    theme: "green",
    items: [
      { path: ROUTES.TUNING_VE, label: "VE Table 1", icon: Table2 },
      {
        path: ROUTES.TUNING_VE2,
        label: "VE Table 2",
        icon: Table,
        sub: true,
      },
      { path: ROUTES.TUNING_AFR, label: "AFR Target", icon: Ratio },
      {
        path: ROUTES.SETTINGS_FUEL,
        label: "Fuel Strategy",
        icon: Settings,
      },
      { path: ROUTES.SETTINGS_AFR, label: "O2 Settings", icon: Settings },
      { path: ROUTES.SETTINGS_FLEX, label: "Flex Fuel", icon: FlaskConical },
      {
        path: ROUTES.SETTINGS_IAT,
        label: "IAT Compensation",
        icon: Thermometer,
      },
      {
        path: ROUTES.SETTINGS_STAGED,
        label: "Staged Injection",
        icon: Droplets,
      },
    ],
  },
  {
    category: "IGNITION / SPARK",
    icon: Flame,
    theme: "orange",
    items: [
      { path: ROUTES.TUNING_IGNITION, label: "Spark Table 1", icon: Flame },
      {
        path: ROUTES.TUNING_IGNITION2,
        label: "Spark Table 2",
        icon: Flame,
        sub: true,
      },
      { path: ROUTES.SETTINGS_SPARK, label: "Spark Settings", icon: Zap },
    ],
  },
  {
    category: "STARTUP & IDLE",
    icon: Clock,
    theme: "yellow",
    items: [
      { path: ROUTES.STARTUP_CRANKING, label: "Cranking Setup", icon: Zap },
      { path: ROUTES.STARTUP_CURVES, label: "ASE/WUE Curves", icon: Droplets },
      { path: ROUTES.STARTUP_IDLE, label: "Idle Control", icon: Settings },
    ],
  },
  {
    category: "RACING",
    icon: Flag,
    theme: "red",
    items: [
      { path: ROUTES.RACING_LAUNCH, label: "Launch Control", icon: Flag },
      {
        path: ROUTES.RACING_FLATSHIFT,
        label: "Flat Shift",
        icon: Zap,
        theme: "orange",
      },
      {
        path: ROUTES.RACING_PITLIMITER,
        label: "Pit Limiter",
        icon: Snail,
        theme: "cyan",
      },
      {
        path: ROUTES.RACING_RUMBLEIDLE,
        label: "Rumble Idle",
        icon: Activity,
        theme: "orange",
      },
      {
        path: ROUTES.RACING_ANTILAG,
        label: "Anti-Lag System",
        icon: Flame,
        theme: "red",
      },

      {
        path: ROUTES.RACING_NITROUS,
        label: "Nitrous Oxide",
        icon: Flame,
      },
      { path: ROUTES.SETTINGS_WMI, label: "WMI Control", icon: FlaskConical },
    ],
  },
  {
    category: "Add On",
    icon: Plug,
    theme: "purple",
    items: [
      {
        path: ROUTES.SETTINGS_PROGRAMMABLE,
        label: "Prog. Outputs",
        icon: Plug,
      },
      { path: ROUTES.SETTINGS_FAN, label: "Fan Control", icon: Activity },

      { path: ROUTES.ADDON_FUELPUMP, label: "Fuel Pump", icon: Droplets },
      { path: ROUTES.SETTINGS_TACHO, label: "Tacho Control", icon: Activity },
    ],
  },
  {
    category: "SYSTEM TOOLS",
    icon: Wrench,
    theme: "white",
    items: [
      {
        path: ROUTES.TOOLS_DIAGNOSTICS,
        label: "Protocol Stats",
        icon: Activity,
      },
      { path: ROUTES.COMM, label: "Communication", icon: Radio },
      { path: ROUTES.TERMINAL, label: "Raw Console", icon: Terminal },
      {
        path: ROUTES.APP_SETTINGS,
        label: "Global Preferences",
        icon: Settings,
      },
    ],
  },
];

const NavItem = ({
  path,
  label,
  icon: Icon,
  collapsed,
  theme = "cyan",
  isActive,
  sub = false,
}) => {
  const [_, navigate] = useLocation();

  const themeClasses = {
    cyan: "text-[#00d4ff] bg-[#00d4ff]/5 border-[#00d4ff]/20 shadow-[0_0_15px_rgba(0,212,255,0.1)]",
    green:
      "text-[#00ffb4] bg-[#00ffb4]/5 border-[#00ffb4]/20 shadow-[0_0_15px_rgba(0,255,180,0.1)]",
    orange:
      "text-[#ff6b35] bg-[#ff6b35]/5 border-[#ff6b35]/20 shadow-[0_0_15px_rgba(255,107,53,0.1)]",
    red: "text-[#f43f5e] bg-[#f43f5e]/5 border-[#f43f5e]/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]",
    purple:
      "text-[#a855f7] bg-[#a855f7]/5 border-[#a855f7]/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]",
    yellow:
      "text-[#eab308] bg-[#eab308]/5 border-[#eab308]/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]",
    white:
      "text-white bg-white/5 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]",
  };

  const activeTheme = themeClasses[theme] || themeClasses.cyan;

  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(path)}
      className={`w-full flex items-center gap-2.5 ${
        collapsed
          ? "justify-center py-2"
          : sub
            ? "pl-8 pr-2 py-1.5"
            : "px-3 py-2"
      } rounded-lg transition-all relative group overflow-hidden ${
        isActive
          ? `${activeTheme} border`
          : "text-gray-500 hover:text-white border border-transparent hover:bg-white/5"
      }`}
    >
      {isActive && !collapsed && (
        <motion.div
          layoutId="active-nav-line"
          className="absolute left-0 w-0.5 h-3/5 rounded-full"
          style={{
            backgroundColor:
              theme === "white"
                ? "white"
                : theme === "cyan"
                  ? "#00d4ff"
                  : theme === "green"
                    ? "#00ffb4"
                    : theme === "orange"
                      ? "#ff6b35"
                      : theme === "purple"
                        ? "#a855f7"
                        : theme === "yellow"
                          ? "#eab308"
                          : "#f43f5e", // red
          }}
        />
      )}

      <div
        className={`p-1 rounded-md shrink-0 ${isActive ? "bg-white/5" : "bg-transparent"}`}
      >
        <Icon size={sub ? 14 : 16} strokeWidth={isActive ? 2.5 : 2} />
      </div>

      {!collapsed && (
        <span
          className={`${sub ? "text-[8px]" : "text-[9px]"} font-orbitron font-black uppercase tracking-widest ${isActive ? "opacity-100" : "opacity-60"}`}
        >
          {label}
        </span>
      )}
    </motion.button>
  );
};

export default function Sidebar() {
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const [location] = useLocation();
  const [openSections, setOpenSections] = useState({
    "MONITOR & LOGS": true,
    "ENGINE FUNDAMENTALS": true,
    "FUEL TUNING": false,
    "IGNITION / SPARK": false,
    "STARTUP & IDLE": false,
    "ADDONS & RACING": false,
    "SYSTEM TOOLS": false,
  });

  const toggleSection = (key) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      className="h-full glass-sidebar backdrop-blur-xl  flex flex-col relative z-20 group"
    >
      {/* Branding Section */}
      <div
        className={`h-16 flex items-center ${collapsed ? "justify-center" : "px-8"} relative overflow-hidden`}
      >
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10 transition-all">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner group overflow-hidden">
            <img
              src={new URL("../assets/logo.png", import.meta.url).href}
              alt="RYN"
              className="w-10 h-10 object-contain group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(0,212,255,0.4)]"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-[14px] font-orbitron font-black text-white uppercase tracking-[0.2em] leading-none">
                RYN
              </span>
              <span className="text-[8px] font-black text-neon-cyan uppercase tracking-[0.4em] mt-1.5 opacity-80">
                CONFIGURATOR
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-8">
        {NAV_CONFIG.map((group) => {
          const isOpen = openSections[group.category];
          const hasActiveInGroup = group.items.some(
            (item) =>
              location === item.path || location.startsWith(item.path + "/"),
          );

          return (
            <div key={group.category} className="space-y-3">
              <button
                onClick={() => !collapsed && toggleSection(group.category)}
                className={`w-full flex items-center rounded-md transition-all ${
                  collapsed
                    ? "justify-center p-2.5"
                    : "justify-between px-2.5 py-2 hover:bg-white/5 active:bg-white/10"
                } group`}
              >
                {!collapsed ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[8px] font-orbitron font-black uppercase tracking-[0.3em] ${hasActiveInGroup ? "text-white" : "text-white/30"} transition-colors`}
                      >
                        {group.category}
                      </span>
                    </div>
                    <ChevronDown
                      size={10}
                      className={`text-white/20 group-hover:text-white transition-all ${isOpen ? "" : "-rotate-90"}`}
                    />
                  </>
                ) : (
                  <group.icon
                    size={16}
                    className={`${hasActiveInGroup ? "text-white" : "text-white/20"} transition-colors`}
                  />
                )}
              </button>

              <AnimatePresence>
                {(isOpen || collapsed) && (
                  <motion.div
                    initial={
                      collapsed ? { opacity: 1 } : { height: 0, opacity: 0 }
                    }
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-1.5 overflow-hidden"
                  >
                    {group.items.map((item) => (
                      <NavItem
                        key={item.path}
                        {...item}
                        collapsed={collapsed}
                        theme={group.theme}
                        isActive={
                          location === item.path ||
                          location.startsWith(item.path + "/")
                        }
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Collapse Handle (Floating Style) */}
      <button
        onClick={toggleSidebar}
        className="mx-4 my-6 py-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 flex items-center justify-center text-white/40 hover:text-white transition-all group"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {/* Footer / Connection Alert */}
      {/* {!collapsed && (
        <div className="p-6 bg-black/40 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[7px] font-black text-gray-600 uppercase tracking-widest">
                ECU Status
              </span>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse shadow-neon-cyan" />
                <span className="text-[9px] font-black font-orbitron text-white uppercase tracking-widest">
                  Connected
                </span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 flex items-center justify-center text-neon-cyan shadow-neon-cyan">
              <Radio size={14} className="animate-pulse" />
            </div>
          </div>
        </div>
      )} */}
    </motion.aside>
  );
}
