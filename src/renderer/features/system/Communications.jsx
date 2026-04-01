import React, { useEffect } from "react";
import { useStore } from "../../core/store.js";
import { BAUD_RATES } from "../../../shared/protocol/ts-commands.js";
import {
  RefreshCcw,
  Cpu,
  Activity,
  Settings,
  PlugZap,
  ShieldCheck,
  ShieldAlert,
  Usb,
  Clock3,
  Radio,
  CircuitBoard,
  AlertTriangle,
} from "lucide-react";

function formatTimestamp(value) {
  if (!value) return "Never";

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getStateTone(state) {
  if (["connected", "ok", "matched"].includes(state)) {
    return "text-neon-green border-neon-green/20 bg-neon-green/10";
  }

  if (["connecting", "pending", "syncing"].includes(state)) {
    return "text-neon-cyan border-neon-cyan/20 bg-neon-cyan/10";
  }

  if (["error", "failed", "mismatch"].includes(state)) {
    return "text-yellow-300 border-yellow-400/20 bg-yellow-400/10";
  }

  return "text-white/70 border-white/10 bg-white/5";
}

function getCompatibility(signatureMatches) {
  if (signatureMatches === null) {
    return { label: "Pending", icon: Clock3, tone: "pending" };
  }

  if (signatureMatches) {
    return { label: "Matched", icon: ShieldCheck, tone: "matched" };
  }

  return { label: "Mismatch", icon: ShieldAlert, tone: "mismatch" };
}

export default function Communications() {
  const connectionStatus = useStore((s) => s.connection.status);
  const connectionPort = useStore((s) => s.connection.port);
  const connectionBaud = useStore((s) => s.connection.baud);
  const connectionError = useStore((s) => s.connection.errorMsg);
  const transportStatus = useStore((s) => s.connection.transportStatus);
  const handshakeStatus = useStore((s) => s.connection.handshakeStatus);
  const availablePorts = useStore((s) => s.connection.availablePorts);
  const refreshingPorts = useStore((s) => s.connection.refreshingPorts);
  const eventLog = useStore((s) => s.connection.eventLog);
  const lastConnectedAt = useStore((s) => s.connection.lastConnectedAt);
  const lastErrorAt = useStore((s) => s.connection.lastErrorAt);
  const lastSerialPort = useStore((s) => s.settings.lastSerialPort);
  const lastSerialBaud = useStore((s) => s.settings.lastSerialBaud);
  const currentProject = useStore((s) => s.currentProject);
  const setConnectionStatus = useStore((s) => s.setConnectionStatus);
  const setConnectionPort = useStore((s) => s.setConnectionPort);
  const setConnectionBaud = useStore((s) => s.setConnectionBaud);
  const setAvailablePorts = useStore((s) => s.setAvailablePorts);
  const setRefreshingPorts = useStore((s) => s.setRefreshingPorts);
  const updateSettings = useStore((s) => s.updateSettings);
  const addConnectionEvent = useStore((s) => s.addConnectionEvent);

  const hydratePorts = async () => {
    setRefreshingPorts(true);

    try {
      const nextPorts = await window.serial.listPorts();
      setAvailablePorts(nextPorts);
      addConnectionEvent("transport", "Serial ports refreshed", {
        count: nextPorts.length,
      });

      if (connectionPort || !lastSerialPort) return;

      const rememberedPort = nextPorts.find(
        (port) => port.path === lastSerialPort,
      );
      if (rememberedPort) {
        setConnectionPort(lastSerialPort);
        if (lastSerialBaud) {
          setConnectionBaud(Number(lastSerialBaud));
        }
      }
    } finally {
      setRefreshingPorts(false);
    }
  };

  useEffect(() => {
    let alive = true;

    hydratePorts().catch((error) => {
      if (!alive) return;
      console.warn("[Communications] Failed to load serial ports", error);
    });

    return () => {
      alive = false;
    };
  }, [
    connectionPort,
    lastSerialBaud,
    lastSerialPort,
    setConnectionBaud,
    setConnectionPort,
  ]);

  const handleConnect = async () => {
    if (!connectionPort) return;

    setConnectionStatus("connecting");
    addConnectionEvent("transport", "Connect requested", {
      port: connectionPort,
      baud: connectionBaud,
    });

    const result = await window.serial.connect(connectionPort, connectionBaud);
    if (!result.ok) {
      setConnectionStatus("error", result.error);
      return;
    }

    try {
      await updateSettings({
        lastSerialPort: connectionPort,
        lastSerialBaud: connectionBaud,
      });
    } catch (error) {
      console.warn(
        "[Communications] Failed to persist last serial port",
        error,
      );
    }
  };

  const handleDisconnect = async () => {
    await window.serial.disconnect();
    setConnectionStatus("disconnected");
    addConnectionEvent("transport", "Disconnect requested", {
      port: connectionPort,
    });
  };

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";
  const ecuSignature = currentProject?.ecu?.signature || "";
  const ecuProduct = currentProject?.ecu?.product || "";
  const projectSignature = currentProject?.ini?.signature || "";
  const signatureMatches =
    ecuSignature && projectSignature
      ? ecuSignature.trim() === projectSignature.trim()
      : null;
  const selectedPortMeta = availablePorts.find(
    (port) => port.path === connectionPort,
  );
  const isMockPort =
    connectionPort === "MOCK" || selectedPortMeta?.path === "MOCK";
  const compatibility = getCompatibility(signatureMatches);
  const compatibilityTone = getStateTone(compatibility.tone);
  const transportTone = getStateTone(transportStatus);
  const handshakeTone = getStateTone(handshakeStatus);
  const connectionTone = getStateTone(connectionStatus);
  const portCountLabel = `${availablePorts.length} available`;

  const statusCards = [
    {
      label: "Connection",
      value: connectionStatus,
      tone: connectionTone,
      icon: Radio,
    },
    {
      label: "Transport",
      value: transportStatus,
      tone: transportTone,
      icon: PlugZap,
    },
    {
      label: "Handshake",
      value: handshakeStatus,
      tone: handshakeTone,
      icon: Activity,
    },
    {
      label: "Compatibility",
      value: compatibility.label,
      tone: compatibilityTone,
      icon: compatibility.icon,
    },
  ];

  const identityRows = [
    { label: "Product", value: ecuProduct || "Unknown" },
    { label: "ECU Signature", value: ecuSignature || "Unknown" },
    { label: "Project Signature", value: projectSignature || "Unknown" },
  ];

  const eventToneMap = {
    transport: "text-neon-cyan border-neon-cyan/20 bg-neon-cyan/10",
    handshake: "text-neon-green border-neon-green/20 bg-neon-green/10",
    sync: "text-white/75 border-white/10 bg-white/5",
    warning: "text-yellow-300 border-yellow-400/20 bg-yellow-400/10",
    error: "text-red-300 border-red-400/20 bg-red-400/10",
  };

  return (
    <div className="mx-auto flex h-full flex-col gap-4 overflow-y-auto custom-scrollbar px-4 pb-6 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 lg:px-5">
      <div className="acrylic-strip rounded-[20px] px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <div className="text-[10px] font-orbitron font-semibold uppercase tracking-[0.34em] text-white/45">
              Link Layer
            </div>
            <h1 className="text-xl font-orbitron font-bold uppercase tracking-[0.16em] text-white sm:text-2xl">
              Communications
            </h1>
            <p className="max-w-2xl text-[10px] uppercase tracking-[0.15em] text-white/42">
              Manage serial transport, verify ECU identity, and inspect the last
              communication events without leaving the tuning workflow.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {statusCards.map(({ label, value, tone, icon: Icon }) => (
              <div
                key={label}
                className="acrylic-strip min-w-[104px] rounded-[16px] px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/38">
                    {label}
                  </span>
                  <Icon size={12} className="text-white/30" />
                </div>
                <div className="mt-1.5 flex items-center">
                  <span
                    className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${tone}`}
                  >
                    {value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.05fr_0.95fr]">
        <section className="acrylic-panel rounded-[24px] p-3.5 sm:p-4">
          <div className="relative z-10 flex items-center gap-3 text-neon-cyan">
            <Settings size={18} />
            <div>
              <div className="text-[10px] font-orbitron font-semibold uppercase tracking-[0.28em] text-white/45">
                Interface
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                Transport Settings
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <div className="bg-black rounded-2xl p-3">
                <div className="mb-2 flex items-center justify-between gap-3 ">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    Serial Port
                  </label>
                  {isMockPort && (
                    <span className="rounded-full border border-neon-cyan/20 bg-neon-cyan/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-neon-cyan">
                      Mock
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <select
                    value={connectionPort}
                    onChange={(e) => setConnectionPort(e.target.value)}
                    disabled={isConnected || isConnecting || refreshingPorts}
                    className="min-h-10 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
                  >
                    <option value="">Select port</option>
                    {availablePorts.map((port) => (
                      <option key={port.path} value={port.path}>
                        {port.path}{" "}
                        {port.manufacturer ? `(${port.manufacturer})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => hydratePorts()}
                    disabled={refreshingPorts}
                    className="acrylic-strip flex min-h-10 min-w-10 items-center justify-center rounded-xl px-3 text-white/70 hover:text-white disabled:opacity-50"
                  >
                    <RefreshCcw
                      size={15}
                      className={refreshingPorts ? "animate-spin" : ""}
                    />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em] text-white/42">
                  <span>
                    {selectedPortMeta?.manufacturer ||
                      (availablePorts.length === 0
                        ? "No serial ports detected"
                        : "Manufacturer unknown")}
                  </span>
                  <span className="font-mono text-white/55">
                    {portCountLabel}
                  </span>
                </div>
              </div>

              <div className="acrylic-strip rounded-2xl p-3">
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Baud Rate
                </label>
                <select
                  value={connectionBaud}
                  onChange={(e) => setConnectionBaud(Number(e.target.value))}
                  disabled={isConnected || isConnecting}
                  className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
                >
                  {BAUD_RATES.map((baud) => (
                    <option key={baud} value={baud}>
                      {baud}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="acrylic-strip rounded-2xl px-3 py-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40">
                    Last Connected
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-white/88">
                    {formatTimestamp(lastConnectedAt)}
                  </div>
                </div>
                <div className="acrylic-strip rounded-2xl px-3 py-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40">
                    Last Error
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-white/88">
                    {formatTimestamp(lastErrorAt)}
                  </div>
                </div>
              </div>

              <div className="acrylic-strip rounded-2xl p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    Active Link
                  </span>
                  <CircuitBoard size={14} className="text-white/35" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/35">
                      Port
                    </div>
                    <div className="mt-1 font-mono text-white/90">
                      {connectionPort || "Not selected"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/35">
                      Mode
                    </div>
                    <div className="mt-1 font-mono text-white/90">
                      {isMockPort ? "Mock ECU" : "Hardware"}
                    </div>
                  </div>
                </div>
              </div>

              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={!connectionPort || isConnecting || refreshingPorts}
                  className="w-full rounded-2xl border border-neon-green/20 bg-neon-green/10 px-4 py-3 font-orbitron text-[11px] font-semibold uppercase tracking-[0.2em] text-neon-green hover:bg-neon-green hover:text-bg-deep disabled:opacity-40"
                >
                  {isConnecting
                    ? "Initializing Link..."
                    : "Establish Connection"}
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="w-full rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 font-orbitron text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300 hover:bg-red-400 hover:text-white"
                >
                  Terminate Connection
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="acrylic-panel rounded-[24px] p-3.5 sm:p-4">
          <div className="relative z-10 flex items-center gap-3 text-neon-cyan">
            <Cpu size={18} />
            <div>
              <div className="text-[10px] font-orbitron font-semibold uppercase tracking-[0.28em] text-white/45">
                ECU Identity
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                Hardware And Session Health
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="acrylic-strip rounded-2xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    Transport
                  </span>
                  <span
                    className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${transportTone}`}
                  >
                    {transportStatus}
                  </span>
                </div>
              </div>
              <div className="acrylic-strip rounded-2xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    Handshake
                  </span>
                  <span
                    className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${handshakeTone}`}
                  >
                    {handshakeStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="acrylic-elevated rounded-[20px] p-3.5">
              <div className="relative z-10">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
                    Identity Snapshot
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${compatibilityTone}`}
                  >
                    {compatibility.label}
                  </span>
                </div>

                <div className="mt-3.5 space-y-2.5">
                  {identityRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-start justify-between gap-4 border-b border-white/6 pb-2.5 last:border-b-0 last:pb-0"
                    >
                      <span className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                        {row.label}
                      </span>
                      <span className="max-w-[70%] break-all text-right font-mono text-[11px] text-white/92">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3.5 flex items-center justify-between gap-4 rounded-2xl  bg-black px-3 py-2.5">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/35">
                      Available Ports
                    </div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-white/88">
                      <Usb size={13} className="text-neon-cyan" />
                      {portCountLabel}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/35">
                      Connection Mode
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-white/88">
                      {isMockPort ? "Mock ECU" : "Hardware"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {connectionError && (
              <div className="acrylic-strip rounded-2xl border border-red-400/20 bg-red-400/10 p-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="mt-0.5 text-red-300" />
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-200/80">
                      Last Transport Error
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-red-100">
                      {connectionError}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="acrylic-panel  rounded-[24px] p-3 sm:p-3.5">
        <div className="relative z-10 flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-orbitron font-semibold uppercase tracking-[0.3em] text-white/45">
              Activity Log
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              Recent Communication Events
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-white/38">
              Compact diagnostics timeline.
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/58">
            {eventLog.length} entries
          </div>
        </div>

        <div className="relative z-10 mt-3">
          {eventLog.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-[10px] text-white/48">
              No communication events recorded yet.
            </div>
          ) : (
            eventLog.map((event) => (
              <div
                key={event.id}
                className="border-b border-white/6 py-2 last:border-b-0"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        className={`mt-0.5 rounded-full border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] ${
                          eventToneMap[event.type] ||
                          "text-white/75 border-white/10 bg-white/5"
                        }`}
                      >
                        {event.type}
                      </span>
                      <div className="min-w-0 text-[10px] leading-4 text-white/88">
                        {event.message}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.12em] text-white/38">
                      {formatTimestamp(event.at)}
                    </span>
                  </div>
                  {Object.keys(event.details || {}).length > 0 && (
                    <div className="pl-6 text-[9px] text-white/44">
                      {Object.entries(event.details).map(
                        ([key, value], index) => (
                          <span key={key} className="mr-3 inline-block">
                            <span className="uppercase tracking-[0.12em] text-white/28">
                              {key}
                            </span>{" "}
                            <span className="font-mono text-white/62">
                              {String(value)}
                            </span>
                            {index < Object.entries(event.details).length - 1
                              ? ""
                              : ""}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
