# Checklist pengiriman ke tim Flutter

Dokumentasi ini cukup untuk memulai implementasi dan menilai kesetaraan aplikasi bila disertai source baseline. Dokumen saja tidak menggantikan codec, metadata, fixture dan tes yang dirujuk. Implementasi Flutter serta adapter mobile belum dibangun atau diuji dalam repository ini.

## Isi paket wajib

- [Seluruh dokumentasi](README.md), termasuk tools generator dan semua fixtures.
- Seluruh `src/`, `test/`, `speeduino.ini`, `compatibility/`, `scripts/`, `package.json`, `bun.lock`, konfigurasi Vite/Forge/PostCSS/Tailwind yang tersedia, serta panduan root yang dipertahankan. Snapshot repository lengkap tanpa data lokal adalah pilihan yang paling mudah direproduksi.
- Source firmware pasangan sesuai commit pada `compatibility/firmware.json`, atau akses repository beserta commit tersebut. Jika ada perubahan lokal firmware yang menjadi bagian baseline, sertakan snapshot dan catat perbedaannya.
- [Manifest source](fixtures/source-manifest.json) dan [manifest project fixture](fixtures/project-fixture-manifest.json). Cocokkan hash dengan file yang benar-benar dikirim.
- Catatan hasil validasi software dan hasil bench yang benar-benar dilakukan, terpisah dari acceptance yang masih harus dikerjakan.

Baseline app adalah HEAD **ditambah working tree** yang didokumentasikan. `git archive HEAD` atau clone remote saja belum cukup untuk mereproduksinya. Bekukan snapshot bersama sebelum tim mulai mengubah source. Jangan menyertakan `node_modules/`, `.cache/`, `out/`, `.git/`, konfigurasi pribadi, atau project/tune pengguna di `proj/`. Fixture sintetis dalam `docs/fixtures/` tetap disertakan.

## Keputusan awal bersama tim

| Keputusan | Yang perlu disepakati |
| --- | --- |
| Target platform | Android terlebih dahulu atau juga iOS; versi OS minimum dan perangkat uji |
| Transport | USB OTG/host, chipset USB serial aktual, izin, attach/detach dan driver; uji perangkat fisik sebelum mengunci adapter |
| Firmware tooling | Apakah flashing/reset EEPROM masuk rilis pertama; kemampuan tiap platform harus dibuktikan |
| UI | Layout sentuh dan navigasi boleh disesuaikan, sedangkan nilai, unit, guard dan makna operasi harus setara |
| Delivery | Milestone, pemilik acceptance hardware, distribusi build dan commit/snapshot baseline yang sama |

Pilihan library/state management Flutter masih usulan arsitektur, bukan dependency mobile yang sudah divalidasi. Lihat [batas platform](11_MOBILE_PLATFORM_AND_FIRMWARE.md).

## Bukti yang harus diterima sebelum menyebut port selesai

1. Jalankan golden protocol/telemetry vectors di Dart dan buktikan raw-byte serta CRC/endian setara.
2. Buka dan simpan fixture project schema 5 lintas desktop–Flutter tanpa merusak page buffers, reserved bytes, embedded INI atau integrity.
3. Cocokkan seluruh route/fitur dan conditional controls dengan [reference source](13_GENERATED_REFERENCE.md), termasuk lima fitur custom dan editor legacy.
4. Lulus [acceptance](12_DELIVERY_AND_ACCEPTANCE.md): sinkronisasi, write/readback/Burn, reconnect, reboot, lifecycle mobile, race conditions, telemetry freshness dan kegagalan file/serial.
5. Bench dengan ECU/USB sebenarnya; rekam build firmware, board, perangkat mobile dan hasil. Reboot desktop yang sudah dilaporkan berhasil tidak membuktikan seluruh fitur ECU atau port Flutter sudah lolos.

Dokumen historis audit/fix di root telah digabungkan ke panduan yang dipelihara. Gunakan [source map](14_SOURCE_MAP_AND_MAINTENANCE.md) untuk menemukan implementasi dan regression tests, lalu perbarui narasi dan fixtures bila kontrak berubah.
