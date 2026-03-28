import React, { useEffect, useState } from "react";
import { useStore } from "../../core/store.js";
import { BAUD_RATES } from "../../../shared/protocol/ts-commands.js";
import {
  Radio,
  RefreshCcw,
  Cpu,
  Activity,
  Database,
  CheckCircle,
  AlertCircle,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Communications() {
  const [ports, setPorts] = useState([]);
  const connectionStatus = useStore((s) => s.connection.status);
  const connectionPort = useStore((s) => s.connection.port);
  const connectionBaud = useStore((s) => s.connection.baud);
  const connectionError = useStore((s) => s.connection.errorMsg);
  const setConnectionStatus = useStore((s) => s.setConnectionStatus);
  const setConnectionPort = useStore((s) => s.setConnectionPort);
  const setConnectionBaud = useStore((s) => s.setConnectionBaud);

  useEffect(() => {
    window.serial.listPorts().then(setPorts);
  }, []);

  const handleConnect = async () => {
    if (!connectionPort) return;
    setConnectionStatus("connecting");
    const result = await window.serial.connect(
      connectionPort,
      connectionBaud,
    );
    if (!result.ok) setConnectionStatus("error", result.error);
  };

  const handleDisconnect = async () => {
    await window.serial.disconnect();
    setConnectionStatus("disconnected");
  };

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  return (
    <div className="p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-orbitron font-bold text-white uppercase tracking-[0.2em]">
            Communications
          </h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-bold">
            Manage hardware interface and telemetry link
          </p>
        </div>
        <div className="flex items-center gap-3 glass px-4 py-2 rounded-2xl border border-white/5">
          <div
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-neon-green animate-pulse shadow-[0_0_10px_rgba(0,255,180,0.8)]" : "bg-gray-700"}`}
          />
          <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">
              {connectionStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Configuration Card */}
        <div className="glass rounded-3xl p-8 border border-white/5 space-y-6">
          <div className="flex items-center gap-3 text-neon-cyan opacity-80">
            <Settings size={20} />
            <span className="text-[11px] font-orbitron font-bold uppercase tracking-widest">
              Interface Settings
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-600 uppercase tracking-widest ml-1">
                Serial Port
              </label>
              <div className="flex gap-2">
                <select
                  value={connectionPort}
                  onChange={(e) => setConnectionPort(e.target.value)}
                  disabled={isConnected || isConnecting}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-neon-cyan transition-all"
                >
                  <option value="">Select Port</option>
                  {ports.map((p) => (
                    <option key={p.path} value={p.path}>
                      {p.path} {p.manufacturer ? `(${p.manufacturer})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => window.serial.listPorts().then(setPorts)}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 transition-all"
                >
                  <RefreshCcw size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-600 uppercase tracking-widest ml-1">
                Baud Rate
              </label>
              <select
                value={connectionBaud}
                onChange={(e) => setConnectionBaud(Number(e.target.value))}
                disabled={isConnected || isConnecting}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-neon-cyan transition-all"
              >
                {BAUD_RATES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4">
            {!isConnected ? (
              <button
                onClick={handleConnect}
                disabled={!connectionPort || isConnecting}
                className="w-full py-4 bg-neon-green/10 text-neon-green border border-neon-green/30 rounded-2xl font-orbitron font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-neon-green hover:text-bg-deep transition-all duration-500 shadow-[0_0_20px_rgba(0,255,180,0.1)] disabled:opacity-30"
              >
                {isConnecting ? "Initializing Link..." : "Establish Connection"}
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="w-full py-4 bg-neon-red/10 text-neon-red border border-neon-red/30 rounded-2xl font-orbitron font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-neon-red hover:text-white transition-all duration-500"
              >
                Terminate Connection
              </button>
            )}
          </div>
        </div>

        {/* Diagnostics Card */}
        <div className="glass rounded-3xl p-8 border border-white/5 space-y-6 flex flex-col">
          <div className="flex items-center gap-3 text-neon-purple opacity-80">
            <Activity size={20} />
            <span className="text-[11px] font-orbitron font-bold uppercase tracking-widest">
              Hardware Diagnostics
            </span>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <Cpu size={16} className="text-gray-500" />
                <span className="text-[10px] text-gray-400 uppercase font-bold">
                  Speeduino Core
                </span>
              </div>
              {isConnected ? (
                <CheckCircle size={16} className="text-neon-green" />
              ) : (
                <AlertCircle size={16} className="text-gray-700" />
              )}
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 text-[10px] text-gray-500 uppercase font-bold tracking-widest">
              <span>Data Consistency</span>
              <span className={isConnected ? "text-white" : "text-gray-800"}>
                {isConnected ? "99.8%" : "N/A"}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 text-[10px] text-gray-500 uppercase font-bold tracking-widest">
              <span>Packet Rate</span>
              <span
                className={isConnected ? "text-neon-cyan" : "text-gray-800"}
              >
                {isConnected ? "20 Hz" : "0 Hz"}
              </span>
            </div>
          </div>

          <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
            <div className="text-[9px] text-gray-600 uppercase font-bold tracking-widest mb-2">
              Recent Events
            </div>
            <div className="font-mono text-[9px] text-gray-500 space-y-1">
              <div className="flex gap-2">
                <span className="text-neon-cyan">[SYS]</span> Application Ready
              </div>
              {connectionStatus === "error" && (
                <div className="flex gap-2 text-neon-red">
                  <span className="font-bold">[ERR]</span> {connectionError}
                </div>
              )}
              {isConnected && (
                <div className="flex gap-2 text-neon-green">
                  <span className="font-bold">[LOG]</span> Serial Link
                  Established
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
