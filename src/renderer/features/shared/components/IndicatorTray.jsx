import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Activity,
  Zap,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "../../../core/store.js";

const Indicator = ({
  label,
  active,
  onLabel,
  offLabel,
  onColor = "neon-green",
  offColor = "gray-700",
}) => {
  const colorMap = {
    "neon-green": "bg-neon-green shadow-glow-green",
    "neon-red": "bg-neon-red shadow-glow-red",
    "neon-yellow": "bg-neon-yellow shadow-glow-yellow",
    "neon-cyan": "bg-neon-cyan shadow-glow-cyan",
    "gray-700": "bg-gray-700",
  };

  return (
    <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group h-[42px]">
      <div className="flex flex-col min-w-0">
        <span className="text-[8px] font-black uppercase tracking-widest text-white/30 group-hover:text-white/50 transition-colors truncate">
          {label}
        </span>
        <span
          className={`text-[10px] font-bold truncate ${active ? "text-white" : "text-white/20"}`}
        >
          {active ? onLabel : offLabel}
        </span>
      </div>
      <div
        className={`w-2 h-2 flex-shrink-0 rounded-full transition-all duration-300 ${active ? colorMap[onColor] : colorMap[offColor]}`}
      />
    </div>
  );
};

const GroupHeader = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-2 px-1 mb-1.5 mt-4 first:mt-0 col-span-2">
    <Icon size={12} className="text-white/20" />
    <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">
      {label}
    </span>
  </div>
);

