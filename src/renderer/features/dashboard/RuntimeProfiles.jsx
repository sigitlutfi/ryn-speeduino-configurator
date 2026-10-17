import React, { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { ROUTES } from '../../routes.js'
import { useStore } from '../../core/store.js'
import {
  DRIVE_MODES,
  DRIVE_REASONS,
  decodeDriveConfig,
  encodeDriveConfig
} from '../../../shared/protocol/drive-modes.js'
import { decodePageSnapshot } from '../../../shared/protocol/page-cache.js'

export default function RuntimeProfiles() {
  const [, navigate] = useLocation()
  const project = useStore((s) => s.currentProject)
  const connection = useStore((s) => s.connection)
  const epoch = useStore((s) => s.projectEpoch)
  const operation = useStore((s) => s.operation)
  const status = useStore((s) => s.driveModeStatus)
  const telemetry = useStore((s) => s.realtime)
  const receivedAt = useStore((s) => s.realtimeReceivedAt)
  const read = useStore((s) => s.readDriveModeStatus)
  const select = useStore((s) => s.selectDriveMode)
  const stageFields = useStore((s) => s.updateProjectFieldDrafts)
  const fieldDrafts = useStore((s) => s.fieldDrafts)
  const discardFields = useStore((s) => s.discardProjectFieldDrafts)
  const upload = useStore((s) => s.uploadDriveModeConfig)
  const saveProject = useStore((s) => s.saveProject)
  const notify = useStore((s) => s.notify)
  const [config, setConfig] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const raw = project?.constants?.pages?.[15]?.rawData
  const supported = project?.ini?.signature === 'speeduino 202504-ryn-perf-v5'
  const connected = connection.status === 'connected'
  useEffect(() => {
    try {
      const bytes = decodePageSnapshot(project?.constants?.pages?.[15]).subarray(106, 124)
      const decoded = decodeDriveConfig(bytes)
      const drafts = useStore.getState().fieldDrafts?.[15] || {}
      decoded.maxTPS = drafts.driveMaxTPS ?? decoded.maxTPS
      ;['Eco', 'Racing', 'Extreme'].forEach((name, i) => {
        for (const key of ['fuel', 'ignition', 'features'])
          decoded.presets[i][key] =
            drafts[`drive${name}${key[0].toUpperCase()}${key.slice(1)}`] ?? decoded.presets[i][key]
      })
      setConfig(decoded)
      setError('')
    } catch {
      setConfig(decodeDriveConfig(encodeDriveConfig()))
      setError('Preset belum diinisialisasi. Simpan preset netral sebelum upload.')
    }
    setDirty(false)
  }, [raw, epoch])
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (supported && connected && !operation) read().catch(() => {})
  }, [epoch, connection.sessionId, connected, supported])
  const fresh =
    connected &&
    status?.session === connection.sessionId &&
    status?.epoch === epoch &&
    now - status.receivedAt < 2500
  const stopped =
    connected &&
    now - receivedAt < 2000 &&
    telemetry?.rpm === 0 &&
    !telemetry?.engine?.running &&
    !telemetry?.engine?.cranking
  const busy = !!operation
  const hasDrafts = Object.keys(fieldDrafts?.[15] || {}).some((name) => name.startsWith('drive'))
  const act = async (action) => {
    try {
      setError('')
      await action()
    } catch (e) {
      setError(e.message)
      notify(e.message, 'error', 5000)
    }
  }
  const stage = (next) => {
    setConfig(next)
    setDirty(true)
    const fields = { driveMagicD: 68, driveMagicM: 77, driveVersion: 1, driveMaxTPS: next.maxTPS }
    ;['Eco', 'Racing', 'Extreme'].forEach((name, i) => {
      for (const key of ['fuel', 'ignition', 'features'])
        fields[`drive${name}${key[0].toUpperCase()}${key.slice(1)}`] = next.presets[i][key]
      fields[`drive${name}Reserved`] = 0
    })
    try {
      fields.driveCRC = encodeDriveConfig(next).readUInt16LE(16)
    } catch {
      fields.driveCRC = 0
    }
    stageFields({ 15: fields })
  }
  const edit = (index, key, value) =>
    stage({
      ...config,
      presets: config.presets.map((preset, i) =>
        i === index ? { ...preset, [key]: value } : preset
      )
    })
  const button =
    'rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm disabled:opacity-35 hover:bg-white/10'
  return (
    <div className="h-full overflow-y-auto p-8 space-y-6 text-white">
      <div>
        <div className="text-xs uppercase tracking-widest text-neon-cyan">ECU Drive Mode</div>
        <h1 className="text-2xl font-bold mt-2">Mode berkendara</h1>
        <p className="text-sm text-white/60 mt-3">
          Pilih saat berkendara, lalu lepaskan gas. ECU menerapkan mode pada TPS ≤{' '}
          {config?.maxTPS ?? 5}% dan RPM ≤ 6000 setelah cranking dan proteksi selesai. Permintaan
          batal setelah 3 detik.
        </p>
      </div>
      {!supported && (
        <p className="rounded-xl border border-amber-400/30 p-4 text-amber-200">
          Perbarui firmware dan INI proyek ke perf-v5. Preset tabel dari versi lama tetap tersimpan
          sebagai data tuning lama; tidak dikonversi otomatis.
        </p>
      )}
      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
        <div className="flex justify-between items-center gap-4">
          <div>
            <span className="text-white/50 text-sm">Aktif di ECU: </span>
            <strong>{fresh ? DRIVE_MODES[status.active] : 'Belum terkonfirmasi'}</strong>
            {fresh && status.state === 1 && (
              <p className="text-amber-200 text-sm mt-2">
                Menunggu {DRIVE_MODES[status.requested]} ·{' '}
                {DRIVE_REASONS[status.reason] || 'Memeriksa kondisi'}
              </p>
            )}
            {fresh && status.state === 2 && (
              <p className="text-amber-200 text-sm mt-2">{DRIVE_REASONS[status.reason]}</p>
            )}
          </div>
          <button
            className={button}
            disabled={!supported || !connected || busy}
            onClick={() => act(read)}
          >
            Baca status ECU
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {DRIVE_MODES.map((mode, i) => (
            <button
              key={mode}
              className={`${button} ${fresh && status.active === i ? 'border-cyan-400 text-cyan-200' : ''}`}
              aria-pressed={fresh && status.active === i}
              disabled={!supported || !connected || busy || (i !== 0 && (dirty || hasDrafts))}
              onClick={() => act(() => select(i))}
            >
              {mode}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/50">
          Switch hanya mengirim pilihan mode. Tidak mengunggah tabel atau burn. ECU mempertahankan
          mode ketika USB terputus dan kembali DEFAULT setelah restart.
        </p>
        {fresh && (
          <p className="text-sm text-white/60">
            Efektif: fuel {status.fuel}% · ignition {status.ignition > 0 ? '+' : ''}
            {status.ignition}° ·{' '}
            {status.valid ? 'Konfigurasi valid' : 'Konfigurasi perlu diperbaiki'}
          </p>
        )}
      </section>
      {config && (
        <section className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-5">
          <h2 className="font-semibold">Preset ECU</h2>
          <p className="text-sm text-white/60">
            Semua mode memakai tabel dasar yang sama. Preset awal netral: 100%, 0°. Izin fitur hanya
            membatasi ALS/Rumble/Pop &amp; Bang yang sudah dikonfigurasi; Pit Limiter dan proteksi
            mesin selalu berlaku.
          </p>
          <label className="flex gap-3 items-center text-sm">
            TPS maksimum saat switch (%)
            <input
              aria-label="TPS maksimum saat switch"
              type="number"
              min="0"
              max="20"
              disabled={busy}
              value={config.maxTPS}
              onChange={(e) => {
                stage({ ...config, maxTPS: Number(e.target.value) })
              }}
              className="w-20 rounded bg-white/10 p-2"
            />
          </label>
          <div className="grid md:grid-cols-3 gap-4">
            {config.presets.map((preset, i) => (
              <div key={i} className="rounded-xl border border-white/10 p-4 space-y-3">
                <h3 className="font-semibold text-cyan-200">{DRIVE_MODES[i + 1]}</h3>
                {[
                  ['fuel', 'Fuel (%)', 80, 120],
                  ['ignition', 'Ignition offset (°)', -10, 10]
                ].map(([key, label, min, max]) => (
                  <label key={key} className="flex items-center justify-between gap-2 text-sm">
                    {label}
                    <input
                      aria-label={`${DRIVE_MODES[i + 1]} ${label}`}
                      type="number"
                      min={min}
                      max={max}
                      disabled={busy}
                      value={preset[key]}
                      onChange={(e) => edit(i, key, Number(e.target.value))}
                      className="w-20 bg-white/10 rounded p-2"
                    />
                  </label>
                ))}
                {[
                  [1, 'ALS'],
                  [2, 'Rumble Idle'],
                  [4, 'Pop & Bang']
                ].map(([bit, label]) => (
                  <label key={bit} className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={!!(preset.features & bit)}
                      onChange={(e) =>
                        edit(
                          i,
                          'features',
                          e.target.checked ? preset.features | bit : preset.features & ~bit
                        )
                      }
                    />
                    Izinkan {label}
                  </label>
                ))}
              </div>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              className={button}
              disabled={!supported || busy}
              onClick={() =>
                act(async () => {
                  if (
                    !Object.keys(fieldDrafts?.[15] || {}).some((name) => name.startsWith('drive'))
                  )
                    stage(config)
                  const result = await saveProject()
                  if (!result.ok) throw new Error(result.error)
                  setDirty(false)
                })
              }
            >
              Simpan preset ke proyek{dirty || hasDrafts ? ' *' : ''}
            </button>
            {(dirty || hasDrafts) && (
              <button
                className={button}
                disabled={busy}
                onClick={() => {
                  discardFields({
                    15: Object.keys(fieldDrafts?.[15] || {}).filter((name) =>
                      name.startsWith('drive')
                    )
                  })
                  try {
                    setConfig(
                      decodeDriveConfig(
                        decodePageSnapshot(project.constants.pages[15]).subarray(106, 124)
                      )
                    )
                  } catch {
                    setConfig(decodeDriveConfig(encodeDriveConfig()))
                  }
                  setDirty(false)
                  setError('')
                }}
              >
                Batal perubahan
              </button>
            )}
            <button
              className={button}
              disabled={!supported || !stopped || busy || dirty || hasDrafts}
              onClick={() =>
                act(async () => {
                  await upload()
                  notify(
                    'Preset diverifikasi di RAM ECU. Gunakan Burn untuk menyimpannya setelah power cycle.',
                    'success',
                    5000
                  )
                })
              }
            >
              Upload preset ke RAM · mesin berhenti
            </button>
          </div>
          <p className="text-xs text-white/50">
            Penyetelan preset memerlukan pengujian tune. Upload hanya pada DEFAULT dan mesin
            berhenti. Burn tetap tindakan terpisah untuk penyimpanan permanen.
          </p>
        </section>
      )}
      <details className="rounded-xl border border-white/10 p-4 text-sm text-white/60">
        <summary>Preset tabel dari versi lama</summary>
        <p className="mt-3">
          VE2, Spark2, AFR dan opsi profil lama tetap disimpan. Data ini terpisah dari preset ECU
          ringkas dan tidak diterapkan oleh tombol mode berkendara.
        </p>
        <button
          className={`${button} mt-3`}
          onClick={() => navigate(ROUTES.RACING_PROFILE_EDITOR.replace(':profileId', 'eco'))}
        >
          Buka editor preset lama
        </button>
      </details>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-amber-400/30 p-4 text-sm text-amber-200"
        >
          {error}
        </p>
      )}
    </div>
  )
}
