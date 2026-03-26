import React, {
  useMemo,
  useRef,
  Suspense,
  useCallback,
  useLayoutEffect,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Grid,
  Center,
  Html,
  Float,
  GizmoHelper,
  GizmoViewport,
  Environment,
  ContactShadows,
  Line,
} from "@react-three/drei";
import * as THREE from "three";

const heatColor3D = (pct) => {
  const stops = [
    { pct: 0.0, h: 280 }, // Violet
    { pct: 0.16, h: 240 }, // Blue
    { pct: 0.33, h: 180 }, // Cyan
    { pct: 0.5, h: 120 }, // Green
    { pct: 0.66, h: 60 }, // Yellow
    { pct: 0.83, h: 30 }, // Orange
    { pct: 1.0, h: 0 }, // Red
  ];

  let hue;
  for (let i = 0; i < stops.length - 1; i++) {
    const s1 = stops[i];
    const s2 = stops[i + 1];
    if (pct >= s1.pct && pct <= s2.pct) {
      const ratio = (pct - s1.pct) / (s2.pct - s1.pct);
      hue = s1.h + ratio * (s2.h - s1.h);
      break;
    }
  }
  if (hue === undefined) hue = stops[stops.length - 1].h;

  const lightness = (32 + pct * 15) / 100; // Exact match to TuningGrid
  const tempColor = new THREE.Color();
  tempColor.setHSL(hue / 360, 1.0, lightness);
  return tempColor;
};

