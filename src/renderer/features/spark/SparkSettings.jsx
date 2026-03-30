import React from "react";
import {
  Zap,
  Settings,
  Info,
  Lock,
  Activity,
  ShieldAlert,
  Flame,
  ArrowRightLeft,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import {
  InputField,
  SelectRow,
} from "../shared/components/TuningComponents";
import { useStore } from "../../core/store";
import { toDisplay, toRaw } from "../shared/utils/normalization";

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

function GroupHeader({
  title,
  icon: Icon,
  colorClass = "bg-neon-purple",
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className={`${colorClass} p-2 rounded-xl shadow-lg shadow-black/20`}>
        <Icon size={16} className="text-black" />
      </div>
      <h3 className="text-xs font-black text-white uppercase tracking-widest">
        {title}
      </h3>
    </div>
  );
}

export default function SparkSettings({
  controller = null,
  showHeader = true,
}) {
  const { parsedIni } = useStore();
  const hookController = useTuningModule(SPARK_FIELDS);
  const {
    getFieldValue,
    setFieldValue,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isDirty,
    isReady,
    isConnected,
    getFieldInfo,
  } = controller || hookController;

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-neon-purple/20 border-t-neon-purple rounded-full animate-spin" />
          <Zap
            className="absolute inset-0 m-auto text-neon-purple animate-pulse"
            size={20}
          />
        </div>
        <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] animate-pulse">
          Syncing Ignition Logic...
        </div>
      </div>
    );
  }

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, value) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(value, info?.meta));
  };

  // Helper to filter dropdown options (same as LaunchControl/FlatShift)
  const getCleanOptions = (fieldName) => {
    const info = getFieldInfo(fieldName);
    if (info?.pageId === undefined || info?.pageId === null) return [];
    if (!parsedIni?.constants?.pages?.[info.pageId]) return [];

    const pageObj = parsedIni.constants.pages[info.pageId];
    const fieldDef = pageObj[info.key]; // e.g., { type: 'bits', labels: [...] }

    const labels = fieldDef?.labels || fieldDef?.options;
    if (!labels) return [];

    // Maintain original index for ECU communication
    return labels
      .map((label, index) => ({ label, index }))
      .filter((opt) => opt.label && opt.label.toUpperCase() !== "INVALID");
  };

  return (
    <div className="flex flex-col gap-8 p-3 backdrop-blur-md w-full animate-in fade-in duration-700">
      {showHeader ? (
        <TuningHeader
          title="Ignition / Spark Settings"
          description="Dwell, Triggering, and Main Ignition Logic"
          icon={Zap}
          themeColor="orange"
          isDirty={isDirty}
          isSaving={isSaving}
          saveStatus={saveStatus}
          onSave={() => handleSave()}
          onBurn={() => handleSave(true)}
          onDiscard={discardChanges}
          isConnected={isConnected}
        />
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Hardware & Hardware */}
        <div className="flex flex-col gap-8">
          <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/5 blur-[60px] rounded-full" />
            <GroupHeader title="Spark Hardware" icon={Settings} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SelectRow
                label="Spark Output Mode"
                value={getValue("sparkMode")}
                onChange={(value) => updateValue("sparkMode", value)}
                options={getCleanOptions("sparkMode")}
                icon={Zap}
              />
              <SelectRow
                label="Output Trigger"
                value={getValue("IgInv")}
                onChange={(value) => updateValue("IgInv", value)}
                options={getCleanOptions("IgInv")}
                icon={ShieldAlert}
              />
              <SelectRow
                label="Ignition Algorithm"
                value={getValue("ignAlgorithm")}
                onChange={(value) => updateValue("ignAlgorithm", value)}
                options={getCleanOptions("ignAlgorithm")}
                icon={Activity}
              />
              <InputField
                label="Cranking Advance"
                value={getValue("CrankAng")}
                onChange={(value) => updateValue("CrankAng", value)}
                units="DEG"
                icon={Flame}
              />
            </div>
            {getValue("IgInv") === 1 && (
              <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex gap-4 items-start animate-in zoom-in-95">
                <ShieldAlert
                  className="text-rose-500 shrink-0 mt-0.5"
                  size={16}
                />
                <p className="text-[10px] text-rose-500/80 font-bold leading-relaxed tracking-tight">
                  WARNING: "Going High" output can destroy smart-coils/igniters
                  if configured incorrectly. Ensure your hardware supports this
                  logic.
                </p>
              </div>
            )}
          </div>

          <div className="p-8 rounded-[40px] glass-card border border-white/10">
            <GroupHeader title="Timing Precision" icon={Activity} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
              <SelectRow
                label="Per Tooth Precision"
                value={getValue("perToothIgn")}
                onChange={(value) => updateValue("perToothIgn", value)}
                options={getCleanOptions("perToothIgn")}
              />
              <SelectRow
                label="Dwell Error Correction"
                value={getValue("dwellErrCorrect")}
                onChange={(value) => updateValue("dwellErrCorrect", value)}
                options={getCleanOptions("dwellErrCorrect")}
                disabled={getValue("perToothIgn") === 0}
              />
            </div>
            <p className="text-[10px] text-white/30 font-medium px-2 leading-relaxed italic">
              * Per tooth timing improves accuracy on high-count triggers but
              requires reliable crank signals.
            </p>
          </div>
        </div>

        {/* Locked Timing */}
        <div className="flex flex-col gap-8">
          <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-[60px] rounded-full" />
            <GroupHeader
              title="Fixed Timing (Locked)"
              icon={Lock}
              colorClass="bg-neon-cyan shadow-glow-cyan"
            />

            <div className="grid grid-cols-1 gap-8">
              <div className="flex flex-col md:flex-row gap-6 items-end group/item">
                <div className="flex-1 w-full">
                  <SelectRow
                    label="Enable Locked Timing"
                    value={getValue("fixAngEnable")}
                    onChange={(value) => updateValue("fixAngEnable", value)}
                    options={getCleanOptions("fixAngEnable")}
                    icon={Lock}
                  />
                </div>
                <div
                  className={`w-full md:w-1/3 transition-all duration-300 ${getValue("fixAngEnable") === 0 ? "opacity-20 pointer-events-none" : "opacity-100 animate-in slide-in-from-right-4"}`}
                >
                  <InputField
                    label="Locked Angle"
                    value={getValue("FixAng")}
                    onChange={(value) => updateValue("FixAng", value)}
                    units="DEG"
                    icon={ArrowRightLeft}
                    disabled={getValue("fixAngEnable") === 0}
                  />
                </div>
              </div>

              <div className="p-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={12} className="text-neon-cyan" />
                  <span className="text-[9px] font-black text-neon-cyan uppercase">
                    Timing Protocol
                  </span>
                </div>
                <p className="text-[10px] text-white/40 font-medium leading-relaxed">
                  When "Fixed Timing" is enabled, the ECU ignores the Ignition
                  Table and stays locked at the specified angle. Useful for
                  verifying trigger offset with a timing light.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
