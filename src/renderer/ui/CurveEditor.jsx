import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import { moveCurvePoint, roundAxis, interpolateCurve } from './curve-math.js';

/**
 * Universal Curve Editor for 2D tuning tables (e.g., IAT, WUE, Injector Dead Time).
 * Features:
 * - Interactive dragging of points (X and Y or Y-only)
 * - Dynamic Crosshairs with interpolation
 * - Precision control (rounding)
 * - Multiple color themes (Cyan, Orange, Red, Yellow)
 * - Axis scaling and Auto-Scale
 * - Two-way hover synchronization
 */

const THEMES = {
  cyan: {
    primary: "#22d3ee",
    secondary: "#0891b2",
    glow: "rgba(6,182,212,0.5)",
    gradient: ["#0891b2", "#22d3ee"],
  },
  orange: {
    primary: "#fb923c",
    secondary: "#ea580c",
    glow: "rgba(234,88,12,0.5)",
    gradient: ["#ea580c", "#fb923c"],
  },
  red: {
    primary: "#f87171",
    secondary: "#dc2626",
    glow: "rgba(220,38,38,0.5)",
    gradient: ["#dc2626", "#f87171"],
  },
  yellow: {
    primary: "#facc15",
    secondary: "#ca8a04",
    glow: "rgba(202,138,4,0.5)",
    gradient: ["#ca8a04", "#facc15"],
  },
  purple: {
    primary: "#a855f7",
    secondary: "#7c3aed",
    glow: "rgba(168,85,247,0.5)",
    gradient: ["#7c3aed", "#a855f7"],
  },
  green: {
    primary: "#4ade80",
    secondary: "#16a34a",
    glow: "rgba(74,222,128,0.5)",
    gradient: ["#16a34a", "#4ade80"],
  },
  magenta: {
    primary: "#f0abfc",
    secondary: "#d946ef",
    glow: "rgba(217,70,239,0.5)",
    gradient: ["#d946ef", "#f0abfc"],
  },
  blue: {
    primary: "#60a5fa",
    secondary: "#2563eb",
    glow: "rgba(59,130,246,0.5)",
    gradient: ["#2563eb", "#60a5fa"],
  },
};

