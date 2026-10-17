# 14 — Source map dan pemeliharaan

Semua link relatif terhadap repository configurator agar dapat dipakai tim tanpa path komputer penulis. Jangan memakai `*.backup.js` sebagai implementasi aktif. Pairing firmware terletak di `compatibility/firmware.json`; source firmware berada di repository terpisah yang ditunjuk pairing.

## Source utama

| Area | Entry/source |
| --- | --- |
| Bootstrap/routes/dialog | [App](../src/renderer/App.jsx), [routes](../src/renderer/routes.js), [sidebar](../src/renderer/ui/Sidebar.jsx), [toolbar](../src/renderer/ui/AppToolbar.jsx) |
| Platform API | [preload](../src/main/preload.js), [main](../src/main/index.js), [serial lifecycle](../src/main/serial-lifecycle.js) |
| Project | [format](../src/shared/project-format.js), [writer](../src/main/project-files.js), [normalization](../src/renderer/core/store/utils/project.normalization.js), [lifecycle](../src/renderer/core/store/slices/project.lifecycle.js) |
| Wizard/templates | [creation](../src/renderer/features/projects/projectCreation.js), [initialization](../src/renderer/features/projects/projectInitialization.js), [initial pages](../src/shared/protocol/initialization-pages.js), [curve presets](../src/shared/protocol/curve-presets.js) |
| Metadata/binary | [INI parser](../src/shared/ini-parser.js), [numeric](../src/shared/protocol/ini-numeric.js), [parser](../src/shared/protocol/binary-parser.js), [serializer](../src/shared/protocol/binary-serializer.js), [page cache](../src/shared/protocol/page-cache.js) |
| Wire | [commands](../src/shared/protocol/ecu-commands.js), [response parser](../src/shared/protocol/response-parser.js), [serial service](../src/renderer/core/services/serialService.js) |
| Connection | [connection slice](../src/renderer/core/store/connectionSlice.js), [recovery](../src/renderer/core/services/ecuRecovery.js) |
| Sync/restart | [sync](../src/renderer/core/store/slices/ecu.sync.js), [communication](../src/renderer/core/store/slices/ecu.communication.js), [restart verification](../src/renderer/core/store/slices/ecu.restart.js), [restart tracking](../src/renderer/core/store/utils/ecu.restart.js) |
| Editing | [form hook](../src/renderer/features/shared/hooks/useTuningModule.js), [table hook](../src/renderer/features/shared/hooks/useTableSync.js), [draft transforms](../src/renderer/core/store/utils/table.drafts.js), [table transforms](../src/renderer/core/store/utils/table.transforms.js) |
| Validation/IO | [contract](../src/shared/protocol/contract.js), [configuration policy](../src/shared/protocol/configuration-policy.js), [value validation](../src/shared/protocol/configuration-validation.js), [readiness](../src/shared/protocol/configuration-readiness.js), [board](../src/shared/protocol/board-pins.js), [pins](../src/shared/protocol/pin-registry.js) |
| Realtime | [decoder](../src/shared/protocol/output-channels.js), [freshness](../src/shared/protocol/tuning-live.js), [registry](../src/renderer/features/dashboard/widgets/telemetry-channels.js), [layout](../src/renderer/features/dashboard/widgets/widgetPresets.js), [store](../src/renderer/core/store/realtimeSlice.js), [CSV](../src/shared/protocol/telemetry-log.js) |
| Calibration | [algorithm/commands](../src/shared/protocol/sensor-calibration.js), [transaction service](../src/renderer/core/services/sensorCalibration.js) |
| Custom/Drive | [feature validation](../src/shared/protocol/performance-features.js), [Drive codec](../src/shared/protocol/drive-modes.js), [Drive slice](../src/renderer/core/store/slices/drive.modes.js), [legacy profile](../src/renderer/core/store/slices/runtime.profile.js), [migration](../src/shared/protocol/drive-mode-migration.js) |
| Pairing upgrade | [workflow](../UPGRADE_WORKFLOW.md), [checker](../scripts/upgrade-check.mjs), [firmware pair](../compatibility/firmware.json) |

