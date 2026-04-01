import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Cpu,
  FileCode2,
  RefreshCcw,
  Upload,
  PlugZap,
  CheckCircle2,
  Radio,
} from "lucide-react";
import { useStore } from "../../core/store.js";
import { SelectRow, InfoCard } from "../shared/components/TuningComponents.jsx";

function truncatePath(value = "") {
  if (!value) return "No firmware selected";
  if (value.length <= 72) return value;
  return `${value.slice(0, 28)}...${value.slice(-36)}`;
}

export default function FlashFirmware() {
  const currentProject = useStore((s) => s.currentProject);
  const connectionStatus = useStore((s) => s.connection.status);
  const setConnectionPort = useStore((s) => s.setConnectionPort);
  const setConnectionBaud = useStore((s) => s.setConnectionBaud);
  const notify = useStore((s) => s.notify);
  const setOperation = useStore((s) => s.setOperation);
  const updateOperation = useStore((s) => s.updateOperation);
  const clearOperation = useStore((s) => s.clearOperation);

  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [hexPath, setHexPath] = useState("");
  const [refreshingPorts, setRefreshingPorts] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [statusText, setStatusText] = useState("Ready");
  const [flashError, setFlashError] = useState("");
  const [logLines, setLogLines] = useState([]);
  const [pendingReconnect, setPendingReconnect] = useState(false);

  const projectSignature = currentProject?.ini?.signature || "Unknown";
  const ecuSignature = currentProject?.ecu?.signature || "Unknown";
  const hasEmbeddedIni = Boolean(currentProject?.ini?.content);
  const canFlash = Boolean(selectedPort && hexPath && hasEmbeddedIni && !isFlashing);

  const portOptions = useMemo(
    () =>
      ports.map((port) => ({
        label: port.label,
        value: port.path,
      })),
    [ports],
  );

  const appendLog = (message) => {
    if (!message) return;
    const nextLines = String(message)
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean);

    if (nextLines.length === 0) return;

    setLogLines((current) => [...current, ...nextLines].slice(-160));
  };

  const hydratePorts = async () => {
    setRefreshingPorts(true);
    try {
      const rawPorts = await window.serial.listPorts();
      const realPorts = rawPorts
        .filter((port) => port.path !== "MOCK")
        .map((port) => ({
          path: port.path,
          label: `${port.path}${port.manufacturer ? ` · ${port.manufacturer}` : ""}`,
        }));

      setPorts(realPorts);

      if (realPorts.length > 0) {
        setSelectedPort((current) =>
          current && realPorts.some((port) => port.path === current)
            ? current
            : realPorts[0].path,
        );
      } else {
        setSelectedPort("");
      }
    } catch (error) {
      notify(`Failed to refresh ports: ${error.message}`, "error");
    } finally {
      setRefreshingPorts(false);
    }
  };

  useEffect(() => {
    hydratePorts();
  }, []);

  useEffect(() => {
    const unsubscribe = window.firmware.onStatus((payload) => {
      if (!payload) return;

      if (payload.message) {
        appendLog(payload.message);
      }

      if (payload.type === "progress") {
        const nextProgress = Math.max(0, Math.min(100, payload.percent ?? 0));
        setProgress(nextProgress);
        setPhase(payload.phase || "flashing");
        setStatusText(nextProgress >= 100 ? "Finishing flash" : `Flashing ${nextProgress}%`);
        updateOperation({
          type: "firmware-flash",
          stage: payload.phase || "flashing",
          label: "Flashing firmware",
          current: nextProgress,
          total: 100,
          scope: "firmware",
        });
      }

      if (payload.type === "state") {
        setPhase(payload.phase || "working");
        setStatusText(payload.message || "Working");
        if (payload.phase === "flashing") {
          updateOperation({
            type: "firmware-flash",
            stage: "flashing",
            label: payload.message || "Flashing firmware",
            current: payload.percent ?? 0,
            total: 100,
            scope: "firmware",
          });
        }
      }

      if (payload.type === "completed") {
        setProgress(100);
        setPhase("completed");
        setStatusText(payload.message || "Firmware flash complete");
      }

      if (payload.type === "error") {
        setPhase("error");
        setFlashError(payload.message || "Firmware flash failed");
        setStatusText("Flash failed");
        clearOperation();
      }
    });

    return () => unsubscribe?.();
  }, [clearOperation, updateOperation]);

  useEffect(() => {
    if (!pendingReconnect) return;

    if (connectionStatus === "connected") {
      setPendingReconnect(false);
      setPhase("validated");
      setStatusText("ECU reconnected and handshake completed");
      clearOperation();
      notify("Firmware flashed and ECU reconnected", "success", 3000);
      return;
    }

    if (connectionStatus === "error") {
      setPendingReconnect(false);
      setPhase("error");
      setStatusText("Flash succeeded, but ECU reconnect failed");
      clearOperation();
      notify("Firmware flashed, but reconnect failed", "warning", 4000);
    }
  }, [clearOperation, connectionStatus, notify, pendingReconnect]);

  const handlePickHex = async () => {
    const picked = await window.firmware.pickHex();
    if (!picked) return;
    setHexPath(picked);
    setFlashError("");
    setStatusText("Firmware image selected");
    appendLog(`Selected firmware: ${picked}`);
  };

  const handleFlash = async () => {
    if (!canFlash) return;

    setIsFlashing(true);
    setProgress(0);
    setPhase("preflight");
    setStatusText("Preparing firmware flash");
    setFlashError("");
    setLogLines([]);
    setPendingReconnect(false);

    setOperation({
      type: "firmware-flash",
      stage: "preflight",
      label: "Preparing firmware flash",
      current: 0,
      total: 100,
      scope: "firmware",
    });

    try {
      if (connectionStatus === "connected") {
        appendLog("Disconnecting active ECU session before flash");
        await window.serial.disconnect();
      }

      const result = await window.firmware.flash({
        port: selectedPort,
        hexPath,
      });

      if (!result?.ok) {
        throw new Error(result?.error || "Firmware flash failed");
      }

      setPhase("reconnecting");
      setStatusText("Firmware flashed. Reconnecting to ECU...");
      updateOperation({
        type: "firmware-flash",
        stage: "reconnecting",
        label: "Reconnecting to ECU",
        current: 100,
        total: 100,
        scope: "firmware",
      });

      await new Promise((resolve) => setTimeout(resolve, 1800));

      setConnectionPort(selectedPort);
      setConnectionBaud(115200);
      setPendingReconnect(true);

      const reconnectResult = await window.serial.connect(selectedPort, 115200);
      if (!reconnectResult?.ok) {
        throw new Error(reconnectResult?.error || "Reconnect request failed");
      }
    } catch (error) {
      setPhase("error");
      setFlashError(error.message || "Firmware flash failed");
      setStatusText("Flash failed");
      setPendingReconnect(false);
      clearOperation();
      notify(`Firmware flash failed: ${error.message}`, "error", 4500);
    } finally {
      setIsFlashing(false);
    }
  };

  const statusCards = [
    {
      label: "Project INI",
      value: projectSignature,
      tone: "text-neon-cyan",
    },
    {
      label: "Selected Port",
      value: selectedPort || "No port",
      tone: selectedPort ? "text-white" : "text-white/35",
    },
    {
      label: "HEX Image",
      value: hexPath ? "Ready" : "Awaiting",
      tone: hexPath ? "text-neon-orange" : "text-white/35",
    },
    {
      label: "ECU State",
      value: connectionStatus,
      tone:
        connectionStatus === "connected"
          ? "text-neon-green"
          : connectionStatus === "error"
            ? "text-neon-red"
            : "text-white/45",
    },
  ];

  return (
    <div className="mx-auto flex h-full max-w-[1360px] flex-col gap-4 overflow-y-auto px-4 pb-6 pt-4 custom-scrollbar lg:px-5">
      <div className="relative overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.03] p-6 backdrop-blur-md">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-neon-orange/80 via-white/16 to-transparent" />
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.3em] text-white/40">
              Deployment Tool
            </div>
            <h1 className="text-2xl font-orbitron font-black uppercase tracking-[0.18em] text-white">
              Flash Firmware
            </h1>
            <p className="max-w-3xl text-[10px] uppercase tracking-[0.16em] text-white/38">
              Upload an ATmega2560 firmware image to the selected serial port, then reconnect automatically and validate
              the embedded project INI against the ECU signature.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statusCards.map((card) => (
              <div
                key={card.label}
                className="min-w-[158px] rounded-[22px] border border-white/8 bg-black/20 px-4 py-3"
              >
                <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
                  {card.label}
                </div>
                <div className={`mt-2 text-[11px] font-orbitron font-bold uppercase tracking-[0.14em] ${card.tone}`}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-4 backdrop-blur-md">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neon-orange/20 bg-neon-orange/10 text-neon-orange">
              <Upload size={20} />
            </div>
            <div>
              <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.28em] text-white/38">
                Flash Target
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                Firmware Deployment
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <SelectRow
              label="Serial Port"
              value={selectedPort}
              onChange={setSelectedPort}
              options={portOptions}
              description={
                ports.length > 0
                  ? "Select the same USB serial port you normally use for ECU communications."
                  : "No serial ports detected yet. Refresh the list after connecting the ECU."
              }
              icon={Radio}
              disabled={isFlashing || portOptions.length === 0}
            />

            <div className="rounded-[32px] border border-white/5 bg-black/20 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileCode2 size={14} className="text-white/30" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                      Firmware HEX
                    </span>
                  </div>
                  <p className="text-[9px] font-bold leading-relaxed text-gray-500">
                    Select a prebuilt firmware image such as <span className="font-mono text-white/55">ua4c-250205.hex</span>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePickHex}
                  disabled={isFlashing}
                  className="rounded-2xl border border-neon-orange/20 bg-neon-orange/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-neon-orange transition-all hover:bg-neon-orange/16 disabled:opacity-40"
                >
                  Browse HEX
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/8 bg-black/30 px-4 py-3 font-mono text-[11px] text-white/55">
                {truncatePath(hexPath)}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={hydratePorts}
                disabled={refreshingPorts || isFlashing}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <RefreshCcw size={14} className={refreshingPorts ? "animate-spin" : ""} />
                Refresh Ports
              </button>

              <button
                type="button"
                onClick={handleFlash}
                disabled={!canFlash}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-neon-orange/28 bg-neon-orange px-4 py-3 text-[10px] font-orbitron font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-[#ff9f66] disabled:cursor-not-allowed disabled:border-white/6 disabled:bg-white/6 disabled:text-white/25"
              >
                <Upload size={14} className={isFlashing ? "animate-pulse" : ""} />
                {isFlashing ? "Flashing..." : "Flash Firmware"}
              </button>
            </div>

            <InfoCard title="Critical Note" icon={AlertTriangle} theme="orange">
              This is a firmware upload, not a normal burn-to-eeprom action. The ECU will reboot and the serial session
              will be interrupted during flashing.
            </InfoCard>

            {!hasEmbeddedIni && (
              <InfoCard title="Project Incomplete" icon={Cpu} theme="red">
                The active project does not contain an embedded INI yet. Open or create a valid project before using this tool.
              </InfoCard>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-4 backdrop-blur-md">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan">
              <PlugZap size={20} />
            </div>
            <div>
              <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.28em] text-white/38">
                Flash Session
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                Progress and Validation
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[26px] border border-white/8 bg-black/20 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
                    Session Status
                  </div>
                  <div className="mt-2 text-[11px] font-orbitron font-bold uppercase tracking-[0.16em] text-white">
                    {statusText}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
                    Progress
                  </div>
                  <div className="mt-2 text-lg font-orbitron font-black text-neon-orange">
                    {progress}%
                  </div>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon-orange via-neon-yellow to-neon-green transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/8 bg-black/20 px-4 py-4">
                <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
                  Project INI Signature
                </div>
                <div className="mt-2 font-mono text-[12px] text-neon-cyan">
                  {projectSignature}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-black/20 px-4 py-4">
                <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
                  ECU Signature
                </div>
                <div
                  className={`mt-2 font-mono text-[12px] ${
                    phase === "validated" && ecuSignature !== "Unknown" && ecuSignature === projectSignature
                      ? "text-neon-green"
                      : ecuSignature !== "Unknown"
                        ? "text-neon-yellow"
                        : "text-white/45"
                  }`}
                >
                  {ecuSignature}
                </div>
              </div>
            </div>

            {phase === "validated" && (
              <InfoCard title="Validation" icon={CheckCircle2} theme="green">
                ECU handshake completed after flashing. If the signature differs from the project INI, the mismatch dialog
                will guide the next step.
              </InfoCard>
            )}

            {flashError && (
              <InfoCard title="Flash Error" icon={AlertTriangle} theme="red">
                {flashError}
              </InfoCard>
            )}

            <div className="rounded-[28px] border border-white/8 bg-black/30 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/38">
                  Flash Console
                </div>
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/28">
                  {phase}
                </div>
              </div>

              <div className="h-[360px] overflow-y-auto rounded-[22px] border border-white/6 bg-[#06080d] px-4 py-3 custom-scrollbar">
                {logLines.length === 0 ? (
                  <div className="text-[11px] font-mono text-white/22">
                    Waiting for firmware activity...
                  </div>
                ) : (
                  <div className="space-y-1.5 font-mono text-[11px] text-white/62">
                    {logLines.map((line, index) => (
                      <div key={`${index}-${line.slice(0, 24)}`}>{line}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
