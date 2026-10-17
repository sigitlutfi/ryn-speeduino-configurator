# 11 — Adapter mobile dan firmware tools

Bagian ini memisahkan kemampuan desktop yang sudah ada dari keputusan platform Flutter yang belum diimplementasikan. Tidak ada plugin USB/flash mobile yang dipilih atau dibuktikan oleh paket docs ini.

## Capability matrix yang harus diselesaikan tim

| Kemampuan | Desktop | Acceptance mobile |
| --- | --- | --- |
| Enumerate/open/close serial | SerialPort | Device yang diuji, permission grant/deny, unplug/replug |
| Baud/RX/TX/drain | Native serial queue | Params tepat, write completion dan stream fragmentasi |
| DTR/RTS | `port.set` | Adapter benar-benar mendukung; unsupported ditampilkan jelas |
| Firmware flash | Bundled/env avrdude | Tool/bootloader implementation platform yang diuji |
| File Save/backup/revision | Native filesystem | Document provider/internal storage dengan hasil terverifikasi |
| Realtime saat app background | Desktop window lifecycle | Kebijakan pause/disconnect/service yang eksplisit |
| Export CSV | Blob download desktop | File/share adapter tanpa mengubah unit/escaping |

Jika Android dipilih, USB-host permission, chipset/driver dan lifecycle device perlu bench test. Jika iOS dipilih, aksesori/transport yang benar-benar tersedia harus dibuktikan sebelum menjanjikan USB setara. Wi-Fi/BLE bridge bukan bagian wire contract desktop ini; bila ditambahkan, harus menjaga ordered byte stream dan cancellation semantics, bukan diasumsikan langsung setara.

## App lifecycle

Coordinator berada di service/domain, bukan hidup-mati mengikuti satu layar. Navigation tidak boleh membuat polling/handshake duplikat. Background/foreground, rotation, screen lock, device detach dan permission revoke harus memiliki state transition deterministik. Setelah resume, validasi ulang connection/freshness; cached UI tidak menjadi bukti ECU masih sama.

Kebijakan awal mobile dapat menghentikan polling dan membatalkan transaksi saat background jika platform tidak menjamin layanan. Itu keputusan produk yang harus diuji/dijelaskan, bukan diam-diam membiarkan operasi menggantung. Jangan melanjutkan write parsial otomatis sesudah proses OS dimatikan.

## Flash dan EEPROM reset

Desktop memilih HEX lalu menjalankan avrdude target `atmega2560`, programmer `wiring`, baud115200, selected port, dan flash operation yang terlihat pada `src/main/index.js`. Tool dapat berasal dari bundle/env; hasil sukses memerlukan exit tool yang valid, bukan sekadar progress100.

EEPROM reset adalah aksi destruktif terpisah atau pilihan saat flash, menggunakan blank EEPROM image. Preserve/default mode tidak sama dengan reset. Confirmation menampilkan tindakan/target yang benar. Mobile harus mereplikasi command/bootloader behavior melalui adapter yang dibuktikan; tidak dapat mengandalkan file executable Windows pada Android/iOS.

Reserve native operation sejak awal sebelum await close/tool startup. Tutup serial handle sebelum tool mengambil port. Error, stdout/stderr/progress dan completion dibedakan. Device flash success diikuti reconnect/handshake/compare/fresh telemetry; kegagalan reconnect tidak boleh ditulis sebagai flash pasti gagal, dan sebaliknya.

## USB reset

Desktop menggunakan DTR=false/RTS=true → tunggu120 ms → DTR=true/RTS=false → tunggu250 ms → close, lalu recovery. Pulsa hanya berfungsi bila hardware reset circuit mendukungnya. Selected port harus sama dengan active verified physical handle. Tanpa control-line capability, tampilkan unavailable dan petunjuk restart manual.

Reset USB bukan supply power-off. Pending tune harus Burn dahulu; engine/test/Burn checks pada dokumen07 wajib. Physical power-cycle confirmation tetap terpisah.

## Diagnostics dan terminal

Protocol Stats menampilkan loop rate, free RAM, sync loss dan kondisi telemetry aktual. Ini bukan simulator benchmark. Raw Console menerima ASCII/hex, menampilkan RX/TX dan copy/clear; ia menyuspend polling ketika aktif. Desktop mengelompokkan RX dalam window30 ms dan membatasi log tampilan. Mobile boleh mengubah layout, tetapi terminal manual tidak boleh menyisipkan byte ke managed transaction aktif. Mode terminal harus memiliki owner dan cleanup pada navigation/session change.

## Settings/file boundaries

App settings default memuat autoReconnect=true, last device/baud, theme/accent/background dan dashboard v2. Preference persistence desktop diantrekan agar rapid edits tidak ditimpa save lama; kegagalan terakhir mengembalikan confirmed settings dan memberi notifikasi. Unit disimpan per project.

Path background/log/INI Windows tidak portabel. Simpan/copy asset melalui adapter mobile dengan izin yang sesuai, pertahankan embedded INI, dan jangan menjadikan path desktop syarat membuka project.

Rujukan: [preload capabilities](../src/main/preload.js), [native tools](../src/main/index.js), [flash screen](../src/renderer/features/system/FlashFirmware.jsx), [console](../src/renderer/features/tools/RawConsole.jsx), [preferences](../src/renderer/core/store/settingsSlice.js).
