import React, { useState } from "react";
import { Activity, ShieldAlert, FlaskConical, PencilLine } from "lucide-react";
import { useLocation } from "wouter";
import { useStore } from "../../core/store.js";
import { ROUTES } from "../../routes.js";
import { DEFAULT_RUNTIME_PROFILE_GUARDS } from "../../core/store/projectSlice.js";

const RUNTIME_BENCH_GUARDS = {
  ...DEFAULT_RUNTIME_PROFILE_GUARDS,
  max_tps_pct: 100,
  max_rpm: 8000,
};

const PROFILE_BUTTONS = [
  { id: "DEFAULT", kind: "rollback", presetKey: null },
  { id: "ECO", kind: "profile", presetKey: "eco" },
  { id: "RACING", kind: "profile", presetKey: "racing" },
  { id: "EXTREME", kind: "profile", presetKey: "extreme" },
];

const FIELD_LABELS = {
  ve2: "Fuel Table 2",
  spark2: "Spark Table 2",
  afr1: "AFR Table",
  fuel2Mode: "Fuel2 Mode",
  spark2Mode: "Spark2 Mode",
  rumbleIdleEnabled: "Rumble Idle",
  alsEnabled: "ALS",
  alsMaxDuration: "ALS Max Duration",
};

const RUNTIME_VISIBLE_FIELDS = new Set([
  "ve2",
  "spark2",
  "afr1",
  "fuel2Mode",
  "spark2Mode",
  "rumbleIdleEnabled",
  "alsEnabled",
  "alsMaxDuration",
]);

function StatusPill({ label, tone = "neutral" }) {
  const toneClass = {
    neutral: "border-white/10 bg-white/5 text-white/60",
    success: "border-neon-green/25 bg-neon-green/10 text-neon-green",
    warning: "border-neon-yellow/25 bg-neon-yellow/10 text-neon-yellow",
    danger: "border-neon-red/25 bg-neon-red/10 text-neon-red",
    info: "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-orbitron font-bold uppercase tracking-[0.18em] ${toneClass[tone] || toneClass.neutral}`}
    >
      {label}
    </span>
  );
}

function formatFieldName(fieldName) {
  return FIELD_LABELS[fieldName] || fieldName;
}

function formatFieldValue(value) {
  if (value && typeof value === "object" && value.changedCells !== undefined) {
    return `${value.changedCells} cells`;
  }
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "-";
  return String(value);
}

function formatRuntimeStateLabel(state) {
  const labels = {
    Disconnected: "Disconnected",
    Base: "Base",
    Applying: "Applying",
    ProfileActive: "Profile Active",
    RollingBack: "Rolling Back",
    Unknown: "Unknown",
  };
  return labels[state] || state || "Idle";
}

