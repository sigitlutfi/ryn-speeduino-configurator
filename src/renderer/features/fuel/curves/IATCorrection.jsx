import React, { useState } from "react";
import { useStore } from "../../../core/store";
import CurveEditor from "../../../ui/CurveEditor";
import {
  Database,
  Thermometer,
  Info,
  AlertTriangle,
  ArrowRight,
  Edit2,
  Wind,
} from "lucide-react";
import { useTuningModule } from "../../shared/hooks/useTuningModule";
import TuningHeader from "../../shared/components/TuningHeader";
import { createIniSchema, isMonotonic } from "../../shared/utils/validation";

const IATCorrection = () => {
  const PAGE = 1;
  const X_BINS_NAME = "airDenBins";
  const Y_RATES_NAME = "airDenRates";

  const [validationErrors, setValidationErrors] = useState({});

  const {
    localConstants,
    setLocalPage,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isConnected,
    isDirty,
  } = useTuningModule(PAGE, {
    onValidate: (data) => {
      const p1 = data[PAGE] || {};
      const fields = [X_BINS_NAME, Y_RATES_NAME];

      const iatSchema = createIniSchema(parsedIni, PAGE, fields);
      const result = iatSchema.safeParse(p1);

      const errors = {};

      if (!result.success) {
        result.error.issues.forEach((issue) => {
          errors[issue.path[0]] = issue.message;
        });
      }

      if (!isMonotonic(p1[X_BINS_NAME])) {
        errors[X_BINS_NAME] = "Temperature bins must be increasing";
      }

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return false;
      }

      setValidationErrors({});
      return true;
    },
  });

  const [hoveredIdx, setHoveredIdx] = useState(null);

  const currentData = localConstants[PAGE] || {};
  const xValues = currentData[X_BINS_NAME] || [
    0, 10, 20, 30, 40, 50, 60, 70, 80,
  ];
  const yValues = currentData[Y_RATES_NAME] || [
    100, 100, 100, 100, 100, 100, 100, 100, 100,
  ];

  const handleCurveChange = (newX, newY) => {
    setLocalPage(PAGE, {
      [X_BINS_NAME]: newX,
      [Y_RATES_NAME]: newY,
    });
  };

  const updateTableValue = (index, type, value) => {
    const nextX = [...xValues];
    const nextY = [...yValues];

    if (type === "x") nextX[index] = value;
    else nextY[index] = value;

    setLocalPage(PAGE, {
      [X_BINS_NAME]: nextX,
      [Y_RATES_NAME]: nextY,
    });
  };

  const GroupHeader = ({ title, icon: Icon, colorClass = "bg-neon-cyan" }) => (
    <div className="flex items-center gap-4 mb-6">
      <div
        className={`w-1.5 h-6 ${colorClass} rounded-full shadow-glow-cyan`}
      />
      <h3 className="font-orbitron text-[11px] font-black text-white uppercase tracking-[0.3em]">
        {title}
      </h3>
      {Icon && <Icon className="ml-auto text-white/20" size={18} />}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent select-none animate-in fade-in duration-700 font-inter">
      <TuningHeader
        title="Air Density"
        icon={Wind}
        description="Compensate for intake air temperature variations to maintain perfect AFR"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-neon-cyan/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-10 pb-20 relative z-10">
          {/* LEFT: Curve UI */}
          <div className="space-y-10">
            <div
              className={`p-8 rounded-[40px] glass-card border transition-all duration-500 ${validationErrors[X_BINS_NAME] ? "border-neon-red shadow-glow-red/20" : "border-white/10"}`}
            >
              <div className="flex items-center justify-between mb-8">
                <GroupHeader
                  title="Density Correction Curve"
                  icon={Thermometer}
                />
                {validationErrors[X_BINS_NAME] && (
                  <AlertTriangle
                    className="text-neon-red animate-bounce"
                    size={18}
                  />
                )}
              </div>

              <div className="relative pt-6">
                <CurveEditor
                  xValues={xValues}
                  yValues={yValues}
                  theme="cyan"
                  xLabel="Air Temperature (°C)"
                  yLabel="Fuel Amount (%)"
                  xRange={{ min: -40, max: 125 }}
                  yRange={{ min: 40, max: 160 }}
                  activeIdx={hoveredIdx}
                  onHoverPoint={setHoveredIdx}
                  onChange={handleCurveChange}
                />
              </div>

              {validationErrors[X_BINS_NAME] && (
                <div className="mt-8 p-4 rounded-2xl bg-neon-red/10 border border-neon-red/40 flex gap-4 items-center">
                  <AlertTriangle className="text-neon-red" size={20} />
                  <span className="text-[10px] font-black text-neon-red uppercase tracking-widest">
                    {validationErrors[X_BINS_NAME]}
                  </span>
                </div>
              )}
            </div>

            <div className="p-8 rounded-[40px] bg-neon-cyan/5 border border-white/5 flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-neon-cyan/10 flex items-center justify-center shrink-0 border border-neon-cyan/20 shadow-glow-cyan/5">
                <Info className="text-neon-cyan" size={24} />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-black text-neon-cyan uppercase tracking-widest block">
                  Tuner Insight
                </span>
                <p className="text-[11px] text-gray-400 font-medium leading-relaxed uppercase tracking-wider">
                  Hotter air is less dense and contains less oxygen per volume.
                  Standard practice is to set 100% at 20°C and decrease fuel as
                  temps rise to prevent rich conditions.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: Data Table View */}
          <div className="space-y-10">
            <div className="p-8 rounded-[40px] glass-card border border-white/10 flex flex-col overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-[60px] pointer-events-none" />
              <GroupHeader title="Numerical Data" icon={Edit2} />

              <div className="space-y-4">
                <div className="grid grid-cols-[100px_1fr_100px] px-4 text-[9px] font-black text-gray-500 uppercase tracking-widest">
                  <span>Degrees (°C)</span>
                  <span className="text-center opacity-0">—</span>
                  <span className="text-right">Multiplier (%)</span>
                </div>

                <div className="space-y-2">
                  {xValues.map((v, i) => (
                    <div
                      key={i}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className={`flex items-center gap-4 p-4 rounded-2xl transition-all border ${hoveredIdx === i ? "bg-neon-cyan/10 border-neon-cyan/50 shadow-glow-cyan/10 ring-1 ring-neon-cyan/20" : "bg-black/20 border-white/5"}`}
                    >
                      <input
                        type="number"
                        value={v}
                        onChange={(e) =>
                          updateTableValue(i, "x", parseFloat(e.target.value))
                        }
                        className={`w-20 bg-transparent border-none text-[12px] font-mono font-black transition-all outline-none ${hoveredIdx === i ? "text-white" : "text-white/40"}`}
                      />

                      <div className="flex-1 flex justify-center opacity-20 group-hover:opacity-40 transition-opacity">
                        <ArrowRight
                          size={14}
                          className={
                            hoveredIdx === i
                              ? "text-neon-cyan translate-x-1"
                              : ""
                          }
                        />
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          value={yValues[i]}
                          onChange={(e) =>
                            updateTableValue(i, "y", parseFloat(e.target.value))
                          }
                          className={`w-20 bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-right text-[12px] font-mono font-black transition-all outline-none ${hoveredIdx === i ? "text-neon-cyan glow-cyan ring-1 ring-neon-cyan/50" : "text-white/60 focus:text-white"}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 text-[9px] text-gray-600 font-bold uppercase tracking-[0.3em] text-center italic">
                Dynamic Density Scaling Enabled
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IATCorrection;