const SecondarySurface = ({ values, minVal, maxVal }) => {
  const dimensions = useMemo(() => {
    if (!values || !values[0]) return null;
    return { rows: values.length, cols: values[0].length };
  }, [values?.length, values?.[0]?.length]);

  const { baseGeo, gridGeo } = useMemo(() => {
    if (!dimensions) return { baseGeo: null, gridGeo: null };
    const { rows, cols } = dimensions;

    const geo = new THREE.PlaneGeometry(14, 14, cols - 1, rows - 1);
    geo.rotateX(-Math.PI / 2);

    const indices = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (c < cols - 1) indices.push(idx, idx + 1);
        if (r < rows - 1) indices.push(idx, idx + cols);
      }
    }

    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute("position", geo.attributes.position);
    gGeo.setIndex(indices);

    return { baseGeo: geo, gridGeo: gGeo };
  }, [dimensions]);

  useLayoutEffect(() => {
    if (!baseGeo || !values) return;
    const pos = baseGeo.attributes.position;
    const { rows, cols } = dimensions;
    const rM = maxVal - minVal || 1;

    for (let i = 0; i < pos.count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const val = values[r] ? values[r][c] : 0;
      const pct = Math.max(0, Math.min(1, (val - minVal) / rM));
      pos.setY(i, pct * 8);
    }

    pos.needsUpdate = true;
  }, [values, minVal, maxVal, baseGeo, dimensions]);

  if (!baseGeo) return null;

  return (
    <group>
      {/* Ghost Surface: Neon Magenta Wireframe */}
      <lineSegments geometry={gridGeo}>
        <lineBasicMaterial
          color="#ec4899"
          transparent
          opacity={0.3}
          linewidth={1}
        />
      </lineSegments>
      {/* Translucent Surface */}
      <mesh geometry={baseGeo}>
        <meshBasicMaterial
          color="#ec4899"
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

const Surface = ({ values, minVal, maxVal }) => {
  // Create base geometries ONLY when dimensions change
  const dimensions = useMemo(() => {
    if (!values || !values[0]) return null;
    return { rows: values.length, cols: values[0].length };
  }, [values?.length, values?.[0]?.length]);

  const { baseGeo, gridGeo, wallGeoX, wallGeoZ } = useMemo(() => {
    if (!dimensions)
      return { baseGeo: null, gridGeo: null, wallGeoX: null, wallGeoZ: null };
    const { rows, cols } = dimensions;

    const geo = new THREE.PlaneGeometry(14, 14, cols - 1, rows - 1);
    geo.rotateX(-Math.PI / 2);

    const indices = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (c < cols - 1) indices.push(idx, idx + 1); // Horizontal
        if (r < rows - 1) indices.push(idx, idx + cols); // Vertical
      }
    }

    // Allocate color buffer directly on the Three.js geometry
    const colorA = new Float32Array(geo.attributes.position.count * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colorA, 3));

    // Create separate grid geometry native
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute("position", geo.attributes.position);
    gGeo.setIndex(indices);

    // Wall projections (pro features)
    const wGeoX = new THREE.PlaneGeometry(14, 8, cols - 1, 1);
    wGeoX.translate(0, 4, -7.01); // Slightly behind floor back edge
    const wGeoZ = new THREE.PlaneGeometry(14, 8, rows - 1, 1);
    wGeoZ.rotateY(Math.PI / 2);
    wGeoZ.translate(-7.01, 4, 0); // Slightly behind floor left edge

    return { baseGeo: geo, gridGeo: gGeo, wallGeoX: wGeoX, wallGeoZ: wGeoZ };
  }, [dimensions]);

  // Update buffers extremely efficiently on every value change
  React.useLayoutEffect(() => {
    if (!baseGeo || !values) return;
    const pos = baseGeo.attributes.position;
    const colAttr = baseGeo.attributes.color;

    const { rows, cols } = dimensions;
    const rM = maxVal - minVal || 1;

    for (let i = 0; i < pos.count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const val = values[r] ? values[r][c] : 0;
      const pct = Math.max(0, Math.min(1, (val - minVal) / rM));

      pos.setY(i, pct * 8);

      const col = heatColor3D(pct);
      colAttr.setXYZ(i, col.r, col.g, col.b);
    }

    baseGeo.computeVertexNormals();
    pos.needsUpdate = true;
    colAttr.needsUpdate = true;
  }, [values, minVal, maxVal, baseGeo, dimensions]);

  if (!baseGeo) return null;

  return (
    <group>
      {/* Pro Wall Projections */}
      <mesh geometry={wallGeoX}>
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.05} />
      </mesh>
      <mesh geometry={wallGeoZ}>
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.05} />
      </mesh>

      {/* Wall Grid Lines (Pro Feature) */}
      <lineSegments geometry={wallGeoX}>
        <lineBasicMaterial color="#06b6d4" transparent opacity={0.1} />
      </lineSegments>
      <lineSegments geometry={wallGeoZ}>
        <lineBasicMaterial color="#06b6d4" transparent opacity={0.1} />
      </lineSegments>

      <mesh geometry={baseGeo} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors={true}
          side={THREE.DoubleSide}
          roughness={0.4}
          metalness={0.2}
          emissive="#000000"
        />
      </mesh>

      {/* Clean Grid Overlay */}
      <lineSegments geometry={gridGeo}>
        <lineBasicMaterial color="#000000" transparent opacity={0.45} />
      </lineSegments>

      {/* Intersection Control Dots */}
      <points geometry={baseGeo}>
        <pointsMaterial size={0.08} color="#ffffff" transparent opacity={0.4} />
      </points>
    </group>
  );
};

const TracePath = ({ currentPosition }) => {
  const [points, setPoints] = React.useState([]);
  const MAX_POINTS = 40;

  React.useEffect(() => {
    if (currentPosition) {
      setPoints((prev) => {
        const next = [...prev, new THREE.Vector3(...currentPosition)];
        if (next.length > MAX_POINTS) return next.slice(1);
        return next;
      });
    }
  }, [currentPosition]);

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color="#ec4899"
      lineWidth={1.5}
      transparent
      opacity={0.6}
    />
  );
};

