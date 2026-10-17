import React, { useEffect, useState } from 'react'
import { useStore } from '../core/store.js'

const LABELS = { pinLayout: 'Board layout', nCylinders: 'Jumlah silinder', reqFuel: 'Required Fuel',
  twoStroke: 'Siklus mesin', engineType: 'Pola penyalaan', alternate: 'Timing injektor' }

export default function ECURestartNotice() {
  const pending = useStore(s => s.currentProject?.hardware?.restartRequired)
  const connection = useStore(s => s.connection)
  const operation = useStore(s => s.operation)
  const verify = useStore(s => s.verifyECUPowerCycle)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setError('') }, [pending])
  if (!pending) return null
  const burned = pending.fields.every(field => pending.burnedPages.includes(field.page))
  const reconnected = connection.status === 'connected' && connection.lastConnectedAt && connection.lastConnectedAt !== pending.connectedAt
  return <aside aria-label="ECU setup menunggu restart" className="shrink-0 border-y border-amber-300/20 bg-amber-300/10 px-5 py-3 text-xs text-amber-100">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{burned ? 'Menunggu power cycle dan verifikasi ECU' : 'Setup berubah — selesaikan Burn sebelum power cycle'}</p>
        <p className="text-amber-100/75">{pending.fields.map(field => LABELS[field.name] || field.name.replace(/([A-Z])/g, ' $1')).join(', ')}</p>
        <p className="text-amber-100/75">Pemetaan yang ditampilkan adalah konfigurasi tujuan. Burn, matikan/nyalakan ECU, lalu reconnect dan verifikasi. Menghubungkan ulang serial saja tidak menerapkan setup baru.</p>
      </div>
      <button type="button" disabled={busy || !!operation || !burned || !reconnected} className="rounded-lg border border-amber-200/30 px-3 py-2 font-semibold disabled:opacity-40"
        onClick={async () => { setBusy(true); setError(''); try { const result = await verify(); if (!result.ok) setError(result.error) } finally { setBusy(false) } }}>
        {busy ? 'Memverifikasi…' : 'ECU sudah di-power-cycle — verifikasi'}
      </button>
    </div>
    {error && <p role="alert" className="mt-2 text-rose-200">{error}</p>}
  </aside>
}
