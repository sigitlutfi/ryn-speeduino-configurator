import React, { useState, useMemo } from "react";
import {
  Settings,
  Activity,
  Cpu,
  Calculator,
  ShieldAlert,
  Info,
  Disc,
  Zap,
  Flame,
} from "lucide-react";
import { useTuningModule } from "../shared/hooks/useTuningModule";
import { useStore } from "../../core/store.js";
import TuningHeader from "../shared/components/TuningHeader";
import {
  GroupHeader,
  StatField,
  SelectField,
} from "../shared/components/TuningComponents";
import { toDisplay, toRaw } from "../shared/utils/normalization";
import ReqFuelCalculator from "./ReqFuelCalculator.jsx";
import { getSupportedBoardChoices, validateBoardSelection, projectPinMapOptions } from '../../../shared/protocol/board-pins.js';
import { injectionSquirts } from '../../../shared/protocol/required-fuel.js';
import { buildPinRegistry } from '../shared/utils/pinRegistry.js';

const ENGINE_FIELDS = [
  "nCylinders",
  "nInjectors",
  "engineType",
  "stoich",
  "reqFuel",
  "divider",
  "injLayout",
  "mapSample",
  "algorithm",
  "sparkMode",
  "pinLayout",
  "injType",
  "alternate",
  "twoStroke",
  "injOpen",
];

