# 12 — Delivery plan dan acceptance

## Tahapan implementasi

| Tahap | Deliverable | Gate sebelum lanjut |
| --- | --- | --- |
| 0 — Baseline | Snapshot source/INI/pairing, target OS/device matrix, feature checklist44 route | Firmware dan metadata yang diuji teridentifikasi |
| 1 — Pure domain | INI, binary codec, CRC, snapshot, project serializer/migrator, validators | Golden vectors dan round-trip file lulus tanpa hardware |
| 2 — Offline UI | Wizard, workspace, form/table/curve editor, pin model, settings | Tidak ada write implisit; draft/Save/Discard benar |
| 3 — Read-only ECU | Adapter USB, lease, handshake, compare/read, telemetry | Framing/freshness, detach/reconnect dan cancellation lulus |
| 4 — Managed write | Guarded RAM write/readback, Burn completion, restart tracking, calibration | Lost ACK/partial failure tidak memberi false success |
| 5 — Custom/tools | Performance UI, Drive Mode, legacy migration, terminal, firmware adapter | Token reconciliation, exclusivity, recovery dan capability gating |
| 6 — Bench/release | Device/OS matrix dan parity report tiap modul | Seluruh acceptance wajib terpenuhi atau gap dinyatakan eksplisit |

Bila suatu kemampuan platform belum tersedia, labeli unsupported dan jangan menyebut port keseluruhan sudah setara. Jangan menjadikan flash/USB-control-line yang belum teruji sebagai tombol aktif.

## A — Codec/protokol

- CRC32 `123456789` → CBF43926; semua command di [vectors](fixtures/protocol-vectors.json) identik byte-for-byte.
- Header/frame BE, tune fields LE, calibration header BE, signed values benar.
- Fragmentasi tiap byte, frame CRC split, error frame, trailing bytes, length0/>limit, short/long data semuanya ditangani sesuai kontrak.
- Cancellation menghapus timer/listener, menolak queued request lama, dan tidak merusak request baru.
- Timeout write tidak diubah menjadi sukses atau replay buta.

## B — Project/persistence

- Buka [fixture v5](fixtures/synthetic-project-v5.rynproj); digest dan page CRC/size benar.
- Flutter Save → desktop Open dan desktop Save → Flutter Open mempertahankan semua raw bytes termasuk reserved/custom page15.
- No-edit round-trip tidak mengubah tune. Unit/display changes tidak mengubah raw tune.
- Unicode, quote/escape, numeric-like keys, doubles dan pretty-vs-compact hash diuji.
- Schema1–4 dimigrasikan; future schema/corrupt base64/size/integrity ditolak tanpa mengganti workspace aktif.
- External file modification menolak overwrite; backup/temporary-write/rename/disk-full failures menjaga recovery path.
- Draft pada halaman lain, Project Settings belum Apply, close/back/switch project: Save/Discard/Cancel konsisten.

## C — Tuning/IO

- Matrix non-simetris, signed ignition, axis scaling dan AFR/Lambda transform tidak terbalik atau double-scale.
- Bitfield edit mempertahankan bit tetangga; invalid page berikutnya menolak plan sebelum write pertama.
- Pin ownership diuji pada setiap board/build yang didukung, fitur enabled/disabled, input/output fixed claims dan restart-required.
- Required fuel/divider/squirts cocok dengan source/tests, tidak menulis ulang VE tanpa intent.
- Raw field yang hilang tidak diam-diam diisi nilai aman palsu untuk upload.

## D — Telemetry/UI

- Golden167-byte packet memberi semua expected values; 166/168-byte responses ditolak.
- Zero tetap0; missing unknown; engine flags null bukan false. Requested/measured dwell terpisah.
- O2/VSS disabled, equal TPS endpoints, sensor limits, stale>2 detik dan blocked CRC tampil benar.
- Validation belum lolos tidak dapat di-bypass oleh sample dari operasi lain.
- Switch units/session/project mereset trace provenance; tidak ada synthetic duplicate samples.
- Dashboard edit offline, hidden/unknown widget, rapid settings save dan persistence failure berperilaku benar.
- Recording start/stop/source-change, max buffer, duration, CSV canonical units, escaping/BOM teruji.

## E — Lifecycle dan concurrency

Tahan sebuah await dengan fake transport, mulai intent lain, kemudian selesaikan await lama. Ulangi untuk:

1. Auto enumerate vs manual Connect.
2. Delayed Disconnect ACK vs Connect berikutnya.
3. Duplicate connected events vs handshake tunggal.
4. Boot delay/legacy probe vs cancel/error/new session.
5. Poll reply vs stop/start/new INI/reset.
6. Suspend/resume saat poll read masih in-flight.
7. Old operation finally vs operation baru/progress update.
8. Old session resume vs suspension session baru.
9. Reboot/flash preflight vs competing connect/disconnect/flash/reset.
10. Native close/data callback lama vs handle baru.
11. Project/INI/draft berganti saat read/upload/verify/save.
12. Drive Mode status failure lama vs status session baru.

Outcome wajib: satu pemilik, data lama dibuang, tidak ada write setelah context invalid, lock tidak tertinggal, cleanup tidak membuka polling yang seharusnya suspended, dan user Disconnect tidak dipulihkan otomatis.

## F — Write/calibration/Drive

- CRC compare→write→readback benar; Download terpisah dari disk Save.
- Burn ACK diikuti burnPending completion/readback. Timeout/CRC drift tidak verified.
- Restart-required dipersist sebelum kemungkinan write dan bertahan setelah lost ACK/restart app.
- Thermistor generator, O2 chunk boundary96, signed calibration values, partial CRC failure dan full restart calibration teruji.
- Drive select ditentukan status/token/appliedToken, bukan ACK saja; lost ACK tidak direplay.
- Legacy overlay tidak berjalan bersamaan dengan Drive Mode; rollback failure menjadi Unknown.

## Bench hardware

Gunakan ECU bench tanpa wiring kendaraan/output loads yang tidak diperlukan. Dokumentasikan board, firmware SHA, mobile OS/device, adapter/USB chip, supply dan kabel. Mulai read-only: identify, compare, telemetry, detach/replug. Lanjutkan guarded writes pada project test dengan before/after snapshot dan readback; lalu Burn/reboot/recovery serta physical power cycle terpisah.

Uji background/foreground, permission deny/revoke, cable removal saat read/write/Burn, app restart dan device yang sama muncul kembali. Native packaging check desktop hanya enumerates ports; itu tidak membuktikan adapter Flutter bekerja.

## Release evidence

Laporan parity menyertakan baseline source/INI hash, hasil pure Dart tests, golden fixture diffs, route/module checklist, platform capabilities, bench logs yang disanitasi, dan gap yang belum selesai. Pisahkan simulator/mock/desktop/real mobile hardware evidence.

Desktop suite terakhir saat handoff: 322 pass,0 fail,0 skip. Relevansi tes per area ada di [source map](14_SOURCE_MAP_AND_MAINTENANCE.md). Port test intent dan expected outcome; jangan menyalin tes yang hanya mencocokkan implementasi sendiri.