export default function IndicatorTray() {
  const { showIndicatorTray, toggleIndicatorTray, realtime } = useStore();
  const { engine, performance } = realtime;

  if (!showIndicatorTray) return null;

  const indicators = [
    {
      group: "Engine Status",
      icon: Activity,
      items: [
        {
          label: "Running State",
          active: engine.running,
          onLabel: "RUNNING",
          offLabel: "STOPPED",
        },
        {
          label: "Cranking",
          active: engine.cranking,
          onLabel: "CRANKING",
          offLabel: "OFF",
        },
        {
          label: "Sync Status",
          active: engine.sync,
          onLabel: "FULL SYNC",
          offLabel: "NO SYNC",
          onColor: "neon-green",
          offColor: "neon-red",
        },
        {
          label: "Half Sync",
          active: engine.halfSync,
          onLabel: "HALF SYNC",
          offLabel: "OFF",
          onColor: "neon-yellow",
        },
        {
          label: "Idle Control",
          active: engine.idleControl,
          onLabel: "ACTIVE",
          offLabel: "OFF",
          onColor: "neon-cyan",
        },
        {
          label: "DFCO (Decel)",
          active: engine.dfco,
          onLabel: "ACTIVE",
          offLabel: "OFF",
          onColor: "neon-red",
        },
      ],
    },
    {
      group: "Fuel & Air Corrections",
      icon: Zap,
      items: [
        {
          label: "Warmup (WUE)",
          active: engine.warmup,
          onLabel: "ENRICH",
          offLabel: "OFF",
          onColor: "neon-cyan",
        },
        {
          label: "Afterstart (ASE)",
          active: engine.ase,
          onLabel: "ENRICH",
          offLabel: "OFF",
          onColor: "neon-cyan",
        },
        {
          label: "TPS Accel",
          active: engine.accelTPS,
          onLabel: "ACCEL",
          offLabel: "IDLE",
          onColor: "neon-green",
        },
        {
          label: "MAP Accel",
          active: engine.accelMAP,
          onLabel: "ACCEL",
          offLabel: "IDLE",
          onColor: "neon-green",
        },
        {
          label: "Boost Cut",
          active: engine.boostCutSpark || engine.boostCutFuel,
          onLabel: "ACTIVE",
          offLabel: "OK",
          onColor: "neon-red",
        },
        {
          label: "Staging",
          active: engine.stagingActive,
          onLabel: "ACTIVE",
          offLabel: "OFF",
          onColor: "neon-green",
        },
      ],
    },
    {
      group: "Limiters & Protection",
      icon: ShieldAlert,
      items: [
        {
          label: "Hard Limit",
          active: engine.hardLimit,
          onLabel: "ACTIVE",
          offLabel: "OK",
          onColor: "neon-red",
        },
        {
          label: "Soft Limit",
          active: engine.softLimit,
          onLabel: "ACTIVE",
          offLabel: "OK",
          onColor: "neon-yellow",
        },
        {
          label: "Launch (H)",
          active: engine.launchHard,
          onLabel: "ACTIVE",
          offLabel: "OFF",
          onColor: "neon-green",
        },
        {
          label: "Launch (S)",
          active: engine.launchSoft,
          onLabel: "ACTIVE",
          offLabel: "OFF",
          onColor: "neon-yellow",
        },
        {
          label: "Prot. Active",
          active: engine.protectActive,
          onLabel: "PROTECT!",
          offLabel: "OK",
          onColor: "neon-red",
        },
        {
          label: "Prot. RPM",
          active: engine.protectRPM,
          onLabel: "RPM!",
          offLabel: "OK",
          onColor: "neon-red",
        },
        {
          label: "Prot. MAP",
          active: engine.protectMAP,
          onLabel: "BOOST!",
          offLabel: "OK",
          onColor: "neon-red",
        },
        {
          label: "Prot. CLT",
          active: engine.protectCLT,
          onLabel: "TEMP!",
          offLabel: "OK",
          onColor: "neon-red",
        },
      ],
    },
    {
      group: "Performance Features",
      icon: Zap,
      items: [
        {
          label: "Pit Limiter",
          active: performance.pitLimiterActive,
          onLabel: "ACTIVE",
          offLabel: "OFF",
          onColor: "neon-red",
        },
        {
          label: "Rumble Idle",
          active: performance.rumbleIdleActive,
          onLabel: "ACTIVE",
          offLabel: "OFF",
          onColor: "neon-green",
        },
        {
          label: "ALS Active",
          active: performance.alsActive,
          onLabel: "ACTIVE",
          offLabel: "OFF",
          onColor: "neon-red",
        },
      ],
    },
    {
      group: "Diagnostics & I/O",
      icon: AlertTriangle,
      items: [
        {
          label: "EEPROM Burn",
          active: engine.burnPending,
          onLabel: "PENDING",
          offLabel: "OK",
          onColor: "neon-yellow",
        },
        {
          label: "VVT1 Error",
          active: engine.vvt1Error,
          onLabel: "ERROR",
          offLabel: "OK",
          onColor: "neon-red",
        },
        {
          label: "WMI Tank",
          active: engine.wmiEmpty,
          onLabel: "EMPTY",
          offLabel: "OK",
          onColor: "neon-red",
        },
        {
          label: "I/O Error",
          active: engine.ioError,
          onLabel: "ERROR",
          offLabel: "OK",
          onColor: "neon-red",
        },
      ],
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-10 right-0 bottom-0 w-[420px] bg-bg-deep/50  backdrop-blur-3xl border-l border-white/10 z-[100] flex flex-col shadow-3xl shadow-black"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-black/40">
          <div className="flex flex-col">
            <h2 className="text-[12px] font-orbitron font-black text-neon-cyan uppercase tracking-[0.4em]">
              Real-time Indicators
            </h2>
            <span className="text-[8px] font-mono font-bold text-white/20 uppercase tracking-widest mt-1">
              Diagnostic Matrix View
            </span>
          </div>
          <button
            onClick={toggleIndicatorTray}
            className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {indicators.map((group) => (
              <React.Fragment key={group.group}>
                <GroupHeader icon={group.icon} label={group.group} />
                {group.items.map((item) => (
                  <Indicator key={item.label} {...item} />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 bg-black/40">
          <div className="flex items-center gap-3">
            <div
              className={`w-1.5 h-1.5 rounded-full ${engine.running ? "bg-neon-green animate-pulse" : "bg-gray-700"}`}
            />
            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest leading-none">
              OCH Protocol v4.0 Active
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
