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
import {
  buildFieldIndex,
  buildPinRegistry,
  getOptionLabel,
  getPageData,
} from "../shared/utils/pinRegistry";
import { getDecodedPages } from "../shared/utils/projectConstants.js";
import { projectPinMapOptions } from '../../../shared/protocol/board-pins.js';

const STATUS_STYLES = {
  assigned: {
    card: "bg-blue-800",
    badge: "bg-emerald-400/18 text-emerald-100",
    direction: " bg-white/10 text-white/75",
    field: "text-emerald-100/70",
    note: "text-emerald-50/75",
    value: "text-white",
    raw: "text-emerald-100/65",
    page: "text-emerald-50/70",
  },
  "board-default": {
    card: "border-white/80 bg-cyan-950/55",
    badge: "border-cyan-300/40 bg-cyan-400/18 text-cyan-100",
    direction: "border-white/20 bg-white/10 text-white/75",
    field: "text-cyan-100/70",
    note: "text-cyan-50/75",
    value: "text-white",
    raw: "text-cyan-100/65",
    page: "text-cyan-50/70",
  },
  inactive: {
    card: "bg-gray-800/90",
    badge: "border-gray-300 bg-gray-700 text-amber-100",
    direction: "border-white/20 bg-white/10 text-white/75",
    field: "text-amber-100/70",
    note: "text-amber-50/70",
    value: "text-white",
    raw: "text-amber-100/60",
    page: "text-amber-50/65",
  },
  potential: {
    card: " bg-yellow-800",
    badge: "border-yellow-300/35 bg-yellow-800 text-yellow-100",
    direction: "border-white/20 bg-white/10 text-white/75",
    field: "text-yellow-100/70",
    note: "text-yellow-50/70",
    value: "text-white",
    raw: "text-yellow-100/60",
    page: "text-yellow-50/65",
  },
  unassigned: {
    card: "bg-green-950",
    badge: "border-white/20 bg-green/8 text-white/65",
    direction: "border-white/20 bg-white/8 text-white/65",
    field: "text-white/40",
    note: "text-white/45",
    value: "text-white/92",
    raw: "text-white/45",
    page: "text-white/45",
  },
  unavailable: {
    card: "border-white/80 bg-neutral-950/90",
    badge: "border-white/20 bg-white/6 text-white/50",
    direction: "border-white/20 bg-white/8 text-white/60",
    field: "text-white/35",
    note: "text-white/38",
    value: "text-white/75",
    raw: "text-white/38",
    page: "text-white/38",
  },
  conflict: {
    card: "border-white/80 bg-rose-950/60",
    badge: "border-rose-300/40 bg-rose-400/18 text-rose-100",
    direction: "border-white/20 bg-white/10 text-white/75",
    field: "text-rose-100/75",
    note: "text-rose-50/78",
    value: "text-white",
    raw: "text-rose-100/65",
    page: "text-rose-50/70",
  },
};

const SECTION_CONFIG = [
  {
    key: "input",
    title: "Input Assignments",
    icon: Radio,
    matcher: (row) => row.direction === "Input",
  },
  {
    key: "output",
    title: "Output Assignments",
    icon: Workflow,
    matcher: (row) => row.direction === "Output",
  },
  {
    key: "other",
    title: "Other Pin Assignments",
    icon: Gauge,
    matcher: (row) => row.direction === "Other",
  },
];

function formatStatus(status) {
  switch (status) {
    case "assigned":
      return "Assigned";
    case "board-default":
      return "Board Default";
    case "unassigned":
      return "Not Assigned";
    case "inactive":
      return "Inactive";
    case "potential":
      return "Potential";
    case "conflict":
      return "Conflict";
    default:
      return "Unavailable";
  }
}

