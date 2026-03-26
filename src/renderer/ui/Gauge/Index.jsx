import React from 'react';

/**
 * Premium Neon Gauge.
 * Props: label, value, min, max, unit, decimals, warning, danger, size
 */
export default function Gauge({ label, value, min = 0, max = 100, unit = '', decimals = 0, warning, danger, size = 140 }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = 52;
  const cx = 70;
  const cy = 70;

  function polarToXY(angleDeg, radius) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arcPath(startAngle, endAngle, radius) {
    const start = polarToXY(startAngle, radius);
    const end = polarToXY(endAngle, radius);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
  }

  const trackStart = -135;
  const trackEnd = 135;
  const fillEnd = trackStart + pct * 270;

  // Theme colors from ryn-race-timer
  const colors = {
    normal: '#00d4ff', // neon-cyan
    warning: '#eab308', // neon-yellow
    danger: '#f43f5e', // neon-red
  };

  const color = danger !== undefined && value >= danger ? colors.danger
    : warning !== undefined && value >= warning ? colors.warning
    : colors.normal;

  const displayVal = value.toFixed(decimals);

  // Generate tick marks
  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const angle = trackStart + i * (270 / 10);
    const p1 = polarToXY(angle, r - 5);
    const p2 = polarToXY(angle, r + 5);
    ticks.push(<line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />);
  }

  return (
    <div className="flex flex-col items-center group relative" style={{ width: size }}>
      <svg viewBox="0 0 140 140" width={size} height={size} className="drop-shadow-2xl">
        <defs>
          <filter id={`glow-${label}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Track */}
        <path
          d={arcPath(trackStart, trackEnd, r)}
          fill="none"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Outer Ring Glow */}
        <path
          d={arcPath(trackStart, trackEnd, r + 4)}
          fill="none"
          stroke="rgba(0,212,255,0.02)"
          strokeWidth="1"
        />

        {/* Ticks */}
        {ticks}

        {/* Glow Layer (Blur) */}
        {pct > 0 && (
          <path
            d={arcPath(trackStart, fillEnd, r)}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            filter={`url(#glow-${label})`}
            opacity="0.3"
          />
        )}

        {/* Fill Layer (Sharp) */}
        {pct > 0 && (
          <path
            d={arcPath(trackStart, fillEnd, r)}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            className="transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1)"
          />
        )}

        {/* Value text */}
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize="26"
          fill="white"
          className="font-mono font-bold tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
        >
          {displayVal}
        </text>

        {/* Unit */}
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          fontSize="9"
          fill="rgba(255,255,255,0.4)"
          className="font-orbitron uppercase tracking-[0.2em] font-bold"
        >
          {unit}
        </text>
      </svg>
      <span className="font-orbitron text-[9px] font-bold text-gray-600 uppercase tracking-[0.3em] mt-[-12px] group-hover:text-neon-cyan transition-colors duration-500">
        {label}
      </span>
    </div>
  );
}

