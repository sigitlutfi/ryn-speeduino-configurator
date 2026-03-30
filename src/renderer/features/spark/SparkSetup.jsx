import React from "react";
import { useState } from "react";
import { useStore } from "../../core/store";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import SparkSettings from "./SparkSettings";
import DwellSettings from "./DwellSettings";
import DwellVoltageCurve from "./curves/DwellVoltageCurve";
import IATRetardCurve from "./curves/IATRetardCurve";
import ColdAdvanceCurve from "./curves/ColdAdvanceCurve";
import { ShieldAlert, Zap } from "lucide-react";

const SPARK_FIELDS = [
  "ignAlgorithm",
  "sparkMode",
  "CrankAng",
  "IgInv",
  "fixAngEnable",
  "FixAng",
  "perToothIgn",
  "dwellErrCorrect",
];

const DWELL_FIELDS = [
  "dwellcrank",
  "useDwellMap",
  "dwellrun",
  "sparkDur",
  "useDwellLim",
  "dwellLim",
];

const CURVE_PAGES = [1, 2, 4, 6];

const CurvePlaceholder = ({ title, icon: Icon, description }) => (
  <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/10 backdrop-blur-xl flex flex-col gap-4 relative overflow-hidden group">
    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
    <div className="absolute top-0 left-0 w-1 h-full bg-neon-purple/30" />
    <div className="relative z-10 flex items-center gap-3">
      <div className="p-2 rounded-xl bg-white/5 text-white/40 border border-white/10">
        <Icon size={16} />
      </div>
      <div>
        <h3 className="text-[12px] font-black text-white/80 uppercase tracking-widest">
          {title}
        </h3>
        <p className="text-[10px] text-white/30">{description}</p>
      </div>
    </div>
    <div className="relative z-10 h-40 w-full border border-dashed border-white/10 rounded-2xl flex items-center justify-center bg-black/30">
      <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
        Universal CurveEditor — Under Construction
      </span>
    </div>
  </div>
);

const SectionLabel = ({ eyebrow, title, description }) => (
  <div className="flex flex-col gap-2 px-2 backdrop-blur-xl">
    <span className="text-[8px] font-black text-neon-purple/70 uppercase tracking-[0.35em]">
      {eyebrow}
    </span>
    <div className="flex flex-col gap-1">
      <h2 className="text-sm font-orbitron font-black text-white uppercase tracking-widest">
        {title}
      </h2>
      {description ? (
        <p className="text-[10px] text-white/40 max-w-3xl leading-relaxed">
          {description}
        </p>
      ) : null}
    </div>
  </div>
);

