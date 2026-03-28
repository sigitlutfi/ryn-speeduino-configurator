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
import EngineSettings from "./features/engine/EngineSettings.jsx";
import TriggerSetup from "./features/engine/TriggerSetup.jsx";
import AFRO2Settings from "./features/fuel/AFRO2Settings.jsx";
import FlexFuelSettings from "./features/fuel/FlexFuelSettings.jsx";
import IATCorrection from "./features/fuel/curves/IATCorrection.jsx";
import InjectorCharacteristics from "./features/engine/InjectorCharacteristics.jsx";
import ProgrammableOutputs from "./features/io/ProgrammableOutputs.jsx";
import SparkSetup from "./features/spark/SparkSetup.jsx";
import VVTControl from "./features/engine/VVTControl.jsx";
import BoostControl from "./features/fuel/BoostControl.jsx";
import StagedInjection from "./features/fuel/StagedInjection.jsx";
import GettingStarted from "./features/projects/GettingStarted.jsx";
import Analysis from "./features/dashboard/Analysis.jsx";
import AppToolbar from "./ui/AppToolbar.jsx";
import Sidebar from "./ui/Sidebar.jsx";
import NotificationTray from "./ui/NotificationTray.jsx";
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
import TachoOutput from "./features/io/TachoOutput.jsx";
import PitLimiter from "./features/racing/PitLimiter.jsx";
import RumbleIdle from "./features/racing/RumbleIdle.jsx";
import AntiLag from "./features/racing/AntiLag.jsx";

import IndicatorTray from "./features/shared/components/IndicatorTray.jsx";
import SyncDialog from "./ui/SyncDialog.jsx";
import { getAccent } from "./core/theme.js";

const TerminalPlaceholder = () => (
  <div className="flex flex-col items-center justify-center h-full text-gray-700 font-orbitron text-xs tracking-[0.3em] uppercase opacity-40">
    Hardware Terminal Debugger
  </div>
);

export default function App() {
  const [, navigate] = useLocation();
  const currentProject = useStore((s) => s.currentProject);
  const init = useStore((s) => s.init);
  const settings = useStore((s) => s.settings);
  const parsedIni = useStore((s) => s.parsedIni);
  const connectionStatus = useStore((s) => s.connection.status);
  const setConnectionStatus = useStore((s) => s.setConnectionStatus);
  const setRealtime = useStore((s) => s.setRealtime);
  const notify = useStore((s) => s.notify);
  const syncDialogOpen = useStore((s) => s.syncDialogOpen);
  const syncDialogResults = useStore((s) => s.syncDialogResults);
  const closeSyncDialog = useStore((s) => s.closeSyncDialog);

  const accent = getAccent(settings.accentColor);

  useEffect(() => {
    init();

    const handleRealtime = (payload) => {
      const data =
        Buffer.isBuffer(payload) || payload instanceof Uint8Array
          ? parseRealtime(payload)
          : payload;
      if (data) setRealtime(data);
    };
    serialService.onRealtime(handleRealtime);

    // Connection status handler with handshake sequence
    window.serial.onStatus(async (status) => {
      if (status === "connected") {
        // Perform handshake before marking as fully connected
        try {
          console.log("[App] Serial connected, performing handshake...");
          const handshakeInfo = await serialService.handshake();
          setConnectionStatus("connected");
          notify("ECU connected", "success", 2000);

          const {
            currentProject,
            compareWithECU,
            updateECUConnectionInfo,
            parsedIni,
          } = useStore.getState();
          updateECUConnectionInfo(handshakeInfo);

          if (
            currentProject?.ini?.signature &&
            handshakeInfo?.signature &&
            currentProject.ini.signature.trim() !==
              handshakeInfo.signature.trim()
          ) {
            console.warn("[App] INI signature mismatch detected", {
              projectName: currentProject.projectName,
              projectSignature: currentProject.ini.signature,
              ecuSignature: handshakeInfo.signature,
              iniPath: currentProject.ini.path || "(embedded only)",
            });
            notify(
              `INI mismatch: project=${currentProject.ini.signature}, ecu=${handshakeInfo.signature}. Check loaded project/INI.`,
              "warning",
              7000,
            );
          }

          if (currentProject?.ini?.content) {
            try {
              const results = await compareWithECU();
              if (!results?.error) {
                const matched = results.matching?.length || 0;
                const different = results.different?.length || 0;
                const missing = results.missing?.length || 0;
                const errors = results.errors?.length || 0;
                notify(
                  `CRC sync check: ${matched} match, ${different} different, ${missing} missing local`,
                  different > 0 ? "warning" : "info",
                  3500,
                );

                if (different > 0 || missing > 0 || errors > 0) {
                  console.warn("[App] Opening sync dialog after connect", {
                    matching: matched,
                    different,
                    missing,
                    errors,
                  });
                  useStore.getState().openSyncDialog(results);
                }
              }
            } catch (syncErr) {
              console.warn("[App] Initial CRC sync check failed:", syncErr);
            }
          }

          if (parsedIni?.outputChannels?.ochGetCommand) {
            serialService.startOutputChannelsPolling(parsedIni);
          }
        } catch (err) {
          console.error("[App] Handshake failed:", err);
          setConnectionStatus("error", "Handshake failed");
          notify("ECU handshake failed", "error");
          // Disconnect if handshake fails
          window.serial.disconnect();
        }
      } else if (status === "disconnected") {
        serialService.reset();
        setConnectionStatus("disconnected");
      } else if (status.startsWith("error:")) {
        setConnectionStatus("error", status.slice(6));
      }
    });

    return () => {
      window.serial.offAll();
      serialService.offRealtime(handleRealtime);
      serialService.destroy();
    };
  }, [init, setConnectionStatus, setRealtime, notify]);

  useEffect(() => {
    if (
      connectionStatus !== "connected" ||
      !parsedIni?.outputChannels?.ochGetCommand
    ) {
      serialService.stopOutputChannelsPolling();
    }

    return () => {
      if (connectionStatus !== "connected") {
        serialService.stopOutputChannelsPolling();
      }
    };
  }, [connectionStatus, parsedIni]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement.tagName.toLowerCase();
      const isInput = ["input", "select", "textarea"].includes(activeTag);
      const { notify, closeProject, saveProject, setProject } =
        useStore.getState();

      if (e.ctrlKey) {
        if (e.key === "n") {
          e.preventDefault();
          closeProject();
          notify("Project closed", "info", 2000);
        }
        if (e.key === "o") {
          e.preventDefault();
          window.projects.pickExisting().then(async (filePath) => {
            if (filePath) {
              const proj = await window.projects.loadFile(filePath);
              if (proj && !proj.error) {
                setProject({ ...proj, filePath });
                notify(
                  `Project Loaded: ${proj.projectName || "Unnamed"}`,
                  "success",
                );
              } else {
                notify("Failed to load project", "error");
              }
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
            transform: (settings.backgroundBlur ?? 0) > 0 ? "scale(1.03)" : "none",
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

        {!currentProject ? (
          <div className="flex-1 overflow-hidden relative">
            <GettingStarted />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden relative">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
              <IndicatorTray />
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
                  <Route path={ROUTES.SETTINGS_TACHO} component={TachoOutput} />
                  <Route path={ROUTES.COMM} component={Communications} />
                  <Route
                    path={ROUTES.TERMINAL}
                    component={TerminalPlaceholder}
                  />
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
