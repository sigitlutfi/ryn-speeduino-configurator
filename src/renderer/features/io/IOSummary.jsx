import React, { useMemo } from "react";
import {
  AlertTriangle,
  Cpu,
  Gauge,
  Plug,
  Radio,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import { useStore } from "../../core/store.js";

const CORE_IO_ITEMS = [
  { field: "fuelPumpPin", label: "Fuel Pump", category: "Output" },
  { field: "fanPin", label: "Cooling Fan", category: "Output" },
  { field: "tachoPin", label: "Tacho", category: "Output" },
  { field: "idleUpPin", label: "Idle-Up Input", category: "Input" },
  { field: "idleUpOutputPin", label: "Idle-Up Output", category: "Output" },
  { field: "resetControlPin", label: "Reset Control", category: "Input" },
  { field: "ignBypassPin", label: "Ignition Bypass", category: "Input" },
];

const AUX_IO_ITEMS = [
  { field: "vssPin", label: "Vehicle Speed", category: "Input" },
  { field: "boostPin", label: "Boost Control", category: "Output" },
  { field: "baroPin", label: "Baro Input", category: "Input" },
  { field: "EMAPPin", label: "EMAP Input", category: "Input" },
  { field: "fuel2InputPin", label: "Fuel 2 Input", category: "Input" },
];

const SPECIAL_IO_ITEMS = [
  { field: "launchPin", label: "Launch Input", category: "Input" },
  { field: "w1Pin", label: "W1 Input", category: "Input" },
  { field: "n2o_arming_pin", label: "Nitrous Arm", category: "Input" },
  { field: "n2o_stage1_pin", label: "Nitrous Stage 1", category: "Output" },
  { field: "n2o_stage2_pin", label: "Nitrous Stage 2", category: "Output" },
  { field: "airConReqPin", label: "A/C Request", category: "Input" },
  { field: "airConCompPin", label: "A/C Compressor", category: "Output" },
  { field: "knock_pin", label: "Knock Input", category: "Input" },
];

const PROGRAMMABLE_ITEMS = Array.from({ length: 8 }, (_, index) => ({
  field: `outputPin${index}`,
  aliasCandidates: [
    `prgm_out0${index}Alias`,
    `prgm_out${index}Alias`,
    `prgmOut${index}Alias`,
  ],
  label: `Programmable Out ${index + 1}`,
  category: "Output",
}));

const SECTION_CONFIG = [
  {
    key: "core",
    title: "Core I/O",
    icon: Cpu,
    items: CORE_IO_ITEMS,
  },
  {
    key: "aux",
    title: "Vehicle & Aux Inputs",
    icon: Gauge,
    items: AUX_IO_ITEMS,
  },
  {
    key: "special",
    title: "Special Functions",
    icon: ShieldAlert,
    items: SPECIAL_IO_ITEMS,
  },
  {
    key: "programmable",
    title: "Programmable Outputs",
    icon: Workflow,
    items: PROGRAMMABLE_ITEMS,
  },
];

const STATUS_STYLES = {
  assigned: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  "board-default": "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
  unassigned: "border-white/10 bg-white/5 text-white/50",
  unavailable: "border-white/10 bg-white/5 text-white/35",
  conflict: "border-rose-400/30 bg-rose-500/10 text-rose-300",
};

function getPageData(decodedPages, pageId) {
  return decodedPages?.[pageId] || decodedPages?.[String(pageId)] || {};
}

function buildFieldIndex(parsedIni) {
  const index = {};
  const pages = parsedIni?.constants?.pages || {};

  Object.entries(pages).forEach(([pageId, pageVars]) => {
    Object.entries(pageVars || {}).forEach(([name, meta]) => {
      index[name] = { pageId, meta };
    });
  });

  return index;
}

function getOptionLabel(meta, value) {
  if (!Array.isArray(meta?.options)) return null;
  const option = meta.options?.[Number(value)];
  return typeof option === "string" ? option : null;
}

function classifyStatus(label, meta, value) {
  if (!meta) return "unavailable";
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "unavailable";
  }

  const normalizedLabel = (label || "").trim();
  if (!normalizedLabel) return "unavailable";
  if (/board\s*default/i.test(normalizedLabel)) return "board-default";
  if (/^(off|disabled|none|not used|invalid)$/i.test(normalizedLabel)) {
    return "unassigned";
  }

  return "assigned";
}

