import React, { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { useStore } from "./core/store.js";
import { ROUTES } from "./routes.js";
import { parseRealtime } from "../shared/protocol/realtime.js";
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
import AppearanceSettings from "./features/system/AppearanceSettings.jsx";
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

// Analytics Placeholder moved to features/dashboard/Analysis.jsx

const TerminalPlaceholder = () => (
  <div className="flex flex-col items-center justify-center h-full text-gray-700 font-orbitron text-xs tracking-[0.3em] uppercase opacity-40">
    Hardware Terminal Debugger
  </div>
);

export default function App() {
  const [, navigate] = useLocation();
  const {
    currentProject,
    closeProject,
    init,
    settings,
    setConnectionStatus,
    setRealtime,
  } = useStore();

  useEffect(() => {
    init();

    // Global Serial Listeners
    window.serial.onData((bytes) => {
      if (bytes.length === 138 || bytes.length === 144) {
        const data = parseRealtime(bytes);
        if (data) setRealtime(data);
      }
    });

    window.serial.onStatus((status) => {
      if (status === "connected") setConnectionStatus("connected");
      else if (status === "disconnected") setConnectionStatus("disconnected");
      else if (status.startsWith("error:"))
        setConnectionStatus("error", status.slice(6));
    });

    return () => window.serial.offAll();
  }, [init, setConnectionStatus, setRealtime]);

  const bgStyle = settings.backgroundImage
    ? {
        backgroundImage: `url("atom:///${settings.backgroundImage.replace(/\\/g, "/")}")`,
        filter: `blur(${settings.backgroundBlur || 0}px) brightness(${(settings.backgroundOpacity || 40) / 100})`,
        transform: "scale(1.1)", // Prevent blur edges from showing black
      }
    : {};

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore shortcuts if user is typing in an input
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

  if (!currentProject) {
    return (
      <div className="flex flex-col h-screen overflow-hidden relative">
        {settings.backgroundImage && (
          <div
            className="absolute inset-0 bg-cover bg-center z-0 transition-all duration-1000"
            style={bgStyle}
          />
        )}
        <div className="relative z-10 flex flex-col h-full bg-black/40">
          <NotificationTray />
          <AppToolbar />
          <IndicatorTray />
          <GettingStarted />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg-deep text-white overflow-hidden font-inter relative">
      {settings.backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center z-0 transition-all duration-1000"
          style={bgStyle}
        />
      )}
      <NotificationTray />
      <div className="neon-grid pointer-events-none" />
      <AppToolbar />
      <IndicatorTray />

      <div className="flex flex-1 overflow-hidden relative z-10">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Main Workspace Area */}
          <main className="flex-1 overflow-hidden relative bg-black/20">
            <Switch>
              {/* Specific routes should come before the root path in wouter Switch */}
              <Route path={ROUTES.ANALYSIS} component={Analysis} />
              <Route path={ROUTES.TUNING_VE} component={VETable} />
              <Route path={ROUTES.TUNING_VE2} component={VETable2} />
              <Route path={ROUTES.TUNING_IGNITION} component={IgnitionTable} />
              <Route
                path={ROUTES.TUNING_IGNITION2}
                component={IgnitionTable2}
              />
              <Route path={ROUTES.TUNING_AFR} component={AFRTable} />
              <Route path={ROUTES.TUNING_LAMBDA} component={LambdaTable} />
              <Route path={ROUTES.SETTINGS_ENGINE} component={EngineSettings} />
              <Route path={ROUTES.SETTINGS_TRIGGER} component={TriggerSetup} />
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
              <Route path={ROUTES.SETTINGS_FLEX} component={FlexFuelSettings} />
              <Route
                path={ROUTES.SETTINGS_PROTECTION}
                component={EngineProtection}
              />
              <Route
                path={ROUTES.STARTUP_CRANKING}
                component={CrankingSettings}
              />
              <Route path={ROUTES.STARTUP_CURVES} component={StartupCurves} />
              <Route path={ROUTES.STARTUP_IDLE} component={IdleControl} />
              <Route path={ROUTES.RACING_LAUNCH} component={LaunchControl} />
              <Route path={ROUTES.RACING_FLATSHIFT} component={FlatShift} />
              <Route path={ROUTES.RACING_PITLIMITER} component={PitLimiter} />
              <Route path={ROUTES.RACING_RUMBLEIDLE} component={RumbleIdle} />
              <Route path={ROUTES.RACING_ANTILAG} component={AntiLag} />
              <Route path={ROUTES.RACING_NITROUS} component={Nitrous} />
              <Route path={ROUTES.ADDON_FUELPUMP} component={FuelPump} />
              <Route path={ROUTES.SETTINGS_FAN} component={FanSettings} />
              <Route path={ROUTES.SETTINGS_WMI} component={WMI} />
              <Route path={ROUTES.SETTINGS_VVT} component={VVTControl} />
              <Route path={ROUTES.SETTINGS_BOOST} component={BoostControl} />
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
              <Route path={ROUTES.TERMINAL} component={TerminalPlaceholder} />
              <Route
                path={ROUTES.APP_SETTINGS}
                component={AppearanceSettings}
              />
              <Route path={ROUTES.DASHBOARD} component={Dashboard} />
              <Route>
                <Dashboard />
              </Route>
            </Switch>
          </main>
        </div>
      </div>
    </div>
  );
}
