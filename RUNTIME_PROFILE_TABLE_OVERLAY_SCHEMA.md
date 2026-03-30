# Runtime Profile Table Overlay Schema

Dokumen ini mendefinisikan arah arsitektur untuk runtime profile berbasis overlay table yang dibangun dari basetune lalu dikirim ke ECU RAM secara session-only.

Tujuan:
- mendukung profile yang tidak hanya mengganti scalar field
- memungkinkan `VE2`, `Spark2`, `AFR`, dan table lain dibangun ulang dari basetune
- menjaga semua perubahan tetap runtime-only tanpa burn EEPROM
- mendukung rollback penuh ke baseline

## Core Idea

Runtime profile tidak lagi hanya berarti:
- set `fuel2Mode`
- set `spark2Mode`
- set `rumbleIdleEnabled`
- set `alsEnabled`

Tetapi juga berarti:
- membaca table sumber dari basetune / baseline
- membangun table target untuk sesi runtime
- menulis table target ke RAM ECU
- mengaktifkan scalar mode yang memakai table tersebut
- mengembalikan semuanya saat rollback

## Scope

Table overlay runtime dirancang minimal untuk:

- `VE2`
- `Spark2`
- `AFR`

Kandidat berikutnya:

- boost target / duty table
- VVT table
- idle / auxiliary tables yang memang berguna untuk profile character

## Concepts

### Basetune Source

Sumber nilai awal untuk membangun overlay.

Contoh:
- `ve1`
- `spark1`
- `afr1`
- `ve2_baseline`
- `spark2_baseline`

Catatan:
- sumber awal paling umum adalah table utama:
  - `VE1`
  - `Spark1`
  - `AFR1`

### Runtime Target

Table tujuan yang akan ditulis ke RAM ECU.

Contoh:
- `ve2`
- `spark2`
- `afr`

### Region

Area table yang akan dipengaruhi.

Contoh:
- seluruh table
- band RPM tertentu
- band load tertentu
- rectangle RPM x load
- bin spesifik

### Operation

Transformasi yang diterapkan ke source untuk menghasilkan target.

## Recommended Operation Types

### 1. `copy`

Salin source ke target tanpa perubahan.

Contoh:
```json
{
  "target": "ve2",
  "source": "ve1",
  "operation": "copy",
  "region": "all"
}
```

### 2. `scale_percent`

Kalikan nilai source dengan persen tertentu.

Contoh:
```json
{
  "target": "ve2",
  "source": "ve1",
  "operation": "scale_percent",
  "value": 95,
  "region": "all"
}
```

Makna:
- `95` = 95% dari source
- `110` = 110% dari source

### 3. `add`

Tambahkan nilai tetap ke source.

Contoh:
```json
{
  "target": "spark2",
  "source": "spark1",
  "operation": "add",
  "value": 2,
  "region": "all"
}
```

### 4. `set`

Tulis nilai tetap pada region tertentu.

Contoh:
```json
{
  "target": "afr",
  "operation": "set",
  "value": 14.7,
  "region": {
    "rpm": { "max": 3000 },
    "load": { "max": 90 }
  }
}
```

### 5. `clamp`

Batasi nilai minimum/maksimum setelah operasi lain.

Contoh:
```json
{
  "target": "ve2",
  "source": "ve1",
  "operation": "scale_percent",
  "value": 110,
  "region": "all",
  "clamp": { "min": 0, "max": 255 }
}
```

## Region Model

### Global

```json
"region": "all"
```

### RPM band

```json
"region": {
  "rpm": { "max": 3000 }
}
```

### RPM range

```json
"region": {
  "rpm": { "min": 3000, "max": 5000 }
}
```

### Load range

```json
"region": {
  "load": { "min": 30, "max": 100 }
}
```

### RPM + Load rectangle

```json
"region": {
  "rpm": { "min": 2000, "max": 4500 },
  "load": { "min": 40, "max": 100 }
}
```

### Specific bins

