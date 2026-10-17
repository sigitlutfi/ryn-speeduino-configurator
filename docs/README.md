# RYN Configurator — Panduan replikasi Flutter

Paket ini ditujukan kepada tim mobile yang membangun ulang RYN Speeduino Configurator dari alur pengguna sampai komunikasi ECU dan penyimpanan project. Baseline: **18 Oktober 2026, Asia/Jakarta**. Nama field, command dan status mengikuti source agar mudah ditelusuri.

## Urutan baca

| Urutan | Dokumen | Hasil yang diharapkan |
| --- | --- | --- |
| 1 | [Lingkup dan kesetaraan](01_SCOPE_AND_PARITY.md) | Batas produk, baseline dan definisi selesai |
| 2 | [Arsitektur Flutter](02_FLUTTER_ARCHITECTURE.md) | Pemisahan domain, adapter dan ownership |
| 3 | [Fitur dan alur pengguna](03_FEATURES_AND_USER_FLOWS.md) | Layar, tindakan, dialog, kondisi sukses/gagal |
| 4 | [Project dan persistence](04_PROJECT_AND_PERSISTENCE.md) | File v5, integritas, migrasi, Save/RAM/Burn |
| 5 | [INI dan model biner](05_INI_AND_BINARY_MODEL.md) | Metadata, scaling, bitfield, tabel dan reserved bytes |
| 6 | [Serial dan protokol](06_SERIAL_PROTOCOL.md) | Framing, endian, CRC, command dan timeout |
| 7 | [Koneksi dan sinkronisasi](07_CONNECTION_SYNC_AND_RECOVERY.md) | Handshake, compare, upload, Burn, reset dan race conditions |
| 8 | [Telemetry dan widget](08_TELEMETRY_WIDGETS_LOGGING.md) | Decode, kualitas, unit, preset, trace dan CSV |
| 9 | [Tuning, pin dan kalibrasi](09_TUNING_IO_AND_CALIBRATION.md) | Editor, validasi dan calibration tables |
| 10 | [Custom features dan Drive Mode](10_CUSTOM_FEATURES_AND_DRIVE_MODE.md) | Lima fitur custom serta legacy preset |
| 11 | [Mobile dan firmware](11_MOBILE_PLATFORM_AND_FIRMWARE.md) | Adapter USB/file/lifecycle/flash dan batas platform |
| 12 | [Delivery dan acceptance](12_DELIVERY_AND_ACCEPTANCE.md) | Tahapan kerja, tes kesetaraan dan release gate |
| Referensi | [Ekstraksi source](13_GENERATED_REFERENCE.md) | 44 route, page sizes, literal field, tabel dan 272 channel definitions |
| Referensi | [Peta source](14_SOURCE_MAP_AND_MAINTENANCE.md) | Sumber implementasi, tes dan pemeliharaan handoff |

## Cara menggunakan

Sebelum mengirim ke tim mobile, ikuti [checklist handoff](HANDOFF_CHECKLIST.md): paket harus memuat snapshot source dan kontrak yang sama dengan dokumen ini, serta keputusan platform yang masih terbuka.

1. Baca 01–07 sebelum mengimplementasikan write ke ECU.
2. Implementasikan codec terlebih dahulu; jalankan [golden vectors](fixtures/protocol-vectors.json) di Dart.
3. Gunakan [project sintetis](fixtures/synthetic-project-v5.rynproj) untuk open/save lintas desktop–Flutter. Ini fixture parsing, **bukan tune kendaraan**. [Manifest](fixtures/project-fixture-manifest.json) merekam hash file.
4. Jalankan acceptance dokumen 12 sebelum menyebut modul setara.
5. Regenerasi referensi saat source berubah, lalu tinjau narasi secara manual. Generator tidak memperbarui aturan bisnis otomatis.

## Kontrak dan usulan

- **Wajib setara:** bytes protokol, metadata firmware, nilai/unit, project, ownership transaksi, makna Save/RAM/Burn, kualitas telemetry, serta keputusan yang memicu write.
- **Boleh disesuaikan:** navigasi sentuh, layout, state-management Flutter dan komposisi widget.
- **Usulan mobile:** arsitektur/adapter pada dokumen 02/11. Belum ada implementasi Flutter teruji dalam repository ini.
- **Sumber kebenaran:** kode dan tes working tree. Komentar historis di source bisa tertinggal dari implementasi; gunakan kontrak aktif, fixture dan tes untuk memverifikasi ukuran, schema dan endian.

Firmware pasangan: `speeduino 202504-ryn-perf-v5`, commit `139eee865fa7743cf9812656e9564da82f79db25`. App HEAD `4284293804c38010e7126d81c10dd8e0c94737e4` **ditambah perubahan working tree**. Menyalin HEAD saja tidak mencakup semua perbaikan yang didokumentasikan. [Source manifest](fixtures/source-manifest.json) merekam hash source/test/contract pada working tree. Tim perlu menerima snapshot source lengkap atau commit handoff tersendiri.

Baseline terbaru memakai project schema **5**, telemetry perf-v5 **167 byte**, dan modern framed responses dengan CRC. Validasi desktop terakhir sebelum penulisan docs: **322 tes lulus**. Pengguna juga telah melaporkan reboot hardware berhasil. Itu bukan bukti kesetaraan Flutter; perangkat mobile tetap perlu diuji.
