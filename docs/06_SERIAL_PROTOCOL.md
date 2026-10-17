# 06 — Serial dan wire protocol

## Stream dan antrean

Desktop umumnya memakai 115200 baud. Adapter mobile harus menerapkan parameter/flow-control perangkat yang diuji. Device identity mobile tidak sama dengan COM Windows.

RX merupakan potongan stream arbitrer. Satu respons bisa pecah menjadi potongan 1–3 byte. Satu transaksi response-bearing menahan antrean sampai seluruh respons selesai/timeout/cancel. Antrean native terpisah mengatur open/close/write/drain/reset/flash. Generic terminal tidak boleh mengirim di tengah polling/sync.

## Bootstrap legacy

Setelah open: tunggu **2200 ms**, flush input, kirim ASCII `F`, terima ASCII `002`; kirim `Q` untuk signature; kirim `S` untuk product. Ini **unframed**. Timeout desktop F/Q/S: 2000/2500/2000 ms; settle: 80/120/120 ms. Product hanya informasi; signature/metadata tetap gate.

Handshake memeriksa generation setelah boot delay, flush dan tiap probe. Coroutine lama tidak boleh melanjutkan F/Q/S ke session pengganti.

## Frame modern

```text
TX: [payloadLength U16 BE] [command payload] [CRC32 U32 BE]
RX: [payloadLength U16 BE] [status U08] [response data] [CRC32 U32 BE]
```

CRC atas payload saja, termasuk status pada RX. CRC32 reflected polynomial `0xEDB88320`, initial/final xor `0xFFFFFFFF`. ASCII `123456789` → `CBF43926`.

Outer length/CRC **big-endian**. Tune offset/count/data umumnya **little-endian**. Header kalibrasi `t` merupakan pengecualian BE. Komentar formatter/parser lama yang menyebut outer LE tidak sesuai implementasi saat ini.

Modern default wajib framed. Nama `sendHybridCommand` bukan izin menebak raw setelah CRC gagal. Raw hanya mode eksplisit bagi command yang memang memiliki kontrak raw. Broken CRC, short/oversized payload atau trailing bytes menolak transaksi, bukan menjadi ACK sukses.

## Command payload

Semua berikut dibungkus frame modern kecuali bootstrap. Reserved/tsCanId lokal bernilai 0.

| Operasi | Payload tanpa outer frame | Data sukses setelah status |
| --- | --- | --- |
| Read page | `p,0,page,offset:U16LE,count:U16LE` | Tepat count byte |
| Write RAM | `M,0,page,offset:U16LE,count:U16LE,data` | Kosong, status 0 |
| Burn | `b,0,page` | Kosong, status 4 atau 0 yang didukung helper |
| Page CRC | `d,0,page` | CRC32 page, U32 BE |
| Telemetry | Expand INI `ochGetCommand`, paired `r,tsCanId,0x30,offset:U16LE,count:U16LE` | Tepat count; full block 167 byte |
| Calibration CRC | `k,0,sensorId` | CRC U32 BE |
| Calibration table | `t,0,sensorId,offset:U16BE,count:U16BE,data` | Kosong, status 0 |
| Drive | `D` subcommands | Lihat dokumen 10 |

Template expansion: `$tsCanId`, escaped `\$tsCanId`, `\xNN`, `%2o` offset LE, `%2c` count LE, `%2i` index LE. Read page adalah **p**, realtime **r**.

## Status

| Hex | Nama | Interpretasi |
| --- | --- | --- |
| 00 | OK | Tetap cek ukuran/jenis operasi |
| 01 | REALTIME | Dikenali parser; bukan fallback command success |
| 02 | PAGE | Dikenali parser; gunakan kontrak helper aktual |
| 04 | BURN_OK | ACK, belum bukti EEPROM selesai |
| 80 | TIMEOUT | Kegagalan; write dapat ambigu |
| 82 | CRC_ERR | Tolak; jangan decode sebagai raw |
| 83 | UNKNOWN_ERR | Command tidak dikenali |
| 84 | RANGE_ERR | Offset/count atau range ditolak |
| 85 | BUSY_ERR | Retry terbatas hanya jika aman diulang |

Read page desktop maksimal **64 byte per chunk**. Timeout umum command/read/write 3000 ms, telemetry 1200 ms, Burn 4000 ms; completion polling Burn memiliki deadline 15 detik. Ini baseline desktop, bukan jaminan waktu semua perangkat.

## Parser dan kegagalan

Akumulasikan header, validasi length (helper transaksi menolak 0 atau >2048), tunggu full frame+CRC. CRC terlambat tidak boleh dianggap raw success. Read response harus tepat ukurannya. Timer/listener dibersihkan sekali saat success/error/cancel/reset.

Timeout setelah TX ambigu: ECU mungkin sudah menerapkan write. Jangan replay otomatis semua command. Drive select direkonsiliasi melalui status/token; O2 calibration continuation tidak diulang otomatis; upload memakai readback/verify. Retry tidak mengubah CRC failure menjadi success.

[Golden vectors](fixtures/protocol-vectors.json): 15 pesan/config block, CRC test dan telemetry sample dengan expected values. Uji fragmentasi per byte, split CRC, framed error, payload pendek/panjang, trailing bytes dan cancellation.

Rujukan: [formatter](../src/shared/protocol/ecu-commands.js), [service](../src/renderer/core/services/serialService.js), [parser](../src/shared/protocol/response-parser.js), [read tests](../test/serial-reads.test.mjs).
