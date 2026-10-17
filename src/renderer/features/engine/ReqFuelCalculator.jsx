import React, { useState, useMemo, useEffect } from 'react';
import { X, Zap, Calculator, ChevronDown, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { calculateRequiredFuel, injectionDivider } from "../../../shared/protocol/required-fuel.js";

// Unit conversion constants
const CID_TO_CC  = 16.3871;
const LBHR_TO_CCMIN = 10.5;

const FUEL_TYPES = {
  gasoline: { label: 'Gasoline', stoich: 14.70 },
  e85:      { label: 'E85',      stoich: 9.76  },
  ethanol:  { label: 'Ethanol',  stoich: 9.00  },
  methanol: { label: 'Methanol', stoich: 6.45  },
};

const STOICH_MATCH_TOLERANCE = 0.05;

function resolveFuelPreset(stoich) {
  const numericStoich = parseFloat(stoich);
  if (!Number.isFinite(numericStoich) || numericStoich <= 0) {
    return { fuelKey: 'gasoline', customStoich: FUEL_TYPES.gasoline.stoich };
  }

  const matched = Object.entries(FUEL_TYPES).find(([, fuel]) => {
    return Math.abs(fuel.stoich - numericStoich) <= STOICH_MATCH_TOLERANCE;
  });

  if (matched) {
    return { fuelKey: matched[0], customStoich: numericStoich };
  }

  return { fuelKey: 'custom', customStoich: numericStoich };
}

/**
 * Calculates Required Fuel in milliseconds for Speeduino.
 */
function calcReqFuel(dispCc, cylinders, injCcMin, divider, stoich) {
  try {
    injectionDivider(Number(cylinders), Number(divider));
    const value = calculateRequiredFuel({ displacement: dispCc, cylinders, injectorFlow: injCcMin, stoich });
    return value >= 0.1 && value <= 25.5 ? value : null;
  } catch { return null; }
}

const UnitToggle = ({ value, onChange, options }) => (
  <div className="flex rounded-lg overflow-hidden border border-white/5 p-0.5 bg-black/40">
    {options.map(opt => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={`px-2 py-1 text-[8px] font-bold uppercase tracking-widest transition-all rounded-md ${
          value === opt.value
            ? 'bg-neon-cyan text-black shadow-[0_0_10px_rgba(0,212,255,0.3)]'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

export default function ReqFuelCalculator({
  isOpen,
  onClose,
  onApply,
  currentReqFuel = 0,
  initialDisplacement = 2000,
  initialDisplacementUnit = 'cc',
  initialCylinders = 4,
  initialInjectorFlow = 440,
  initialInjectorUnit = 'ccmin',
  initialSquirts = 2,
  initialStoich = 14.7,
}) {
  const initialFuelState = useMemo(
    () => resolveFuelPreset(initialStoich),
    [initialStoich],
  );

  // Use non-zero fallbacks for initialization
  const [dispValue, setDispValue]   = useState((initialDisplacement || 2000).toString());
  const [dispUnit, setDispUnit]     = useState(initialDisplacementUnit || 'cc');
  const [cylinders, setCylinders]   = useState((initialCylinders || 4).toString());
  const [injValue, setInjValue]     = useState((initialInjectorFlow || 440).toString());
  const [injUnit, setInjUnit]       = useState(initialInjectorUnit || 'ccmin');
  const [squirts, setSquirts]       = useState((initialSquirts || 2).toString());
  const [fuelKey, setFuelKey]       = useState(initialFuelState.fuelKey);
  const [customStoich, setCustomStoich] = useState(
    initialFuelState.customStoich.toString(),
  );

  // Re-sync if modal re-opens and ensure we don't start with "0"
  useEffect(() => {
    if (isOpen) {
      setDispValue((initialDisplacement || 2000).toString());
      setDispUnit(initialDisplacementUnit || 'cc');
      setCylinders((initialCylinders || 4).toString());
      setInjValue((initialInjectorFlow || 440).toString());
      setInjUnit(initialInjectorUnit || 'ccmin');
      setSquirts((initialSquirts || 2).toString());
      const nextFuelState = resolveFuelPreset(initialStoich);
      setFuelKey(nextFuelState.fuelKey);
      setCustomStoich(nextFuelState.customStoich.toString());
    }
  }, [
    isOpen,
    initialDisplacement,
    initialDisplacementUnit,
    initialCylinders,
    initialInjectorFlow,
    initialInjectorUnit,
    initialSquirts,
    initialStoich,
  ]);

  const selectedStoich =
    fuelKey === 'custom'
      ? parseFloat(customStoich)
      : FUEL_TYPES[fuelKey]?.stoich;

  // Convert inputs
  const dispCc  = dispUnit  === 'cid'  ? parseFloat(dispValue)  * CID_TO_CC    : parseFloat(dispValue);
  const injCcMin = injUnit  === 'lbhr' ? parseFloat(injValue)   * LBHR_TO_CCMIN : parseFloat(injValue);
  const cyl      = parseInt(cylinders);
  const div      = parseInt(squirts);

  const reqFuel = useMemo(
    () => calcReqFuel(dispCc, cyl, injCcMin, div, selectedStoich),
    [dispCc, cyl, injCcMin, div, selectedStoich]
  );

  const currentReqFuelValue = Number.isFinite(parseFloat(currentReqFuel))
    ? parseFloat(currentReqFuel)
    : null;
  const reqFuelDelta =
    currentReqFuelValue !== null && reqFuel !== null
      ? reqFuel - currentReqFuelValue
      : null;

  const handleApply = () => {
    if (reqFuel !== null && !isNaN(reqFuel)) {
      onApply({
        reqFuel: Math.round(reqFuel * 10) / 10,
        displacement: parseFloat(dispValue),
        displacementUnit: dispUnit,
        cylinders: cyl,
        injectorFlow: parseFloat(injValue),
        injectorUnit: injUnit,
        squirts: div,
        divider: injectionDivider(cyl, div),
        stoich: selectedStoich,
      });
      onClose();
    }
  };

  const isInvalid = (val) => isNaN(parseFloat(val)) || parseFloat(val) <= 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 font-inter"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[420px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-[24px] shadow-2xl overflow-hidden relative"
          >
              <div className="absolute top-0 right-0 w-48 h-48 bg-neon-cyan/5 blur-[80px] pointer-events-none" />

              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-neon-cyan/20 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan shadow-[0_0_15px_rgba(0,212,255,0.2)]">
                    <Zap size={16} />
                  </div>
                  <div className="text-xs font-orbitron font-bold text-white uppercase tracking-widest glow-cyan">Fuel Calculation</div>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest pl-1">Displacement</label>
                    <div className="relative group">
                      <input
                        type="number" value={dispValue} onChange={e => setDispValue(e.target.value)}
                        className={`w-full bg-black/60 border rounded-xl px-3 py-2.5 text-xs text-gray-200 focus:border-neon-cyan transition-all ${isInvalid(dispValue) ? 'border-red-500/30' : 'border-white/10'}`}
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 scale-90">
                        <UnitToggle value={dispUnit} onChange={setDispUnit} options={[{ value: 'cc', label: 'cc' }, { value: 'cid', label: 'cid' }]} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest pl-1">Inj. Flow</label>
                    <div className="relative group">
                      <input
                        type="number" value={injValue} onChange={e => setInjValue(e.target.value)}
                        className={`w-full bg-black/60 border rounded-xl px-3 py-2.5 text-xs text-gray-200 focus:border-neon-cyan transition-all ${isInvalid(injValue) ? 'border-red-500/30' : 'border-white/10'}`}
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 scale-90">
                        <UnitToggle value={injUnit} onChange={setInjUnit} options={[{ value: 'ccmin', label: 'cc' }, { value: 'lbhr', label: 'lb' }]} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest pl-1">Cylinders</label>
                    <input
                      type="number" value={cylinders} onChange={e => setCylinders(e.target.value)}
                      className={`w-full bg-black/60 border rounded-xl px-3 py-2.5 text-xs text-gray-200 focus:border-neon-cyan text-center transition-all ${isInvalid(cylinders) ? 'border-red-500/30' : 'border-white/10'}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest pl-1">Squirts</label>
                    <div className="relative">
                      <select
                        value={squirts} onChange={e => setSquirts(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-200 focus:border-neon-cyan text-center appearance-none cursor-pointer"
                      >
                        {[1, 2, 3, 4, 6, 8].map(n => <option key={n} value={n.toString()}>{n}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest pl-1 flex justify-between">
                    <span>Fuel Type & AFR</span>
                  </label>
                  <div className="relative">
                    <select
                      value={fuelKey} onChange={e => setFuelKey(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:border-neon-cyan appearance-none cursor-pointer"
                    >
                      {Object.entries(FUEL_TYPES).map(([key, { label, stoich }]) => (
                        <option key={key} value={key}>{label} ({stoich} AFR)</option>
                      ))}
                      <option value="custom">Custom</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                </div>

                {fuelKey === 'custom' && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest pl-1">
                      Custom Stoich
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={customStoich}
                      onChange={e => setCustomStoich(e.target.value)}
                      className={`w-full bg-black/60 border rounded-xl px-3 py-2.5 text-xs text-gray-200 focus:border-neon-cyan transition-all ${isInvalid(customStoich) ? 'border-red-500/30' : 'border-white/10'}`}
                    />
                  </div>
                )}

                <div className={`p-4 rounded-2xl border transition-all relative overflow-hidden ${
                  reqFuel !== null ? 'bg-neon-cyan/5 border-neon-cyan/20' : 'bg-red-500/5 border-red-500/10'
                }`}>
                  <div className="flex items-center justify-between mb-1 relative z-10">
                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Full-cycle Required Fuel</span>
                    {reqFuel === null && <AlertCircle size={12} className="text-red-500/50" />}
                  </div>
                  <div className="flex items-baseline gap-2 relative z-10">
                    <div className={`text-3xl font-mono font-bold tracking-tighter ${reqFuel !== null ? 'text-white glow-cyan' : 'text-gray-800'}`}>
                      {reqFuel !== null ? reqFuel.toFixed(1) : '—'}
                    </div>
                    <span className="text-[10px] text-gray-600 font-bold uppercase">ms</span>
                  </div>
                  {reqFuel === null && (
                    <div className="text-[7px] text-red-500/60 font-bold uppercase tracking-[0.1em] mt-1 italic animate-pulse">
                      All fields must be greater than zero
                    </div>
                  )}
                  {currentReqFuelValue !== null && (
                    <div className="mt-3 text-[8px] font-bold uppercase tracking-[0.12em] text-gray-500">
                      Current {currentReqFuelValue.toFixed(1)} ms
                      {reqFuelDelta !== null && (
                        <span className={`${reqFuelDelta === 0 ? 'text-gray-400' : reqFuelDelta > 0 ? 'text-neon-orange' : 'text-neon-cyan'} ml-2`}>
                          {reqFuelDelta > 0 ? '+' : ''}{reqFuelDelta.toFixed(1)} ms
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 px-6 pb-6 pt-2 bg-white/2">
                <button onClick={onClose} className="flex-1 py-3 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-all">Cancel</button>
                <button
                  onClick={handleApply} disabled={reqFuel === null}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-orbitron font-bold uppercase tracking-[0.2em] transition-all ${
                    reqFuel === null
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                      : 'bg-neon-cyan text-bg-deep hover:opacity-90 active:scale-95 box-glow-cyan'
                  }`}
                >
                  Apply Result
                </button>
              </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
