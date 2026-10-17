# 04 — Project dan persistence

## Empat lapisan data

| Lapisan | Makna |
| --- | --- |
| Field/table drafts | Edit yang belum di-commit ke document |
| `.rynproj` | Target tune lokal dan metadata workspace |
| RAM ECU | Konfigurasi controller saat berjalan; dapat hilang saat reset |
| EEPROM ECU | Konfigurasi persisten setelah Burn completion/verify |

Tidak ada transaksi atomik bersama antara file mobile dan EEPROM ECU. UI harus menjelaskan tahap mana yang berhasil.

## Schema v5

JSON UTF-8 menyimpan embedded INI sekali dan raw page snapshots. `constants.decodedPages` dan cached `tables` merupakan derivation runtime, bukan authority kedua pada hasil Save v5.

| Field | Kontrak |
| --- | --- |
| `schemaVersion` | 5; migrasi versi 1–4, tolak versi masa depan |
| `projectName`, `description` | Identitas; `name` lama dimigrasikan |
| `ini` | `path`, `signature`, `version`, `content`; path dapat kosong di mobile |
| `engine` | Data wizard/calculator seperti displacement/cylinders |
| `hardware` | `pinMapPlatform`, `channelBuild`, optional `restartRequired` |
| `constants.pages` | Map page ID string → raw snapshot |
| `ecu` | Info terakhir/sync bookkeeping, bukan fakta koneksi baru |
| `runtimeProfiles` | Legacy preset definitions, bukan mode aktif ECU |
| `units` | Temperature, pressure, speed per project |
| `ui` | Misalnya accentColor |
| `initialization` | Provider/base tune, board, INI signature, restore points |
| `createdAt`, `updatedAt` | Timestamp document |
| `integrity` | SHA-256 compact JSON document tanpa `integrity` |

`filePath` dan `fileRevision` adalah runtime repository metadata; writer menghapusnya dari document on-disk. Mobile dapat memakai URI/file reference internal. Preserve extension fields yang tidak dikenal saat round-trip.

Contoh **struktur**, bukan tune lengkap:

```json
{
  "pageId": 14,
  "size": 288,
  "rawEncoding": "base64",
  "rawData": "<base64 tepat 288 byte>",
  "crc32": "<8 digit hex uppercase>",
  "syncState": "unknown",
  "lastReadAt": null,
  "lastVerifiedAt": null,
  "source": "ecu-read"
}
```

Validasi base64, panjang decoded, snapshot.size dan pageSize INI. CRC dihitung ulang dari rawData; saved CRC hanya cache. Preserve padding/reserved bytes melalui base buffer. Legacy partial tune tidak boleh dijadikan complete page dengan zero-fill byte yang tidak diketahui.

## Status page

`unknown`, `dirty-local`, `write-pending`, `burn-pending`, `verified`, `different`, `generated-local`, `verify-failed`; comparison juga melaporkan `missing-local`. Ini bukan enum connection status. `verified` setelah compare berarti project cocok dengan **RAM**, bukan bukti independen EEPROM diprogram pada sesi tersebut.

Load project dan koneksi baru memerlukan pemeriksaan ulang; jangan menampilkan verifikasi lama sebagai fakta terkini. Default active pages 1–15.

## Integritas Dart–JavaScript

Desktop menghitung `SHA256(UTF8(JSON.stringify(document)))`, lalu menulis compact JSON `{...document, integrity}` dan newline. `fileRevision` berbeda: hash atas seluruh bytes file, termasuk newline. V5 tanpa integrity valid ditolak.

Ini **bukan** hash pretty JSON dan belum memakai canonical JSON independen bahasa. Jangan berasumsi `jsonEncode` selalu identik. Uji property ordering, integer-like keys/page IDs, Unicode escaping, representasi double/negative zero dan penghapusan runtime fields. Untuk output Flutter yang dibaca desktop, digest harus cocok dengan bentuk JSON.stringify setelah desktop melakukan JSON.parse. Jangan mengganti algoritma tanpa migrasi versi.

[Fixture lengkap](fixtures/synthetic-project-v5.rynproj) dibuat dengan serializer/writer produksi, embedded INI dan data sintetis. [Manifest](fixtures/project-fixture-manifest.json) mencatat hash file. Gunakan untuk parsing dan round-trip offline; jangan menggunakannya sebagai tune ECU kendaraan.

## Save, revision dan backup

Writer desktop: unique temporary file → write UTF-8 → flush/fsync → backup `.bak` bila target ada → rename replacement. Failure mempertahankan file asli. Expected revision menolak overwrite bila file berubah di luar app; tawarkan reopen/Save As. Recent list berupa descriptor ringan, deduplikasi, maksimum 10.

Adapter mobile harus menyatakan apakah document provider mendukung atomic replacement. Bila tidak, gunakan salinan internal atomik dan ekspor dengan status hasil jelas. Jangan mengaku Save sukses sebelum penulisan selesai. Backup harus dapat direcover pengguna.

## Restore dan restart-required

Restore points `blankCanvas`/`baseTune` menyimpan snapshot dan legacy presets. Restore lokal tidak diam-diam menulis ECU. Snapshot yang direcover dari project lama diberi origin tersendiri, bukan diklaim template pabrik.

`hardware.restartRequired`: `fields`, `targetConfig`, `connectedAt`, `recordedAt`, `burnedPages`. Persist **sebelum write pertama** karena lost ACK tetap bisa mengubah RAM. Requirement bertahan melewati restart app. Hapus hanya setelah konfirmasi user atas power cycle, fresh connection dan readback/CRC target; restore requirement jika persistence gagal. Tidak ada boot identity independen pada kontrak ini.

Rujukan: [format](../src/shared/project-format.js), [writer](../src/main/project-files.js), [normalizer](../src/renderer/core/store/utils/project.normalization.js), [page cache](../src/shared/protocol/page-cache.js), [restart tracker](../src/renderer/core/store/utils/ecu.restart.js).
