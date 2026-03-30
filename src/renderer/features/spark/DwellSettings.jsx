import React from "react";
import {
  Zap,
  Settings,
  Info,
  AlertTriangle,
  Flame,
  Battery,
  ShieldAlert,
  Activity,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import {
  InputField,
  SelectRow,
} from "../shared/components/TuningComponents";
import { useStore } from "../../core/store";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const DWELL_FIELDS = [
  "dwellcrank",
  "useDwellMap",
  "dwellrun",
  "sparkDur",
  "useDwellLim",
  "dwellLim",
];

function GroupHeader({
  title,
  icon: Icon,
  colorClass = "bg-neon-purple",
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div
        className={`${colorClass} p-2 rounded-xl shadow-lg shadow-black/20 text-black`}
      >
        <Icon size={16} />
      </div>
      <h3 className="text-xs font-black text-white uppercase tracking-widest">
        {title}
      </h3>
    </div>
  );
}

export default function DwellSettings({
  controller = null,
  showHeader = true,
}) {
  const { parsedIni } = useStore();
  const hookController = useTuningModule(DWELL_FIELDS);
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
          <Battery
            className="absolute inset-0 m-auto text-neon-purple animate-pulse"
            size={20}
          />
        </div>
        <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] animate-pulse">
          Syncing Coil Charging Parameters...
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

  const getCleanOptions = (fieldName) => {
    const info = getFieldInfo(fieldName);
    if (!info?.pageId || !parsedIni?.constants?.pages?.[info.pageId]) return [];

    const pageObj = parsedIni.constants.pages[info.pageId];
    const fieldDef = pageObj[info.key];

    if (!fieldDef?.labels) return [];

    return fieldDef.labels
      .map((label, index) => ({ label, index }))
      .filter((opt) => opt.label && opt.label.toUpperCase() !== "INVALID");
  };

  return (
    <div className="flex flex-col gap-8  w-full animate-in fade-in duration-700">
      {showHeader ? (
        <TuningHeader
          title="Dwell / Spark Configuration"
          description="Ignition dwell times and triggering setup"
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="flex flex-col gap-8">
          <div className="p-8 rounded-[40px] glass-card border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/5 blur-[60px] rounded-full" />
            <GroupHeader title="Coil Charging Timing" icon={Settings} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <InputField
                label="Cranking Dwell"
                value={getValue("dwellcrank")}
                onChange={(value) => updateValue("dwellcrank", value)}
                units="MS"
                icon={Flame}
                step={0.1}
              />
              <InputField
                label="Spark Duration"
                value={getValue("sparkDur")}
                onChange={(value) => updateValue("sparkDur", value)}
                units="MS"
                icon={Activity}
                step={0.1}
              />
            </div>

            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex gap-4 items-start mb-8">
              <Info className="text-indigo-400 shrink-0 mt-0.5" size={16} />
              <p className="text-[10px] text-indigo-200/80 font-bold leading-relaxed tracking-tight">
                Note: Voltage correction is automatically applied to these
                values by the ECU. Values shown are referenced to 12.0V
                baseline.
              </p>
            </div>

            <SelectRow
              label="Running Calculation Mode"
              value={getValue("useDwellMap")}
              onChange={(value) => updateValue("useDwellMap", value)}
              options={getCleanOptions("useDwellMap")}
              description="Switch between fixed running dwell or using the dynamic Dwell Map table."
              icon={Settings}
            />

            <div
              className={`mt-6 transition-all duration-300 ${getValue("useDwellMap") === 1 ? "opacity-20 pointer-events-none scale-95" : "opacity-100 animate-in fade-in"}`}
            >
              <InputField
                label="Base Running Dwell"
                value={getValue("dwellrun")}
                onChange={(value) => updateValue("dwellrun", value)}
                units="MS"
                icon={Zap}
                disabled={getValue("useDwellMap") === 1}
                step={0.1}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="p-8 rounded-[40px] glass-card border border-rose-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-rose/5 blur-[60px] rounded-full" />
            <GroupHeader
              title="Overdwell Safety"
              icon={ShieldAlert}
              colorClass="bg-neon-rose shadow-glow-rose"
            />

            <div className="flex flex-col gap-8">
              <SelectRow
                label="Protection Active"
                value={getValue("useDwellLim")}
                onChange={(value) => updateValue("useDwellLim", value)}
                options={getCleanOptions("useDwellLim")}
                description="Hard limit for dwell time to prevent coil burnout if triggers become unstable."
                icon={ShieldAlert}
              />

              <div
                className={`transition-all duration-300 ${getValue("useDwellLim") === 0 ? "opacity-20 pointer-events-none" : "opacity-100"}`}
              >
                <InputField
                  label="Maximum Permissible Dwell"
                  value={getValue("dwellLim")}
                  onChange={(value) => updateValue("dwellLim", value)}
                  units="MS"
                  icon={ShieldAlert}
                  disabled={getValue("useDwellLim") === 0}
                  step={0.1}
                />
              </div>

              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                <p className="text-[9px] text-rose-500/60 font-black uppercase tracking-widest text-center">
                  Critical Warning
                </p>
                <p className="mt-2 text-[10px] text-rose-400 font-bold leading-relaxed text-center italic">
                  "Set this limit at least 3ms higher than your intended peak
                  dwell time to avoid ignition cut-outs."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
