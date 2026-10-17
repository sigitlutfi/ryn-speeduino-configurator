# 01 — Lingkup dan arti setara

## Produk

RYN Configurator memungkinkan pengguna membuat/membuka project, mengedit konfigurasi/kurva/tabel, melihat mesin secara realtime, menyinkronkan tune dengan RAM ECU, Burn ke EEPROM, mengalibrasi sensor dan memakai fitur racing/Drive Mode. Desktop memakai Electron/React dengan domain logic JavaScript. Port Flutter harus mereplikasi perilaku domain tersebut, bukan sekadar menampilkan halaman serupa.

Aplikasi tetap berguna offline untuk project dan editor. Offline tidak boleh mengklaim bahwa RAM atau EEPROM ECU sudah sesuai.

## Baseline

| Item | Acuan |
| --- | --- |
| Pairing firmware | `compatibility/firmware.json`, signature perf-v5 |
| INI | Bundled `speeduino.ini`; embedded INI pada project |
| Tune pages | 1–15; page 0 bukan active tune page |
| Telemetry paired | 167 byte, diminta melalui `r` |
| Project | JSON UTF-8 schema 5, raw pages base64, SHA-256 integrity |
| Hardware yang diuji | ATmega2560; board pilihan termasuk UA4C layout 41 |
| Desktop transport | SerialPort, umumnya 115200 baud |
| Desktop firmware tool | avrdude, ATmega2560/wiring, HEX terpilih |

UA4C tidak berarti semua firmware build memiliki jumlah channel sama. Project menyimpan `hardware.pinMapPlatform` dan `hardware.channelBuild`. Kontrak pin dan build harus direview bersama firmware.

## Lingkup replikasi

| Area | Target |
| --- | --- |
| Project | Create/open/save/save-as, recent, migrasi, integritas, backup, restore dan konflik file |
| Tune | Seluruh field, tabel dan kurva pada route terpasang; editor metadata dan validasi |
| Serial | Device enumerate/open/close, bootstrap, framed commands, pembatalan dan timeout |
| Sync | Compare, read baseline, RAM write/readback, Burn completion dan verify |
| Realtime | Nilai/unit benar, missing/disabled/stale/blocked, widget editor, recording/CSV |
| IO | Board/build, pin occupancy, reservasi, field aktif dan restart tracking |
| Custom | Pit limiter, rumble idle, ALS, rolling pop & bang, Drive Mode |
| Tools | Kalibrasi, raw console, protocol stats, firmware flash, EEPROM/USB reset |
| Preferensi | Unit per project, tema/accent/background, dashboard layout |

Catat status tiap area: `belum`, `parsial`, `setara offline`, `setara mock`, `setara bench`. Layar yang sudah tampil belum otomatis setara fungsional.

## Keputusan platform yang belum ditentukan

Belum dipilih: target Android/iOS, minimum OS, plugin USB, chip USB–serial yang didukung, Wi-Fi/BLE bridge, metode flash mobile, dan distribusi app. Dokumen 11 menjelaskan kebutuhan adapter dan acceptance. Jangan menganggap kemampuan tersebut sudah tersedia.

Firmware/INI lain hanya dianggap didukung setelah gate kontrak dan pengujian. Signature sama pun belum cukup bila metadata offset/shape berbeda. Paket ini tidak menjanjikan dukungan seluruh versi Speeduino/upstream.

## Definisi selesai

Fixture codec dan project round-trip harus lolos; semua alur write terverifikasi; telemetry memiliki kualitas/unit benar; race/failure scenarios lolos; lalu bench hardware membuktikan perilaku platform mobile. Tampilan boleh berbeda selama tindakan dan konsekuensinya sama.

Rujukan: [pairing](../compatibility/firmware.json), [routes](../src/renderer/routes.js), [contract guard](../src/shared/protocol/contract.js), [acceptance](12_DELIVERY_AND_ACCEPTANCE.md).
