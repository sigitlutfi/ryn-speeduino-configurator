# RYN Speeduino Configurator

Aplikasi desktop Electron untuk konfigurasi dan tuning Speeduino: project portabel, editor tabel/kurva, kalibrasi sensor, sinkronisasi ECU, telemetry dan dashboard widget.

## Dokumentasi

Mulai dari [panduan pengembang dan replikasi Flutter](docs/README.md). Untuk menyerahkan pekerjaan kepada tim mobile, ikuti [checklist handoff](docs/HANDOFF_CHECKLIST.md). Kontrak protokol, alur pengguna, format project, recovery, fitur custom, fixture dan acceptance tersedia di sana.

Baseline yang didokumentasikan memakai firmware `speeduino 202504-ryn-perf-v5`, project schema **5**, halaman konfigurasi **1–15**, serta paket telemetry **167 byte**. Pairing firmware/INI dicatat pada [firmware contract](compatibility/firmware.json). Source working tree dan tes menjadi acuan implementasi; HEAD saja belum mencakup semua perubahan baseline handoff.

## Development

Gunakan **Bun 1.4.0** dan **Node 24 atau lebih baru**, sesuai package.json.

```sh
bun install --frozen-lockfile
bun run start
bun run test
bun run build:renderer
```

Packaging dan pemeriksaan native runtime Windows:

```sh
bun run package
bun run test:package -- "out/RYN CONFIGURATOR-win32-x64"
```

Baca [kontribusi](CONTRIBUTING.md) dan [panduan repository](AGENTS.md). Untuk perubahan firmware, INI, pin atau dependency, ikuti [upgrade workflow](UPGRADE_WORKFLOW.md). Perintah lint saat ini masih placeholder.

## Perilaku utama

- Project `.rynproj` menyimpan embedded INI, raw page buffers, integritas file dan metadata project.
- Save project, upload ke RAM ECU, dan Burn ke EEPROM memiliki makna terpisah.
- Koneksi melewati handshake, pemeriksaan kontrak dan sinkronisasi sebelum operasi tuning diizinkan.
- Telemetry menampilkan kualitas/freshness data; status tersambung saja tidak menjamin data LIVE.
- Lima fitur custom: Pit Limiter, Rumble Idle, Anti-Lag, Rolling Pop & Bang, dan Drive Mode. Modul Launch, Flat Shift, Nitrous dan WMI juga tersedia.

Dukungan transport, flashing dan board mengikuti implementasi serta pairing yang diuji; lihat [batas platform](docs/11_MOBILE_PLATFORM_AND_FIRMWARE.md).

## Proyek

Repository: [ryn-speeduino-configurator](https://github.com/sigitlutfi/ryn-speeduino-configurator). Lisensi yang dinyatakan package.json: MIT.

RYN Configurator adalah proyek independen untuk ekosistem Speeduino dan tidak menyatakan afiliasi resmi dengan Speeduino. Pengujian software tidak menggantikan validasi tune dan perangkat keras.
