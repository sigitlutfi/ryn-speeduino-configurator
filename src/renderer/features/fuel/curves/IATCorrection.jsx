import React, { useState } from 'react'
import { useStore } from '../../../core/store.js'
import { Thermometer, Info, Wind } from 'lucide-react'
import { useTuningModule } from '../../shared/hooks/useTuningModule.js'
import TuningHeader from '../../shared/components/TuningHeader.jsx'
import IniCurvePanel from '../../shared/components/IniCurvePanel.jsx'
import { useLiveTelemetry } from '../../shared/hooks/useLiveTelemetry.js'
import { curveMetadata, curveDisplay, inspectCurve, curvePreset } from '../../../../shared/protocol/curve-presets.js'

const IATCorrection = () => {
  const parsedIni = useStore(s => s.parsedIni)
  const { realtime } = useLiveTelemetry()
  const [validationError, setValidationError] = useState(null)
  const { handleSave, discardChanges, isSaving, saveStatus, isConnected, isDirty } = useTuningModule(['airDenBins', 'airDenRates'], {
    onValidate: pages => {
      const xm = curveMetadata(parsedIni, 'airDenBins', pages), ym = curveMetadata(parsedIni, 'airDenRates', pages)
      const x = pages[xm?.page]?.airDenBins?.map(v => curveDisplay(v, xm))
      const y = pages[ym?.page]?.airDenRates?.map(v => curveDisplay(v, ym))
      const issues = inspectCurve(x, y, xm, ym, curvePreset('airDenRates'))
      setValidationError(issues.join(' ') || null)
      return !issues.length
    },
  })
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
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-neon-cyan/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-[1400px] mx-auto space-y-8 pb-20 relative z-10">
          <IniCurvePanel
        xName="airDenBins"
        yName="airDenRates"
        title="Density Correction Curve"
        description="Air temperature vs fuel density multiplier"
        icon={Thermometer}
        theme="cyan"
        error={validationError}
        liveXValue={isConnected ? realtime?.iat : null}
      />

          <div className="p-6 rounded-[32px] bg-neon-cyan/5 border border-white/5 flex gap-5 items-start">
            <div className="w-11 h-11 rounded-2xl bg-neon-cyan/10 flex items-center justify-center shrink-0 border border-neon-cyan/20">
              <Info className="text-neon-cyan" size={20} />
            </div>
            <div className="space-y-1.5">
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
      </div>
    </div>
  );
};

export default IATCorrection;