const CurveEditor = ({
  xValues,
  yValues,
  xRange: initialXRange = { min: -40, max: 120 },
  yRange: initialYRange = { min: 0, max: 255 },
  xBounds = initialXRange,
  yBounds = initialYRange,
  xLabel = "X Axis",
  yLabel = "Y Axis",
  xFixed = false,
  precision = 0,
  xPrecision = precision,
  step = 10 ** -precision,
  xStep = 10 ** -xPrecision,
  disabled = false,
  theme = "cyan",
  activeIdx = null,
  liveXValue = null,
  onHoverPoint,
  onChange,
  onCommit,
  onInteractionStart,
}) => {
  const gradientId = `curve-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const svgRef = useRef(null);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [mousePos, setMousePos] = useState(null);

  const [xRange, setXRange] = useState(initialXRange);
  const [yRange, setYRange] = useState(initialYRange);
  const [showSettings, setShowSettings] = useState(false);

  const colors = THEMES[theme] || THEMES.cyan;
  const normalizedXValues = Array.isArray(xValues)
    ? xValues
    : xValues === undefined || xValues === null
      ? []
      : [xValues];
  const normalizedYValues = Array.isArray(yValues)
    ? yValues
    : yValues === undefined || yValues === null
      ? []
      : [yValues];
  const pointCount = Math.min(normalizedXValues.length, normalizedYValues.length);
  const curveXValues = normalizedXValues.slice(0, pointCount);
  const curveYValues = normalizedYValues.slice(0, pointCount);

  const padding = { top: 30, right: 30, bottom: 50, left: 60 };
  const width = 800;
  const height = 400;

  const getX = (val) =>
    padding.left +
    ((val - xRange.min) / (xRange.max - xRange.min)) *
      (width - padding.left - padding.right);
  const getY = (val) =>
    height -
    padding.bottom -
    ((val - yRange.min) / (yRange.max - yRange.min)) *
      (height - padding.top - padding.bottom);

  const fromX = (pixelX) => {
    const val =
      xRange.min +
      ((pixelX - padding.left) / (width - padding.left - padding.right)) *
        (xRange.max - xRange.min);
    return Math.max(xRange.min, Math.min(xRange.max, val));
  };

  const fromY = (pixelY) => {
    const val =
      yRange.min +
      ((height - padding.bottom - pixelY) /
        (height - padding.top - padding.bottom)) *
        (yRange.max - yRange.min);
    return Math.max(yRange.min, Math.min(yRange.max, val));
  };

  const round = (val) => roundAxis(Number(val), precision);
  const roundX = (val) => roundAxis(Number(val), xPrecision);

  const getInterpolatedY = (xVal) => {
    return interpolateCurve(curveXValues, curveYValues, xVal) ?? 0;
  };

  const handleAutoScale = () => {
    if (!curveXValues.length || !curveYValues.length) return;
    const minX = Math.min(...curveXValues) - (xRange.max - xRange.min) * 0.1;
    const maxX = Math.max(...curveXValues) + (xRange.max - xRange.min) * 0.1;
    const minY = Math.min(...curveYValues) - (yRange.max - yRange.min) * 0.1;
    const maxY = Math.max(...curveYValues) + (yRange.max - yRange.min) * 0.1;
    setXRange({ min: roundX(minX), max: Math.max(roundX(maxX), roundX(minX) + xStep) });
    setYRange({ min: round(minY), max: Math.max(round(maxY), round(minY) + step) });
    setShowSettings(false);
  };

  const handleStartInteraction = (idx, e) => {
    if (disabled || (e.button !== undefined && e.button !== 0)) return;
    if (e.cancelable) e.preventDefault();
    onInteractionStart?.();
    setDraggingIdx(idx);
  };

  const handleMove = useCallback(
    (clientX, clientY) => {
      if (!svgRef.current) return;
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const pixelX = ((clientX - rect.left) / rect.width) * width;
      const pixelY = ((clientY - rect.top) / rect.height) * height;

      setMousePos({ x: pixelX, y: pixelY });
      if (draggingIdx === null || disabled) return;

      const newX = fromX(pixelX);
      const newY = fromY(pixelY);
      const next = moveCurvePoint(curveXValues, curveYValues, draggingIdx, { x: newX, y: newY },
        { xRange: xBounds, yRange: yBounds, xFixed, xPrecision, precision, xStep, step });
      if (onChange) onChange(next.x, next.y);
    },
    [
      draggingIdx,
      curveXValues,
      curveYValues,
      xRange,
      yRange,
      xFixed,
      precision,
      xPrecision, xStep, step, disabled, xBounds, yBounds,
      onChange,
    ],
  );

  const handleEndInteraction = useCallback(() => {
    if (draggingIdx !== null && onCommit) {
      onCommit(curveXValues, curveYValues);
    }
    setDraggingIdx(null);
  }, [draggingIdx, onCommit, curveXValues, curveYValues]);

  useEffect(() => {
    const onMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      if (e.cancelable) e.preventDefault();
      if (e.touches.length > 0)
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    if (draggingIdx !== null) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", handleEndInteraction);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", handleEndInteraction);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", handleEndInteraction);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", handleEndInteraction);
    };
  }, [draggingIdx, handleMove, handleEndInteraction]);

  const renderGrid = () => {
    const lines = [];
    const xStep = (xRange.max - xRange.min) / 4;
    const yStep = (yRange.max - yRange.min) / 5;

    for (let i = 0; i <= 4; i++) {
      const val = xRange.min + i * xStep;
      const x = getX(val);
      lines.push(
        <g key={`x-${i}`}>
          <line
            x1={x}
            y1={padding.top}
            x2={x}
            y2={height - padding.bottom}
            stroke="white"
            strokeOpacity="0.05"
          />
          <text
            x={x}
            y={height - padding.bottom + 20}
            fill="white"
            fillOpacity="0.3"
            fontSize="10"
            textAnchor="middle"
          >
            {roundX(val)}
          </text>
        </g>,
      );
    }

    for (let i = 0; i <= 5; i++) {
      const val = yRange.min + i * yStep;
      const y = getY(val);
      lines.push(
        <g key={`y-${i}`}>
          <line
            x1={padding.left}
            y1={y}
            x2={width - padding.right}
            y2={y}
            stroke="white"
            strokeOpacity="0.05"
          />
          <text
            x={padding.left - 10}
            y={y + 4}
            fill="white"
            fillOpacity="0.3"
            fontSize="10"
            textAnchor="end"
          >
            {round(val)}
          </text>
        </g>,
      );
    }
    return lines;
  };

  const pathData = curveXValues
    .map((x, i) => `${i === 0 ? "M" : "L"} ${getX(x)} ${getY(curveYValues[i])}`)
    .join(" ");

  const renderCrosshair = () => {
    if (!mousePos || draggingIdx !== null) return null;
    const { x, y } = mousePos;
    if (
      x < padding.left ||
      x > width - padding.right ||
      y < padding.top ||
      y > height - padding.bottom
    )
      return null;

    const valX = roundX(fromX(x));
    const valY = round(getInterpolatedY(valX));
    const crossY = getY(valY);

    return (
      <g pointerEvents="none" className="animate-in fade-in duration-200">
        <line
          x1={x}
          y1={padding.top}
          x2={x}
          y2={height - padding.bottom}
          stroke={colors.primary}
          strokeOpacity="0.2"
          strokeDasharray="4"
        />
        <line
          x1={padding.left}
          y1={crossY}
          x2={width - padding.right}
          y2={crossY}
          stroke={colors.primary}
          strokeOpacity="0.2"
          strokeDasharray="4"
        />
        <circle
          cx={x}
          cy={crossY}
          r="4"
          fill={colors.primary}
          fillOpacity="0.5"
        />
        <g transform={`translate(${x + 10}, ${crossY - 10})`}>
          <rect width="70" height="20" rx="4" fill="black" fillOpacity="0.8" />
          <text
            x="35"
            y="14"
            fill={colors.primary}
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
          >
            {valX} / {valY}
          </text>
        </g>
      </g>
    );
  };

  const renderLiveMarker = () => {
    if (!Number.isFinite(liveXValue) || !curveXValues.length) return null;
    const clampedX = Math.max(xRange.min, Math.min(xRange.max, liveXValue));
    const lx = getX(clampedX);
    const interpY = round(getInterpolatedY(liveXValue));
    const clampedY = Math.max(yRange.min, Math.min(yRange.max, interpY));
    const ly = getY(clampedY);

    return (
      <g pointerEvents="none">
        <line
          x1={lx}
          y1={padding.top}
          x2={lx}
          y2={height - padding.bottom}
          stroke="#4ade80"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <circle
          cx={lx}
          cy={ly}
          r="9"
          fill="rgba(74, 222, 128, 0.2)"
          stroke="#4ade80"
          strokeWidth="1.5"
        />
        <circle cx={lx} cy={ly} r="3.5" fill="#4ade80" />
      </g>
    );
  };

  const internalHoverStart = (idx) => {
    setHoveredIdx(idx);
    if (onHoverPoint) onHoverPoint(idx);
  };

  const internalHoverEnd = () => {
    setHoveredIdx(null);
    if (onHoverPoint) onHoverPoint(null);
  };

  return (
    <div className="relative select-none bg-black/40 backdrop-blur-md rounded-xl border border-white/10 p-4 shadow-2xl overflow-visible">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-white/40">
          {yLabel} vs {xLabel}
        </span>

        <div className="flex items-center gap-3">
          {Number.isFinite(liveXValue) && curveXValues.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-neon-green/30 bg-neon-green/10 px-2 py-0.5 font-mono text-[10px] font-bold text-neon-green">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-green animate-pulse" />
              <span>
                LIVE {roundX(liveXValue)} → {round(getInterpolatedY(liveXValue))}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[10px] text-white/40">
            <div
              style={{
                backgroundColor: colors.primary,
                boxShadow: `0 0 8px ${colors.glow}`,
              }}
              className="w-2 h-2 rounded-full"
            ></div>
            Active Value
          </div>
          <button
            type="button"
            aria-label="Curve axis settings"
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg transition-all ${showSettings ? "bg-white text-black" : "hover:bg-white/5 text-white/40"}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="absolute right-4 top-12 z-50 bg-[#1a1a1a] border border-white/10 rounded-xl p-4 shadow-2xl w-64 animate-in fade-in zoom-in duration-200">
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-bold text-white/40 uppercase mb-2">
                X Axis ({xLabel})
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-white/30 block mb-1">
                    Min
                  </label>
                  <input
                    type="number"
                    value={xRange.min}
                    onChange={(e) =>
                      roundX(e.target.value) < xRange.max && setXRange({ ...xRange, min: roundX(e.target.value) })
                    }
                    className="w-full bg-black/40 border border-white/5 rounded p-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-white/30 block mb-1">
                    Max
                  </label>
                  <input
                    type="number"
                    value={xRange.max}
                    onChange={(e) =>
                      roundX(e.target.value) > xRange.min && setXRange({ ...xRange, max: roundX(e.target.value) })
                    }
                    className="w-full bg-black/40 border border-white/5 rounded p-1 text-xs text-white"
                  />
                </div>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-white/40 uppercase mb-2">
                Y Axis ({yLabel})
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-white/30 block mb-1">
                    Min
                  </label>
                  <input
                    type="number"
                    value={yRange.min}
                    onChange={(e) =>
                      round(e.target.value) < yRange.max && setYRange({ ...yRange, min: round(e.target.value) })
                    }
                    className="w-full bg-black/40 border border-white/5 rounded p-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-white/30 block mb-1">
                    Max
                  </label>
                  <input
                    type="number"
                    value={yRange.max}
                    onChange={(e) =>
                      round(e.target.value) > yRange.min && setYRange({ ...yRange, max: round(e.target.value) })
                    }
                    className="w-full bg-black/40 border border-white/5 rounded p-1 text-xs text-white"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={handleAutoScale}
              className="w-full py-2 bg-white/5 border border-white/10 text-white/60 text-[10px] font-bold uppercase rounded-lg hover:bg-white/10 transition-all"
            >
              Auto Scale Axis
            </button>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto cursor-crosshair overflow-visible"
        onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
        onMouseLeave={() => setMousePos(null)}
      >
        {/* defs MUST come first in SVG for url() references to resolve on initial paint */}
        <defs>
          <clipPath id={`${gradientId}-plot`}>
            <rect x={padding.left - 8} y={padding.top - 8}
              width={width - padding.left - padding.right + 16} height={height - padding.top - padding.bottom + 16} />
          </clipPath>
          {Object.entries(THEMES).map(([name, config]) => (
            <linearGradient
              key={name}
              id={`${gradientId}-${name}`}
              gradientUnits="userSpaceOnUse"
              x1={padding.left}
              y1="0"
              x2={width - padding.right}
              y2="0"
            >
              <stop offset="0%" stopColor={config.gradient[0]} />
              <stop offset="100%" stopColor={config.gradient[1]} />
            </linearGradient>
          ))}
        </defs>

        <rect
          x={padding.left}
          y={padding.top}
          width={width - padding.left - padding.right}
          height={height - padding.top - padding.bottom}
          fill="black"
          fillOpacity="0.2"
        />
        {renderGrid()}
        <g clipPath={`url(#${gradientId}-plot)`}>
        <path
          d={pathData}
          fill="none"
          stroke={`url(#${gradientId}-${THEMES[theme] ? theme : "cyan"})`}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${colors.glow})` }}
        />

        {renderLiveMarker()}
        {renderCrosshair()}

        {curveXValues.map((x, i) => {
          const cx = getX(x);
          const cy = getY(curveYValues[i]);
          const isTarget =
            draggingIdx === i || hoveredIdx === i || activeIdx === i;
          return (
            <g
              key={i}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`Bin ${i + 1}: ${xLabel} ${x}, ${yLabel} ${curveYValues[i]}. Arrow keys adjust; Shift for ten steps.`}
              aria-disabled={disabled}
              onFocus={() => internalHoverStart(i)}
              onBlur={internalHoverEnd}
              onKeyDown={event => {
                if (disabled || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                event.preventDefault();
                const multiplier = event.shiftKey ? 10 : 1;
                const deltaX = event.key === 'ArrowLeft' ? -xStep : event.key === 'ArrowRight' ? xStep : 0;
                const deltaY = event.key === 'ArrowDown' ? -step : event.key === 'ArrowUp' ? step : 0;
                const next = moveCurvePoint(curveXValues, curveYValues, i,
                  { x: deltaX ? x + deltaX * multiplier : undefined, y: deltaY ? curveYValues[i] + deltaY * multiplier : undefined },
                  { xRange: xBounds, yRange: yBounds, xPrecision, precision, xStep, step, xFixed });
                onInteractionStart?.();
                onChange?.(next.x, next.y);
                onCommit?.(next.x, next.y);
              }}
              onMouseEnter={() => internalHoverStart(i)}
              onMouseLeave={internalHoverEnd}
              onMouseDown={(e) => handleStartInteraction(i, e)}
              onTouchStart={(e) => handleStartInteraction(i, e)}
              className="cursor-pointer"
            >
              <circle cx={cx} cy={cy} r="15" fill="white" fillOpacity="0" />
              <circle
                cx={cx}
                cy={cy}
                r={isTarget ? 8 : 4}
                fill={isTarget ? colors.primary : colors.secondary}
                className="transition-all duration-200"
              />
              <circle cx={cx} cy={cy} r={isTarget ? 3 : 2} fill="white" />
              {(draggingIdx === i || hoveredIdx === i) && (
                <g transform={`translate(${cx}, ${cy - 20})`}>
                  <rect
                    x="-30"
                    y="-15"
                    width="60"
                    height="15"
                    rx="4"
                    fill="black"
                    stroke={colors.primary}
                    strokeWidth="1"
                  />
                  <text
                    y="-4"
                    fontSize="9"
                    fontWeight="bold"
                    fill="white"
                    textAnchor="middle"
                  >
                    {x}, {curveYValues[i]}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        </g>
      </svg>
      <div className="mt-2 text-center text-[10px] font-orbitron font-bold text-white/20 uppercase tracking-[0.3em]">
        {xLabel}
      </div>
    </div>
  );
};

export default CurveEditor;