Nama file per layar dan direct field references ada di [generated reference](13_GENERATED_REFERENCE.md). Untuk kurva/panel dinamis, telusuri import component dan metadata table/curve; daftar literal tidak dapat menjamin seluruh generated controls sudah tercakup.

## Peta tes desktop

| Area | Tes |
| --- | --- |
| Framing/cancellation/polling | [serial reads](../test/serial-reads.test.mjs), [native lifecycle](../test/serial-lifecycle.test.mjs), [ECU recovery](../test/ecu-recovery.test.mjs) |
| Project/file | [management](../test/project-management.test.mjs), [initialization](../test/project-initialization.test.mjs), [curves](../test/curve-initialization.test.mjs) |
| Sync/contract | [initial sync](../test/initial-sync.test.mjs), [contract safety](../test/contract-safety.test.mjs), [upgrade](../test/upgrade-check.test.mjs) |
| Hardware/configuration | [master setup](../test/master-setup.test.mjs), [pin selector](../test/pin-selector.test.mjs), [operating settings](../test/audit-operating-settings.test.mjs) |
| Telemetry/UI | [realtime audit](../test/realtime-audit.test.mjs), [widgets](../test/telemetry-widgets.test.mjs), [UI](../test/realtime-ui.test.mjs), [live tuning](../test/tuning-live.test.mjs) |
| Calibration/custom | [sensors](../test/sensor-calibration.test.mjs), [Drive](../test/drive-modes.test.mjs), [profiles](../test/runtime-profile.test.mjs), [performance protocol](../test/performance-protocol.test.mjs) |

## Menjalankan baseline desktop

Dari root configurator dengan Bun/Node sesuai AGENTS/package.json:

```sh
bun install --frozen-lockfile
bun run test
bun run build:renderer
bun run upgrade:check -- --firmware /path/to/reviewed/firmware
```

Pada paired verification, set `RYN_FIRMWARE_ROOT` ke checkout firmware yang benar agar rejection tests pasangan juga dijalankan. Jangan `upgrade:sync` untuk menerima perubahan kontrak yang belum direview. Dokumentasi ini tidak memerlukan flash ECU.

## Regenerasi docs/fixtures

```sh
node docs/tools/generate-reference.mjs
```

Generator membaca source aktif dan paired INI, menulis dokumen13, vectors JSON, synthetic v5 project, manifest fixture dan [source hashes](fixtures/source-manifest.json). Ia tidak mengakses serial. Fixture target adalah artefak generated yang boleh diganti; generator memakai production writer serta memverifikasi checksum, load, normalization dan lossless raw-page round-trip.

Setelah regenerasi: periksa route count, hash, page sizes/offsets dan perubahan golden vectors; update dokumen naratif dan acceptance. Perubahan parser/schema/serializer memerlukan uji round-trip ulang di Dart dan desktop. Jangan mengandalkan generator untuk meninjau perubahan semantik.

## Alasan guard dan regression coverage

[Koneksi, recovery dan race conditions](07_CONNECTION_SYNC_AND_RECOVERY.md), [telemetry dan widget](08_TELEMETRY_WIDGETS_LOGGING.md), serta [acceptance](12_DELIVERY_AND_ACCEPTANCE.md) memuat perilaku yang harus dipertahankan. Gunakan peta tes di atas untuk regression coverage. Catatan audit historis root telah digantikan dokumentasi ini; source dan tes terbaru tetap penentu implementasi.

## Handoff ke tim

Sertakan `docs/`, fixture, bundled INI, pairing/generated contracts, seluruh source aktif yang dirujuk dan tests. Working tree baseline belum identik dengan app HEAD. Sebelum development paralel, bekukan snapshot/commit bersama dan tulis gap platform yang disepakati. Tidak ada cloud backend wajib atau akun server dalam kontrak app lokal yang didokumentasikan di sini.
