import { useLiveTelemetry } from '../shared/hooks/useLiveTelemetry.js';
import React from "react";
import { Activity, Zap, Cpu, AlertTriangle, RefreshCw } from "lucide-react";
import TuningHeader from "../shared/components/TuningHeader";

const StatCard = ({ label, value, unit = "", icon: Icon, color = "cyan" }) => (
  <div className="p-8 rounded-[40px] glass-card border border-white/5 space-y-6 relative overflow-hidden group">
    <div
      className={`absolute top-0 right-0 w-32 h-32 bg-neon-${color}/5 blur-[60px] pointer-events-none group-hover:bg-neon-${color}/10 transition-all`}
    />
    <div className="flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-2xl bg-neon-${color}/10 flex items-center justify-center border border-neon-${color}/20`}
      >
        <Icon className={`text-neon-${color}`} size={24} />
      </div>
      <div className="space-y-1">
        <h3 className="text-lx font-black text-white uppercase italic tracking-tighter">
          {label}
        </h3>
        <p className="text-[8px] text-white/30 uppercase tracking-[0.3em]">
          Hardware Metrics
        </p>
      </div>
    </div>
    <div className="flex items-baseline gap-3">
      <span
        className={`text-[60px] font-mono font-black text-white leading-none tracking-tighter glow-${color}`}
      >
        {value}
      </span>
      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
        {unit}
      </span>
    </div>
  </div>
);

const ProtocolStats = () => {
  const { realtime, status: telemetryStatus } = useLiveTelemetry();

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden h-screen animate-in fade-in duration-700">
      <TuningHeader
        title="Protocol Stats"
        subtitle="ECU Performance & Communication Integrity"
        status={telemetryStatus.toUpperCase()}
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-10 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          <StatCard
            label="Main Loop Rate"
            value={realtime?.loopsPerSecond ?? '—'}
            unit="Hz"
            icon={RefreshCw}
            color="cyan"
          />
          <StatCard
            label="Sync Loss Count"
            value={realtime?.syncLossCounter ?? '—'}
            unit="errors"
            icon={AlertTriangle}
            color="red"
          />
          <StatCard
            label="Free System RAM"
            value={realtime?.freeRAM ?? '—'}
            unit="bytes"
            icon={Cpu}
            color="green"
          />
        </div>

        <div className="mt-20 p-12 rounded-[50px] border border-white/5 bg-white/[0.01] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
          <div className="flex flex-col gap-10">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h4 className="text-xl font-black text-white uppercase italic">
                  Protocol Integrity
                </h4>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.3em]">
                  Communication Stream Health Scan
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                    CRC Errors
                  </span>
                  <span className="text-xl font-mono font-black text-white">
                    <span title="Host CRC error counters are not collected">—</span>
                  </span>
                </div>
                <div className="h-10 w-[1px] bg-white/10" />
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                    Timeouts
                  </span>
                  <span className="text-xl font-mono font-black text-white">
                    <span title="Host timeout counters are not collected">—</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="h-[200px] w-full border border-dashed border-white/10 rounded-[30px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 opacity-20">
                <Zap size={48} />
                <span className="text-[10px] font-black uppercase tracking-[0.5em]">
                  Realtime Stream Monitor Placeholder
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProtocolStats;
