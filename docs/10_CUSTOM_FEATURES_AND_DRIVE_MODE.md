# 10 — Lima fitur custom dan Drive Mode

Lima fitur yang dimaksud: **Pit Limiter, Rumble Idle, Anti-Lag, Rolling Pop & Bang, Drive Mode**. Launch, Flat Shift, Nitrous dan WMI juga ada sebagai modul; jangan menghapusnya hanya karena bukan bagian daftar lima custom ini.

## Empat performance features

| Fitur | Parameter/validasi penting | Telemetry/UI |
| --- | --- | --- |
| Pit limiter | Enabled, switch pin, RPM/speed limit, cut type; minimal salah satu limit >0. Soft mode memerlukan RPM dan protection ignition; rolling mode memerlukan protection yang enabled | Active, switch state; enable konfigurasi bukan bukti limiter aktif |
| Rumble idle | Enabled, switch/input, min/max RPM, TPS/temperature, beat/pattern; minRPM≤maxRPM, maxTPS>0, pattern length 1–8 | Active dan beat state |
| ALS | Enabled, switch pin, TPS/CLT/RPM/duration serta timing/fuel; maxTPS>0, minCLT≤maxCLT | Active, switch, timing/fuel correction, active time |
| Rolling Pop & Bang | Enabled, pin, RPM/TPS/CLT/duration serta cut settings; minRPM≤maxRPM, cut mode perlu nonzero pattern | Active, switch, time, cut counter, timing/fuel correction |

Nama field tepat dan page/offset ada pada INI serta [reference](13_GENERATED_REFERENCE.md). Port semua field pada source layar, termasuk conditional controls dan pin rules. Label correction/timer harus mengikuti unit metadata.

UI performance priority helper memilih Pit → Rumble → ALS → PopBang bila beberapa active flag tersedia. Itu aturan penyajian source; jangan menyimpulkan seluruh state firmware dari satu feature yang dipilih UI. Tampilkan flag yang benar-benar dilaporkan ECU, bedakan enabled, switch, eligible dan active bila datanya ada.

## Drive Mode ECU

Modes: `0 DEFAULT`, `1 ECO`, `2 RACING`, `3 EXTREME`. Firmware paired v5 diperlukan. Aplikasi mengirim request; ECU memutuskan kapan mode dapat diterapkan. Button tap bukan konfirmasi mode aktif.

Config: **18 byte pada page 15 offset 106–123**:

| Relative offset | Data |
| --- | --- |
| 0–1 | ASCII `D`,`M` |
| 2 | Version 1 |
| 3 | Max TPS 0–20 |
| 4–7 | ECO: fuel U08 80–120, ignition S08 -10..10, features U08 0–7, reserved=0 |
| 8–11 | RACING, struktur sama |
| 12–15 | EXTREME, struktur sama |
| 16–17 | CRC16 LE atas 16 byte sebelumnya |

CRC16: initial `FFFF`, polynomial `1021`, MSB-first, tanpa final xor. Features bitmask: `1 ALS`, `2 Rumble Idle`, `4 Pop & Bang`. Mode membatasi fitur yang sudah dikonfigurasi; bukan mengabaikan Pit Limiter/protection. Neutral config: fuel100, ignition0, features7 untuk tiga preset. Decoder menolak reserved/invalid values, magic/version/CRC salah.

### Command/status

Semua dibungkus modern CRC32 frame:

```text
Status: [D,0]
Select: [D,1,mode,requestToken:U16LE,configCRC:U16LE]
```

Token 1..65535. Status data 15 byte: version[0], active[1], requested[2], state[3], reason[4], requestToken U16LE[5], appliedToken U16LE[7], configCRC U16LE[9], fuel[11], ignition S08[12], features[13], valid bit0[14]. Struktur yang sama menjadi tail telemetry byte 152–166.

State: 0 settled, 1 pending, 2 rejected. Reason 1..8: lepaskan gas; RPM≤6000; tunggu cranking selesai; tunggu sync; protection/launch/nitrous aktif; racing feature aktif; request expired/mode sebelumnya dipertahankan; config invalid. Gunakan reason decoder sumber untuk bahasa UI.

Setelah select, reconcile request token/requested/config CRC dan applied state; timeout aplikasi sekitar 4500 ms. Lost ACK **tidak** memicu replay selection. Status baru menentukan apakah request diterapkan, pending, rejected atau superseded.

Pending request di firmware kedaluwarsa setelah 3 detik dan mempertahankan mode sebelumnya. Putus USB tidak mengubah mode aktif ECU; reboot ECU kembali ke DEFAULT. DEFAULT boleh diminta meskipun config lokal berubah atau masih ada draft, dengan syarat perpindahan ECU tetap berlaku.

Config upload memakai guarded page transaction dan harus preserve byte lain di page15. Project/config Save dan mode Select adalah operasi berbeda. Base tune manual writes/Burn memerlukan DEFAULT; pending restart/draft/legacy active profile dapat memblokir mode tertentu sesuai source guards.

Upload preset dilakukan dalam DEFAULT dan mesin berhenti, hanya menulis 18 byte config. Byte lain page15 harus cocok dengan project; seluruh halaman diverifikasi sebelum ditandai Burn pending. Upload dan select tidak melakukan Burn otomatis. Migrasi INI lama mengisi preset netral hanya pada offset106–123 page15 dalam tune aktif dan restore points, mempertahankan seluruh byte lain serta data preset legacy. Simpan project setelah migrasi.

## Legacy app-side runtime presets

Project masih menyimpan `runtimeProfiles.eco/racing/extreme`; editor route legacy juga dipertahankan. Ini RAM table/field overlays oleh aplikasi, bukan Drive Mode firmware. Default legacy guard: RPM0, max TPS5%, engine not cranking.

Legacy session membedakan Base/Applying/ProfileActive/RollingBack/Unknown dan menjaga before-images untuk rollback. Recovery gagal/putus koneksi membuat status Unknown; jangan mengklaim baseline sudah kembali. Ada allowlist fields/tables dan migration logic ke Drive Mode. Jangan mengaplikasikan overlay lama sekaligus Drive Mode karena nama preset sama.

Rujukan: [performance validation](../src/shared/protocol/performance-features.js), [Drive codec](../src/shared/protocol/drive-modes.js), [Drive actions](../src/renderer/core/store/slices/drive.modes.js), [Drive UI](../src/renderer/features/dashboard/RuntimeProfiles.jsx), [legacy transactions](../src/renderer/core/store/slices/runtime.profile.js), [migration](../src/shared/protocol/drive-mode-migration.js).
