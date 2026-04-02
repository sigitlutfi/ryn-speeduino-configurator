import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Cpu,
  FileCode2,
  RefreshCcw,
  RotateCw,
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
  const [isResettingEeprom, setIsResettingEeprom] = useState(false);
  const [isRebootingEcu, setIsRebootingEcu] = useState(false);
  const [resetEeprom, setResetEeprom] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [statusText, setStatusText] = useState("Ready");
  const [flashError, setFlashError] = useState("");
  const [logLines, setLogLines] = useState([]);
  const [pendingReconnect, setPendingReconnect] = useState(false);
  const [activeAction, setActiveAction] = useState("flash");
  const [confirmAction, setConfirmAction] = useState(null);

  const projectSignature = currentProject?.ini?.signature || "Unknown";
  const ecuSignature = currentProject?.ecu?.signature || "Unknown";
  const hasEmbeddedIni = Boolean(currentProject?.ini?.content);
  const isBusy = isFlashing || isResettingEeprom || isRebootingEcu;
  const canFlash = Boolean(
    selectedPort && hexPath && hasEmbeddedIni && !isBusy,
  );
  const canResetEepromOnly = Boolean(selectedPort && hasEmbeddedIni && !isBusy);
  const canRebootEcu = Boolean(selectedPort && !isBusy);

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
        setStatusText(
          nextProgress >= 100 ? "Finishing flash" : `Flashing ${nextProgress}%`,
        );
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
      notify(
        activeAction === "reset-eeprom"
          ? "EEPROM reset completed and ECU reconnected"
          : activeAction === "reboot-ecu"
            ? "ECU reboot completed and connection restored"
            : "Firmware flashed and ECU reconnected",
        "success",
        3000,
      );
      return;
    }

    if (connectionStatus === "error") {
      setPendingReconnect(false);
      setPhase("error");
      setStatusText(
        activeAction === "reset-eeprom"
          ? "EEPROM reset succeeded, but ECU reconnect failed"
          : activeAction === "reboot-ecu"
            ? "ECU reboot succeeded, but reconnect failed"
            : "Flash succeeded, but ECU reconnect failed",
      );
      clearOperation();
      notify(
        activeAction === "reset-eeprom"
          ? "EEPROM reset completed, but reconnect failed"
          : activeAction === "reboot-ecu"
            ? "ECU reboot completed, but reconnect failed"
            : "Firmware flashed, but reconnect failed",
        "warning",
        4000,
      );
    }
  }, [
    activeAction,
    clearOperation,
    connectionStatus,
    notify,
    pendingReconnect,
  ]);

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
    setActiveAction("flash");
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
        resetEeprom,
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

  const handleResetEepromOnly = async () => {
    if (!canResetEepromOnly) return;

    setIsResettingEeprom(true);
    setActiveAction("reset-eeprom");
    setProgress(0);
    setPhase("preflight");
    setStatusText("Preparing EEPROM reset");
    setFlashError("");
    setLogLines([]);
    setPendingReconnect(false);

    setOperation({
      type: "firmware-flash",
      stage: "preflight",
      label: "Preparing EEPROM reset",
      current: 0,
      total: 100,
      scope: "firmware",
    });

    try {
      if (connectionStatus === "connected") {
        appendLog("Disconnecting active ECU session before EEPROM reset");
        await window.serial.disconnect();
      }

      const result = await window.firmware.resetEeprom({
        port: selectedPort,
      });

      if (!result?.ok) {
        throw new Error(result?.error || "EEPROM reset failed");
      }

      setPhase("reconnecting");
      setStatusText("EEPROM reset complete. Reconnecting to ECU...");
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
      setFlashError(error.message || "EEPROM reset failed");
      setStatusText("EEPROM reset failed");
      setPendingReconnect(false);
      clearOperation();
      notify(`EEPROM reset failed: ${error.message}`, "error", 4500);
    } finally {
      setIsResettingEeprom(false);
    }
  };

  const handleRebootEcu = async () => {
    if (!canRebootEcu) return;

    setIsRebootingEcu(true);
    setActiveAction("reboot-ecu");
    setProgress(0);
    setPhase("preflight");
    setStatusText("Preparing ECU reboot");
    setFlashError("");
    setLogLines([]);
    setPendingReconnect(false);

    setOperation({
      type: "firmware-flash",
      stage: "preflight",
      label: "Preparing ECU reboot",
      current: 0,
      total: 100,
      scope: "firmware",
    });

    try {
      const result = await window.firmware.reboot({
        port: selectedPort,
        baud: 115200,
      });

      if (!result?.ok) {
        throw new Error(result?.error || "ECU reboot failed");
      }

      setPhase("reconnecting");
      setStatusText("ECU reboot pulse sent. Reconnecting...");
      updateOperation({
        type: "firmware-flash",
        stage: "reconnecting",
        label: "Reconnecting to ECU",
        current: 100,
        total: 100,
        scope: "firmware",
      });

      await window.serial.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 1400));

      setConnectionPort(selectedPort);
      setConnectionBaud(115200);
      setPendingReconnect(true);

      const reconnectResult = await window.serial.connect(selectedPort, 115200);
      if (!reconnectResult?.ok) {
        throw new Error(reconnectResult?.error || "Reconnect request failed");
      }
    } catch (error) {
      setPhase("error");
      setFlashError(error.message || "ECU reboot failed");
      setStatusText("ECU reboot failed");
      setPendingReconnect(false);
      clearOperation();
      notify(`ECU reboot failed: ${error.message}`, "error", 4500);
    } finally {
      setIsRebootingEcu(false);
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
      label: "EEPROM Mode",
      value: resetEeprom ? "Reset on Flash" : "Preserve",
      tone: resetEeprom ? "text-neon-yellow" : "text-white",
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

  const confirmationConfig = {
    flash: {
      title: "Confirm Flash Firmware",
      body: resetEeprom
        ? "This will flash the selected firmware and also clear retained EEPROM data. The ECU will reboot and the previous tune stored on the controller will be lost."
        : "This will flash the selected firmware to the ECU. The controller will reboot and the serial session will be interrupted during the process.",
      confirmLabel: resetEeprom ? "Flash + Reset EEPROM" : "Flash Firmware",
      tone: "orange",
      action: handleFlash,
    },
    "reset-eeprom": {
      title: "Confirm Reset EEPROM",
      body: "This will erase retained tune data on the ECU without replacing the firmware image. Reconnect and load a fresh base tune after this completes.",
      confirmLabel: "Reset EEPROM",
      tone: "yellow",
      action: handleResetEepromOnly,
    },
    "reboot-ecu": {
      title: "Confirm Reboot ECU",
      body: "This will restart the ECU and temporarily interrupt the serial connection. No firmware or EEPROM data will be changed.",
      confirmLabel: "Reboot ECU",
      tone: "cyan",
      action: handleRebootEcu,
    },
  };

  const activeConfirmation = confirmAction
    ? confirmationConfig[confirmAction]
    : null;

  return (
    <>
      <div className="mx-auto flex h-full min-h-0 max-w-[1360px] flex-col gap-3 overflow-y-auto px-3 pb-4 pt-3 custom-scrollbar lg:px-4">
      <div className="relative rounded-[24px] border border-white/8 bg-white/[0.03] p-4 backdrop-blur-md">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-neon-orange/80 via-white/16 to-transparent" />
        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <div className="text-[9px] font-orbitron font-bold uppercase tracking-[0.28em] text-white/40">
              Deployment Tool
            </div>
            <h1 className="text-xl font-orbitron font-black uppercase tracking-[0.16em] text-white sm:text-[22px]">
              Flash Firmware
            </h1>
            <p className="max-w-4xl text-[9px] uppercase tracking-[0.14em] text-white/38">
              Upload an ATmega2560 firmware image to the selected serial port,
              then reconnect automatically and validate the embedded project INI
              against the ECU signature.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {statusCards.map((card) => (
              <div
                key={card.label}
                className="min-w-0 rounded-[18px] bg-black/20 px-3 py-2.5"
              >
                <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
                  {card.label}
                </div>
                <div
                  className={`mt-1.5  text-[10px] font-orbitron font-bold uppercase tracking-[0.12em] ${card.tone}`}
                  title={card.value}
                >
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
        <section className="rounded-[24px] border border-white/8 bg-white/[0.03] p-3 backdrop-blur-md">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neon-orange/20 bg-neon-orange/10 text-neon-orange">
              <Upload size={18} />
            </div>
            <div>
              <div className="text-[9px] font-orbitron font-bold uppercase tracking-[0.24em] text-white/38">
                Flash Target
              </div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                Firmware Deployment
              </div>
            </div>
          </div>

          <div className="space-y-3">
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
              disabled={isBusy || portOptions.length === 0}
            />

            <div className="rounded-[28px] border border-white/5 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileCode2 size={14} className="text-white/30" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                      Firmware HEX
                    </span>
                  </div>
                  <p className="text-[9px] font-bold leading-relaxed text-gray-500">
                    Select a prebuilt firmware image such as{" "}
                    <span className="font-mono text-white/55">
                      ua4c-250205.hex
                    </span>
                    .
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePickHex}
                  disabled={isBusy}
                  className="rounded-2xl border border-neon-orange/20 bg-neon-orange/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-neon-orange transition-all hover:bg-neon-orange/16 disabled:opacity-40"
                >
                  Browse HEX
                </button>
              </div>

              <div className="mt-3 rounded-2xl border border-white/8 bg-black/30 px-4 py-3 font-mono text-[10px] text-white/55">
                {truncatePath(hexPath)}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neon-yellow/18 bg-neon-yellow/6 px-4 py-3.5 transition-all hover:bg-neon-yellow/10">
              <input
                type="checkbox"
                checked={resetEeprom}
                onChange={(e) => setResetEeprom(e.target.checked)}
                disabled={isBusy}
                className="mt-0.5 h-4 w-4 rounded border-neon-yellow/35 bg-black/40 text-neon-yellow focus:ring-neon-yellow/30"
              />
              <div className="min-w-0">
                <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.18em] text-white">
                  Reset EEPROM During Flash
                </div>

                <p className="mt-1.5 text-[9px] leading-relaxed text-neon-yellow">
                  Use this when the new firmware is not compatible with the
                  previous EEPROM layout. Existing tune data on the ECU will be
                  lost.
                </p>
              </div>
            </label>

            <div className="grid gap-2 md:grid-cols-[auto_minmax(0,1fr)]">
              <button
                type="button"
                onClick={hydratePorts}
                disabled={refreshingPorts || isBusy}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <RefreshCcw
                  size={14}
                  className={refreshingPorts ? "animate-spin" : ""}
                />
                Refresh Ports
              </button>

              <button
                type="button"
                onClick={() => setConfirmAction("flash")}
                disabled={!canFlash}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-900 bg-neon-orange px-4 py-3 text-[10px] font-orbitron font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-[#ff9f66] disabled:cursor-not-allowed disabled:border-white/6 disabled:bg-white/6 disabled:text-white/25"
              >
                <Upload
                  size={14}
                  className={isFlashing ? "animate-pulse" : ""}
                />
                {isFlashing ? "Flashing..." : "Flash Firmware"}
              </button>
            </div>

            <InfoCard title="Critical Note" icon={AlertTriangle} theme="orange">
              This is a firmware upload, not a normal burn-to-eeprom action. The
              ECU will reboot and the serial session will be interrupted during
              flashing.
            </InfoCard>

            <InfoCard title="Service Action" icon={Cpu} theme="yellow">
              Use{" "}
              <span className="font-semibold text-white">
                Reset EEPROM Only
              </span>{" "}
              for a clean memory state, or
              <span className="font-semibold text-white"> Reboot ECU</span> when
              you just need the controller to restart.
            </InfoCard>

            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction("reboot-ecu")}
                  disabled={!canRebootEcu}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neon-cyan/28 bg-neon-cyan/10 px-4 py-3 text-[10px] font-orbitron font-black uppercase tracking-[0.2em] text-neon-cyan transition-all hover:bg-neon-cyan/16 disabled:cursor-not-allowed disabled:border-white/6 disabled:bg-white/6 disabled:text-white/25"
                >
                  <RotateCw
                    size={14}
                    className={isRebootingEcu ? "animate-spin" : ""}
                  />
                  {isRebootingEcu ? "Rebooting..." : "Reboot ECU"}
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmAction("reset-eeprom")}
                  disabled={!canResetEepromOnly}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neon-yellow/28 bg-neon-yellow/10 px-4 py-3 text-[10px] font-orbitron font-black uppercase tracking-[0.2em] text-neon-yellow transition-all hover:bg-neon-yellow/16 disabled:cursor-not-allowed disabled:border-white/6 disabled:bg-white/6 disabled:text-white/25"
                >
                  <AlertTriangle
                    size={14}
                    className={isResettingEeprom ? "animate-pulse" : ""}
                  />
                  {isResettingEeprom ? "Resetting..." : "Reset EEPROM Only"}
                </button>
              </div>
            </div>

            {resetEeprom && (
              <InfoCard
                title="EEPROM Reset Enabled"
                icon={AlertTriangle}
                theme="red"
              >
                The flash session will also erase retained tune data by writing
                a blank EEPROM image. Plan to reload a known-good base map or
                initialize defaults before running the engine.
              </InfoCard>
            )}

            {!hasEmbeddedIni && (
              <InfoCard title="Project Incomplete" icon={Cpu} theme="red">
                The active project does not contain an embedded INI yet. Open or
                create a valid project before using this tool.
              </InfoCard>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-[24px] border border-white/8 bg-white/[0.03] p-3 backdrop-blur-md">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan">
              <PlugZap size={18} />
            </div>
            <div>
              <div className="text-[9px] font-orbitron font-bold uppercase tracking-[0.24em] text-white/38">
                Flash Session
              </div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                Progress and Validation
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <div className="rounded-[22px] border border-white/8 bg-black/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
                    Session Status
                  </div>
                  <div className="mt-1.5 text-[10px] font-orbitron font-bold uppercase tracking-[0.14em] text-white">
                    {statusText}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
                    Progress
                  </div>
                  <div className="mt-1.5 text-base font-orbitron font-black text-neon-orange sm:text-lg">
                    {progress}%
                  </div>
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon-orange via-neon-yellow to-neon-green transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                />
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-[20px] border border-white/8 bg-black/20 px-4 py-3">
                <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
                  Project INI Signature
                </div>
                <div
                  className="mt-1.5 truncate font-mono text-[11px] text-neon-cyan"
                  title={projectSignature}
                >
                  {projectSignature}
                </div>
              </div>

              <div className="rounded-[20px] border border-white/8 bg-black/20 px-4 py-3">
                <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/35">
                  ECU Signature
                </div>
                <div
                  className={`mt-1.5 truncate font-mono text-[11px] ${
                    phase === "validated" &&
                    ecuSignature !== "Unknown" &&
                    ecuSignature === projectSignature
                      ? "text-neon-green"
                      : ecuSignature !== "Unknown"
                        ? "text-neon-yellow"
                        : "text-white/45"
                  }`}
                  title={ecuSignature}
                >
                  {ecuSignature}
                </div>
              </div>
            </div>

            {phase === "validated" && (
              <InfoCard title="Validation" icon={CheckCircle2} theme="green">
                ECU handshake completed after flashing. If the signature differs
                from the project INI, the mismatch dialog will guide the next
                step.
              </InfoCard>
            )}

            {flashError && (
              <InfoCard title="Flash Error" icon={AlertTriangle} theme="red">
                {flashError}
              </InfoCard>
            )}

            <div className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-white/8 bg-black/30 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/38">
                  Flash Console
                </div>
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/28">
                  {phase}
                </div>
              </div>

              <div className="min-h-[260px] flex-1 overflow-y-auto rounded-[20px] border border-white/6 bg-[#06080d] px-4 py-3 custom-scrollbar xl:min-h-[320px]">
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

      {activeConfirmation && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close confirmation"
            className="absolute inset-0 bg-black/72 backdrop-blur-sm"
            onClick={() => setConfirmAction(null)}
          />

          <div className="relative z-[121] w-full max-w-[520px] rounded-[28px] border border-white/12 bg-[#111318]/96 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                  activeConfirmation.tone === "orange"
                    ? "border-neon-orange/25 bg-neon-orange/10 text-neon-orange"
                    : activeConfirmation.tone === "yellow"
                      ? "border-neon-yellow/25 bg-neon-yellow/10 text-neon-yellow"
                      : "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan"
                }`}
              >
                <AlertTriangle size={18} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.22em] text-white/42">
                  Confirmation Required
                </div>
                <h2 className="mt-1 text-[15px] font-orbitron font-black uppercase tracking-[0.14em] text-white">
                  {activeConfirmation.title}
                </h2>
                <p className="mt-3 text-[11px] leading-relaxed text-white/62">
                  {activeConfirmation.body}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-orbitron font-black uppercase tracking-[0.18em] text-white/72 transition-all hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  const run = activeConfirmation.action;
                  setConfirmAction(null);
                  run();
                }}
                className={`inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-[10px] font-orbitron font-black uppercase tracking-[0.18em] transition-all ${
                  activeConfirmation.tone === "orange"
                    ? "border-neon-orange/28 bg-neon-orange text-white hover:bg-[#ff9f66]"
                    : activeConfirmation.tone === "yellow"
                      ? "border-neon-yellow/28 bg-neon-yellow/12 text-neon-yellow hover:bg-neon-yellow/18"
                      : "border-neon-cyan/28 bg-neon-cyan/12 text-neon-cyan hover:bg-neon-cyan/18"
                }`}
              >
                {activeConfirmation.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