function formatStatus(status) {
  switch (status) {
    case "assigned":
      return "Assigned";
    case "board-default":
      return "Board Default";
    case "unassigned":
      return "Not Assigned";
    case "conflict":
      return "Conflict";
    default:
      return "Unavailable";
  }
}

function buildRow(item, decodedPages, fieldIndex) {
  const aliasName = item.aliasCandidates?.find((candidate) => {
    const info = fieldIndex[candidate];
    if (!info) return false;
    const aliasValue = getPageData(decodedPages, info.pageId)?.[candidate];
    return typeof aliasValue === "string" && aliasValue.trim().length > 0;
  });

  const labelOverride = aliasName
    ? getPageData(decodedPages, fieldIndex[aliasName].pageId)?.[aliasName]
    : null;
  const info = fieldIndex[item.field];

  if (!info) {
    return {
      ...item,
      displayLabel: labelOverride || item.label,
      pageId: null,
      rawValue: null,
      resolvedValue: "Not available in loaded INI",
      status: "unavailable",
      note: "Field is not defined for this firmware signature.",
    };
  }

  const pageData = getPageData(decodedPages, info.pageId);
  const rawValue = pageData?.[item.field];
  const optionLabel = getOptionLabel(info.meta, rawValue);
  const resolvedValue =
    optionLabel ||
    (rawValue !== undefined && rawValue !== null ? String(rawValue) : "Unavailable");
  const status = classifyStatus(optionLabel || resolvedValue, info.meta, rawValue);

  return {
    ...item,
    displayLabel: labelOverride || item.label,
    pageId: info.pageId,
    rawValue,
    resolvedValue,
    status,
    note:
      status === "board-default"
        ? "Uses the board layout default routing."
        : status === "unassigned"
          ? "No active pin assignment is configured."
          : status === "unavailable"
            ? "No decoded value is available in this project."
            : "Explicit pin assignment found in project constants.",
  };
}