const EngineSettings = () => {
  const [showReqFuelCalc, setShowReqFuelCalc] = useState(false);
  const currentProject = useStore((s) => s.currentProject);
  const parsedIni = useStore(s => s.parsedIni);
  const updateProjectField = useStore((s) => s.updateProjectField);

  const {
    pinPages,
    getFieldValue,
    setFieldValue,
    setLocalPage,
    getFieldInfo,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isConnected,
    isDirty,
    isReady,
  } = useTuningModule(ENGINE_FIELDS, {});

  const getValue = (name) => {
    const info = getFieldInfo(name);
    const rawVal = getFieldValue(name);
    return toDisplay(rawVal, info?.meta) ?? rawVal ?? 0;
  };

  const updateValue = (name, val) => {
    const info = getFieldInfo(name);
    setFieldValue(name, toRaw(val, info?.meta));
  };

  const fieldProps = { getValue, updateValue, getFieldInfo, pinPages };
  const reqFuelCalcPrefs = currentProject?.engine?.reqFuelCalc || {};
  const hardware = projectPinMapOptions(currentProject);
  const channelBuildKnown = ['standard', '6-3', '8-1'].includes(currentProject?.hardware?.channelBuild);
  const boardChoices = getSupportedBoardChoices(parsedIni, hardware.platform);
  const boardValue = getValue('pinLayout');
  const boardError = validateBoardSelection(parsedIni, boardValue, hardware.platform);
  const boardOptions = boardChoices.some(choice => choice.value === boardValue) ? boardChoices : [
    { value: boardValue, label: `${getFieldInfo('pinLayout')?.meta?.options?.[boardValue] || `Board ${boardValue}`} — unavailable for this firmware`, disabled: true }, ...boardChoices,
  ];
  const boardChanged = boardValue !== currentProject?.constants?.decodedPages?.[getFieldInfo('pinLayout')?.pageId]?.pinLayout;
  const routingChanges = useMemo(() => {
    if (!boardChanged || !parsedIni) return [];
    const before = buildPinRegistry(parsedIni, currentProject.constants.decodedPages, hardware);
    const after = buildPinRegistry(parsedIni, pinPages, hardware);
    return after.rows.filter(row => row.isActive && row.physicalPin !== before.rows.find(previous => previous.field === row.field)?.physicalPin)
      .map(row => ({ label: row.displayLabel, before: before.rows.find(previous => previous.field === row.field)?.physicalPin, after: row.physicalPin }));
  }, [boardChanged, parsedIni, pinPages, currentProject?.constants, currentProject?.hardware]);
  const cylinders = getValue('nCylinders');
  const dividerOptions = Array.from({ length: Number.isInteger(cylinders) && cylinders > 0 ? cylinders : 0 }, (_, i) => i + 1)
    .filter(value => cylinders % value === 0).map(value => ({ value, label: `Divider ${value} · ${cylinders / value} squirts/cycle requested` }));
  let squirtsInfo;
  try {
    const squirts = injectionSquirts(cylinders, getValue('divider'), getValue('injLayout'), getValue('twoStroke'), getValue('injType'));
    squirtsInfo = `Efektif: ${squirts} squirts/cycle. ${getValue('injLayout') === 3 && getValue('twoStroke') === 0 ? 'Sequential four-stroke memakai 1 squirt.' : 'Pembagi harus membagi jumlah silinder secara tepat.'}`;
  } catch { squirtsInfo = 'Pilih jumlah silinder dan divider yang valid sebelum menyimpan.'; }

  return (
    <div className="flex flex-col h-full  select-none animate-in fade-in duration-700">
      <TuningHeader
        title="Master Setup"
        icon={Settings}
        description="Board, engine configuration and base fuel delivery"
        isDirty={isDirty}
        isSaving={isSaving}
        saveStatus={saveStatus}
        isConnected={isConnected}
        onSave={() => handleSave(false)}
        onBurn={() => handleSave(true)}
        onDiscard={discardChanges}
        themeColor="white"
      />

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
        {!isReady && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="text-[10px] font-black text-white animate-pulse uppercase tracking-[0.4em]">
              Synchronizing Engine definitions...
            </div>
          </div>
        )}

        <div className="max-w-[1400px] mx-auto space-y-10 pb-24">
          <section aria-label="Hardware target" className="rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.035] p-5 text-xs text-slate-300 space-y-2">
            <p className="font-semibold text-cyan-100">{hardware.platform === 'mega2560' ? 'Mega2560' : 'MCU belum dikonfirmasi'} · {channelBuildKnown ? `kapasitas firmware ${hardware.injectorChannels} injector / ${hardware.ignitionChannels} ignition channels` : 'Channel build belum dikonfirmasi; reservasi pin memakai semua channel'}</p>
            <p>Board menentukan routing fisik; jumlah silinder tidak mengubah kapasitas channel hasil build. Pilihan hanya mencakup mapping firmware yang didukung.</p>
            {currentProject?.hardware?.restartRequired && <p className="text-amber-200">Setup ECU menunggu Burn/power cycle dan verifikasi. Mapping berikut adalah konfigurasi tujuan.</p>}
            {!hardware.platform && <p className="text-amber-200">Konfirmasikan MCU dan channel build di I/O Summary terlebih dahulu.</p>}
          </section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-8 rounded-[40px] backdrop-blur-md border border-white/5 bg-black/20">
              <GroupHeader
                title="Core Constants"
                icon={Cpu}
                theme="white"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                <div className="md:col-span-2 p-6 rounded-3xl bg-neon-red/5 border border-neon-red/20 relative group">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[8px] font-black text-neon-red uppercase tracking-widest flex items-center gap-2">
                      <Calculator size={14} className="animate-pulse" />
                      Required Fuel (Base Duration)
                    </span>
                    <button
                      onClick={() => setShowReqFuelCalc(true)}
                      className="text-[8px] font-black text-white bg-neon-red/20 px-4 py-1.5 rounded-full hover:bg-neon-red hover:text-white transition-all uppercase tracking-widest shadow-glow-red"
                    >
                      Recalculate
                    </button>
                  </div>
                  <input
                    aria-label="Required Fuel (ms)"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max={getFieldInfo('reqFuel')?.meta?.hi ?? 25.5}
                    value={getValue("reqFuel")}
                    onChange={(e) =>
                      updateValue("reqFuel", parseFloat(e.target.value))
                    }
                    className="w-full bg-transparent border-none text-[64px] font-mono font-black text-neon-red outline-none tracking-tighter"
                  />
                  <span className="absolute right-8 bottom-8 text-[10px] font-black text-neon-red/40 uppercase">
                    ms
                  </span>
                </div>

                <StatField
                  {...fieldProps}
                  name="stoich"
                  label="Stoichiometric Ratio"
                  unit="AFR"
                  theme="red"
                />
                <SelectField
                  {...fieldProps}
                  name="pinLayout"
                  label="Speeduino Board"
                  options={boardOptions}
                  disabled={!hardware.platform}
                  description="Changing the board requires Burn, ECU power cycle and verification. Explicit pin overrides are retained."
                  error={boardError}
                  icon={Cpu}
                  theme="white"
                />
                {boardChanged && <details aria-label="Preview perubahan routing board" className="md:col-span-2 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs space-y-3">
                  <summary className="cursor-pointer font-semibold text-amber-100">Preview routing board · {routingChanges.length} perubahan · belum diterapkan ke ECU</summary>
                  <p className="text-slate-400">Pin override tetap dipertahankan. Konflik dicek kembali saat Save dan sebelum upload. Burn dan power cycle diperlukan untuk menerapkan mapping.</p>
                  <div className="grid sm:grid-cols-2 gap-2">{routingChanges.map(row => <div key={row.label} className="flex justify-between gap-3 rounded-lg border border-white/5 p-2">
                    <span>{row.label}</span><span className="font-mono">{row.before == null ? '—' : `D${row.before}`} → {row.after == null ? '—' : `D${row.after}`}</span>
                  </div>)}</div>
                </details>}
                <SelectField
                  {...fieldProps}
                  name="nCylinders"
                  label="Cylinder Count"
                  icon={Activity}
                  theme="white"
                />
                <SelectField
                  {...fieldProps}
                  name="nInjectors"
                  label="Injector Count"
                  icon={Zap}
                  theme="red"
                />
                <SelectField {...fieldProps} name="twoStroke" label="Stroke Cycle" theme="white" />
                <SelectField {...fieldProps} name="engineType" label="Firing Pattern" description="Even fire / Odd fire describes firing intervals." theme="white" />
              </div>
            </div>

            <div className="flex flex-col gap-8">
              <div className="p-8 rounded-[40px] glass-card border border-white/10">
                <GroupHeader
                  title="Fueling Strategy"
                  icon={Flame}
                  theme="cyan"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SelectField
                    {...fieldProps}
                    name="algorithm"
                    label="Control Algorithm"
                    icon={ShieldAlert}
                  />
                  <SelectField
                    {...fieldProps}
                    name="divider"
                    label="Injection Divider"
                    options={dividerOptions}
                    description={squirtsInfo}
                    theme="red"
                  />
                  <SelectField {...fieldProps} name="injType" label="Injection Type" />
                  <SelectField {...fieldProps} name="alternate" label="Injektor Timing" />
                  <StatField
                    {...fieldProps}
                    name="injOpen"
                    label="Injector Open Time"
                    unit="ms"
                    step={0.1}
                    theme="red"
                  />
                  <SelectField {...fieldProps} name="mapSample" label="MAP Sampling" />
                </div>
              </div>

              <div className="p-8 rounded-[40px] bg-white/5 border border-white/10 flex items-center gap-6">
                <div className="p-4 rounded-3xl bg-white/10">
                  <Info size={24} className="text-white/40" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest">
                    Setup Warning
                  </h4>
                  <p className="text-[8px] text-gray-500 font-medium uppercase mt-1 leading-relaxed">
                    Mengubah Required Fuel mengubah jumlah bahan bakar dasar setelah setup diterapkan.
                    Nilai tabel VE tidak diubah atau dikompensasi otomatis. Gunakan spesifikasi mesin dan injektor saat menghitung ulang.
                  </p>
                </div>
              </div>
            </div>
          </div>



          <div className="p-8 rounded-[40px] glass-card border border-white/10">
            <GroupHeader
              title="Ignition / Sync"
              icon={Zap}
              theme="orange"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <SelectField {...fieldProps} name="sparkMode" label="Spark Mode" theme="orange" />
            </div>
          </div>
        </div>
      </div>

      {showReqFuelCalc && (
        <ReqFuelCalculator
          isOpen={true}
          onClose={() => setShowReqFuelCalc(false)}
          currentReqFuel={getValue("reqFuel")}
          initialDisplacement={
            reqFuelCalcPrefs.displacement ??
            currentProject?.engine?.displacement ??
            2000
          }
          initialDisplacementUnit={reqFuelCalcPrefs.displacementUnit ?? "cc"}
          initialCylinders={getValue("nCylinders")}
          initialInjectorFlow={reqFuelCalcPrefs.injectorFlow ?? currentProject?.engine?.injectorFlow ?? 440}
          initialInjectorUnit={reqFuelCalcPrefs.injectorUnit ?? "ccmin"}
          initialSquirts={getValue("divider") > 0 ? getValue("nCylinders") / getValue("divider") : 2}
          initialStoich={getValue("stoich")}
          onApply={(data) => {
            const reqFuelInfo = getFieldInfo("reqFuel");
            const nCylInfo = getFieldInfo("nCylinders");
            const dividerInfo = getFieldInfo("divider");
            const stoichInfo = getFieldInfo("stoich");

            updateProjectField("engine.reqFuelCalc", {
              displacement: data.displacement,
              displacementUnit: data.displacementUnit,
              injectorFlow: data.injectorFlow,
              injectorUnit: data.injectorUnit,
              stoich: data.stoich,
            });

            if (
              reqFuelInfo &&
              nCylInfo &&
              dividerInfo &&
              stoichInfo &&
              reqFuelInfo.pageId === nCylInfo.pageId &&
              reqFuelInfo.pageId === dividerInfo.pageId &&
              reqFuelInfo.pageId === stoichInfo.pageId
            ) {
              setLocalPage(reqFuelInfo.pageId, {
                [reqFuelInfo.key]: toRaw(data.reqFuel, reqFuelInfo.meta),
                [nCylInfo.key]: toRaw(data.cylinders, nCylInfo.meta),
                [dividerInfo.key]: toRaw(data.divider, dividerInfo.meta),
                [stoichInfo.key]: toRaw(data.stoich, stoichInfo.meta),
              });
            } else {
              // Fallback if INI mappings ever diverge across pages.
              updateValue("reqFuel", data.reqFuel);
              updateValue("nCylinders", data.cylinders);
              updateValue("divider", data.divider);
              updateValue("stoich", data.stoich);
            }

            setShowReqFuelCalc(false);
          }}
        />
      )}
    </div>
  );
};

export default EngineSettings;
