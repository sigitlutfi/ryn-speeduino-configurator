import { createAutoReconnect, validateConnectedECU, recoverECUConnection } from './core/services/ecuRecovery.js';
import { assertCompatibleContract } from '../shared/protocol/contract.js';
import React, { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { Buffer } from "buffer";
import { useStore } from "./core/store.js";
import { ROUTES } from "./routes.js";
import { parseRealtime } from "../shared/protocol/realtime.js";
import { serialService } from "./core/services/serialService.js";
import Communications from "./features/system/Communications.jsx";
import Dashboard from "./features/dashboard/Dashboard.jsx";
import VETable from "./features/fuel/VETable.jsx";
import VETable2 from "./features/fuel/VETable2.jsx";
import IgnitionTable from "./features/spark/IgnitionTable.jsx";
import IgnitionTable2 from "./features/spark/IgnitionTable2.jsx";
import AFRTable from "./features/fuel/AFRTable.jsx";
import LambdaTable from "./features/fuel/LambdaTable.jsx";
import FuelSettings from "./features/fuel/FuelSettings.jsx";
import EngineSettings from "./features/engine/EngineSettings.jsx";
import TriggerSetup from "./features/engine/TriggerSetup.jsx";
import AFRO2Settings from "./features/fuel/AFRO2Settings.jsx";
import FlexFuelSettings from "./features/fuel/FlexFuelSettings.jsx";
import IATCorrection from "./features/fuel/curves/IATCorrection.jsx";
import InjectorCharacteristics from "./features/engine/InjectorCharacteristics.jsx";
import IOSummary from "./features/io/IOSummary.jsx";
import ProgrammableOutputs from "./features/io/ProgrammableOutputs.jsx";
import SparkSetup from "./features/spark/SparkSetup.jsx";
import VVTControl from "./features/engine/VVTControl.jsx";
import BoostControl from "./features/fuel/BoostControl.jsx";
import StagedInjection from "./features/fuel/StagedInjection.jsx";
import GettingStarted from "./features/projects/GettingStarted.jsx";
import Analysis from "./features/dashboard/Analysis.jsx";
import AppToolbar from "./ui/AppToolbar.jsx";
import Sidebar from "./ui/Sidebar.jsx";
import ECURestartNotice from './ui/ECURestartNotice.jsx';
import NotificationTray from "./ui/NotificationTray.jsx";
import IniMismatchDialog from "./ui/IniMismatchDialog.jsx";
import GlobalPreferencesPage from "./features/system/GlobalPreferencesPage.jsx";
import EngineProtection from "./features/engine/EngineProtection.jsx";
import CrankingSettings from "./features/startup/CrankingSettings.jsx";
import StartupCurves from "./features/startup/StartupCurves.jsx";
import IdleControl from "./features/startup/IdleControl.jsx";
import LaunchControl from "./features/racing/LaunchControl.jsx";
import FlatShift from "./features/racing/FlatShift.jsx";
import Nitrous from "./features/racing/Nitrous.jsx";
import FuelPump from "./features/io/FuelPump.jsx";
import WMI from "./features/racing/WMI.jsx";
import FanSettings from "./features/io/FanSettings.jsx";
import SensorCalibration from "./features/tools/SensorCalibration.jsx";
import ProtocolStats from "./features/tools/ProtocolStats.jsx";
import RawConsole from "./features/tools/RawConsole.jsx";
import FlashFirmware from "./features/system/FlashFirmware.jsx";
import TachoOutput from "./features/io/TachoOutput.jsx";
import PitLimiter from "./features/racing/PitLimiter.jsx";
import RumbleIdle from "./features/racing/RumbleIdle.jsx";
import AntiLag from "./features/racing/AntiLag.jsx";
import PopAndBang from "./features/racing/PopAndBang.jsx";
import RuntimeProfiles from "./features/dashboard/RuntimeProfiles.jsx";
import RuntimeProfileEditor from "./features/dashboard/RuntimeProfileEditor.jsx";

import IndicatorTray from "./features/shared/components/IndicatorTray.jsx";
import SyncDialog from "./ui/SyncDialog.jsx";
import { getAccent } from "./core/theme.js";

export default function App() {
  useEffect(() => window.projects.onCloseRequested?.(() => useStore.getState().closeProject()), []);
  const [, navigate] = useLocation();
  const currentProject = useStore((s) => s.currentProject);
  const init = useStore((s) => s.init);
  const settings = useStore((s) => s.settings);
  const parsedIni = useStore((s) => s.parsedIni);
  const connectionStatus = useStore((s) => s.connection.status);
  const firmwareSignature = useStore(s => s.connection.firmwareSignature);
  const handshakeStatus = useStore(s => s.connection.handshakeStatus);
  const projectEpoch = useStore(s => s.projectEpoch);
  const setConnectionStatus = useStore((s) => s.setConnectionStatus);
  const setConnectionPort = useStore((s) => s.setConnectionPort);
  const setConnectionBaud = useStore((s) => s.setConnectionBaud);
  const setConnectionTransportStatus = useStore((s) => s.setConnectionTransportStatus);
  const setConnectionHandshakeStatus = useStore((s) => s.setConnectionHandshakeStatus);
  const addConnectionEvent = useStore((s) => s.addConnectionEvent);
  const setRealtime = useStore((s) => s.setRealtime);
  const notify = useStore((s) => s.notify);
  const clearRuntimeProfileSession = useStore(
    (s) => s.clearRuntimeProfileSession,
  );
  const syncDialogOpen = useStore((s) => s.syncDialogOpen);
  const syncDialogResults = useStore((s) => s.syncDialogResults);
  const closeSyncDialog = useStore((s) => s.closeSyncDialog);
  const iniMismatchDialogOpen = useStore((s) => s.iniMismatchDialogOpen);
  const iniMismatchDetails = useStore((s) => s.iniMismatchDetails);
  const openIniMismatchDialog = useStore((s) => s.openIniMismatchDialog);
  const closeIniMismatchDialog = useStore((s) => s.closeIniMismatchDialog);
  const validationStatus = useStore(s => s.connection.validationStatus);

  const accent = getAccent(settings.accentColor);

  useEffect(() => {
    init();

    const handleRealtime = (payload, source) => {
      const data =
        Buffer.isBuffer(payload) || payload instanceof Uint8Array
          ? parseRealtime(payload)
          : payload;
      if (data) setRealtime(data, source);
    };
    serialService.onRealtime(handleRealtime);

    // Connection status handler with handshake sequence
    let transportGeneration = 0, transportConnected = false;
    const unsubscribeStatus = window.serial.onStatus(async (status) => {
      if (status === 'connected' && (transportConnected || (useStore.getState().connection.autoReconnectPaused && !useStore.getState().connection.connectionAttempt))) return;
      transportConnected = status === 'connected';
      const generation = ++transportGeneration;
      const intent = useStore.getState().connection.recoveryGeneration;
      const isCurrent = () => generation === transportGeneration && useStore.getState().connection.recoveryGeneration === intent;
      console.log("[App] Serial status event", status);

      if (status === "connected") {
        try {
          setConnectionTransportStatus("connected");
          setConnectionHandshakeStatus("probing");
          addConnectionEvent("transport", "Serial transport connected", {
            port: useStore.getState().connection.port,
            baud: useStore.getState().connection.baud,
          });

          console.log("[App] Serial connected, performing handshake...");
          serialService.reset();
          const handshakeInfo = await serialService.handshake();
          if (!isCurrent()) return;
          setConnectionStatus("connected");
          setConnectionHandshakeStatus("ok");
          notify("ECU handshake complete; validating configuration and telemetry", "info", 2500);
          addConnectionEvent("handshake", "ECU handshake completed", {
            signature: handshakeInfo?.signature || "",
            product: handshakeInfo?.product || "",
          });

          const {
            currentProject,
            updateECUConnectionInfo,
          } = useStore.getState();
          updateECUConnectionInfo(handshakeInfo);

          const hasIniSignatureMismatch =
            Boolean(currentProject?.ini?.signature) &&
            Boolean(handshakeInfo?.signature) &&
            currentProject.ini.signature.trim() !== handshakeInfo.signature.trim();

          if (hasIniSignatureMismatch) {
            console.warn("[App] INI signature mismatch detected", {
              projectName: currentProject.projectName,
              projectSignature: currentProject.ini.signature,
              ecuSignature: handshakeInfo.signature,
              iniPath: currentProject.ini.path || "(embedded only)",
            });
            addConnectionEvent("warning", "Project INI signature does not match ECU", {
              projectSignature: currentProject.ini.signature,
              ecuSignature: handshakeInfo.signature,
            });
            notify(
              `INI mismatch: project=${currentProject.ini.signature}, ecu=${handshakeInfo.signature}`,
              "warning",
              7000,
            );
            openIniMismatchDialog({
              projectName: currentProject.projectName,
              projectSignature: currentProject.ini.signature,
              ecuSignature: handshakeInfo.signature,
              iniPath: currentProject.ini.path || "(embedded only)",
            });
          }


        } catch (err) {
          if (!isCurrent()) return;
          console.error("[App] Handshake failed:", err);
          setConnectionStatus("error", "Handshake failed");
          setConnectionTransportStatus("error");
          setConnectionHandshakeStatus("failed");
          addConnectionEvent("error", "ECU handshake failed", {
            error: err?.message || "Handshake failed",
          });
          notify("ECU handshake failed", "error");
          try { await window.serial.disconnect(); } catch (closeError) { console.error("[App] Disconnect after handshake failure failed", closeError); }
        }
      } else if (status === 'connecting') {
        serialService.reset();
        setConnectionStatus('connecting');
        setConnectionTransportStatus('connecting');
        setConnectionHandshakeStatus('idle');
      } else if (status === "disconnected") {
        serialService.reset();
        setConnectionStatus("disconnected");
        setConnectionTransportStatus("disconnected");
        setConnectionHandshakeStatus("idle");
        closeIniMismatchDialog();
        addConnectionEvent("transport", "Serial transport disconnected");
        if (useStore.getState().runtimeProfileSession?.state !== 'Unknown') clearRuntimeProfileSession({ state: 'Disconnected' });
      } else if (status.startsWith("error:")) {
        serialService.reset();
        setConnectionHandshakeStatus('failed');
        console.error("[App] Serial transport error", status.slice(6));
        setConnectionStatus("error", status.slice(6));
        setConnectionTransportStatus("error");
        addConnectionEvent("error", "Serial transport error", {
          error: status.slice(6),
        });
      }
    });

    return () => {
      transportGeneration += 1;
      unsubscribeStatus?.();
      serialService.offRealtime(handleRealtime);
      serialService.destroy();
    };
    }, [
      init,
      setConnectionStatus,
      setConnectionTransportStatus,
      setConnectionHandshakeStatus,
      setRealtime,
      notify,
      addConnectionEvent,
      clearRuntimeProfileSession,
      openIniMismatchDialog,
      closeIniMismatchDialog,
    ]);

  // Validate each project/session before publishing live data. A tune mismatch
  // remains a review outcome; it never uploads or replaces a tune automatically.
  useEffect(() => {
    if (connectionStatus !== 'connected' || handshakeStatus !== 'ok' || !firmwareSignature) return;
    let cancelled = false;
    const initial = useStore.getState();
    const session = initial.connection.sessionId;
    const check = () => {
      const state = useStore.getState();
      if (cancelled || state.connection.status !== 'connected' || state.connection.sessionId !== session ||
          state.projectEpoch !== projectEpoch || state.parsedIni !== parsedIni) throw new Error('ECU validation context changed');
      assertCompatibleContract(state);
    };
    initial.setConnectionValidation('checking');
    serialService.stopOutputChannelsPolling();
    initial.clearRealtime();
    (async () => {
      try {
        const result = await validateConnectedECU({ check,
          compare: () => useStore.getState().compareWithECU(),
          readTelemetry: () => serialService.readOutputChannels(parsedIni) });
        check();
        if (result.status === 'review') useStore.getState().openSyncDialog(result.comparison);
        useStore.getState().setConnectionValidation(result.status);
        useStore.getState().setRealtime(result.telemetry, { ini: parsedIni });
        addConnectionEvent('sync', result.status === 'ready' ? 'ECU configuration and fresh telemetry verified' : 'ECU online; tune differences require review');
      } catch (error) {
        if (cancelled || useStore.getState().connection.sessionId !== session || useStore.getState().projectEpoch !== projectEpoch) return;
        if (Object.keys(error.comparison?.pageStates || {}).length) useStore.getState().openSyncDialog(error.comparison);
        useStore.getState().setConnectionValidation('failed', error.message);
        useStore.getState().clearRealtime(error.message);
        addConnectionEvent('error', 'ECU recovery validation failed', { error: error.message });
        notify(`ECU validation failed: ${error.message}`, 'error', 6000);
      }
    })();
    return () => { cancelled = true; serialService.stopOutputChannelsPolling(); };
  }, [connectionStatus, handshakeStatus, firmwareSignature, parsedIni, projectEpoch, addConnectionEvent, notify]);

  useEffect(() => {
    serialService.stopOutputChannelsPolling();
    if (connectionStatus !== 'connected' || handshakeStatus !== 'ok' || !['ready', 'review'].includes(validationStatus)) {
      useStore.getState().clearRealtime(useStore.getState().connection.validationError || null);
      return;
    }
    try {
      assertCompatibleContract(useStore.getState());
      if (!serialService.startOutputChannelsPolling(parsedIni)) throw new Error('The project INI has no telemetry definition');
    } catch (error) {
      useStore.getState().clearRealtime(error.message);
      addConnectionEvent('error', 'Telemetry unavailable', { error: error.message });
    }
    return () => serialService.stopOutputChannelsPolling();
  }, [connectionStatus, handshakeStatus, validationStatus, firmwareSignature, parsedIni, projectEpoch, addConnectionEvent]);

  useEffect(() => {
    let cancelled = false;
    const tick = createAutoReconnect({ getState: useStore.getState,
      onError: error => addConnectionEvent('warning', error.message),
      connect: async (port, baud) => {
        const epoch = useStore.getState().projectEpoch;
        const check = () => {
          const state = useStore.getState();
          if (cancelled || state.projectEpoch !== epoch || !state.settings.autoReconnect ||
              state.settings.lastSerialPort !== port || Number(state.settings.lastSerialBaud || 115200) !== baud ||
              state.connection.autoReconnectPaused) throw new Error('Auto reconnect cancelled');
        };
        addConnectionEvent('transport', 'Attempting auto reconnect', { port, baud });
        const result = await recoverECUConnection({ serial: window.serial, getState: useStore.getState,
          port, baud, check, attempts: 1, owner: 'auto' });
        check();
        if (!result.ok) addConnectionEvent('warning', result.error);
      } });
    void tick();
    const timer = setInterval(() => { void tick(); }, 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [addConnectionEvent]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement.tagName.toLowerCase();
      const isInput = ["input", "select", "textarea"].includes(activeTag);
      const { notify, closeProject, saveProject, openProject } =
        useStore.getState();

      if (e.ctrlKey) {
        if (e.key === "n") {
          e.preventDefault();
          closeProject().then(result => {
            if (result.ok) notify("Project closed", "info", 2000);
          });
        }
        if (e.key === "o") {
          e.preventDefault();
          window.projects.pickExisting().then(async (filePath) => {
            if (filePath) {
              await openProject(filePath);
            }
          });
        }
        if (e.key === "s") {
          e.preventDefault();
          saveProject().then((res) => {
            if (res.ok) notify("Project Saved Successfully", "success");
            else notify(`Error: ${res.error}`, "error");
          });
        }
      }

      if (!isInput) {
        if (e.key === "1") navigate(ROUTES.DASHBOARD);
        if (e.key === "2") navigate(ROUTES.TUNING_VE);
        if (e.key === "3") navigate(ROUTES.TUNING_IGNITION);
        if (e.key === "4") navigate(ROUTES.TUNING_AFR);
        if (e.key === "5") navigate(ROUTES.SETTINGS_ENGINE);
        if (e.key === "6") navigate(ROUTES.SETTINGS_TRIGGER);
        if (e.key === "7") navigate(ROUTES.SETTINGS_IAT);
        if (e.key === "8") navigate(ROUTES.SETTINGS_INJECTOR);
        if (e.key === "9") navigate(ROUTES.SETTINGS_PROGRAMMABLE);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden relative bg-[#0a0b10] text-[#eeeff5] font-inter"
      style={{
        "--accent-color": accent.main,
        "--accent-glow": accent.glow,
      }}
    >
      {/* Background image is only visible in GettingStarted or via low opacity */}
      {settings.backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center z-0 transition-[opacity,filter] duration-500 pointer-events-none"
          style={{
            backgroundImage: `url("atom:///${settings.backgroundImage.replace(/\\/g, "/")}")`,
            opacity: Math.max(
              0,
              Math.min(1, (settings.backgroundOpacity ?? 20) / 100),
            ),
            filter: `blur(${Math.max(0, settings.backgroundBlur ?? 0)}px)`,
            transform:
              (settings.backgroundBlur ?? 0) > 0 ? "scale(1.03)" : "none",
          }}
        />
      )}

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        <NotificationTray />
        <AppToolbar />
        <SyncDialog
          isOpen={syncDialogOpen}
          onClose={closeSyncDialog}
          diffResults={syncDialogResults}
        />
        <IniMismatchDialog
          isOpen={iniMismatchDialogOpen}
          details={iniMismatchDetails}
          onClose={closeIniMismatchDialog}
          onReview={() => {
            closeIniMismatchDialog();
            navigate(ROUTES.COMM);
          }}
        />

        {!currentProject ? (
          <div className="flex-1 overflow-hidden relative">
            <GettingStarted />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden relative">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
              <IndicatorTray />
              <ECURestartNotice />
              <main className="flex-1 overflow-hidden relative ">
                <Switch>
                  <Route path={ROUTES.ANALYSIS} component={Analysis} />
                  <Route path={ROUTES.TUNING_VE} component={VETable} />
                  <Route path={ROUTES.TUNING_VE2} component={VETable2} />
                  <Route
                    path={ROUTES.TUNING_IGNITION}
                    component={IgnitionTable}
                  />
                  <Route
                    path={ROUTES.TUNING_IGNITION2}
                    component={IgnitionTable2}
                  />
                  <Route path={ROUTES.TUNING_AFR} component={AFRTable} />
                  <Route path={ROUTES.TUNING_LAMBDA} component={LambdaTable} />
                  <Route path={ROUTES.SETTINGS_FUEL} component={FuelSettings} />
                  <Route
                    path={ROUTES.SETTINGS_ENGINE}
                    component={EngineSettings}
                  />
                  <Route
                    path={ROUTES.SETTINGS_TRIGGER}
                    component={TriggerSetup}
                  />
                  <Route path={ROUTES.SETTINGS_IAT} component={IATCorrection} />
                  <Route
                    path={ROUTES.SETTINGS_INJECTOR}
                    component={InjectorCharacteristics}
                  />
                  <Route
                    path={ROUTES.SETTINGS_PROGRAMMABLE}
                    component={ProgrammableOutputs}
                  />
                  <Route
                    path={ROUTES.SETTINGS_IO_SUMMARY}
                    component={IOSummary}
                  />
                  <Route path={ROUTES.SETTINGS_SPARK} component={SparkSetup} />
                  <Route path={ROUTES.SETTINGS_AFR} component={AFRO2Settings} />
                  <Route
                    path={ROUTES.SETTINGS_FLEX}
                    component={FlexFuelSettings}
                  />
                  <Route
                    path={ROUTES.SETTINGS_PROTECTION}
                    component={EngineProtection}
                  />
                  <Route
                    path={ROUTES.STARTUP_CRANKING}
                    component={CrankingSettings}
                  />
                  <Route
                    path={ROUTES.STARTUP_CURVES}
                    component={StartupCurves}
                  />
                  <Route path={ROUTES.STARTUP_IDLE} component={IdleControl} />
                  <Route
                    path={ROUTES.RACING_LAUNCH}
                    component={LaunchControl}
                  />
                  <Route path={ROUTES.RACING_FLATSHIFT} component={FlatShift} />
                  <Route
                    path={ROUTES.RACING_PITLIMITER}
                    component={PitLimiter}
                  />
                  <Route
                    path={ROUTES.RACING_RUMBLEIDLE}
                    component={RumbleIdle}
                  />
                  <Route path={ROUTES.RACING_ANTILAG} component={AntiLag} />
                  <Route
                    path={ROUTES.RACING_POPANDBANG}
                    component={PopAndBang}
                  />
                  <Route
                    path={ROUTES.RACING_PROFILES}
                    component={RuntimeProfiles}
                  />
                  <Route
                    path={ROUTES.RACING_PROFILE_EDITOR}
                    component={RuntimeProfileEditor}
                  />
                  <Route path={ROUTES.RACING_NITROUS} component={Nitrous} />
                  <Route path={ROUTES.ADDON_FUELPUMP} component={FuelPump} />
                  <Route path={ROUTES.SETTINGS_FAN} component={FanSettings} />
                  <Route path={ROUTES.SETTINGS_WMI} component={WMI} />
                  <Route path={ROUTES.SETTINGS_VVT} component={VVTControl} />
                  <Route
                    path={ROUTES.SETTINGS_BOOST}
                    component={BoostControl}
                  />
                  <Route
                    path={ROUTES.SETTINGS_STAGED}
                    component={StagedInjection}
                  />
                  <Route
                    path={ROUTES.SETTINGS_CALIBRATION}
                    component={SensorCalibration}
                  />
                  <Route
                    path={ROUTES.TOOLS_DIAGNOSTICS}
                    component={ProtocolStats}
                  />
                  <Route
                    path={ROUTES.TOOLS_FLASH_FIRMWARE}
                    component={FlashFirmware}
                  />
                  <Route path={ROUTES.SETTINGS_TACHO} component={TachoOutput} />
                  <Route path={ROUTES.COMM} component={Communications} />
                  <Route path={ROUTES.TERMINAL} component={RawConsole} />
                  <Route
                    path={ROUTES.APP_SETTINGS}
                    component={GlobalPreferencesPage}
                  />
                  <Route path={ROUTES.DASHBOARD} component={Dashboard} />
                  <Route>
                    <Dashboard />
                  </Route>
                </Switch>
              </main>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