function StatCard({ label, value, tone = "cyan", helper }) {
  const tones = {
    cyan: " bg-cyan-500/10 text-cyan-200",
    emerald: "bg-emerald-500/10 text-emerald-200",
    rose: "bg-rose-500/10 text-rose-200",
    white: " bg-white/5 text-white",
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] px-4 py-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.24em] text-white/45">
          {label}
        </span>
      </div>
      <div className="text-sm font-orbitron font-black uppercase tracking-[0.12em] text-white">
        {value}
      </div>
      {helper && (
        <p className="mt-1 text-[10px] leading-relaxed text-white/35">
          {helper}
        </p>
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
            className={`grid gap-2 rounded-xl  px-3 py-2.5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_auto_auto] ${STATUS_STYLES[row.status]?.card || STATUS_STYLES.unavailable.card}`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                  {row.displayLabel}
                </span>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] ${STATUS_STYLES[row.status]?.direction || STATUS_STYLES.unavailable.direction}`}
                >
                  {row.direction}
                </span>
              </div>
              <div
                className={`mt-0.5 text-[9px] uppercase tracking-[0.14em] ${STATUS_STYLES[row.status]?.field || STATUS_STYLES.unavailable.field}`}
              >
                {row.field}
              </div>
              <div
                className={`mt-1 text-[10px] leading-relaxed ${STATUS_STYLES[row.status]?.note || STATUS_STYLES.unavailable.note}`}
              >
                {row.note}
              </div>
            </div>

            <div className="min-w-0">
              <div
                className={`truncate text-[11px] font-semibold ${STATUS_STYLES[row.status]?.value || STATUS_STYLES.unavailable.value}`}
              >
                {row.resolvedValue}
              </div>
              <div
                className={`mt-0.5 text-[10px] ${STATUS_STYLES[row.status]?.raw || STATUS_STYLES.unavailable.raw}`}
              >
                Raw: {row.rawValue ?? "n/a"}
              </div>
            </div>

            <div className="flex items-center">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] ${STATUS_STYLES[row.status]?.badge || STATUS_STYLES.unavailable.badge}`}
              >
                {formatStatus(row.status)}
              </span>
            </div>

            <div
              className={`flex flex-col items-start justify-center gap-0.5 text-[9px] uppercase tracking-[0.14em] lg:items-end ${STATUS_STYLES[row.status]?.page || STATUS_STYLES.unavailable.page}`}
            >
              <span>P{row.pageId ?? "--"}</span>
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

  const decodedPages = useMemo(
    () => getDecodedPages(currentProject?.constants, parsedIni),
    [currentProject?.constants, parsedIni],
  );
  const fieldIndex = useMemo(() => buildFieldIndex(parsedIni), [parsedIni]);

  const updateProjectField = useStore(s => s.updateProjectField);
  const registry = useMemo(() => buildPinRegistry(parsedIni, decodedPages, projectPinMapOptions(currentProject)),
    [parsedIni, decodedPages, currentProject?.hardware]);
  const ioRows = registry.rows;

  const sectionRows = useMemo(() => {
    const grouped = {};
    SECTION_CONFIG.forEach((section) => {
      grouped[section.key] = ioRows.filter(section.matcher);
    });
    return grouped;
  }, [ioRows]);

  const stats = useMemo(() => {
    const counts = {
      assigned: 0,
      boardDefault: 0,
      potential: 0,
      unavailable: 0,
      conflicts: 0,
      total: ioRows.length,
    };

    ioRows.forEach((row) => {
      if (row.status === "assigned") counts.assigned += 1;
      if (row.status === "board-default") counts.boardDefault += 1;
      if (row.status === "potential") counts.potential += 1;
      if (row.status === "unavailable") counts.unavailable += 1;
      if (row.status === "conflict") counts.conflicts += 1;
    });

    return counts;
  }, [ioRows]);

  const boardInfo = useMemo(() => {
    const pinLayoutInfo = fieldIndex.pinLayout;
    if (!pinLayoutInfo) {
      return "Board layout unavailable";
    }

    const rawValue = getPageData(decodedPages, pinLayoutInfo.pageId)?.pinLayout;
    return (
      getOptionLabel(pinLayoutInfo.meta, rawValue) ||
      `Layout ${rawValue ?? "Unknown"}`
    );
  }, [decodedPages, fieldIndex]);

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center bg-black p-10 text-center text-white/60">
        Open a project first to inspect board-level I/O assignments.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden  text-white">
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
                  {currentProject.hardware?.restartRequired ? 'Target pin mapping — ECU power cycle belum diverifikasi' : 'Pin assignments from INI metadata and project constants'}
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
          <div className="rounded-2xl border border-white/10 p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-zinc-100">Board mapping · Project preview</p>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-200">Target: standard 4-cylinder build</span>
            </div>
            <p className="text-zinc-400">Match these settings to the firmware installed on the ECU. They control the mapping preview; live configuration is checked when writing.</p>
            <label className="block">MCU pin map
              <select className="ml-3 bg-black border border-white/20 rounded p-2" value={currentProject.hardware?.pinMapPlatform || ''}
                onChange={event => updateProjectField('hardware.pinMapPlatform', event.target.value)}>
                <option value="">Unverified / other MCU</option>
                <option value="mega2560">Arduino Mega 2560 (AVR)</option>
              </select>
            </label>
            <label className="block">Firmware profile
              <select className="ml-3 bg-black border border-white/20 rounded p-2" value={currentProject.hardware?.channelBuild || ''}
                onChange={event => updateProjectField('hardware.channelBuild', event.target.value)}>
                <option value="">Choose installed build — reserve all until confirmed</option>
                <option value="standard">Standard Mega · 4-cylinder project</option>
                {currentProject.hardware?.channelBuild === '6-3' && <option value="6-3">Imported profile · 6 injectors / 3 ignition</option>}
                {currentProject.hardware?.channelBuild === '8-1' && <option value="8-1">Imported profile · 8 injectors / 1 ignition</option>}
              </select>
            </label>
            {currentProject.hardware?.channelBuild === 'standard' && <p className="text-zinc-400">Compiled capacity: 4 injector / 5 ignition channels. Channel capacity is separate from the engine's cylinder count.</p>}
            <details className="rounded-lg border border-white/10 p-2.5">
              <summary className="cursor-pointer text-zinc-400">Advanced · other compiled channel profiles</summary>
              <p className="my-2 text-zinc-400">For an existing tune using a different firmware build. Current validation targets the standard four-cylinder project.</p>
              <label>Compiled channels
                <select aria-label="Advanced firmware channel build" className="ml-3 rounded border border-white/20 bg-black p-2"
                  value={currentProject.hardware?.channelBuild || ''}
                  onChange={event => updateProjectField('hardware.channelBuild', event.target.value)}>
                  <option value="">Unknown — reserve all mapped channels</option>
                  <option value="standard">Standard · 4 injectors / 5 ignition</option>
                  <option value="6-3">6 injectors / 3 ignition</option>
                  <option value="8-1">8 injectors / 1 ignition</option>
                </select>
              </label>
            </details>
            {registry.context.warning && <p className="text-amber-200">{registry.context.warning}</p>}
            <p className="text-zinc-400">D/A numbers identify MCU pins. Check your board's wiring diagram for connector terminals. Save the project after changing the preview settings.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-5">
            <StatCard
              label="Detected I/O"
              value={String(stats.total)}
              tone="white"
              helper="From loaded INI"
            />
            <StatCard
              label="Assigned"
              value={String(stats.assigned)}
              tone="emerald"
              helper="Explicit routing"
            />
            <StatCard
              label="Board Default"
              value={String(stats.boardDefault)}
              tone="cyan"
              helper="Preset routing"
            />
            <StatCard
              label="Potential"
              value={String(stats.potential)}
              tone={stats.potential > 0 ? "white" : "white"}
              helper="Shared but not active"
            />
            <StatCard
              label="Conflicts"
              value={String(stats.conflicts)}
              tone={stats.conflicts > 0 ? "rose" : "white"}
              helper="Actively shared"
            />
          </div>

          {stats.conflicts > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em]">
                  Pin conflicts detected
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-rose-100/80">
                  Rows marked `Conflict` share the same resolved pin label.
                  Review these before burning so multiple features do not fight
                  over one input or output.
                </p>
              </div>
            </div>
          )}

          {stats.potential > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-3 text-yellow-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em]">
                  Potential pin overlap
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-yellow-50/80">
                  Rows marked `Potential` share the same resource, but the
                  related feature is currently inactive or parked in a default
                  mode. They may become a real conflict if enabled together
                  later.
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
                  I/O auto-discovery depends on INI metadata. Without it, the
                  summary cannot infer all pin assignments reliably.
                </p>
              </div>
            </div>
          )}

          {ioRows.length === 0 && parsedIni && (
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/65">
              <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em]">
                  No pin assignments discovered
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-white/50">
                  The loaded INI did not expose any pin-assignment style fields
                  that matched the current discovery rules.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-3 xl:grid-cols-3">
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
  );
}
