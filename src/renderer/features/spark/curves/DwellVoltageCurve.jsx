import React from 'react'
import IniCurvePanel from '../../shared/components/IniCurvePanel.jsx'

export default function DwellVoltageCurve() {
  return <IniCurvePanel xName="brvBins" yName="dwellRates" title="Dwell Voltage Correction" theme="purple" />
}