```json
"region": {
  "cells": [
    { "row": 3, "col": 5 },
    { "row": 3, "col": 6 },
    { "row": 4, "col": 5 }
  ]
}
```

## Proposed Profile Schema

Contoh profile hybrid:

```json
{
  "name": "ECO",
  "runtime_only": true,
  "apply_requirements": {
    "max_tps_pct": 5,
    "max_rpm": 1500,
    "engine_not_cranking": true
  },
  "scalar_changes": [
    { "key": "fuel2Mode", "value": 3 },
    { "key": "spark2Mode", "value": 3 },
    { "key": "rumbleIdleEnabled", "value": 0 },
    { "key": "alsEnabled", "value": 0 }
  ],
  "table_overlays": [
    {
      "target": "ve2",
      "source": "ve1",
      "operation": "scale_percent",
      "value": 95,
      "region": "all"
    },
    {
      "target": "spark2",
      "source": "spark1",
      "operation": "copy",
      "region": "all"
    }
  ]
}
```

Contoh profile yang lebih agresif:

```json
{
  "name": "RACING",
  "runtime_only": true,
  "scalar_changes": [
    { "key": "fuel2Mode", "value": 3 },
    { "key": "spark2Mode", "value": 3 },
    { "key": "rumbleIdleEnabled", "value": 1 },
    { "key": "alsEnabled", "value": 1 },
    { "key": "alsMaxDuration", "value": 15 }
  ],
  "table_overlays": [
    {
      "target": "ve2",
      "source": "ve1",
      "operation": "scale_percent",
      "value": 110,
      "region": "all",
      "clamp": { "min": 0, "max": 255 }
    },
    {
      "target": "spark2",
      "source": "spark1",
      "operation": "add",
      "value": 2,
      "region": {
        "rpm": { "min": 2500 },
        "load": { "min": 60 }
      }
    }
  ]
}
```

## Runtime Flow

### Apply

1. validasi guard policy
2. capture baseline scalar dan baseline target tables jika belum ada
3. baca source table
4. bangun overlay target table
5. tulis target table ke RAM ECU
6. verify readback table
7. tulis scalar changes
8. verify scalar readback
9. update session state

### Rollback

1. ambil baseline target tables
2. tulis kembali table baseline ke RAM ECU
3. verify readback table
4. tulis scalar baseline
5. verify scalar baseline
6. session kembali ke `Base`

## Baseline Model

Baseline tidak hanya scalar:

```json
{
  "runtimeProfileSession": {
    "baseline": {
      "scalars": {},
      "tables": {
        "ve2": {},
        "spark2": {},
        "afr": {}
      }
    }
  }
}
```

Artinya rollback nanti bisa mengembalikan:
- field scalar
- isi table target yang disentuh runtime profile

## Practical Implications

Dengan model ini:

- `ECO` bisa:
  - membangun `VE2` dari `VE1 x 95%`
  - membangun `Spark2` dari `Spark1`
  - lalu mengaktifkan mode table 2

- `RACING` bisa:
  - membangun `VE2` dari `VE1 x 110%`
  - membangun `Spark2` dari `Spark1 + delta`
  - mengaktifkan rumble idle dan ALS

- `EXTREME` bisa:
  - memakai overlay table lebih agresif
  - atau memakai table yang sama dengan scalar drama lebih besar

- `AFR` juga bisa diubah on-the-fly tanpa burn

## Recommended Implementation Order

### Phase 1

- table read/write baseline support
- `copy`
- `scale_percent`
- full-table region only

### Phase 2

- `add`
- `set`
- `clamp`
- region by RPM / load / rectangle

### Phase 3

- cell-specific edits
- mixed overlay stacks
- profile compare / preview

## Open Decisions

- source default untuk `ECO`:
  - `ve1 -> ve2`
  - `spark1 -> spark2`
  - `afr1 -> afr`

- apakah `AFR` akan selalu memakai table utama atau secondary target strategy
- apakah profile boleh memiliki beberapa operasi berurutan pada target yang sama
- apakah preview diff table perlu ditampilkan di UI sebelum apply
