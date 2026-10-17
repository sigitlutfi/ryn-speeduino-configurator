import { CalibrationTable } from './CalibrationTables.jsx';
import { useLiveTelemetry } from '../shared/hooks/useLiveTelemetry.js';
import { liveTpsADC } from '../../../shared/protocol/tuning-live.js';
import React, { useState } from "react";
import {
  Wrench,
  Activity,
  Zap,
  Thermometer,
  Wind,
  Gauge,
  MousePointer2,
  ChevronRight,
  ChevronDown,
  Settings,
  CircleDot,
  Trash2,
  Save,
  RefreshCw,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import FilterControl from "../../ui/FilterControl.jsx";
import TuningHeader from "../shared/components/TuningHeader";
import { toDisplay, toRaw } from "../shared/utils/normalization";
import { useStore } from "../../core/store";

const SENSOR_FIELDS = [
  "ADCFILTER_TPS",
  "ADCFILTER_CLT",
  "ADCFILTER_IAT",
  "ADCFILTER_O2",
  "ADCFILTER_BAT",
  "ADCFILTER_MAP",
  "ADCFILTER_BARO",
  "FILTER_FLEX",
  "tpsMin",
  "tpsMax",
  "mapMin",
  "mapMax",
  "baroMin",
  "baroMax",
  "EMAPMin",
  "EMAPMax",
  "batVoltCorrect",
];

const SensorCalibration = () => {
  const [activeTab, setActiveTab] = useState("filters");
  const { realtime, status: telemetryStatus, issues } = useLiveTelemetry();
  const tpsADC = realtime?.tpsADC ?? null;
  const clt = realtime?.clt ?? '—', iat = realtime?.iat ?? '—';
  const afr = realtime?.afr ?? '—', vbatt = realtime?.vbatt ?? null;
  const captureTPS = field => {
    const state = useStore.getState();
    const value = liveTpsADC(state);
    if (value === null) {
      state.notify('Wait for a fresh ECU TPS ADC reading before capturing calibration.', 'warning');
      return;
    }
    setFieldValue(field, value);
  };

  const {
    getFieldValue,
    setFieldValue,
    getFieldInfo,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isConnected,
    isDirty,
    isReady,
  } = useTuningModule(SENSOR_FIELDS, { page: 4 });

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 font-orbitron animate-pulse uppercase tracking-[0.3em]">
        Calibrating Interfaces...
      </div>
    );
  }

  const getVal = (name) => getFieldValue(name) ?? 0;

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`relative z-10 flex items-center gap-3 px-6 py-4 border-b-2 transition-all duration-500 font-bold uppercase tracking-widest text-[10px] pointer-events-auto ${
        activeTab === id
          ? "border-neon-cyan text-white bg-neon-cyan/5 shadow-[inset_0_-10px_20px_-10px_rgba(0,243,255,0.2)]"
          : "border-transparent text-white/30 hover:text-white/60 hover:bg-white/5"
      }`}
    >
      <Icon size={14} className={activeTab === id ? "text-neon-cyan" : ""} />
      {label}
    </button>
  );

  const CalibrationRow = ({
    label,
    fieldName,
    unit = "",
    icon: Icon,
    color = "cyan",
  }) => {
    const value = getVal(fieldName);
    return (
      <div className="flex items-center gap-6 p-6 rounded-[24px] bg-white/[0.02] border border-white/5 hover:border-neon-cyan/20 transition-all group">
        <div
          className={`w-10 h-10 rounded-xl bg-neon-${color}/10 flex items-center justify-center shrink-0`}
        >
          <Icon size={18} className={`text-neon-${color}`} />
        </div>
        <div className="flex-1 space-y-1">
          <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">
            {label}
          </span>
          <div className="flex items-baseline gap-2">
            <input
              type="number"
              value={value}
              onChange={(e) =>
                setFieldValue(fieldName, parseFloat(e.target.value))
              }
              className="bg-transparent border-none outline-none text-xl font-mono font-black text-white w-24"
            />
            <span className="text-[10px] font-bold text-white/20 uppercase">
              {unit}
            </span>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="relative flex flex-col h-full min-h-0 animate-in fade-in duration-700">
      <TuningHeader
        title="Sensor Management"
        icon={Wrench}
        description="Global sensor calibration, signal filtering, and diagnostic tools"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="cyan"
      />

      {telemetryStatus !== 'live' && <div role="status" className="px-6 py-3 text-sm text-neon-yellow">Telemetry: {telemetryStatus}</div>}
      {issues.length > 0 && <div role="alert" className="px-6 py-3 text-sm text-neon-yellow">{issues.join(' ')}</div>}
      {/* Internal Navigation */}
      <div
        className="relative z-20 flex bg-white/5 border-b border-white/10 px-6 backdrop-blur-xl shrink-0 pointer-events-auto"
        style={{ WebkitAppRegion: "no-drag" }}
      >
        <TabButton id="filters" label="Analog Filters" icon={Activity} />
        <TabButton id="tps" label="TPS Calibration" icon={MousePointer2} />
        <TabButton id="o2" label="O2 Calibration" icon={Activity} />
        <TabButton id="temp" label="Thermistor Cal" icon={Thermometer} />
        <TabButton id="pressure" label="Pressure Sensors" icon={Wind} />
        <TabButton id="battery" label="Battery" icon={Zap} />
      </div>

      <div className="relative z-0 flex-1 min-h-0 overflow-y-auto custom-scrollbar p-10">
        <div className="max-w-[1400px] mx-auto">
          {activeTab === "filters" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
                <h3 className="text-base font-semibold text-white">Sensor signal filtering</h3>
                <p className="text-sm text-white/60 leading-relaxed max-w-3xl">
                  Higher coefficients smooth signal noise but slow the response to changes.
                  Zero applies no smoothing. These are filter coefficients, not percentages.
                </p>
                <p className="text-xs text-neon-cyan/80">Edits are staged. Use Save to apply your changes; Burn stores them in the ECU.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[
                  ['ADCFILTER_TPS', 'Throttle position', 'TPS · Keep enough response for throttle changes.', MousePointer2],
                  ['ADCFILTER_MAP', 'Manifold pressure', 'MAP · Used for instantaneous MAP sampling.', Wind],
                  ['ADCFILTER_CLT', 'Coolant temperature', 'CLT · Smooth temperature sensor readings.', Thermometer],
                  ['ADCFILTER_IAT', 'Intake air temperature', 'IAT · Smooth temperature sensor readings.', Thermometer],
                  ['ADCFILTER_O2', 'Oxygen sensor', 'O2 · Filtering also applies to the second O2 input.', Activity],
                  ['ADCFILTER_BAT', 'Battery voltage', 'Battery · Smooth supply voltage readings.', Zap],
                  ['ADCFILTER_BARO', 'Barometric pressure', 'Baro · Used when an external barometric sensor is enabled.', Wind],
                  ['FILTER_FLEX', 'Flex fuel sensor', 'Flex · Affects ethanol content and fuel temperature response.', Activity],
                ].map(([name, label, detail, icon]) => <FilterControl key={name}
                  label={label} detail={detail} icon={icon} value={getFieldValue(name)}
                  meta={getFieldInfo(name)?.meta} onChange={value => setFieldValue(name, value)} />)}
              </div>
              <p className="text-xs text-white/50 leading-relaxed px-1">
                Increase filtering only as needed. Check sensor wiring and grounding when signals are noisy.
                Defaults come from the project INI and can differ between firmware versions.
              </p>
            </div>
          )}

          {activeTab === "tps" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in slide-in-from-bottom-4 duration-500">
              <div className="p-10 rounded-[40px] glass-card border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20">
                      <MousePointer2 className="text-neon-cyan" size={24} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lx font-black text-white uppercase italic tracking-tighter">
                        ADC Live Scope
                      </h3>
                      <p className="text-[8px] text-white/30 uppercase tracking-[0.3em]">
                        Raw Signal Monitor
                      </p>
                    </div>
                  </div>

                  <div className="relative h-64 rounded-3xl border border-white/5 p-8 flex flex-col items-center justify-center overflow-hidden group">
                    <div className="absolute inset-0 bg-neon-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-6xl font-mono font-black text-neon-cyan drop-shadow-glow-cyan animate-in zoom-in duration-300">
                      {tpsADC ?? '—'}
                    </span>
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-4">
                      ECU ADC UNITS (0–255)
                    </span>
                    <div className="absolute bottom-10 inset-x-10 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neon-cyan shadow-glow-cyan transition-all duration-200"
                        style={{ width: `${((tpsADC ?? 0) / 255) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mt-10">
                  <button
                    disabled={telemetryStatus !== 'live' || !Number.isFinite(tpsADC)}
                    onClick={() => captureTPS('tpsMin')}
                    className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-neon-cyan/[0.15] hover:border-neon-cyan/50 group transition-all"
                  >
                    <h4 className="text-[9px] font-black text-white/40 group-hover:text-neon-cyan uppercase mb-2">
                      Pedal Closed
                    </h4>
                    <span className="text-xl font-black text-white uppercase italic">
                      Set Min
                    </span>
                  </button>
                  <button
                    disabled={telemetryStatus !== 'live' || !Number.isFinite(tpsADC)}
                    onClick={() => captureTPS('tpsMax')}
                    className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-neon-cyan/[0.15] hover:border-neon-cyan/50 group transition-all"
                  >
                    <h4 className="text-[9px] font-black text-white/40 group-hover:text-neon-cyan uppercase mb-2">
                      Pedal Open
                    </h4>
                    <span className="text-xl font-black text-white uppercase italic">
                      Set Max
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="p-10 rounded-[40px] glass-card border border-white/5 space-y-8">
                  <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest italic">
                    Calibration Targets
                  </h3>
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <label className="text-[7px] font-black text-neon-cyan uppercase tracking-widest block">
                        Stored Min ADC
                      </label>
                      <input
                        type="number"
                        value={getVal("tpsMin")}
                        onChange={(e) =>
                          setFieldValue("tpsMin", parseInt(e.target.value))
                        }
                        className="w-full bg-transparent border-b border-white/10 text-3xl font-mono font-black text-white outline-none focus:border-neon-cyan transition-colors pb-2"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[7px] font-black text-neon-cyan uppercase tracking-widest block">
                        Stored Max ADC
                      </label>
                      <input
                        type="number"
                        value={getVal("tpsMax")}
                        onChange={(e) =>
                          setFieldValue("tpsMax", parseInt(e.target.value))
                        }
                        className="w-full bg-transparent border-b border-white/10 text-3xl font-mono font-black text-white outline-none focus:border-neon-cyan transition-colors pb-2"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-8 rounded-[40px] border border-dashed border-white/5 flex flex-col items-center justify-center gap-6 text-center group hover:border-neon-cyan/20 transition-all">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CircleDot
                      size={32}
                      className="text-white/20 group-hover:text-neon-cyan"
                    />
                  </div>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed max-w-[280px]">
                    Ensure your throttle body is fully closed before setting
                    min, and fully open for max. Do not use cruise control or
                    high idle during this process.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "o2" && <CalibrationTable sensor="o2" title="O₂ controller" />}

          {activeTab === "temp" && (
            <div className="space-y-20">
              <CalibrationTable
                title="Coolant Temperature (CLT)"
                sensor="clt"
              />
              <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <CalibrationTable
                title="Intake Air Temperature (IAT)"
                sensor="iat"
              />
            </div>
          )}

          {activeTab === "pressure" && (
            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="p-10 rounded-[40px] glass-card border border-white/5 space-y-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-neon-blue/10 flex items-center justify-center border border-neon-blue/20">
                      <Wind className="text-neon-blue" size={24} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lx font-black text-white uppercase italic tracking-tighter">
                        MAP & Baro Calibration
                      </h3>
                      <p className="text-[8px] text-white/30 uppercase tracking-[0.3em]">
                        Manifold Absolute Pressure
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CalibrationRow
                      label="MAP Min Pressure"
                      fieldName="mapMin"
                      unit="kPa"
                      icon={Wind}
                      color="blue"
                    />
                    <CalibrationRow
                      label="MAP Max Pressure"
                      fieldName="mapMax"
                      unit="kPa"
                      icon={Wind}
                      color="blue"
                    />
                    <CalibrationRow
                      label="Baro Min Pressure"
                      fieldName="baroMin"
                      unit="kPa"
                      icon={Wind}
                      color="indigo"
                    />
                    <CalibrationRow
                      label="Baro Max Pressure"
                      fieldName="baroMax"
                      unit="kPa"
                      icon={Wind}
                      color="indigo"
                    />
                  </div>
                </div>

                <div className="p-10 rounded-[40px] glass-card border border-white/5 space-y-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-neon-purple/10 flex items-center justify-center border border-neon-purple/20">
                      <Wind className="text-neon-purple" size={24} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lx font-black text-white uppercase italic tracking-tighter">
                        EMAP Calibration
                      </h3>
                      <p className="text-[8px] text-white/30 uppercase tracking-[0.3em]">
                        Exhaust Backpressure
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CalibrationRow
                      label="EMAP Min Pressure"
                      fieldName="EMAPMin"
                      unit="kPa"
                      icon={Wind}
                      color="purple"
                    />
                    <CalibrationRow
                      label="EMAP Max Pressure"
                      fieldName="EMAPMax"
                      unit="kPa"
                      icon={Wind}
                      color="purple"
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 rounded-[30px] border border-dashed border-white/5 flex items-start gap-6 max-w-2xl">
                <div className="p-3 rounded-2xl bg-white/5 text-white/20">
                  <Save size={20} />
                </div>
                <p className="text-[9px] text-white/30 uppercase leading-relaxed tracking-wider">
                  Mini/Max values for pressure sensors are typically provided by
                  the manufacturer. For a standard 2.5 Bar MAP sensor, use 0kPa
                  - 250kPa.
                </p>
              </div>
            </div>
          )}

          {activeTab === "battery" && (
            <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
              <div className="p-10 rounded-[40px] glass-card border border-white/5 space-y-12 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-96 h-96 bg-neon-yellow/5 blur-[120px] pointer-events-none" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-3xl bg-neon-yellow/10 flex items-center justify-center border border-neon-yellow/20">
                      <Zap className="text-neon-yellow" size={32} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">
                        Battery Voltage Calibration
                      </h3>
                      <p className="text-[10px] text-white/30 uppercase tracking-[0.4em]">
                        Hardware Level Power Monitoring
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                      MCU Supply
                    </span>
                    <span className="text-xl font-mono font-black text-white">
                      5.01V
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 py-10">
                  <div className="flex flex-col items-center justify-center p-10 rounded-[40px] border border-white/5 relative group">
                    <div className="absolute inset-0 bg-neon-yellow/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[40px]" />
                    <div className="relative">
                      <div className="text-[100px] font-mono font-black text-white leading-none tracking-tighter glow-yellow">
                        {vbatt ?? '—'}
                      </div>
                      <span className="text-[12px] font-black text-neon-yellow absolute -right-10 top-4 uppercase tracking-widest">
                        VOLTS
                      </span>
                    </div>
                    <div className="h-1.5 w-48 bg-white/5 rounded-full mt-8 overflow-hidden">
                      <div
                        className="h-full bg-neon-yellow shadow-glow-yellow transition-all duration-300"
                        style={{
                          width: `${Math.min(100, ((vbatt ?? 0) / 16) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-center space-y-10">
                    <div className="space-y-6">
                      <div className="flex flex-col gap-2">
                        <h4 className="text-[10px] font-black text-white/60 uppercase tracking-widest pl-1">
                          Offset Correction
                        </h4>
                        <p className="text-[9px] text-white/20 uppercase tracking-wider leading-relaxed">
                          Adjust this value if the displayed voltage differs
                          from a physical multimeter reading at the battery.
                        </p>
                      </div>

                      <div className="flex items-center gap-8 bg-black/40 p-6 rounded-3xl border border-white/5">
                        <button
                          onClick={() =>
                            setFieldValue(
                              "batVoltCorrect",
                              getVal("batVoltCorrect") - 0.1,
                            )
                          }
                          className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-neon-yellow/10 hover:border-neon-yellow/30 hover:text-neon-yellow transition-all text-2xl font-black"
                        >
                          -
                        </button>
                        <div className="flex-1 text-center">
                          <div className="text-4xl font-mono font-black text-neon-yellow">
                            {getVal("batVoltCorrect") > 0 ? "+" : ""}
                            {getVal("batVoltCorrect")?.toFixed(1)}V
                          </div>
                          <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">
                            Current Bias
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            setFieldValue(
                              "batVoltCorrect",
                              getVal("batVoltCorrect") + 0.1,
                            )
                          }
                          className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-neon-yellow/10 hover:border-neon-yellow/30 hover:text-neon-yellow transition-all text-2xl font-black"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-[9px] text-white/30 uppercase leading-relaxed tracking-widest">
                      <span className="text-neon-yellow font-black block mb-2">
                        Notice:
                      </span>
                      High voltage readings (&gt;15.5V) may indicate a failing
                      alternator or voltage regulator, which could damage the
                      ECU.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SensorCalibration;
