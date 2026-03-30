import React, { useMemo, useState } from "react";
import { ArrowLeft, Copy, PencilLine, RotateCcw, Save } from "lucide-react";
import { useLocation } from "wouter";
import { useStore } from "../../core/store.js";
import { ROUTES } from "../../routes.js";
import TuningGrid from "../shared/TuningGrid/TuningGrid.jsx";
import { getVarMetadata } from "../../../shared/ini-parser.js";
import {
  readRuntimeTableFromDecodedPage,
  resolveRuntimeTable,
} from "../../../shared/protocol/runtime-tables.js";

const EDITABLE_PROFILE_IDS = ["ECO", "RACING", "EXTREME"];
const EDITOR_TABS = ["Fuel", "Spark", "AFR", "Options"];
const OPTION_FIELDS = [
  {
    key: "fuel2Mode",
    label: "Fuel Table 2 Mode",
    kind: "select",
    options: [
      { value: 0, label: "0 Off" },
      { value: 1, label: "1 Multiplied %" },
      { value: 2, label: "2 Added" },
    ],
  },
  {
    key: "spark2Mode",
    label: "Spark Table 2 Mode",
    kind: "select",
    options: [
      { value: "", label: "Use Project Base" },
      { value: 0, label: "0 Off" },
      { value: 1, label: "1 Multiplied %" },
      { value: 2, label: "2 Added" },
    ],
  },
  {
    key: "rumbleIdleEnabled",
    label: "Rumble Idle",
    kind: "select",
    options: [
      { value: "", label: "Use Project Base" },
      { value: 0, label: "0 Disabled" },
      { value: 1, label: "1 Enabled" },
    ],
  },
  {
    key: "alsEnabled",
    label: "ALS",
    kind: "select",
    options: [
      { value: "", label: "Use Project Base" },
      { value: 0, label: "0 Disabled" },
      { value: 1, label: "1 Enabled" },
    ],
  },
  {
    key: "alsMaxDuration",
    label: "ALS Max Duration",
    kind: "number",
    placeholder: "Use Project Base",
  },
];

function flattenMatrix(matrix = []) {
  return matrix.flatMap((row) => Array.from(row || []));
}

function normalizeProfileKey(profileId) {
  return profileId?.toLowerCase?.() || "";
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

function summarizeTablePreset(tablePreset, label = "Table") {
  const rawValues = Array.from(tablePreset?.rawValues || []);
  if (!rawValues.length) return `${label} preset belum berisi data.`;

  const uniqueValues = Array.from(new Set(rawValues));
  if (uniqueValues.length === 1) {
    return `${label} flat ${uniqueValues[0]} di semua bin`;
  }

  return `${label} custom table (${rawValues.length} cells)`;
}

function tableRawValuesEqual(a, b) {
  return JSON.stringify(Array.from(a?.rawValues || [])) === JSON.stringify(Array.from(b?.rawValues || []));
}

function createFlatTablePresetFromTemplate(template, fillValue) {
  if (!template) return null;
  const totalCells = Math.max(1, (template.rows || 16) * (template.cols || 16));
  const rawValues = Array(totalCells).fill(fillValue);
  const cols = template.cols || 16;
  const rows = template.rows || 16;
  const displayValues = [];
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    displayValues.push(rawValues.slice(rowIndex * cols, (rowIndex + 1) * cols));
  }

  return {
    ...template,
    operation: "preset",
    source: "neutral",
    rawValues,
    displayValues,
  };
}

function getBaseProjectTable(parsedIni, currentProject, logicalName) {
  if (!parsedIni || !currentProject?.constants?.decodedPages) return null;

  try {
    const tableDef = resolveRuntimeTable(parsedIni, logicalName);
    const decodedPage =
      currentProject.constants.decodedPages?.[tableDef.page] ||
      currentProject.constants.decodedPages?.[String(tableDef.page)];
    if (!decodedPage) return null;
    return readRuntimeTableFromDecodedPage(decodedPage, tableDef);
  } catch {
    return null;
  }
}

function getBaseProjectOptionValues(parsedIni, currentProject) {
  const decodedPages = currentProject?.constants?.decodedPages || {};
  const values = {};

  for (const field of OPTION_FIELDS) {
    const meta = parsedIni ? getVarMetadata(parsedIni, field.key) : null;
    const decodedPage =
      decodedPages?.[meta?.page] || decodedPages?.[String(meta?.page)];
    values[field.key] =
      decodedPage && Object.prototype.hasOwnProperty.call(decodedPage, field.key)
        ? decodedPage[field.key]
        : null;
  }

  return values;
}

