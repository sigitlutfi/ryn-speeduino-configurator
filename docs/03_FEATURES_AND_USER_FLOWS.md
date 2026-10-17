# 03 — Fitur dan alur pengguna

[Referensi source](13_GENERATED_REFERENCE.md) memetakan **44 route** ke component/field. Nested curves dan panel ikut diport, bukan hanya halaman induknya.

## Katalog fungsi

| Kelompok | Layar/fungsi | Kontrak perilaku |
| --- | --- | --- |
| Workspace | Getting Started, wizard, Project Settings, recent | Create/open offline, embedded INI, board, draft guard |
| Monitoring | Realtime View, Telemetries, IndicatorTray | Kualitas/unit, preset/widget, trace, recording/CSV |
| Tabel | VE1/2, Ignition1/2, AFR, Lambda | Axis/matrix, edit/selection, view 2D/3D sesuai source, Save/RAM/Burn |
| Engine | Master Setup, Trigger, Injector, Spark, Protection | Enum/metadata, required-fuel, dwell/advance curves, restart tracking |
| Fuel | Strategy, AFR/O2, Flex, Staged, Boost | Enable/condition gating, tabel/kurva pendamping, pin aktif |
| Startup | Cranking, Startup Curves, Idle | Kurva enrichment/timing, kontrol sesuai algoritma |
| Racing | Launch, Flat Shift, Nitrous, Pit, Rumble, ALS, Pop & Bang, WMI | Threshold, input/output pin dan state ECU |
| Drive | RuntimeProfiles dan editor | Drive Mode ECU serta legacy local preset dibedakan |
| IO | IO Summary, Programmable, Pump, Fan, Tacho, VVT | Pin efektif/tujuan, routing, konflik, enable |
| Tools | Calibration, Stats, Console, Flash, Communications | Sensor tables, metrics aktual, terminal, flash/reset/recovery |
| Preferences | App Settings, menu View/Status | Theme/accent/background, unit project, layout, tray/sidebar |

## A — Project baru

1. Tanpa project, tampilkan Getting Started, New/Open dan recent list.
2. Wizard memilih INI, board, data engine dan pilihan base tune. Bangun document serta restore points lengkap sebelum mengganti workspace.
3. Provider desktop `ryn-12-1-wasted-spark-v5` memberi konfigurasi awal; bukan kalibrasi kendaraan yang sudah terbukti.
4. Save ke file pilihan pengguna. Cancel picker/write failure mempertahankan project lama.
5. Editor dibangun dari bytes/metadata; offline tidak mengaku sesuai ECU.

## B — Connect dan mismatch

1. Device/baud → permission platform → attempt lease → open.
2. Boot delay dan F/Q/S handshake; product string bukan pengganti signature/metadata check.
3. Signature/INI mismatch membuka compatibility dialog. Jangan mengganti INI atau mengirim tune otomatis.
4. Compare active pages. Perbedaan/generated/missing ditampilkan dalam sync dialog.
5. Validasi selesai setelah compare teknis berhasil dan telemetry baru diterima. `review` berarti tune perlu keputusan; `ready` berarti compare/fresh read lolos.

Dialog wajib menjelaskan arah: **Download ECU → project**, **Upload project → RAM ECU**, **Burn RAM → EEPROM**. Munculnya mismatch tidak otomatis mengizinkan upload.

## C — Edit dan Save

Edit menghasilkan draft; raw/display dipisah. Validasi metadata, hubungan field dan pin sebelum commit. Save pada form/tabel commit scope ke project; bila connected, tulis/verifikasi RAM; kemudian simpan document. Burn tindakan tambahan eksplisit.

Global Save menerapkan draft project ke file; jangan disamakan dengan upload/Burn. Bila RAM write berhasil tetapi disk gagal, laporkan tahap disk gagal secara terpisah. ECU tidak otomatis kembali ke nilai sebelumnya.

## D — Close/switch project

Berikan Save/Discard/Cancel untuk perubahan dan draft. Project Settings yang belum Apply ikut dideteksi. Cancel mempertahankan workspace. File rusak, future schema, INI incompatible atau Save failure tidak mengganti project valid.

Desktop window close menunggu acknowledgement lifecycle renderer. Flutter memakai coordinator yang sama untuk back/navigation/close sejauh platform mengizinkan; jangan membuat jalur back yang melewati draft guard.

## E — Reset/recovery

Burn perubahan pending dahulu. USB reset membutuhkan telemetry baru yang membuktikan engine stop, output test mati, EEPROM idle. Native lock → invalidate session → control-line pulse → close → reconnect/validate. Pisahkan keberhasilan device action dari recovery. Port tersambung kembali tidak otomatis membuktikan physical power cycle.

## Keadaan UI

Setiap tindakan memiliki pending/progress, success, cancel dan error spesifik. Serial-open bukan sukses keseluruhan. Dashboard dapat diedit offline. Unknown channel/preset lama tetap editable. Diagnostics memakai nilai aktual atau unavailable, bukan angka contoh.

Rujukan: [App](../src/renderer/App.jsx), [toolbar](../src/renderer/ui/AppToolbar.jsx), [wizard](../src/renderer/features/projects/GettingStarted.jsx), [sync dialog](../src/renderer/ui/SyncDialog.jsx), [lifecycle](../src/renderer/core/store/slices/project.lifecycle.js).