export default function SparkSetup() {
  const sparkController = useTuningModule(SPARK_FIELDS);
  const dwellController = useTuningModule(DWELL_FIELDS);
  const curveController = useTuningModule(CURVE_PAGES);
  const currentProject = useStore((s) => s.currentProject);
  const updateConstants = useStore((s) => s.updateConstants);
  const writePagesToRAM = useStore((s) => s.writePagesToRAM);
  const burnPendingPages = useStore((s) => s.burnPendingPages);
  const saveProject = useStore((s) => s.saveProject);
  const notify = useStore((s) => s.notify);
  const connection = useStore((s) => s.connection);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveStatusAll, setSaveStatusAll] = useState(null);

  const isReady =
    sparkController.isReady && dwellController.isReady && curveController.isReady;
  const isDirty =
    sparkController.isDirty ||
    dwellController.isDirty ||
    curveController.isDirty;
  const isSaving =
    isSavingAll ||
    sparkController.isSaving ||
    dwellController.isSaving ||
    curveController.isSaving;
  const isConnected =
    sparkController.isConnected ||
    dwellController.isConnected ||
    curveController.isConnected;
  const saveStatus =
    saveStatusAll ||
    sparkController.saveStatus ||
    dwellController.saveStatus ||
    curveController.saveStatus;

  const handleSaveAll = async (isBurn = false) => {
    if (isBurn && connection.status !== "connected") {
      notify("Device not connected", "error");
      return { ok: false };
    }

    const mergedPages = {};
    const mergePayload = (payload) => {
      Object.entries(payload || {}).forEach(([pageId, pageData]) => {
        mergedPages[pageId] = {
          ...(mergedPages[pageId] || {}),
          ...(pageData || {}),
        };
      });
    };

    mergePayload(sparkController.getSavePayload());
    mergePayload(dwellController.getSavePayload());

    const dirtyCurvePages = CURVE_PAGES.filter((pageId) => {
      const snapshot =
        currentProject?.constants?.pages?.[pageId] ||
        currentProject?.constants?.pages?.[String(pageId)];
      return snapshot?.syncState === "dirty-local";
    });

    const pagesToWrite = Array.from(
      new Set([
        ...Object.keys(mergedPages)
          .map(Number)
          .filter((value) => !Number.isNaN(value)),
        ...dirtyCurvePages,
      ]),
    )
      .map(Number)
      .filter((value) => !Number.isNaN(value));

    setIsSavingAll(true);
    setSaveStatusAll(null);

    try {
      if (Object.keys(mergedPages).length > 0) {
        await updateConstants(mergedPages);
      }

      if (connection.status === "connected" && pagesToWrite.length > 0) {
        const ramResult = await writePagesToRAM(pagesToWrite);
        if (!ramResult.ok) {
          throw new Error(ramResult.errors?.[0]?.error || "ECU RAM sync failed");
        }

        if (isBurn) {
          const burnResult = await burnPendingPages(pagesToWrite);
          if (!burnResult.ok) {
            throw new Error(burnResult.errors?.[0]?.error || "ECU burn failed");
          }
        }
      }

      const result = await saveProject();
      if (result.ok) {
        setSaveStatusAll("success");
        notify(
          isBurn
            ? "RAM write, burn, and project save successful"
            : connection.status === "connected"
              ? "RAM write and project save successful"
              : "Project save successful",
          "success",
        );
      } else {
        setSaveStatusAll("error");
        notify(`Save Failed: ${result.error}`, "error");
      }
      return result;
    } catch (error) {
      setSaveStatusAll("error");
      notify(error?.message || "Save failed", "error");
      return { ok: false, error: error?.message || "Save failed" };
    } finally {
      setIsSavingAll(false);
      setTimeout(() => setSaveStatusAll(null), 3000);
    }
  };

  const discardAll = () => {
    sparkController.discardChanges();
    dwellController.discardChanges();
    curveController.discardChanges();
  };

  if (!isReady) return null;

  return (
    <div className="flex flex-col h-full select-none overflow-hidden animate-in fade-in duration-700">
      <TuningHeader
        title="Spark Setup"
        description="Ignition strategy, dwell behavior, and spark compensation curves"
        icon={Zap}
        themeColor="orange"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        onSave={() => handleSaveAll(false)}
        onBurn={() => handleSaveAll(true)}
        onDiscard={discardAll}
        isConnected={isConnected}
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className=" mx-auto space-y-6 pb-20">
          <SectionLabel
            eyebrow="Core Logic"
            title="Ignition Strategy"
            description="Primary trigger logic, fixed timing behavior, and dwell control stay grouped together here so the spark workflow reads like one system."
          />

          <div className="space-y-8">
            <div className="rounded-[44px] bg-gradient-to-b from-white/6 to-transparent p-1">
              <div className="rounded-[40px] bg-black/20 border border-white/5">
                <SparkSettings
                  controller={sparkController}
                  showHeader={false}
                />
              </div>
            </div>

            <SectionLabel
              eyebrow="Dwell Settings"
              title="Coil Charge Strategy"
              description="Primary trigger logic, fixed timing behavior, and dwell control stay grouped together here so the spark workflow reads like one system."
            />

            <div className="rounded-[44px] bg-gradient-to-b from-white/6 to-transparent p-1">
              <div className="rounded-[40px] bg-black/20 border border-white/5">
                <DwellSettings
                  controller={dwellController}
                  showHeader={false}
                />
              </div>
            </div>
          </div>

          <SectionLabel
            eyebrow="Compensation"
            title="Ignition Curves"
            description="Voltage, intake temperature, and coolant-based corrections are grouped together so the spark modifiers feel like a unified set of tools."
          />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <DwellVoltageCurve />
            <IATRetardCurve />
            <ColdAdvanceCurve />
          </div>

          <CurvePlaceholder
            title="Knock Settings"
            icon={ShieldAlert}
            description="Reserved for DSP knock detection parameters and automatic aggressive timing truncation."
          />
        </div>
      </div>
    </div>
  );
}
