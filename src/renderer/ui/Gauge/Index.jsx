import React, { useMemo } from "react";
import { useStore } from "../../core/store";
import { getAccent } from "../../core/theme.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function polarToXY(cx, cy, angleDeg, radius) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function arcPath(cx, cy, startAngle, endAngle, radius) {
  const start = polarToXY(cx, cy, startAngle, radius);
  const end = polarToXY(cx, cy, endAngle, radius);
  const delta = endAngle - startAngle;
  const large = Math.abs(delta) > 180 ? 1 : 0;
  const sweep = delta >= 0 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} ${sweep} ${end.x} ${end.y}`;
}

function angleForValue(value, min, max, startAngle, sweepAngle) {
  const safeMax = max === min ? min + 1 : max;
  const pct = clamp((value - min) / (safeMax - min), 0, 1);
  return startAngle + pct * sweepAngle;
}

function getTickConfig(min, max) {
  const span = Math.abs(max - min);
  if (span <= 12) return { majorCount: 4, minorPerMajor: 2 };
  if (span <= 60) return { majorCount: 5, minorPerMajor: 2 };
  if (span <= 200) return { majorCount: 4, minorPerMajor: 3 };
  return { majorCount: 4, minorPerMajor: 4 };
}

function formatTickValue(value, decimals) {
  if (!Number.isFinite(value)) return "0";
  const safeDecimals = decimals > 0 ? Math.min(decimals, 1) : 0;
  return value.toFixed(safeDecimals);
}

function bandPath(cx, cy, radius, thickness, startAngle, endAngle) {
  const outerStart = polarToXY(cx, cy, startAngle, radius + thickness / 2);
  const outerEnd = polarToXY(cx, cy, endAngle, radius + thickness / 2);
  const innerEnd = polarToXY(cx, cy, endAngle, radius - thickness / 2);
  const innerStart = polarToXY(cx, cy, startAngle, radius - thickness / 2);
  const delta = endAngle - startAngle;
  const large = Math.abs(delta) > 180 ? 1 : 0;
  const sweep = delta >= 0 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${radius + thickness / 2} ${radius + thickness / 2} 0 ${large} ${sweep} ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${radius - thickness / 2} ${radius - thickness / 2} 0 ${large} ${sweep ? 0 : 1} ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

export default function Gauge({
  label,
  value,
  min = 0,
  max = 100,
  unit = "",
  decimals = 0,
  warning,
  danger,
  warningMode = "high",
  size = 140,
}) {
  const settings = useStore((s) => s.settings);
  const accent = getAccent(settings?.accentColor);

  const safeMax = max === min ? min + 1 : max;
  const displayValue = Number.isFinite(value) ? value.toFixed(decimals) : "0";
  const cx = 90;
  const cy = 90;
  const outerRadius = 64;
  const startAngle = 200;
  const sweepAngle = 280;
  const endAngle = startAngle + sweepAngle;
  const warningValue = warning ?? safeMax + 1;
  const dangerValue = danger ?? safeMax + 1;
  const fillAngle = angleForValue(value, min, safeMax, startAngle, sweepAngle);
  const warningAngle = angleForValue(warningValue, min, safeMax, startAngle, sweepAngle);
  const dangerAngle = angleForValue(dangerValue, min, safeMax, startAngle, sweepAngle);
  const isLowMode = warningMode === "low";
  const activeColor = isLowMode
    ? value <= dangerValue
      ? "#f43f5e"
      : value <= warningValue
        ? "#f59e0b"
        : accent.main
    : value >= dangerValue
      ? "#f43f5e"
      : value >= warningValue
        ? "#f59e0b"
        : accent.main;
  const tickConfig = useMemo(() => getTickConfig(min, safeMax), [min, safeMax]);
  const idBase = useMemo(
    () => `gauge-${String(label ?? unit ?? "metric").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    [label, unit],
  );

  const ticks = useMemo(() => {
    const output = [];
    const totalSegments = tickConfig.majorCount * tickConfig.minorPerMajor;
    for (let index = 0; index <= totalSegments; index += 1) {
      const angle = startAngle + index * (sweepAngle / totalSegments);
      const isMajor = index % tickConfig.minorPerMajor === 0;
      const outer = polarToXY(cx, cy, angle, outerRadius);
      const inner = polarToXY(cx, cy, angle, outerRadius - (isMajor ? 9 : 5));
      output.push(
        <line
          key={`tick-${index}`}
          x1={outer.x}
          y1={outer.y}
          x2={inner.x}
          y2={inner.y}
          stroke={isMajor ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.14)"}
          strokeWidth={isMajor ? "1.8" : "1"}
          strokeLinecap="round"
        />,
      );
    }
    return output;
  }, [tickConfig, startAngle, sweepAngle]);

  const tickLabels = useMemo(() => {
    const labels = [];
    for (let index = 0; index <= tickConfig.majorCount; index += 1) {
      const ratio = index / tickConfig.majorCount;
      const angle = startAngle + ratio * sweepAngle;
      const position = polarToXY(cx, cy, angle, outerRadius + 15);
      const tickValue = min + ratio * (safeMax - min);
      labels.push(
        <text
          key={`tick-label-${index}`}
          x={position.x}
          y={position.y + 2}
          textAnchor="middle"
          fontSize="7"
          fill="rgba(255,255,255,0.28)"
          className="font-mono font-bold"
        >
          {formatTickValue(tickValue, decimals)}
        </text>,
      );
    }
    return labels;
  }, [tickConfig, startAngle, sweepAngle, min, safeMax, decimals]);

  const marker = polarToXY(cx, cy, fillAngle, 69);
  const needleInner = polarToXY(cx, cy, fillAngle, 49);
  const needleOuter = polarToXY(cx, cy, fillAngle, 63);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 180 180" width={size} height={size} className="overflow-visible">
        <defs>
          <linearGradient id={`${idBase}-progress`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.78" />
            <stop offset="12%" stopColor={accent.main} stopOpacity="0.92" />
            <stop offset="100%" stopColor={activeColor} stopOpacity="1" />
          </linearGradient>
          <filter id={`${idBase}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx={cx} cy={cy} r="76" fill="rgba(255,255,255,0.015)" />
        <circle cx={cx} cy={cy} r="71" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r="50" fill="rgba(6,8,14,0.88)" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

        <path
          d={arcPath(cx, cy, startAngle, endAngle, outerRadius)}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {isLowMode ? (
          <>
            {danger !== undefined && dangerAngle > startAngle ? (
              <path
                d={bandPath(cx, cy, outerRadius, 14, startAngle, Math.min(dangerAngle, endAngle))}
                fill="rgba(244,63,94,0.4)"
              />
            ) : null}
            {warning !== undefined && warningAngle > startAngle ? (
              <path
                d={bandPath(cx, cy, outerRadius, 14, danger !== undefined ? dangerAngle : startAngle, Math.min(warningAngle, endAngle))}
                fill="rgba(245,158,11,0.32)"
              />
            ) : null}
          </>
        ) : (
          <>
            {warning !== undefined && warningAngle < endAngle ? (
              <path
                d={bandPath(cx, cy, outerRadius, 14, warningAngle, Math.min(dangerAngle, endAngle))}
                fill="rgba(245,158,11,0.32)"
              />
            ) : null}

            {danger !== undefined && dangerAngle < endAngle ? (
              <path
                d={bandPath(cx, cy, outerRadius, 14, dangerAngle, endAngle)}
                fill="rgba(244,63,94,0.4)"
              />
            ) : null}
          </>
        )}

        <path
          d={arcPath(cx, cy, startAngle, fillAngle, outerRadius)}
          fill="none"
          stroke={`url(#${idBase}-progress)`}
          strokeWidth="10"
          strokeLinecap="round"
          filter={`url(#${idBase}-glow)`}
        />

        <path
          d={arcPath(cx, cy, startAngle, fillAngle, outerRadius - 10)}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="2 6"
          opacity="0.82"
        />

        {ticks}
        {tickLabels}

        <line
          x1={needleInner.x}
          y1={needleInner.y}
          x2={needleOuter.x}
          y2={needleOuter.y}
          stroke="rgba(2,4,10,0.92)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <line
          x1={needleInner.x}
          y1={needleInner.y}
          x2={needleOuter.x}
          y2={needleOuter.y}
          stroke={activeColor}
          strokeWidth="2.6"
          strokeLinecap="round"
          filter={`url(#${idBase}-glow)`}
        />
        <circle cx={marker.x} cy={marker.y} r="5.2" fill="rgba(2,4,10,0.92)" />
        <circle cx={marker.x} cy={marker.y} r="2.8" fill={activeColor} filter={`url(#${idBase}-glow)`} />

        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize="28"
          fill="white"
          className="font-mono font-black tracking-tight"
          style={{ textShadow: "0 0 18px rgba(255,255,255,0.14)" }}
        >
          {displayValue}
        </text>
        <text
          x={cx}
          y={cy + 21}
          textAnchor="middle"
          fontSize="7"
          fill="rgba(255,255,255,0.36)"
          className="font-orbitron uppercase tracking-[0.24em] font-bold"
        >
          {unit || ""}
        </text>
        <path
          d={`M ${cx - 14} ${cy + 29} L ${cx + 14} ${cy + 29}`}
          stroke={activeColor}
          strokeOpacity="0.5"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
