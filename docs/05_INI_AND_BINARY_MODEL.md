# 05 — INI dan model biner

## Metadata sebagai kontrak

INI mendefinisikan signature, offsets, primitive types, bit/enum, units, scale/translate, bounds, precision, arrays, table/curve bindings, command templates dan output channels. Port parser/resolver yang dipakai aplikasi; menyalin label UI saja tidak cukup.

Preprocessor CELSIUS/FAHRENHEIT memengaruhi metadata. Uji keduanya. Snapshot CELSIUS pada generated reference tidak menggantikan parser embedded INI runtime.

Signature sama belum membuktikan kompatibilitas: struktur metadata dibandingkan dengan paired contract. Fuzzy lookup membantu nama editor, tetapi tidak boleh membenarkan write ke offset/shape lain. Binding X/Y/Z yang tidak valid harus membuat tabel unavailable.

## Field dan encoding

| Type | Decoded | Write |
| --- | --- | --- |
| scalar | Integer raw signed/unsigned | Width/range/offset tepat |
| bits | Enum hasil ekstraksi `[lo:hi]` | Mask bit sendiri, preserve tetangga |
| array | Flat raw array, shape menentukan jumlah | Preserve orientasi dan field lain |

Primitive `U08/S08/U16/S16/U32/S32`. Tune scalar multibyte **little-endian**. Offset dalam byte. Signed decoding wajib sign extension. Validate bounds sebelum parse/serialize; fallback nol pada helper lama tidak mengizinkan transport packet pendek.

`parsePage` menghasilkan raw values. Nilai fisik umumnya `(raw + translate) * scale`. Beberapa helper menamai translate sebagai offset. Invers umumnya `round(display / scale - translate)`, lalu validate primitive/bounds. Jangan scale dua kali atau menyimpan display-unit ke bytes.

## Tabel/kurva

Metadata tabel mengikat `xBinsVar`, `yBinsVar`, `zBinsVar`, page dan shape. Flat index, matrix dan axis harus memakai normalisasi desktop yang sama. Uji fixture non-simetris untuk membuktikan X/Y tidak tertukar dan baris tidak terbalik.

VE1/2, Spark1/2, AFR dan Lambda adalah view terpasang, bukan alasan membuat page tambahan. Lambda mengikuti transform/binding source; jangan membuat storage AFR kedua. Kurva memakai pasangan array X/Y dengan panjang, unit dan bounds INI.

Axis harus valid sesuai editor. Jangan membetulkan tune ECU otomatis saat layar dibuka. Precision input/display berasal dari metadata; rounding dilakukan pada tahap encoding yang sesuai. Clipboard/CSV editor memakai urutan matrix, bukan urutan widget Flutter.

## Preserve bytes

Serialize dengan base buffer lengkap. Ubah region yang diminta; preserve padding, reserved bytes, field lain dan bit tetangga. Round-trip no-edit harus byte-for-byte sama, termasuk page custom 15. Mengenerate page dari decoded fields saja dapat menghapus data tanpa definisi editor.

Validate seluruh write plan sebelum write pertama. Invalid page berikutnya harus menolak plan lebih awal. Validasi edited-scope juga mempertimbangkan kebutuhan menonaktifkan fitur pada tune yang sudah invalid; jangan membuat pengguna terjebak tidak bisa disable fitur.

## Artefak port

- INI/parser/preprocessor dan generated metadata/AVR mapping.
- Numeric resolver, binary parser/serializer, page snapshots.
- Table transforms/drafts, curve presets, initialization provider.
- Configuration validation/policy, pin registry, readiness checks.

[Generated reference](13_GENERATED_REFERENCE.md) menyediakan page sizes, restart fields, table bindings dan output offsets. INI lengkap tetap utama.

Rujukan: [INI parser](../src/shared/ini-parser.js), [binary parser](../src/shared/protocol/binary-parser.js), [serializer](../src/shared/protocol/binary-serializer.js), [numeric resolver](../src/shared/protocol/ini-numeric.js), [table transforms](../src/renderer/core/store/utils/table.transforms.js).
