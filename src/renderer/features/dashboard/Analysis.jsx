import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useStore } from "../../core/store.js";
import RealtimeChart from "../../ui/Layout/RealtimeChart.jsx";
import TuningHeader from "../shared/components/TuningHeader";
import {
  Play,
  Circle,
  Trash2,
  Download,
  Activity,
  Zap,
  Thermometer,
  Wind,
  Layers,
  Save,
  Clock,
} from "lucide-react";

/**
 * High-Performance Analysis View
 * Uses uPlot for real-time telemetry trace.
 */
const Analysis = () => {
  const {
    realtime,
    logRecording,
    logEntries,
    setLogRecording,
    clearLog,
    connection,
  } = useStore();

  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState("00:00:00");

  const isConnected = connection.status === "connected";

  // Helper to format durations
  useEffect(() => {
    let interval;
    if (logRecording && startTime) {
      interval = setInterval(() => {
        const ms = Date.now() - startTime;
        const h = Math.floor(ms / 3600000)
          .toString()
          .padStart(2, "0");
        const m = Math.floor((ms % 3600000) / 60000)
          .toString()
          .padStart(2, "0");
        const s = Math.floor((ms % 60000) / 1000)
          .toString()
          .padStart(2, "0");
        setElapsed(`${h}:${m}:${s}`);
      }, 1000);
    } else {
      setElapsed("00:00:00");
    }
    return () => clearInterval(interval);
  }, [logRecording, startTime]);

  const toggleRecording = () => {
    if (!logRecording) {
      setStartTime(Date.now());
      setLogRecording(true);
    } else {
      setLogRecording(false);
      setStartTime(null);
    }
  };

  // Chart Getters (Memoized for uPlot stability)
  const getRpm = useCallback(() => useStore.getState().realtime.rpm, []);
  const getTps = useCallback(() => useStore.getState().realtime.tps, []);
  const getMap = useCallback(() => useStore.getState().realtime.map, []);
  const getAfr = useCallback(() => useStore.getState().realtime.afr, []);
  const getPw1 = useCallback(() => useStore.getState().realtime.pw1, []);
  const getAdvance = useCallback(
    () => useStore.getState().realtime.advance,
    [],
  );
  const getClt = useCallback(() => useStore.getState().realtime.coolant, []);
  const getIat = useCallback(() => useStore.getState().realtime.iat, []);

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden h-screen animate-in fade-in duration-700">
      {/* <TuningHeader
        title="Live Analysis"
        subtitle="High-Resolution Telemetry Trace & Data Insights"
        status={
          logRecording ? "RECORDING" : isConnected ? "CONNECTED" : "OFFLINE"
        }
      /> */}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Trace Toolbar */}
        <div className="px-10 py-6 border-b border-white/5 flex items-center justify-between glass shadow-xl z-20">
          <div className="flex items-center gap-6">
            <button
              onClick={toggleRecording}
              disabled={!isConnected}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-orbitron font-bold text-[10px] uppercase tracking-widest transition-all ${
                logRecording
                  ? "bg-neon-red text-white shadow-glow-red"
                  : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
              } disabled:opacity-20`}
            >
              {logRecording ? (
                <Circle className="animate-pulse fill-white" size={12} />
              ) : (
                <Play size={12} />
              )}
              {logRecording ? "Stop Recording" : "Start Session"}
            </button>

            <div className="h-8 w-[1px] bg-white/10" />

            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">
                  Session Time
                </span>
                <span
                  className={`text-sm font-mono font-black ${logRecording ? "text-neon-cyan" : "text-white/40"}`}
                >
                  {elapsed}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">
                  Buffer Depth
                </span>
                <span className="text-sm font-mono font-black text-white/40">
                  {logEntries.length} pts
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={clearLog}
              className="p-3 rounded-xl bg-white/5 text-white/30 hover:text-white hover:bg-white/10 transition-all"
              title="Clear Buffer"
            >
              <Trash2 size={16} />
            </button>
            <button
              className="p-3 rounded-xl bg-white/5 text-white/30 hover:text-white hover:bg-white/10 transition-all"
              title="Export CSV"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Trace Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-12 pb-32">
          {/* Core Dynamics Category */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 opacity-40">
              <Activity size={16} />
              <h4 className="text-[10px] font-orbitron font-black uppercase tracking-[0.4em]">
                Core Dynamics
              </h4>
              <div className="flex-1 h-[1px] bg-white/10" />
            </div>
            <div className="grid grid-cols-1 gap-6">
              <RealtimeChart
                getValue={getRpm}
                label="Engine Speed (RPM)"
                color="#00ffb4"
                min={0}
                max={8000}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <RealtimeChart
                  getValue={getTps}
                  label="Throttle Position (TPS %)"
                  color="#ff6b35"
                  min={0}
                  max={100}
                />
                <RealtimeChart
                  getValue={getMap}
                  label="Manifold Pressure (MAP kPa)"
                  color="#00d4ff"
                  min={20}
                  max={250}
                />
              </div>
            </div>
          </div>

          {/* Combustion & Fuel Category */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 opacity-40">
              <Zap size={16} />
              <h4 className="text-[10px] font-orbitron font-black uppercase tracking-[0.4em]">
                Mixture & Combustion
              </h4>
              <div className="flex-1 h-[1px] bg-white/10" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <RealtimeChart
                getValue={getAfr}
                label="Air/Fuel Ratio (AFR)"
                color="#f43f5e"
                min={9}
                max={20}
              />
              <RealtimeChart
                getValue={getAdvance}
                label="Ignition Advance (°)"
                color="#a855f7"
                min={-10}
                max={50}
              />
              <RealtimeChart
                getValue={getPw1}
                label="Pulse Width 1 (ms)"
                color="#eab308"
                min={0}
                max={20}
              />
            </div>
          </div>

          {/* Thermal Category */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 opacity-40">
              <Thermometer size={16} />
              <h4 className="text-[10px] font-orbitron font-black uppercase tracking-[0.4em]">
                Thermal Monitoring
              </h4>
              <div className="flex-1 h-[1px] bg-white/10" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <RealtimeChart
                getValue={getClt}
                label="Coolant Temp (°C)"
                color="#0ea5e9"
                min={-20}
                max={120}
              />
              <RealtimeChart
                getValue={getIat}
                label="Intake Air Temp (°C)"
                color="#06b6d4"
                min={-20}
                max={100}
              />
            </div>
          </div>
        </div>

        {/* Global Chart Decorators */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 opacity-5 pointer-events-none">
          <Layers size={200} />
        </div>
      </div>
    </div>
  );
};

export default Analysis;
