import React, { useCallback } from "react";
import { useStore } from "../../core/store.js";
import Gauge from "../../ui/Gauge/Index.jsx";
import RealtimeChart from "../../ui/Layout/RealtimeChart.jsx";

function StatRow({ label, value, unit }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/5 text-sm group transition-all">
      <span className="text-gray-500 font-medium group-hover:text-gray-300 transition-colors">
        {label}
      </span>
      <span className="font-mono text-white flex items-baseline">
        {value}
        <span className="text-gray-600 text-[10px] ml-1 uppercase font-inter">
          {unit}
        </span>
      </span>
    </div>
  );
}

export default function Dashboard() {
  const rt = useStore((s) => s.realtime);
  const isConnected = useStore((s) => s.connection.status === "connected");

  const getRpm = useCallback(() => useStore.getState().realtime.rpm, []);
  const getMap = useCallback(() => useStore.getState().realtime.map, []);
  const getAfr = useCallback(() => useStore.getState().realtime.afr * 10, []);

  const convertTemp = useStore((s) => s.convertTemp);
  const convertPress = useStore((s) => s.convertPress);
  const convertSpeed = useStore((s) => s.convertSpeed);
  const tempUnit = useStore((s) => s.tempUnit);
  const pressUnit = useStore((s) => s.pressUnit);
  const speedUnit = useStore((s) => s.speedUnit);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
        <div className="w-16 h-16 rounded-full border border-white/5 flex items-center justify-center bg-white/5 animate-pulse">
          <svg
            className="w-8 h-8 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <p className="font-orbitron text-xs tracking-[0.2em] uppercase opacity-60">
          Waiting for connection
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 grid grid-cols-1 gap-6 overflow-y-auto h-full custom-scrollbar">
      {/* Engine status badge */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-[10px] font-orbitron font-bold text-gray-600 uppercase tracking-widest mr-2">
          Status:
        </span>
        {rt.engine?.running && (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-neon-green/10  text-neon-green  border border-neon-green/20  box-glow-green">
            RUNNING
          </span>
        )}
        {rt.engine?.cranking && (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/20">
            CRANKING
          </span>
        )}
        {rt.engine?.warmup && (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-neon-cyan/10  text-neon-cyan  border border-neon-cyan/20">
            WARMUP
          </span>
        )}
        {rt.engine?.ase && (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-neon-purple/10 text-neon-purple border border-neon-purple/20">
            ASE
          </span>
        )}
        {rt.engine?.accelTPS && (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-neon-orange/10 text-neon-orange border border-neon-orange/20">
            ACCEL
          </span>
        )}
      </div>

      {/* Main gauges */}
      <div className="flex flex-wrap justify-around gap-8 glass rounded-2xl p-8 border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-3xl pointer-events-none" />
        <Gauge
          label="RPM"
          value={rt.rpm}
          min={0}
          max={8000}
          unit="rpm"
          size={180}
          warning={6000}
          danger={7000}
        />
        <Gauge
          label="MAP"
          value={convertPress(rt.map)}
          min={convertPress(20)}
          max={convertPress(110)}
          unit={pressUnit()}
          size={140}
          decimals={pressUnit() === "kPa" ? 0 : 1}
        />
        <Gauge
          label="TPS"
          value={rt.tps}
          min={0}
          max={100}
          unit="%"
          size={140}
        />
        <Gauge
          label="AFR"
          value={rt.afr}
          min={9}
          max={20}
          unit="λ"
          size={140}
          decimals={1}
          warning={16}
          danger={17}
        />
        <Gauge
          label="Coolant"
          value={convertTemp(rt.coolant)}
          min={convertTemp(-20)}
          max={convertTemp(120)}
          unit={tempUnit()}
          size={140}
          warning={convertTemp(100)}
          danger={convertTemp(110)}
        />
        <Gauge
          label="IAT"
          value={convertTemp(rt.iat)}
          min={convertTemp(-20)}
          max={convertTemp(80)}
          unit={tempUnit()}
          size={140}
          warning={convertTemp(50)}
          danger={convertTemp(65)}
        />
        <Gauge
          label="Battery"
          value={rt.battery}
          min={8}
          max={16}
          unit="V"
          size={140}
          decimals={1}
          warning={11}
          danger={10}
        />
        <Gauge
          label="Advance"
          value={rt.advance}
          min={-10}
          max={50}
          unit="°"
          size={140}
          decimals={0}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RealtimeChart
          getValue={getRpm}
          label="RPM"
          color="#00ffb4"
          min={0}
          max={8000}
        />
        <RealtimeChart
          getValue={getMap}
          label="MAP"
          color="#00d4ff"
          min={20}
          max={110}
        />
        <RealtimeChart
          getValue={getAfr}
          label="AFR"
          color="#ff6b35"
          min={90}
          max={180}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="text-[10px] text-neon-cyan mb-4 font-orbitron font-bold uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan glow-cyan" />{" "}
            Fuel
          </div>
          <StatRow label="VE" value={rt.ve} unit="%" />
          <StatRow label="PW1" value={rt.pw1?.toFixed(2)} unit="ms" />
          <StatRow label="Corrections" value={rt.corrections} unit="%" />
          <StatRow label="Ethanol" value={rt.ethanolPct} unit="%" />
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-[10px] text-neon-purple mb-4 font-orbitron font-bold uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-purple" />{" "}
            Ignition
          </div>
          <StatRow label="Advance" value={rt.advance} unit="°" />
          <StatRow label="Dwell" value={rt.dwell?.toFixed(1)} unit="ms" />
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-[10px] text-neon-orange mb-4 font-orbitron font-bold uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-orange" /> Sensors
          </div>
          <StatRow
            label="Baro"
            value={convertPress(rt.baro)?.toFixed(
              pressUnit() === "kPa" ? 0 : 2,
            )}
            unit={pressUnit()}
          />
          <StatRow
            label="VSS"
            value={convertSpeed(rt.vss)?.toFixed(0)}
            unit={speedUnit()}
          />
          <StatRow label="Gear" value={rt.gear} unit="" />
        </div>
      </div>
    </div>
  );
}
