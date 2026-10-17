# 09 — Tuning, IO dan kalibrasi

## Form, tabel dan curve

Form memakai shared field drafts per page. `useTuningModule` resolve field ke metadata/page; beberapa modul memakai numeric page scope. Nested field, enum, conditional panel, curve dan pin selector harus ikut dipindahkan. Literal field reference pada dokumen 13 adalah alat navigasi source, bukan daftar lengkap kontrol dinamis.

Form Save: validate edited fields/configuration → commit raw project → apply table drafts → jika connected write/readback RAM scope → optional Burn → Save file. Discard membuang draft scope. Table Save memiliki tahap serupa melalui `useTableSync`. Global Save tidak berarti Burn.

Editor mobile harus mempertahankan precision/range, tanda negatif, axis dan transform. Pilihan 2D/3D boleh direorganisasi untuk sentuhan. Perilaku bulk edit/selection/clipboard yang dipakai layar desktop perlu acceptance tersendiri, termasuk orientasi matrix dan pembatalan input. Jangan mengubah tabel hanya karena widget di-render ulang.

## Engine dan required fuel

Master Setup mencakup board/hardware, cylinder/injection/engine configuration, required fuel dan parameter dasar. Kalkulator source:

```text
fullCycleReqFuel = 6.49 * displacementCc / (cylinders * injectorCcMin)
                  * 14.7 / stoich
```

Hasil adalah full-cycle quantity. Firmware membaginya sesuai injection strategy. Squirts harus membagi cylinder count tepat; divider nol/truncation ditolak. Sequential dan beberapa pola 3-cylinder memiliki aturan efektif khusus dalam `injectionSquirts`. Jangan membagi required fuel dua kali atau menulis ulang VE sebagai efek kalkulator.

Readiness/operating validation juga menangani dwell protection, flood-clear, MAP range dan konfigurasi terkait. Disabled overdwell dengan nilai tertentu berbeda dari enabled overdwell bernilai nol. Port aturan yang nyata dari validator; jangan mengganti dengan clamp umum.

## Pin ownership dan hardware

`board-pins`, `pin-registry` dan generated AVR mapping memutuskan board/build yang didukung, pin fisik/logis, reservasi channel, fixed claims dan field aktif. Jangan menyimpan nomor pin MCU mentah yang berbeda dari enum firmware.

PinSelect harus menjelaskan occupied/unavailable pin dan pemiliknya. Konflik bergantung enable/algorithm; fitur disabled tidak selalu mengambil pin. Evaluasi candidate configuration lengkap, bukan hanya field yang sedang dibuka. IO Summary membedakan konfigurasi tujuan dan yang sudah diterapkan; restart-required berarti routing baru belum boleh dianggap aktif.

Fields INI `requiresPowerCycle` dicatat sebelum write, dipersist, Burn, lalu physical restart/verify. Daftar aktual terbangkitkan per page pada dokumen 13. Jangan hardcode hanya `pinLayout` dan melupakan structural fields lain.

## Kalibrasi biasa vs calibration tables

Sensor screen memuat analog filters, TPS, tekanan/MAP/baro/EMAP, battery, O2 dan thermistor. Sebagian berupa tune-page fields dengan Save/RAM/Burn; **CLT/IAT/O2 tables memakai command `t` dan CRC `k`, bukan Burn page biasa**.

TPS capture menggunakan fresh `tpsADC` 0–255 dari telemetry, bukan menganggapnya full ADC 0–1023. Capture closed/open menulis draft tpsMin/tpsMax. Endpoints sama adalah invalid/check; capture tidak boleh mengambil nilai stale atau nol default ketika tidak ada data.

## CLT dan IAT

Sensor IDs: CLT=0, IAT=1, O2=2. Thermistor input: bias resistor dan tiga pasangan °C/resistance. Validasi bias/resistance positif, suhu -40..215°C, titik suhu berbeda dan NTC resistance menurun terhadap suhu.

Gunakan three-point Steinhart–Hart `1/T=A+B ln(R)+C ln(R)^3`, T Kelvin. Generator membuat 32 sampel ADC `i*33` (0..1023), clamp suhu -40..215; hasil harus monotonic. Wire table 64 byte: 32 nilai S16LE dalam tenth °F, memakai rounding desktop untuk mengimbangi truncation firmware saat konversi kembali ke °C. Mengirim langsung °C akan salah. Port algoritma sumber dan tes golden, bukan formula interpolasi linear pengganti.

## O2

Input dua titik voltage/AFR meningkat, voltage 0..5 V, AFR 0..25.5. Buat 1024 byte: setiap ADC 0..1023 dipetakan linear ke voltage, AFR×10 dibulatkan dan clamp U08. Firmware melakukan downsampling; continuation boundary harus tetap sesuai implementasi.

`t` payload: command/reserved/sensor lalu **offset dan length U16BE**, bukan LE tune-page. Thermistor satu chunk 64 byte; O2 chunk 96 byte dan sisa terakhir. Alignment 96 mempertahankan aturan firmware `x % 32`. ACK status 0/no data untuk setiap chunk. Kalibrasi menetap lewat mekanisme firmware ini; tidak ada tombol Burn page tambahan yang dapat dianggap menggantikannya.

Calibration service mengunci operasi, membaca stopped-engine status baru, output tests off dan Drive Mode DEFAULT. Ia memeriksa context per tahap, kemudian membaca CRC `k`; response CRC U32BE. O2 continuation timeout tidak direplay otomatis karena firmware mengakumulasi CRC. Error setelah write berarti kalibrasi mungkin parsial; retry penuh dimulai dari offset nol. Display verified hanya setelah CRC sesuai.

Rujukan: [tuning hook](../src/renderer/features/shared/hooks/useTuningModule.js), [table hook](../src/renderer/features/shared/hooks/useTableSync.js), [configuration policy](../src/shared/protocol/configuration-policy.js), [pin registry](../src/shared/protocol/pin-registry.js), [required fuel](../src/shared/protocol/required-fuel.js), [calibration algorithm](../src/shared/protocol/sensor-calibration.js), [calibration service](../src/renderer/core/services/sensorCalibration.js).