const HoverProjections = ({ point }) => {
  if (!point) return null;

  return (
    <group>
      {/* Floor crosshair */}
      <Line
        points={[
          [point.x, 0, -7],
          [point.x, 0, 7],
        ]}
        color="#06b6d4"
        lineWidth={0.5}
        transparent
        opacity={0.15}
      />
      <Line
        points={[
          [-7, 0, point.z],
          [7, 0, point.z],
        ]}
        color="#06b6d4"
        lineWidth={0.5}
        transparent
        opacity={0.15}
      />

      {/* Wall vertical line projection */}
      <Line
        points={[
          [point.x, 0, -7.01],
          [point.x, point.y, -7.01],
        ]}
        color="#ffffff"
        lineWidth={0.8}
        transparent
        opacity={0.3}
      />
      <Line
        points={[
          [-7.01, 0, point.z],
          [-7.01, point.y, point.z],
        ]}
        color="#ffffff"
        lineWidth={0.8}
        transparent
        opacity={0.3}
      />

      {/* Connector lines to point */}
      <Line
        points={[
          [point.x, point.y, point.z],
          [point.x, point.y, -7],
        ]}
        color="#ffffff"
        lineWidth={0.5}
        transparent
        opacity={0.1}
        dashSize={0.2}
        gapSize={0.1}
      />
      <Line
        points={[
          [point.x, point.y, point.z],
          [-7, point.y, point.z],
        ]}
        color="#ffffff"
        lineWidth={0.5}
        transparent
        opacity={0.1}
        dashSize={0.2}
        gapSize={0.1}
      />
    </group>
  );
};