function ModeButton({ label, active, disabled, onClick, tone = "neutral" }) {
  const toneClass = {
    neutral: active
      ? "border-neon-cyan/60 bg-neon-cyan/20 text-white shadow-[0_0_24px_rgba(0,229,255,0.16)]"
      : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10",
    success: active
      ? "border-neon-green/60 bg-neon-green/20 text-white shadow-[0_0_24px_rgba(57,255,20,0.16)]"
      : "border-neon-green/20 bg-neon-green/5 text-neon-green hover:bg-neon-green/10",
    warning: active
      ? "border-neon-yellow/60 bg-neon-yellow/20 text-white shadow-[0_0_24px_rgba(255,214,10,0.16)]"
      : "border-neon-yellow/20 bg-neon-yellow/5 text-neon-yellow hover:bg-neon-yellow/10",
    danger: active
      ? "border-neon-red/60 bg-neon-red/20 text-white shadow-[0_0_24px_rgba(255,59,59,0.16)]"
      : "border-neon-red/20 bg-neon-red/5 text-neon-red hover:bg-neon-red/10",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border px-4 py-3 text-[11px] font-orbitron font-bold uppercase tracking-[0.18em] transition-all disabled:opacity-40 ${toneClass[tone] || toneClass.neutral}`}
    >
      {label}
    </button>
  );
}

function summarizeVe2Preset(tablePreset) {
  const rawValues = Array.from(tablePreset?.rawValues || []);
  if (!rawValues.length) return "VE2 preset belum berisi data.";

  const uniqueValues = Array.from(new Set(rawValues));
  if (uniqueValues.length === 1) {
    return `VE2 flat ${uniqueValues[0]} di semua bin`;
  }

  return `VE2 custom table (${rawValues.length} cells)`;
}

function summarizeProfilePreset(profileName, preset) {
  if (!preset) return `${profileName} preset belum tersedia.`;

  const parts = [];
  const ve2 = preset?.tablePresets?.ve2;
  const spark2 = preset?.tablePresets?.spark2;
  const afr1 = preset?.tablePresets?.afr1;
  const options = preset?.options || {};

  if (ve2) {
    parts.push(`VE2 ${summarizeRuntimeTableState("ve2", ve2, "project")}`);
  }
  if (spark2) {
    parts.push(
      `Spark2 ${summarizeRuntimeTableState("spark2", spark2, "project")}`,
    );
  }
  if (afr1) {
    parts.push(`AFR ${summarizeRuntimeTableState("afr1", afr1, "project")}`);
  }
  if (options.fuel2Mode !== undefined && options.fuel2Mode !== null) {
    parts.push(`Fuel2 mode ${options.fuel2Mode}`);
  }
  if (options.spark2Mode !== undefined && options.spark2Mode !== null) {
    parts.push(`Spark2 mode ${options.spark2Mode}`);
  }
  if (
    options.rumbleIdleEnabled !== undefined &&
    options.rumbleIdleEnabled !== null
  ) {
    parts.push(`Rumble ${options.rumbleIdleEnabled ? "on" : "off"}`);
  }
  if (options.alsEnabled !== undefined && options.alsEnabled !== null) {
    parts.push(`ALS ${options.alsEnabled ? "on" : "off"}`);
  }
  if (options.alsMaxDuration !== undefined && options.alsMaxDuration !== null) {
    parts.push(`ALS ${options.alsMaxDuration}s`);
  }

  return parts.join(" | ");
}

function summarizeRuntimeTableState(
  tableName,
  tableState,
  fallbackLabel = "project",
) {
  const rawValues = Array.from(tableState?.rawValues || []);
  if (!rawValues.length) {
    return fallbackLabel;
  }

  const uniqueValues = Array.from(new Set(rawValues));
  const changedCells = tableState?.changedCells ?? rawValues.length;

  if (uniqueValues.length === 1) {
    return `flat ${uniqueValues[0]}`;
  }

  if (tableName === "ve2") {
    return `${changedCells} cells`;
  }

  return `${changedCells} values`;
}

function normalizeProfileKey(profileId) {
  return profileId?.toLowerCase?.() || "";
}

function buildApplyProfile(profileName, preset) {
  const ve2Preset = preset?.tablePresets?.ve2;
  const spark2Preset = preset?.tablePresets?.spark2;
  const afr1Preset = preset?.tablePresets?.afr1;
  const optionEntries = Object.entries(preset?.options || {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  const tableOverlays = [];

  if (ve2Preset) {
    tableOverlays.push({
      target: "ve2",
      source: "preset",
      operation: "preset",
      table: ve2Preset,
    });
  }

  if (spark2Preset) {
    tableOverlays.push({
      target: "spark2",
      source: "preset",
      operation: "preset",
      table: spark2Preset,
    });
  }

  if (afr1Preset) {
    tableOverlays.push({
      target: "afr1",
      source: "preset",
      operation: "preset",
      table: afr1Preset,
    });
  }

  return {
    name: profileName,
    version: 1,
    runtime_only: true,
    apply_requirements: RUNTIME_BENCH_GUARDS,
    table_overlays: tableOverlays,
    changes: optionEntries.map(([key, value]) => ({
      key,
      type: "scalar",
      value,
    })),
  };
}

export default function RuntimeProfiles() {
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [, navigate] = useLocation();
  const connectionStatus = useStore((s) => s.connection.status);
  const currentProject = useStore((s) => s.currentProject);
  const realtime = useStore((s) => s.realtime);
  const runtimeProfileSession = useStore((s) => s.runtimeProfileSession);
  const notify = useStore((s) => s.notify);
  const applyRuntimeProfile = useStore((s) => s.applyRuntimeProfile);
  const rollbackRuntimeProfile = useStore((s) => s.rollbackRuntimeProfile);
  const getRuntimeProfileGuardStatus = useStore(
    (s) => s.getRuntimeProfileGuardStatus,
  );

  const isConnected = connectionStatus === "connected";
  const runtimeProfiles = currentProject?.runtimeProfiles || {};
  const projectProfiles = {
    ECO: buildApplyProfile("ECO", runtimeProfiles.eco),
    RACING: buildApplyProfile("RACING", runtimeProfiles.racing),
    EXTREME: buildApplyProfile("EXTREME", runtimeProfiles.extreme),
  };
  const activeRequirements = RUNTIME_BENCH_GUARDS;
  const guard = getRuntimeProfileGuardStatus(activeRequirements);
  const safeToApply = isConnected && guard.ok;
  const baselineCount = Object.keys(
    runtimeProfileSession?.baseline || {},
  ).length;
  const activeProfile = runtimeProfileSession?.activeProfile || "DEFAULT";
  const isAtBaseState = runtimeProfileSession?.state === "Base";
  const runtimeStateLabel = formatRuntimeStateLabel(
    runtimeProfileSession?.state,
  );

  const trackedRows = (runtimeProfileSession?.fields || []).map((field) => {
    const baselineValue = runtimeProfileSession?.baseline?.[field]?.value;
    const currentValue = runtimeProfileSession?.currentValues?.[field];
    const changed =
      JSON.stringify(baselineValue) !== JSON.stringify(currentValue);

    return { field, baselineValue, currentValue, changed };
  });

  const trackedTableRows = (runtimeProfileSession?.tables || []).map(
    (tableName) => {
      const baselineTable = runtimeProfileSession?.baselineTables?.[tableName];
      const currentTable = runtimeProfileSession?.currentTables?.[tableName];
      const changed =
        JSON.stringify(baselineTable?.rawValues || []) !==
          JSON.stringify(currentTable?.rawValues || []) ||
        JSON.stringify(baselineTable?.rawRpmAxis || []) !==
          JSON.stringify(currentTable?.rawRpmAxis || []) ||
        JSON.stringify(baselineTable?.rawLoadAxis || []) !==
          JSON.stringify(currentTable?.rawLoadAxis || []);

      return {
        field: tableName,
        baselineValue: summarizeRuntimeTableState(
          tableName,
          baselineTable,
          "project base",
        ),
        currentValue: currentTable
          ? summarizeRuntimeTableState(
              tableName,
              currentTable,
              currentTable?.operation === "preset"
                ? "profile preset"
                : "runtime",
            )
          : null,
        changed,
      };
    },
  );

  const runtimeRows = [...trackedTableRows, ...trackedRows].filter((row) =>
    RUNTIME_VISIBLE_FIELDS.has(row.field),
  );
  const profilePresetRows = [
    { id: "ECO", preset: runtimeProfiles.eco, tone: "success" },
    { id: "RACING", preset: runtimeProfiles.racing, tone: "warning" },
    { id: "EXTREME", preset: runtimeProfiles.extreme, tone: "danger" },
  ];

  const runAction = async (action, fallbackMessage) => {
    setRuntimeBusy(true);
    try {
      await action();
    } catch (error) {
      notify(error.message || fallbackMessage, "error", 4000);
    } finally {
      setRuntimeBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-8 sm:p-10 mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="rounded-[30px] border border-white/10 bg-black/20 p-6 sm:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-orbitron font-bold uppercase tracking-[0.22em] text-neon-cyan">
                Runtime Profiles
              </div>
              <h1 className="mt-2 text-xl sm:text-2xl font-orbitron font-black uppercase tracking-[0.16em] text-white">
                Fuel Multiplier Profiles
              </h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill
                label={runtimeStateLabel}
                tone={
                  runtimeProfileSession?.state === "Applying"
                    ? "warning"
                    : runtimeProfileSession?.state === "RollingBack"
                      ? "warning"
                      : runtimeProfileSession?.state === "ProfileActive"
                        ? "success"
                        : "neutral"
                }
              />
              <StatusPill label={activeProfile} tone="info" />
              <StatusPill
                label={`Baseline ${baselineCount}`}
                tone={baselineCount > 0 ? "success" : "neutral"}
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              Mode
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {PROFILE_BUTTONS.map((button) => {
                const tone =
                  button.id === "ECO"
                    ? "success"
                    : button.id === "RACING"
                      ? "warning"
                      : button.id === "EXTREME"
                        ? "danger"
                        : "neutral";

                const active =
                  button.id === "DEFAULT"
                    ? isAtBaseState
                    : activeProfile === button.id;

                const disabled =
                  button.kind === "rollback"
                    ? !isConnected ||
                      baselineCount === 0 ||
                      runtimeBusy ||
                      isAtBaseState
                    : !safeToApply || runtimeBusy;

                return (
                  <ModeButton
                    key={button.id}
                    label={button.id}
                    tone={tone}
                    active={active}
                    disabled={disabled}
                    onClick={() =>
                      button.kind === "rollback"
                        ? runAction(
                            () => rollbackRuntimeProfile(),
                            "Failed to return runtime profile to base",
                          )
                        : runAction(
                            () =>
                              applyRuntimeProfile(projectProfiles[button.id]),
                            `Failed to apply ${button.id} profile`,
                          )
                    }
                  />
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-neon-yellow/15 bg-neon-yellow/5 p-4">
            <div className="flex items-center gap-2">
              <FlaskConical size={14} className="text-neon-yellow" />
              <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.18em] text-white">
                Profile Scope
              </div>
            </div>

            <div className="mt-3 space-y-2 text-[11px] leading-5 text-white/55">
              <div>
                Preset runtime sekarang memakai pendekatan{" "}
                <code>Multiplied %</code>.
              </div>
              <div>
                1. `ECO`, `RACING`, dan `EXTREME` sekarang dibaca dari{" "}
                <code>currentProject.runtimeProfiles</code>
              </div>
              <div>
                2. project baru akan men-seed preset dengan{" "}
                <code>VE2 = 100</code> flat
              </div>
              <div>
                3. semua preset tetap mengaktifkan <code>fuel2Mode</code> dari
                opsi profile masing-masing
              </div>
              <div>
                4. `DEFAULT` mengembalikan scalar dan VE2 ke base project saat
                ini
              </div>
              <div>
                5. source of truth base adalah project, bukan snapshot ECU saat
                connect
              </div>
              <div>
                6. status apply aktif terlihat dari pill di header dan disable
                state tombol saat proses berjalan
              </div>
              {activeProfile !== "DEFAULT" &&
              runtimeProfiles[activeProfile.toLowerCase()] ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[10px] text-white/60">
                  {summarizeProfilePreset(
                    activeProfile,
                    runtimeProfiles[activeProfile.toLowerCase()],
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <PencilLine size={14} className="text-neon-cyan" />
                <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.18em] text-white">
                  Profile Editor
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    ROUTES.RACING_PROFILE_EDITOR.replace(":profileId", "eco"),
                  )
                }
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[11px] font-orbitron font-bold uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/10"
              >
                <PencilLine size={14} />
                Open Profile Editor
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
              {profilePresetRows.map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.16em] text-white">
                      {profile.id}
                    </div>
                    <StatusPill label={profile.id} tone={profile.tone} />
                  </div>
                  <div className="mt-3 text-[11px] leading-5 text-white/58">
                    {summarizeProfilePreset(profile.id, profile.preset)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-neon-yellow" />
            <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.18em] text-white">
              Guard Policy
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono text-white/70">
            <StatusPill
              label={`TPS ${realtime?.tps ?? 0}% / ${activeRequirements.max_tps_pct}%`}
              tone={
                (realtime?.tps ?? 0) <= activeRequirements.max_tps_pct
                  ? "success"
                  : "warning"
              }
            />
            <StatusPill
              label={`RPM ${realtime?.rpm ?? 0} / ${activeRequirements.max_rpm}`}
              tone={
                (realtime?.rpm ?? 0) <= activeRequirements.max_rpm
                  ? "success"
                  : "warning"
              }
            />
            <StatusPill
              label={realtime?.engine?.cranking ? "Cranking" : "Not Cranking"}
              tone={!realtime?.engine?.cranking ? "success" : "warning"}
            />
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-neon-green" />
            <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.18em] text-white">
              Live Snapshot
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono text-white/70">
            <StatusPill label={`RPM ${realtime?.rpm ?? 0}`} tone="neutral" />
            <StatusPill label={`TPS ${realtime?.tps ?? 0}%`} tone="neutral" />
            <StatusPill
              label={safeToApply ? "SAFE" : "BLOCKED"}
              tone={safeToApply ? "success" : "warning"}
            />
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.18em] text-white">
            Runtime Values
          </div>
          <StatusPill
            label={`${runtimeRows.filter((row) => row.changed).length} changed`}
            tone={
              runtimeRows.some((row) => row.changed) ? "warning" : "neutral"
            }
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {runtimeRows.map((row) => (
            <div
              key={row.field}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.12em] text-white/80">
                  {formatFieldName(row.field)}
                </div>
                <StatusPill
                  label={row.changed ? "CHG" : "OK"}
                  tone={row.changed ? "warning" : "neutral"}
                />
              </div>

              <div className="mt-3 space-y-2 text-[10px] font-mono text-white/70">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/35">base</span>
                  <span>{formatFieldValue(row.baselineValue)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/35">current</span>
                  <span>{formatFieldValue(row.currentValue)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
