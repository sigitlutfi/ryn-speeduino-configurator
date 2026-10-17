import React, { useMemo, useRef, useEffect, useState } from 'react'
import { useStore } from '../../core/store.js'
import { thermistorCalibration, oxygenCalibration } from '../../../shared/protocol/sensor-calibration.js'
import { sensorCalibrationOperation } from '../../core/services/sensorCalibration.js'

const REFERENCE_NTC = { bias: 2490, t1: -40, r1: 100700, t2: 30, r2: 2238, t3: 99, r3: 177 }
const LINEAR_O2 = { vMin: 0, afrMin: 10, vMax: 5, afrMax: 20 }

export function CalibrationTable({ sensor, title }) {
  const oxygen = sensor === 'o2'
  const saved = useStore(s => s.currentProject?.sensorCalibrations?.[sensor]?.parameters)
  const [params, setParams] = useState(() => ({ ...(saved || (oxygen ? LINEAR_O2 : REFERENCE_NTC)) }))
  const [result, setResult] = useState(null), [error, setError] = useState(null), [busy, setBusy] = useState(false), [progress, setProgress] = useState(0)
  const connection = useStore(s => s.connection), operation = useStore(s => s.operation)
  const epoch = useStore(s => s.projectEpoch)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const curve = useMemo(() => {
    try { return { table: oxygen ? oxygenCalibration(params) : thermistorCalibration(params) } }
    catch (error) { return { error: error.message } }
  }, [params, oxygen])
  useEffect(() => { setResult(null); setError(null) }, [epoch, connection.sessionId])
  useEffect(() => {
    const parameters = useStore.getState().currentProject?.sensorCalibrations?.[sensor]?.parameters
    setParams({ ...(parameters || (oxygen ? LINEAR_O2 : REFERENCE_NTC)) })
  }, [epoch, sensor, oxygen])
  const online = connection.status === 'connected' && connection.handshakeStatus === 'ok'
  const run = async write => {
    const session = connection.sessionId, projectEpoch = epoch
    const current = () => mounted.current && useStore.getState().projectEpoch === projectEpoch && useStore.getState().connection.sessionId === session
    setBusy(true); setError(null); setResult(null); setProgress(0)
    try {
      if (write && !curve.table) throw new Error(curve.error)
      const value = await sensorCalibrationOperation(useStore.getState, sensor, write ? curve.table.bytes : null, value => { if (current()) setProgress(value) })
      if (current()) {
        setResult({ ...value, matchesCurve: curve.table && value.crc === curve.table.crc })
        if (write) {
          const state = useStore.getState()
          state.updateProjectField?.(`sensorCalibrations.${sensor}`, { parameters: { ...params }, lastWrittenCRC: value.crc, lastWrittenAt: new Date().toISOString() })
        }
      }
    } catch (error) { if (current()) setError(error.message) }
    finally { if (mounted.current) setBusy(false) }
  }
  const input = (key, label) => <label key={key} className="flex flex-col gap-1 text-xs text-slate-300">
    {label}<input type="number" step="any" value={params[key]} disabled={busy}
      onChange={event => {
        const next = { ...params, [key]: event.target.value }
        setParams(next); setResult(null)
        useStore.getState().updateProjectField?.(`sensorCalibrations.${sensor}`, { parameters: next })
      }}
      className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-white disabled:opacity-50" />
  </label>
  const samples = curve.table?.samples || []
  const low = oxygen ? 0 : -40, high = oxygen ? 25.5 : 215
  const points = samples.map(p => `${p.adc / 1023 * 320},${110 - (p.value - low) / (high - low) * 100}`).join(' ')
  return <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 space-y-4" aria-label={`${title} calibration`}>
    <h3 className="text-sm font-bold text-white">{title}</h3>
    <p className="text-xs text-slate-400">{oxygen
      ? 'Enter the measured 0–5 V controller output curve. Initial 10–20 AFR values are an editable example, not a controller calibration.'
      : 'NTC sensor to ground with a pull-up resistor. Initial values are an editable reference; enter the actual sensor resistance points and board bias resistor.'}</p>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {oxygen ? [input('vMin', 'Low voltage (V)'), input('afrMin', 'AFR at low voltage'), input('vMax', 'High voltage (V)'), input('afrMax', 'AFR at high voltage')]
        : [input('bias', 'Bias resistor (Ω)'), ...[1, 2, 3].flatMap(i => [input(`t${i}`, `Point ${i}: °C`), input(`r${i}`, `Point ${i}: Ω`)])]}
    </div>
    <svg viewBox="0 0 320 120" className="h-32 w-full rounded-lg bg-black/25" role="img" aria-label={`${title} generated ECU lookup curve`}>
      <polyline points={points} fill="none" stroke="#67e8f9" strokeWidth="2" />
    </svg>
    <p className="text-xs text-slate-400">{oxygen ? 'ECU stores 32 points at ADC 0, 32, …, 992; readings above the final bin use its value.' : 'ECU stores 32 whole-degree points from ADC 0 to 1023. Temperatures outside −40…215°C are clamped.'}</p>
    {curve.error && <p role="alert" className="text-sm text-amber-300">{curve.error}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={!online || !!operation || busy} onClick={() => run(false)} className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-40">Read stored CRC</button>
      <button type="button" disabled={!online || !!operation || busy || !curve.table} onClick={() => run(true)} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">{busy ? `Calibration ${progress}%` : 'Write table and verify CRC'}</button>
    </div>
    <p className="text-xs text-slate-400">Writing requires the engine and output tests stopped, Drive Mode DEFAULT, and persists immediately to ECU EEPROM. Save/Burn in the toolbar applies only to tune fields. Reconnect and read CRC to check persistence.</p>
    <p className="text-xs text-slate-400">Calibration inputs are kept with the project when you save the project file. A stored CRC alone does not verify sensor accuracy.</p>
    {result && <p role="status" className={result.empty ? 'text-amber-300 text-sm' : 'text-cyan-200 text-sm'}>
      {result.empty ? 'Stored calibration is empty/uninitialized.' : result.verified ? 'Written and CRC verified.' : result.matchesCurve ? 'Stored CRC matches the displayed curve.' : 'Stored table differs from the displayed curve.'} CRC {result.crc.toString(16).toUpperCase().padStart(8, '0')}
    </p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </section>
}
