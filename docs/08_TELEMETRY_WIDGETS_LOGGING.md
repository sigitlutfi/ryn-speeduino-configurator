# 08 — Telemetry, widgets dan logging

## Decode canonical

Paired firmware meminta full block **167 byte** dari `ochGetCommand`. Tolak short/oversized payload sebelum decoding; jangan zero-fill. Fixed legacy decoder bukan fallback bebas untuk current packet. Gunakan INI metadata dan mapping `output-channels.js`.

| Canonical key | Makna/konversi penting |
| --- | --- |
| rpm, map, tps | rpm, kPa, %; TPS scaled, dapat out-of-range |
| coolant/clt, iat, fuelTemp | Raw temperature channel dikurangi 40 → °C |
| battery/vbatt, afr | Metadata scale → V dan AFR |
| advance | Signed ignition advance dalam derajat |
| pw1 | Pulse width ms, bukan angka raw mikrodetik |
| dwell / dwellActual | Requested vs measured ms; dua channel berbeda |
| fuelLoadRaw, ignLoadRaw | Signed S16; algorithm menentukan interpretasi |
| vss, gear, baro | km/h, gear, kPa; availability mengikuti konfigurasi |
| freeRAM, loopsPerSecond, syncLossCounter | Bytes, loop/s, counter aktual |
| engine/performance | Boolean nullable; missing bukan false |
| driveMode | Tail byte 152–166, 15-byte structure tervalidasi |

Fuel-load display mengikuti algorithm: MAP, Alpha-N/TPS, atau IMAP/EMAP. TPS internal load dapat memakai skala 0–400 dan harus dibagi 4. Jangan selalu memakai MAP sebagai load highlight tabel.

[Golden packet](fixtures/protocol-vectors.json) memeriksa rpm 4321, MAP 163, TPS 73.5%, CLT 87°C, IAT 15°C, battery 14.2 V, AFR 14.7, advance -12°, pw1 12.345 ms, dwell 3.15/2.75 ms dan signed loads negatif.

## Freshness dan kualitas

- Session connected + handshake ok + validation ready/review diperlukan untuk publikasi data.
- Tidak ada sample: waiting. Age >2000 ms: stale. Disconnected: offline. Decoder/validation error: blocked.
- Nol valid tetap **0**. Missing/NaN/unknown tampil unavailable/`—`, bukan 0 atau OFF.
- `egoType=0` membuat AFR unavailable; VSS disabled membuat speed/gear unavailable; gear 0 berarti belum terdeteksi sesuai registry.
- TPS endpoints sama atau TPS di luar 0–100 ditandai CHECK. Suhu -40/215 adalah sensor-limit check, bukan bukti suhu mesin nyata.
- Partial multi-value/status widget mempertahankan bagian yang diketahui; unknown flags tidak diklaim false.
- Jangan membuat universal AFR/TPS danger band. RPM warning/danger mengikuti protection config yang relevan.

Last packet timestamp dapat ditampilkan offline, tetapi angka lama tidak diiklankan LIVE. Observed Hz memakai window arrival 2 detik/maksimal 20 timestamp. Session/project change menghapus rate dan provenance.

## Unit

Raw/canonical storage tetap °C, kPa, km/h, ms. Display: °F=`C*9/5+32`; psi=`kPa*0.145038`; bar=`kPa/100`; mph=`kmh*0.621371`. Konversi tepat sekali. Pressure precision registry: kPa 0, psi 1, bar 2 decimal. CSV tetap canonical meskipun UI memakai unit lain.

## Dashboard

Preset default: Tune, Street, Diag. Layout schema v2 menyimpan `activePresetId` dan list preset; widget memiliki `id`, `type`, `channelKey`, `color`, `enabled`, `span`.

Types: digital/gauge/trace/status; kemampuan tiap channel tidak sama. Editor mendukung tambah/hapus, pindah urutan, hide/show, channel, style, warna dan span. Hidden widget tetap dapat diedit. Unknown channel lama dipertahankan agar bisa diperbaiki; malformed IDs/style diperbaiki tanpa menghapus layout valid. Default settings harus di-clone, bukan dimutasi bersama.

Registry mencakup engine/fuel/spark/thermal/electrical/diagnostic metrics, fuelLoad, thermalPair, engineState, protectState, performanceState dan driveMode. Semua halaman memakai registry/kualitas yang sama.

Visual mobile boleh menyesuaikan layout. Tetap tampilkan label, unit, precision, status kualitas, reason unavailable dan configured range secara terbaca. Gauge perlu batas/tanda threshold yang benar, termasuk low-warning; style tidak boleh menyembunyikan nilai outlier.

## Trace dan recording

Trace menambah satu titik per packet timestamp, bukan timer render. Baseline window 30 detik, maksimum 600 titik, gap saat stale, auto-range menyertakan outlier. Reset history saat source/unit berganti. Resize/rotation tidak mengubah data.

Recording hanya mulai pada live telemetry, buffer maksimum 10.000 entries. Stop otomatis saat source/session berubah atau telemetry dibersihkan; waktu/durasi tetap konsisten saat pindah halaman. Setiap entry mencatat timestamp dan source project/session/firmware serta metadata sensor yang relevan.

CSV desktop: UTF-8 BOM pada download, CRLF, escaped commas/quotes/newlines, boolean 1/0, missing kosong. String berawalan formula diberi apostrophe. Kolom mencakup timestamp_utc, session_id, project, firmware, canonical metrics, requested/measured dwell, engine flags, drive_mode dan sensor-quality flags. Urutan persis ada di `telemetry-log.js`; pakai golden export untuk uji mobile.

Rujukan: [decoder](../src/shared/protocol/output-channels.js), [registry](../src/renderer/features/dashboard/widgets/telemetry-channels.js), [presets](../src/renderer/features/dashboard/widgets/widgetPresets.js), [store](../src/renderer/core/store/realtimeSlice.js), [CSV](../src/shared/protocol/telemetry-log.js), [plot](../src/shared/protocol/telemetry-plot.js).