const ActivePointHUD = ({ activePoint, unit, xLabel, yLabel }) => {
  if (!activePoint) return null;
  return (
    <div className="absolute top-8 right-8 flex flex-col items-end gap-1 font-mono pointer-events-none group-hover:scale-105 transition-transform duration-500">
      <div className="glass p-3 rounded-xl border border-white/10 flex flex-col items-end shadow-2xl overflow-hidden relative min-w-[140px]">
        <div className="absolute top-0 right-0 w-16 h-16 bg-neon-cyan/5 blur-2xl pointer-events-none" />

        <div className="flex items-center gap-4 w-full justify-between">
          <span className="text-[8px] text-white/20 uppercase tracking-[0.2em] font-black">
            {yLabel}
          </span>
          <span className="text-[14px] text-white/50 font-black">
            {activePoint.load.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-4 w-full justify-between -mt-1">
          <span className="text-[8px] text-white/20 uppercase tracking-[0.2em] font-black">
            {xLabel}
          </span>
          <span className="text-[14px] text-white/50 font-black tracking-tighter">
            {activePoint.rpm.toFixed(0)}
          </span>
        </div>

        <div className="h-px w-full bg-white/5 my-2" />

        <div className="flex flex-col items-end">
          <span className="text-[8px] text-neon-cyan font-black uppercase tracking-[0.3em] mb-1">
            {unit} TARGET
          </span>
          <span className="text-4xl text-neon-cyan font-black leading-none tracking-tighter drop-shadow-[0_0_15px_rgba(0,212,255,0.4)]">
            {activePoint.value.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
};

const ColorLegend = ({ min, max, unit }) => (
  <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 group z-20">
    <span className="text-[8px] font-black text-white/60 uppercase mb-1 font-mono">
      {max}
    </span>
    <div className="w-1.5 h-48 rounded-full overflow-hidden bg-black/40 border border-white/10 flex flex-col-reverse relative shadow-[0_0_20px_rgba(0,0,0,0.5)]">
      <div className="absolute inset-0 bg-gradient-to-t from-[#4c1d95] via-[#2563eb] via-[#0891b2] via-[#059669] via-[#d97706] to-[#dc2626] opacity-90" />
      {/* Dynamic Marker if needed */}
    </div>
    <span className="text-[8px] font-black text-white/60 uppercase mt-1 font-mono">
      {min}
    </span>
    <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-4 bg-black/80 backdrop-blur-md px-2 py-1 rounded border border-white/10">
      <span className="text-[9px] font-orbitron text-neon-cyan font-black tracking-widest uppercase">
        {unit} SCALE
      </span>
    </div>
  </div>
);

const AxisLabel = ({ position, label, color = "#06b6d4" }) => (
  <Html
    position={position}
    center
    distanceFactor={10}
    style={{ transition: "all 0.2s ease-out" }}
  >
    <div
      className="px-2 py-1 bg-[#040608]/90 backdrop-blur-xl border border-white/10 rounded-md whitespace-nowrap shadow-[0_0_20px_rgba(0,0,0,0.4)] scale-75 lg:scale-100 flex items-center gap-2 group border-l-2"
      style={{ borderColor: color }}
    >
      <span
        style={{ color, textShadow: `0 0 10px ${color}44` }}
        className="text-[9px] font-orbitron font-black uppercase tracking-[0.2em]"
      >
        {label}
      </span>
    </div>
  </Html>
);

const TickLabel = ({
  position,
  label,
  rotation,
  color = "rgba(255, 255, 255, 0.4)",
}) => (
  <Html
    position={position}
    rotation={rotation}
    center
    transform
    pointerEvents="none"
  >
    <div
      style={{
        fontSize: "10px",
        color,
        fontFamily: "Orbitron, sans-serif",
        fontWeight: "900",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  </Html>
);

export default function SurfacePlot3D({
  values,
  minVal = 0,
  maxVal = 100,
  xAxisLabel = "RPM",
  yAxisLabel = "LOAD",
  unitLabel = "VAL",
  selection = null, // { r1, c1, r2, c2 }
  activePoint = null, // { rpm, load, value }
  secondaryValues = null, // Ghost surface data
  rpmAxis = [],
  loadAxis = [],
  onSelect = null,
  onUpdateValue = null,
}) {
  const [hoveredPoint, setHoveredPoint] = React.useState(null);
  const [dragInfo, setDragInfo] = React.useState(null);
  const controlsRef = React.useRef();

  const setView = (type) => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;

    // Snap to views
    switch (type) {
      case "Top":
        controls.object.position.set(0, 25, 0);
        break;
      case "Side":
        controls.object.position.set(25, 0, 0);
        break;
      case "Back":
        controls.object.position.set(0, 0, 25);
        break;
      case "Iso":
      default:
        controls.object.position.set(12, 12, 12);
        break;
    }
    controls.target.set(0, 0, 0);
    controls.update();
  };

  // Calculate selection box in 3D space
  const selectionBox = useMemo(() => {
    if (!selection || !rpmAxis.length || !loadAxis.length) return null;
    const { r1, c1, r2, c2 } = selection;

    const rows = loadAxis.length;
    const cols = rpmAxis.length;

    const x1 = (c1 / (cols - 1)) * 14 - 7;
    const z1 = (r1 / (rows - 1)) * 14 - 7;
    const x2 = (c2 / (cols - 1)) * 14 - 7;
    const z2 = (r2 / (rows - 1)) * 14 - 7;

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);

    return {
      center: [(minX + maxX) / 2, 4, (minZ + maxZ) / 2],
      size: [maxX - minX + 0.2, 8.5, maxZ - minZ + 0.2],
    };
  }, [selection, rpmAxis, loadAxis]);

  // Helper to interp position from axes
  const getPoint3D = useCallback(
    (rpm, load, val) => {
      if (!rpmAxis.length || !loadAxis.length) return [0, 0, 0];

      const findPct = (axis, v) => {
        if (v <= axis[0]) return 0;
        if (v >= axis[axis.length - 1]) return 1;
        for (let i = 0; i < axis.length - 1; i++) {
          if (v >= axis[i] && v <= axis[i + 1]) {
            return (
              (i + (v - axis[i]) / (axis[i + 1] - axis[i])) / (axis.length - 1)
            );
          }
        }
        return 0;
      };

      const xPct = findPct(rpmAxis, rpm);
      const zPct = findPct(loadAxis, load);

      const x = xPct * 14 - 7;
      const z = zPct * 14 - 7;
      const yPct = (val - minVal) / (maxVal - minVal || 1);
      const y = yPct * 8;

      return [x, y, z];
    },
    [rpmAxis, loadAxis, minVal, maxVal],
  );

  const activePos3D = useMemo(() => {
    if (!activePoint) return null;
    return getPoint3D(
      activePoint.rpm,
      activePoint.load,
      activePoint.value || 0,
    );
  }, [activePoint, getPoint3D]);

  // Calculate specific feature points for labeling
  const { minPoint, maxPoint } = useMemo(() => {
    if (!values || !values[0])
      return { minPoint: [0, 0, 0], maxPoint: [0, 0, 0] };
    const rows = values.length;
    const cols = values[0].length;

    let minV = Infinity,
      maxV = -Infinity;
    let minC = [0, 0, 0],
      maxC = [0, 0, 0];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = values[r][c];
        const x = (c / (cols - 1)) * 14 - 7;
        const z = (r / (rows - 1)) * 14 - 7;
        const pct = (val - minVal) / (maxVal - minVal || 1);
        const y = pct * 8;

        if (val < minV) {
          minV = val;
          minC = [x, y, z];
        }
        if (val >= maxV) {
          maxV = val;
          maxC = [x, y, z];
        }
      }
    }
    return { minPoint: minC, maxPoint: maxC };
  }, [values, minVal, maxVal]);

  if (!values || !values.length) {
    return (
      <div className="w-full h-[700px] flex items-center justify-center bg-[#0a0b10] text-white/40 border border-white/5 rounded-3xl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <span className="font-orbitron text-[10px] uppercase tracking-widest">
            Generating Surface...
          </span>
        </div>
      </div>
    );
  }

  const getClientY = (e) => {
    if (e.clientY !== undefined) return e.clientY;
    if (e.nativeEvent?.clientY !== undefined) return e.nativeEvent.clientY;
    if (e.nativeEvent?.touches?.[0]?.clientY !== undefined)
      return e.nativeEvent.touches[0].clientY;
    return 0; // fallback
  };

  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (e.intersections.length > 0) {
      const p = e.intersections[0].point;
      const cols = rpmAxis.length;
      const rows = loadAxis.length;
      const c = Math.max(
        0,
        Math.min(cols - 1, Math.round(((p.x + 7) / 14) * (cols - 1))),
      );
      const r = Math.max(
        0,
        Math.min(rows - 1, Math.round(((p.z + 7) / 14) * (rows - 1))),
      );

      if (onSelect) onSelect(r, c);

      setDragInfo({
        r,
        c,
        startY: getClientY(e),
        startVal: values[r][c],
        pointerId: e.pointerId,
      });
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    e.stopPropagation();
    if (dragInfo) {
      // Drag Logic
      const currentY = getClientY(e);
      const deltaY = dragInfo.startY - currentY;

      // Calculate new value directly scaling pixel drag to value delta
      const range = Math.max(1, maxVal - minVal);
      const deltaVal = (deltaY / 150) * range;

      let newVal = dragInfo.startVal + deltaVal;
      if (isNaN(newVal)) newVal = dragInfo.startVal; // Failsafe

      newVal = Math.max(minVal, Math.min(maxVal, newVal));

      if (onUpdateValue)
        onUpdateValue(dragInfo.r, dragInfo.c, Math.round(newVal));

      const cx = (dragInfo.c / (rpmAxis.length - 1)) * 14 - 7;
      const cz = (dragInfo.r / (loadAxis.length - 1)) * 14 - 7;
      setHoveredPoint({
        x: cx,
        y: ((newVal - minVal) / (maxVal - minVal || 1)) * 8,
        z: cz,
        val: newVal,
      });
    } else if (e.intersections.length > 0) {
      // Hover Logic
      const p = e.intersections[0].point;
      const pctY = p.y / 8;
      const val = minVal + pctY * (maxVal - minVal);
      setHoveredPoint({ x: p.x, y: p.y, z: p.z, val });
    }
  };

  const handlePointerUp = (e) => {
    e.stopPropagation();
    if (dragInfo) {
      e.target.releasePointerCapture(dragInfo.pointerId);
      setDragInfo(null);
    }
  };

  return (
    <div
      style={{ width: "100%", height: "650px" }}
      className="bg-[#050608] rounded-3xl border border-white/10 overflow-hidden relative group shadow-2xl"
    >
      <ColorLegend min={minVal} max={maxVal} unit={unitLabel} />
      <Canvas
        shadows={true}
        camera={{ position: [15, 15, 15], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
      >
        <PerspectiveCamera makeDefault position={[12, 12, 12]} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.1}
          maxPolarAngle={Math.PI / 1.8}
          minDistance={6}
          maxDistance={30}
          enabled={!dragInfo}
        />

        <Suspense fallback={null}>
          <Environment preset="night" />
          <ambientLight intensity={1.2} />
          <ContactShadows
            position={[0, -0.05, 0]}
            opacity={0.4}
            scale={20}
            blur={2.5}
            far={10}
            resolution={512}
            color="#000000"
          />
          <spotLight
            position={[10, 20, 10]}
            angle={0.15}
            penumbra={1}
            intensity={4}
            castShadow
          />
          <pointLight
            position={[-10, 10, -10]}
            intensity={1.5}
            color="#06b6d4"
          />

          {/* Gizmo Orientation Helper */}
          <GizmoHelper
            alignment="bottom-right"
            margin={[80, 80]}
            onTarget={() => {}}
            onUpdate={() => {}}
          >
            <GizmoViewport
              axisColors={["#f43f5e", "#10b981", "#3b82f6"]}
              labelColor="white"
            />
          </GizmoHelper>

          <group
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerOut={() => {
              if (!dragInfo) setHoveredPoint(null);
            }}
          >
            <Surface values={values} minVal={minVal} maxVal={maxVal} />

            {secondaryValues && (
              <SecondarySurface
                values={secondaryValues}
                minVal={minVal}
                maxVal={maxVal}
              />
            )}

            {/* ECU Trace Path History */}
            {activePos3D && <TracePath currentPosition={activePos3D} />}

            {/* Selection Highlight Box */}
            {selectionBox && (
              <mesh position={selectionBox.center}>
                <boxGeometry args={selectionBox.size} />
                <meshBasicMaterial
                  color="#06b6d4"
                  transparent
                  opacity={0.1}
                  side={THREE.DoubleSide}
                />
                <lineSegments>
                  <edgesGeometry
                    args={[new THREE.BoxGeometry(...selectionBox.size)]}
                  />
                  <lineBasicMaterial
                    color="#06b6d4"
                    transparent
                    opacity={0.4}
                  />
                </lineSegments>
              </mesh>
            )}

            {/* Base Reference Plane (Floor) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
              <planeGeometry args={[14, 14]} />
              <meshBasicMaterial color="#06b6d4" transparent opacity={0.03} />
            </mesh>

            {/* ECU Trace Line */}
            {activePos3D && (
              <group position={activePos3D}>
                <mesh>
                  <sphereGeometry args={[0.2, 16, 16]} />
                  <meshBasicMaterial color="#ec4899" />
                </mesh>
                <mesh position={[0, -activePos3D[1] / 2, 0]}>
                  <cylinderGeometry args={[0.02, 0.02, activePos3D[1]]} />
                  <meshBasicMaterial
                    color="#ec4899"
                    transparent
                    opacity={0.5}
                  />
                </mesh>
                <AxisLabel
                  position={[0, 1.0, 0]}
                  label="ECU TRACE"
                  color="#ec4899"
                />
              </group>
            )}

            {/* Tooltip on Hover */}
            {hoveredPoint && (
              <>
                <HoverProjections point={hoveredPoint} />
                <AxisLabel
                  position={[
                    hoveredPoint.x,
                    hoveredPoint.y + 1.2,
                    hoveredPoint.z,
                  ]}
                  label={`${hoveredPoint.val.toFixed(1)} ${unitLabel}`}
                  color="#ffffff"
                />
              </>
            )}
          </group>

          {/* Precision Anchored Labels */}
          <AxisLabel position={[0, -0.5, -8.2]} label={xAxisLabel} />
          <AxisLabel position={[8.2, -0.5, 0]} label={yAxisLabel} />

          <AxisLabel
            position={[maxPoint[0], maxPoint[1] + 1.2, maxPoint[2]]}
            label={`MAX: ${maxVal}`}
            color="#ef4444"
          />
          <AxisLabel
            position={[minPoint[0], minPoint[1] + 1.2, minPoint[2]]}
            label={`MIN: ${minVal}`}
            color="#3b82f6"
          />

          {/* Quad-Axis Ticks (RPM - x Axis) */}
          {rpmAxis.map((val, i) => {
            const x = (i / (rpmAxis.length - 1)) * 14 - 7;
            return (
              <React.Fragment key={`rpm-quad-${i}`}>
                {/* Front Side */}
                <TickLabel
                  position={[x, -0.05, 7.8]}
                  label={val}
                  rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
                  color="rgba(255, 255, 255, 0.7)"
                />
                {/* Back Side */}
                <TickLabel
                  position={[x, -0.05, -7.8]}
                  label={val}
                  rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                  color="rgba(255, 255, 255, 0.3)"
                />
              </React.Fragment>
            );
          })}

          {/* Quad-Axis Ticks (LOAD - z Axis) */}
          {loadAxis.map((val, i) => {
            const z = (i / (loadAxis.length - 1)) * 14 - 7;
            return (
              <React.Fragment key={`load-quad-${i}`}>
                {/* Left Side */}
                <TickLabel
                  position={[-7.8, -0.05, z]}
                  label={val}
                  rotation={[-Math.PI / 2, 0, 0]}
                  color="rgba(255, 255, 255, 0.7)"
                />
                {/* Right Side */}
                <TickLabel
                  position={[7.8, -0.05, z]}
                  label={val}
                  rotation={[-Math.PI / 2, 0, Math.PI]}
                  color="rgba(255, 255, 255, 0.3)"
                />
              </React.Fragment>
            );
          })}

          <Grid
            args={[14, 14]}
            fadeDistance={50}
            fadeStrength={2}
            cellSize={1}
            sectionSize={2}
            sectionColor="#06b6d4"
            cellColor="#1e293b"
            opacity={0.4}
            position={[0, -0.04, 0]}
          />
        </Suspense>
      </Canvas>

      {/* Modern UI Overlay */}
      <div className="absolute top-8 left-8 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-[0_0_10px_#06b6d4] animate-pulse" />
          <h3 className="text-[12px] font-orbitron font-black text-white uppercase tracking-[0.4em]">
            Precision 3D Mapping
          </h3>
        </div>
        <div className="flex items-center gap-4 text-[9px] font-mono font-bold text-white/30 tracking-widest uppercase">
          <span>
            Resolution: {values.length}x{values[0]?.length}
          </span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>Real-time Sync Active</span>
        </div>
      </div>

      {/* Real-time Telemetry HUD */}
      {activePoint ? (
        <ActivePointHUD
          activePoint={activePoint}
          unit={unitLabel}
          xLabel={xAxisLabel}
          yLabel={yAxisLabel}
        />
      ) : (
        <div className="absolute top-8 right-8 flex flex-col gap-2">
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-3 flex flex-col gap-2 shadow-2xl">
            <div className="flex items-center justify-between gap-8">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                X-Axis
              </span>
              <span className="text-[9px] font-black text-neon-cyan uppercase">
                {xAxisLabel}
              </span>
            </div>
            <div className="flex items-center justify-between gap-8">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                Y-Axis
              </span>
              <span className="text-[9px] font-black text-neon-cyan uppercase">
                {yAxisLabel}
              </span>
            </div>
            <div className="h-px bg-white/10 my-1" />
            <div className="flex items-center justify-between gap-8">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                Range
              </span>
              <span className="text-[9px] font-black text-white uppercase font-mono">
                {minVal} - {maxVal} {unitLabel}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center gap-8">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
            Low Efficiency
          </span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
            High Load
          </span>
        </div>
      </div>

      <div className="absolute bottom-2 left-8 flex flex-col  gap-2 text-[8px] font-black pointer-events-none">
        <div className="flex gap-2 pointer-events-auto">
          {["Top", "Side", "Back", "Iso"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 border border-white/5 bg-black/40 backdrop-blur-md rounded-md text-white/40 uppercase tracking-widest hover:bg-neon-cyan/20 hover:text-white hover:border-neon-cyan/40 transition-all duration-300 shadow-xl"
            >
              {v}
            </button>
          ))}
        </div>
        <div className="text-white/20 uppercase tracking-[0.2em] bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
          Orbit: Left Drag | Zoom: Scroll | Pan: Right Drag
        </div>
      </div>
    </div>
  );
}