function createProfileEditorState(profileId, runtimeProfiles, baseProjectTables = {}) {
  const preset = runtimeProfiles?.[normalizeProfileKey(profileId)];
  const fuelTable = preset?.tablePresets?.ve2 || baseProjectTables.ve2;
  const sparkTable = preset?.tablePresets?.spark2 || baseProjectTables.spark2;
  const afrTable = preset?.tablePresets?.afr1 || baseProjectTables.afr1;

  return {
    profileId,
    fuel: {
      values: fuelTable?.displayValues || [],
      rpmAxis: fuelTable?.displayRpmAxis || [],
      loadAxis: fuelTable?.displayLoadAxis || [],
      rawTemplate: fuelTable || null,
    },
    spark: {
      values: sparkTable?.displayValues || [],
      rpmAxis: sparkTable?.displayRpmAxis || [],
      loadAxis: sparkTable?.displayLoadAxis || [],
      rawTemplate: sparkTable || null,
    },
    afr: {
      values: afrTable?.displayValues || [],
      rpmAxis: afrTable?.displayRpmAxis || [],
      loadAxis: afrTable?.displayLoadAxis || [],
      rawTemplate: afrTable || null,
    },
    options: preset?.options || {},
  };
}

export default function RuntimeProfileEditor() {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("Fuel");
  const [location, navigate] = useLocation();
  const currentProject = useStore((s) => s.currentProject);
  const parsedIni = useStore((s) => s.parsedIni);
  const runtimeProfiles = currentProject?.runtimeProfiles || {};
  const updateRuntimeProfilePreset = useStore((s) => s.updateRuntimeProfilePreset);
  const saveProject = useStore((s) => s.saveProject);
  const notify = useStore((s) => s.notify);

  const routeProfileId = location.split("/").pop()?.toUpperCase?.() || "ECO";
  const profileId = EDITABLE_PROFILE_IDS.includes(routeProfileId) ? routeProfileId : "ECO";
  const profileKey = normalizeProfileKey(profileId);
  const baseProjectTables = useMemo(
    () => ({
      ve2: getBaseProjectTable(parsedIni, currentProject, "ve2"),
      spark2: getBaseProjectTable(parsedIni, currentProject, "spark2"),
      afr1: getBaseProjectTable(parsedIni, currentProject, "afr1"),
    }),
    [parsedIni, currentProject],
  );
  const baseProjectOptions = useMemo(
    () => getBaseProjectOptionValues(parsedIni, currentProject),
    [parsedIni, currentProject],
  );
  const editorState = useMemo(
    () => createProfileEditorState(profileId, runtimeProfiles, baseProjectTables),
    [profileId, runtimeProfiles, baseProjectTables],
  );

  const handleProfileGridUpdate = (tableKey, partial) => {
    const existingPreset = runtimeProfiles?.[profileKey];
    const logicalName =
      tableKey === "spark2" ? "spark2" : tableKey === "afr1" ? "afr1" : "ve2";
    const currentEditorTable =
      tableKey === "spark2"
        ? editorState.spark
        : tableKey === "afr1"
          ? editorState.afr
          : editorState.fuel;
    const existingTable =
      existingPreset?.tablePresets?.[logicalName] || currentEditorTable.rawTemplate;
    if (!existingTable) return;

    const nextValues = partial?.values || currentEditorTable.values;
    const nextTablePreset = {
      ...existingTable,
      displayValues: nextValues,
      rawValues: flattenMatrix(nextValues),
      displayRpmAxis: existingTable.displayRpmAxis || currentEditorTable.rpmAxis,
      displayLoadAxis: existingTable.displayLoadAxis || currentEditorTable.loadAxis,
      rawRpmAxis: existingTable.rawRpmAxis || [],
      rawLoadAxis: existingTable.rawLoadAxis || [],
    };

    updateRuntimeProfilePreset(profileKey, {
      tablePresets: {
        [logicalName]: nextTablePreset,
      },
    });
  };

  const handleOptionChange = (key, value, kind = "select") => {
    let nextValue = value;
    if (value === "") {
      nextValue = null;
    } else if (kind === "number") {
      nextValue = Number(value);
      if (!Number.isFinite(nextValue)) {
        nextValue = null;
      }
    } else {
      nextValue = Number(value);
    }

    updateRuntimeProfilePreset(profileKey, {
      options: {
        [key]: nextValue,
      },
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveProject();
      if (!result?.ok) {
        throw new Error(result?.error || "Failed to save runtime profile preset");
      }
      notify("Runtime profile preset saved to project", "success", 2500);
    } catch (error) {
      notify(error.message || "Failed to save runtime profile preset", "error", 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromBase = (targetTab = activeTab) => {
    if (targetTab === "Fuel" && baseProjectTables.ve2) {
      updateRuntimeProfilePreset(profileKey, {
        tablePresets: { ve2: { ...baseProjectTables.ve2, operation: "preset", source: "base-project" } },
      });
      return;
    }

    if (targetTab === "Spark" && baseProjectTables.spark2) {
      updateRuntimeProfilePreset(profileKey, {
        tablePresets: { spark2: { ...baseProjectTables.spark2, operation: "preset", source: "base-project" } },
      });
      return;
    }

    if (targetTab === "AFR" && baseProjectTables.afr1) {
      updateRuntimeProfilePreset(profileKey, {
        tablePresets: { afr1: { ...baseProjectTables.afr1, operation: "preset", source: "base-project" } },
      });
      return;
    }

    if (targetTab === "Options") {
      updateRuntimeProfilePreset(profileKey, {
        options: { ...baseProjectOptions },
      });
    }
  };

  const handleResetTab = (targetTab = activeTab) => {
    if (targetTab === "Fuel") {
      const next = createFlatTablePresetFromTemplate(
        editorState.fuel.rawTemplate || baseProjectTables.ve2,
        100,
      );
      if (next) {
        updateRuntimeProfilePreset(profileKey, { tablePresets: { ve2: next } });
      }
      return;
    }

    if (targetTab === "AFR") {
      const next = createFlatTablePresetFromTemplate(
        editorState.afr.rawTemplate || baseProjectTables.afr1,
        14.7,
      );
      if (next) {
        updateRuntimeProfilePreset(profileKey, { tablePresets: { afr1: next } });
      }
      return;
    }

    if (targetTab === "Options") {
      updateRuntimeProfilePreset(profileKey, {
        options: Object.fromEntries(OPTION_FIELDS.map((field) => [field.key, null])),
      });
    }
  };

  const activeTabMeta = useMemo(() => {
    if (activeTab === "Fuel") {
      const base = baseProjectTables.ve2;
      const current = runtimeProfiles?.[profileKey]?.tablePresets?.ve2 || editorState.fuel.rawTemplate;
      return {
        changed: !tableRawValuesEqual(base, current),
        label: summarizeTablePreset(current, "VE2"),
      };
    }

    if (activeTab === "Spark") {
      const base = baseProjectTables.spark2;
      const current = runtimeProfiles?.[profileKey]?.tablePresets?.spark2 || editorState.spark.rawTemplate;
      return {
        changed: !tableRawValuesEqual(base, current),
        label: summarizeTablePreset(current, "Spark2"),
      };
    }

    if (activeTab === "AFR") {
      const base = baseProjectTables.afr1;
      const current = runtimeProfiles?.[profileKey]?.tablePresets?.afr1 || editorState.afr.rawTemplate;
      return {
        changed: !tableRawValuesEqual(base, current),
        label: summarizeTablePreset(current, "AFR"),
      };
    }

    const hasOverrides = OPTION_FIELDS.some(
      (field) => editorState.options?.[field.key] !== null && editorState.options?.[field.key] !== undefined && editorState.options?.[field.key] !== "",
    );
    return {
      changed: hasOverrides,
      label: hasOverrides ? "Option overrides active" : "Using project base options",
    };
  }, [activeTab, baseProjectTables, editorState, runtimeProfiles, profileKey]);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-8 sm:p-10 mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="rounded-[30px] border border-white/10 bg-black/20 p-6 sm:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-orbitron font-bold uppercase tracking-[0.22em] text-neon-cyan">
                Profile Editor
              </div>
              <h1 className="mt-2 text-xl sm:text-2xl font-orbitron font-black uppercase tracking-[0.16em] text-white">
                {profileId} Fuel Profile
              </h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate(ROUTES.RACING_PROFILES)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[11px] font-orbitron font-bold uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/10"
              >
                <ArrowLeft size={14} />
                Runtime Profiles
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!currentProject?.filePath || saving}
                className="inline-flex items-center gap-2 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 px-4 py-3 text-[11px] font-orbitron font-bold uppercase tracking-[0.16em] text-neon-cyan transition hover:bg-neon-cyan/15 disabled:opacity-40"
              >
                <Save size={14} />
                Save Project
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <PencilLine size={14} className="text-neon-cyan" />
                <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.18em] text-white">
                  Editable Preset
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {EDITABLE_PROFILE_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => navigate(`/racing/runtime-profiles/${id.toLowerCase()}`)}
                    className={`rounded-2xl border px-4 py-3 text-[11px] font-orbitron font-bold uppercase tracking-[0.18em] transition-all ${
                      profileId === id
                        ? "border-neon-cyan/60 bg-neon-cyan/20 text-white shadow-[0_0_24px_rgba(0,229,255,0.16)]"
                        : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    }`}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-white/60">
              <div>{summarizeVe2Preset(runtimeProfiles?.[profileKey]?.tablePresets?.ve2)}</div>
              <div>{summarizeTablePreset(runtimeProfiles?.[profileKey]?.tablePresets?.spark2, "Spark2")}</div>
              <div>{summarizeTablePreset(runtimeProfiles?.[profileKey]?.tablePresets?.afr1, "AFR")}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
        <div className="flex flex-wrap gap-2">
          {EDITOR_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-2xl border px-4 py-3 text-[11px] font-orbitron font-bold uppercase tracking-[0.16em] transition-all ${
                activeTab === tab
                  ? "border-neon-cyan/60 bg-neon-cyan/20 text-white shadow-[0_0_24px_rgba(0,229,255,0.16)]"
                  : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-3">
          <div className="mb-3 flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.16em] text-white/45">
                {activeTab} Tools
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-orbitron font-bold uppercase tracking-[0.16em] ${
                  activeTabMeta.changed
                    ? "border-neon-yellow/25 bg-neon-yellow/10 text-neon-yellow"
                    : "border-neon-green/25 bg-neon-green/10 text-neon-green"
                }`}
              >
                {activeTabMeta.changed ? "Modified" : "Matches Base"}
              </span>
              <div className="text-[11px] text-white/60">{activeTabMeta.label}</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCopyFromBase(activeTab)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-[11px] font-orbitron font-bold uppercase tracking-[0.14em] text-white/80 transition hover:bg-white/10"
              >
                <Copy size={13} />
                Copy From Base
              </button>
              {(activeTab === "Fuel" || activeTab === "AFR" || activeTab === "Options") ? (
                <button
                  type="button"
                  onClick={() => handleResetTab(activeTab)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-[11px] font-orbitron font-bold uppercase tracking-[0.14em] text-white/80 transition hover:bg-white/10"
                >
                  <RotateCcw size={13} />
                  {activeTab === "Fuel"
                    ? "Reset 100%"
                    : activeTab === "AFR"
                      ? "Reset 14.7"
                      : "Use Project Base"}
                </button>
              ) : null}
            </div>
          </div>

          {activeTab === "Fuel" ? (
            <TuningGrid
              values={editorState.fuel.values}
              rpmAxis={editorState.fuel.rpmAxis}
              loadAxis={editorState.fuel.loadAxis}
              onUpdate={(partial) => handleProfileGridUpdate("ve2", partial)}
              minVal={0}
              maxVal={200}
              xAxisLabel="RPM"
              yAxisLabel="Fuel Load (kPa)"
              unitLabel="%"
              precision={0}
            />
          ) : activeTab === "Spark" ? (
            <TuningGrid
              values={editorState.spark.values}
              rpmAxis={editorState.spark.rpmAxis}
              loadAxis={editorState.spark.loadAxis}
              onUpdate={(partial) => handleProfileGridUpdate("spark2", partial)}
              minVal={-20}
              maxVal={60}
              xAxisLabel="RPM"
              yAxisLabel="Ignition Load"
              unitLabel="deg"
              precision={1}
            />
          ) : activeTab === "Options" ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {OPTION_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  <div className="text-[10px] font-orbitron font-bold uppercase tracking-[0.12em] text-white/85">
                    {field.label}
                  </div>

                  <div className="mt-3">
                    {field.kind === "number" ? (
                      <input
                        type="number"
                        value={editorState.options?.[field.key] ?? ""}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          handleOptionChange(field.key, event.target.value, "number")
                        }
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-mono text-white outline-none"
                      />
                    ) : (
                      <select
                        value={editorState.options?.[field.key] ?? ""}
                        onChange={(event) =>
                          handleOptionChange(field.key, event.target.value, "select")
                        }
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-mono text-white outline-none"
                      >
                        {field.options.map((option) => (
                          <option key={`${field.key}-${String(option.value)}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === "AFR" ? (
            <TuningGrid
              values={editorState.afr.values}
              rpmAxis={editorState.afr.rpmAxis}
              loadAxis={editorState.afr.loadAxis}
              onUpdate={(partial) => handleProfileGridUpdate("afr1", partial)}
              minVal={8}
              maxVal={20}
              xAxisLabel="RPM"
              yAxisLabel="AFR Load"
              unitLabel="AFR"
              precision={1}
            />
          ) : (
            <div className="rounded-[20px] border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white/45">
              {activeTab} editor coming next. Tab ini sudah disiapkan supaya rumah profile nanti rapi saat kita tambahkan parameter lain.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
