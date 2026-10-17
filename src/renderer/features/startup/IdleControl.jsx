import React from "react";
import {
  Activity,
  Zap,
  Clock,
  Gauge,
  Settings,
  ShieldAlert,
  Cpu,
  Lock,
  Snowflake,
  MoveUp,
  Triangle,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import TuningHeader from "../shared/components/TuningHeader";
import {
  GroupHeader,
  StatField,
  SelectField,
} from "../shared/components/TuningComponents";
import { toDisplay, toRaw } from "../shared/utils/normalization";

const IDLE_FIELDS = [
  "iacAlgorithm",
  "iacStepTime",
  "iacChannels",
  "idleFreq",
  "iacPWMdir",
  "iacCLminValue",
  "iacCLmaxValue",
  "idleKP",
  "idleKI",
  "idleKD",
  "idleAdvEnabled",
  "idleAdvRPM",
  "idleAdvTPS",
  "idleAdvDelay",
  "idleUpEnabled",
  "idleUpAdder",
  "idleUpPin",
  "idleUpPolarity",
  "iacTPSlimit",
  "iacRPMlimitHysteresis",
  "idleTaperTime",
  "iacStepHome",
  "iacStepHyster",
  "iacStepperPower",
  "iacMaxSteps",
  "iacPWMrun",
];

const IdleControl = () => {
  const {
    pinPages,
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
  } = useTuningModule(IDLE_FIELDS, {});

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-8 h-8 border-2 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin" />
        <div className="text-[10px] font-black text-white/40 uppercase tracking-widest animate-pulse">Syncing Idle Strategy...</div>
      </div>
    );
  }

  const iacAlgorithm = getFieldValue("iacAlgorithm");
  const isStepper = [4, 5, 7].includes(iacAlgorithm);
  const isPWM = [2, 3, 6].includes(iacAlgorithm);
  const isClosedLoop = [3, 5, 6, 7].includes(iacAlgorithm);
  const isAnyIdle = iacAlgorithm > 0;

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden h-screen animate-in fade-in duration-700">
      <TuningHeader
        title="Idle Control"
        icon={Activity}
        description="Air bypassing & idle stabilization strategy"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="cyan"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 p-5 rounded-3xl glass-card border border-white/5 h-fit space-y-4">
              <GroupHeader title="Strategy & Hardware" icon={Settings} />
              <div className="grid grid-cols-1 gap-1">
                <SelectField pinPages={pinPages}
                  name="iacAlgorithm"
                  label="Algorithm"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
                <SelectField pinPages={pinPages}
                  name="iacChannels"
                  label="Channels"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
                <StatField
                  name="idleFreq"
                  label="PWM Freq"
                  unit="Hz"
                  disabled={!isPWM}
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
                <SelectField pinPages={pinPages}
                  name="iacPWMdir"
                  label="Polarity"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
              </div>
            </div>

            <div className={`lg:col-span-8 p-5 rounded-3xl glass-card border border-white/5 transition-all ${!isAnyIdle && "opacity-30"}`}>
              <GroupHeader title="Idle-Up Compensation (AC / FAN)" icon={Snowflake} theme="blue" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SelectField pinPages={pinPages}
                  name="idleUpEnabled"
                  label="Mode"
                  theme="blue"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
                <StatField
                  name="idleUpAdder"
                  label="Target Adder"
                  unit="+ %/Steps"
                  theme="blue"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
                <SelectField pinPages={pinPages}
                  name="idleUpPin"
                  label="Input Pin"
                  theme="blue"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
                <SelectField pinPages={pinPages}
                  name="idleUpPolarity"
                  label="Input Polarity"
                  theme="blue"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className={`lg:col-span-8 p-5 rounded-3xl glass-card border border-white/5 bg-gradient-to-r from-neon-orange/5 to-transparent transition-all ${!isClosedLoop && "opacity-20 grayscale"}`}>
              <GroupHeader title="Closed-Loop (PID)" icon={Gauge} theme="orange" />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatField name="idleKP" label="P-Gain" step={0.1} theme="orange" getValue={getValue} getFieldInfo={getFieldInfo} updateValue={updateValue} />
                <StatField name="idleKI" label="I-Gain" step={0.1} theme="orange" getValue={getValue} getFieldInfo={getFieldInfo} updateValue={updateValue} />
                <StatField name="idleKD" label="D-Gain" step={0.1} theme="orange" getValue={getValue} getFieldInfo={getFieldInfo} updateValue={updateValue} />
                <StatField name="iacCLminValue" label="Min Clamp" theme="orange" getValue={getValue} getFieldInfo={getFieldInfo} updateValue={updateValue} />
                <StatField name="iacCLmaxValue" label="Max Clamp" theme="orange" getValue={getValue} getFieldInfo={getFieldInfo} updateValue={updateValue} />
              </div>
            </div>

            <div className="lg:col-span-4 p-5 rounded-3xl glass-card border border-white/5">
              <GroupHeader title="Lockout Thresholds" icon={Lock} theme="magenta" />
              <div className="grid grid-cols-2 gap-4">
                <StatField name="iacTPSlimit" label="TPS Limit" unit="%" theme="magenta" getValue={getValue} getFieldInfo={getFieldInfo} updateValue={updateValue} />
                <StatField name="iacRPMlimitHysteresis" label="Hysteresis" unit="RPM" theme="magenta" getValue={getValue} getFieldInfo={getFieldInfo} updateValue={updateValue} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:col-cols-12 gap-6">
            <div className={`lg:col-span-7 p-5 rounded-3xl glass-card border border-white/5 transition-all ${!isStepper && "opacity-20 grayscale"}`}>
              <GroupHeader title="Advanced Configuration" icon={MoveUp} theme="yellow" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatField
                  name="iacStepTime"
                  label="Step Time"
                  unit="ms"
                  theme="yellow"
                  disabled={!isStepper}
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
                <StatField
                  name="iacStepHome"
                  label="Home Steps"
                  theme="yellow"
                  disabled={!isStepper}
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
                <StatField
                  name="iacMaxSteps"
                  label="Max Limit"
                  theme="yellow"
                  disabled={!isStepper}
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
                <SelectField pinPages={pinPages}
                  name="iacStepperPower"
                  label="Power Mode"
                  theme="yellow"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
                <StatField
                  name="idleTaperTime"
                  label="Taper Time"
                  unit="s"
                  step={0.1}
                  theme="yellow"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
                <SelectField pinPages={pinPages}
                  name="iacPWMrun"
                  label="PWM Run Mode"
                  theme="yellow"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
              </div>
            </div>

            <div className="lg:col-span-5 p-5 rounded-3xl glass-card border border-white/5 h-fit">
              <GroupHeader title="Idle Advance" icon={Zap} />
              <div className="grid grid-cols-2 gap-4">
                <SelectField pinPages={pinPages}
                  name="idleAdvEnabled"
                  label="Adv Strategy"
                  getValue={getValue}
                  getFieldInfo={getFieldInfo}
                  updateValue={updateValue}
                />
                <StatField name="idleAdvRPM" label="RPM Threshold" unit="RPM" getValue={getValue} getFieldInfo={getFieldInfo} updateValue={updateValue} />
                <StatField name="idleAdvTPS" label="TPS Threshold" unit="%" getValue={getValue} getFieldInfo={getFieldInfo} updateValue={updateValue} />
                <StatField name="idleAdvDelay" label="Delay" unit="s" getValue={getValue} getFieldInfo={getFieldInfo} updateValue={updateValue} />
              </div>
            </div>
          </div>

          {!isAnyIdle && (
            <div className="p-12 text-center rounded-3xl border border-dashed border-white/10 animate-pulse mt-10">
              <Triangle className="mx-auto mb-4 text-white/10" size={32} />
              <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Idle Strategy: NONE</h4>
              <p className="text-[8px] text-white/10 uppercase mt-2 font-bold italic tracking-widest text-balance max-w-sm mx-auto">
                Selected algorithm does not require auxiliary hardware parameters.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdleControl;