function StatCard({ label, value, tone = "cyan", helper }) {
  const tones = {
    cyan: "border-cyan-400/20 bg-cyan-500/10 text-cyan-200",
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    rose: "border-rose-400/20 bg-rose-500/10 text-rose-200",
    white: "border-white/10 bg-white/5 text-white",
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.24em] text-white/45">
          {label}
        </span>
        <div className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] ${tones[tone] || tones.white}`}>
          Live
        </div>
      </div>
      <div className="text-sm font-orbitron font-black uppercase tracking-[0.12em] text-white">
        {value}
      </div>
      {helper && (
        <p className="mt-1 text-[10px] leading-relaxed text-white/35">{helper}</p>
      )}
    </div>
  );
}

function SectionCard({ title, icon: Icon, rows }) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-black/30 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-3 border-b border-white/5 pb-3">
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-2.5 text-cyan-200">
          <Icon size={15} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[11px] font-orbitron font-black uppercase tracking-[0.22em] text-white">
            {title}
          </h2>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.field}
            className="grid gap-2 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_auto_auto]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                  {row.displayLabel}
                </span>
                <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-white/35">
                  {row.category}
                </span>
              </div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-white/26">
                {row.field}
              </div>
            </div>

            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold text-white/90">{row.resolvedValue}</div>
              <div className="mt-0.5 text-[10px] text-white/35">
                Raw: {row.rawValue ?? "n/a"}
              </div>
            </div>

            <div className="flex items-center">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] ${STATUS_STYLES[row.status] || STATUS_STYLES.unavailable}`}
              >
                {formatStatus(row.status)}
              </span>
            </div>

            <div className="flex flex-col items-start justify-center gap-0.5 text-[9px] uppercase tracking-[0.14em] text-white/35 lg:items-end">
              <span>P{row.pageId ?? "--"}</span>
              {row.status === "conflict" && (
                <span className="text-[9px] normal-case tracking-normal text-rose-200/80">
                  {row.note}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function IOSummary() {
  const currentProject = useStore((s) => s.currentProject);
  const parsedIni = useStore((s) => s.parsedIni);
  const connectionStatus = useStore((s) => s.connection.status);

  const decodedPages = currentProject?.constants?.decodedPages || {};
  const fieldIndex = useMemo(() => buildFieldIndex(parsedIni), [parsedIni]);

  const sectionRows = useMemo(() => {
    const rowsBySection = {};

    SECTION_CONFIG.forEach((section) => {
      rowsBySection[section.key] = section.items.map((item) =>
        buildRow(item, decodedPages, fieldIndex),
      );
    });

    const assignedMap = {};
    Object.values(rowsBySection)
      .flat()
      .forEach((row) => {
        if (row.status !== "assigned") return;
        const key = row.resolvedValue?.trim()?.toLowerCase();
        if (!key) return;
        assignedMap[key] = [...(assignedMap[key] || []), row.field];
      });

    Object.values(rowsBySection).forEach((rows) => {
      rows.forEach((row) => {
        const key = row.resolvedValue?.trim()?.toLowerCase();
        const related = key ? assignedMap[key] || [] : [];
        if (row.status === "assigned" && related.length > 1) {
          row.status = "conflict";
          row.note = `Shared with ${related.filter((name) => name !== row.field).join(", ")}`;
        }
      });
    });

    return rowsBySection;
  }, [decodedPages, fieldIndex]);

  const flatRows = Object.values(sectionRows).flat();

  const stats = useMemo(() => {
    const counts = {
      assigned: 0,
      boardDefault: 0,
      unavailable: 0,
      conflicts: 0,
    };

    flatRows.forEach((row) => {
      if (row.status === "assigned") counts.assigned += 1;
      if (row.status === "board-default") counts.boardDefault += 1;
      if (row.status === "unavailable") counts.unavailable += 1;
      if (row.status === "conflict") counts.conflicts += 1;
    });

    return counts;
  }, [flatRows]);

  const boardInfo = useMemo(() => {
    const pinLayoutInfo = fieldIndex.pinLayout;
    if (!pinLayoutInfo) {
      return "Board layout unavailable";
    }

    const rawValue = getPageData(decodedPages, pinLayoutInfo.pageId)?.pinLayout;
    return getOptionLabel(pinLayoutInfo.meta, rawValue) || `Layout ${rawValue ?? "Unknown"}`;
  }, [decodedPages, fieldIndex]);

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center bg-black p-10 text-center text-white/60">
        Open a project first to inspect board-level I/O assignments.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-black text-white">
      <div className="mx-8 mb-4 mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-md">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-2 text-cyan-200">
                <Plug size={16} />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-orbitron font-black uppercase tracking-[0.2em] text-white">
                  I/O Summary
                </h1>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                  Compact board and pin assignment overview
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/55">
              {currentProject.projectName || "Untitled Project"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/55">
              {boardInfo}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${
                connectionStatus === "connected"
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                  : connectionStatus === "error"
                    ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
                    : "border-white/10 bg-white/5 text-white/55"
              }`}
            >
              ECU {connectionStatus || "idle"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-10">
        <div className="mx-auto max-w-[1560px] space-y-4">
          <div className="grid gap-3 lg:grid-cols-4">
            <StatCard
              label="Assigned"
              value={String(stats.assigned)}
              tone="emerald"
              helper="Explicit"
            />
            <StatCard
              label="Board Default"
              value={String(stats.boardDefault)}
              tone="cyan"
              helper="Using preset"
            />
            <StatCard
              label="Unavailable"
              value={String(stats.unavailable)}
              tone="white"
              helper="Unsupported or missing"
            />
            <StatCard
              label="Conflicts"
              value={String(stats.conflicts)}
              tone={stats.conflicts > 0 ? "rose" : "white"}
              helper="Shared explicit labels"
            />
          </div>

          {stats.conflicts > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em]">
                  Shared pin labels detected
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-rose-100/80">
                  Review rows marked `Conflict` before burning.
                </p>
              </div>
            </div>
          )}

          {!parsedIni && (
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/65">
              <Radio className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em]">
                  Metadata not loaded
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-white/50">
                  Pin labels may be incomplete without active INI metadata.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              {SECTION_CONFIG.map((section) => (
                <SectionCard
                  key={section.key}
                  title={section.title}
                  icon={section.icon}
                  rows={sectionRows[section.key] || []}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
