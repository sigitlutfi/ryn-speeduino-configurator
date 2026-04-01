---
name: speeduino-ini
description: Technical blueprint for navigating Speeduino firmware's speeduino.ini. Includes memory mapping, bitfield extraction logic, real-time data bridges, and standard validation patterns for tuning modules.
---

# Speeduino INI Technical Blueprint

## 📜 Core INI Paths & Search
- **Path**: `c:\Users\ryn\speeduino\speeduino\reference\speeduino.ini`
- **Lookup Command (Git Bash)**: `rg -n "<term>" speeduino.ini`
- **Fallback (PowerShell)**: `Select-String -Path speeduino.ini -Pattern "<term>"`

---

## 🏗️ Memory Architecture (The "Page" System)

Speeduino organizes data into **Pages**. In React/Redux store, these are accessed via `constants.pages[PAGE_ID]`.

| Page | Functional Domain | Critical Variables |
|:---:|---|---|
| **P1** | Core Configuration | `algorithm`, `ignAlgorithm`, `sparkMode`, `dwellrun`, `dwellcrank` |
| **P2** | VE / Fuel Map | `veTable` (16x16), `rpmBins` (16), `mapBins` (16) |
| **P3** | Spark / Ignition Map | `ignTable` (16x16), `rpmBins3`, `mapBins3` |
| **P4** | Curves & Tables | `wueValues`, `iatRetBins`, `brvBins` (Voltage), `dwellRates` |
| **P5** | AFR / Lambda | `afrTable` (16x16), `rpmBinsAFR`, `loadBinsAFR` |
| **P6** | EGO & Protections | `egoKP`, `egoKI`, `egoKD`, `egoAlgorithm` |
| **P7** | Boost / VVT | `boostTable`, `rpmBinsBoost`, `tpsBinsBoost` |

> [!CAUTION]
> **Serialization Guard**: Project JSON often converts integer keys to strings.
> **Pattern**: `const pData = constants.pages?.[1] || constants.pages?.["1"];`

---

## 🔢 Bitfield & Scalar Mapping
Many settings share a single byte (Bitfields). Use these JS shifts to extract/set them.

### Common Bitfield Examples
| Variable | Bit Range | Meaning |
|---|---|---|
| **algorithm** | `[0:1]` | Fuel Load (0:MAP, 1:TPS, 2:IMAP, 3:EMAP) |
| **ignAlgorithm** | `[4:6]` | Spark Load (0:MAP, 1:TPS, 2:IMAP/EMAP) |
| **sparkMode** | `[2:4]` | Output (0:Wasted, 1:Single, 2:WastedCOP, 3:Sequential) |

### Implementation Pattern (Bitfield)
```javascript
// Extracting: (byte >> shift) & mask
const algorithm = (p1.algorithm & 0b00000011); // Range [0:1]
const ignAlgo   = (p1.sparkSettings >> 4) & 0b111; // Range [4:6] in composite byte

// Modifying: (byte & ~(mask << shift)) | (newVal << shift)
const updateBit = (byte, val, shift, mask) => (byte & ~(mask << shift)) | (val << shift);
```

---

## 📡 Real-time Data Bridge (OutputChannels)
To move the "Active Point" in 3D/2D grids, map these `RealtimeData` keys:

| Speeduino Var | Realtime Key | Used for... |
|---|---|---|
| `rpm` | `rpm` | X-axis for all TuningGrids |
| `fuelLoad` / `map` | `map` atau `tps` | Y-axis for VE/AFR Table (based on active algorithm) |
| `ignLoad` | `ignLoad` | Y-axis for Ignition Table |
| `coolant` | `clt` | X-axis for WUE and Cold Advance Curves |
| `iat` | `iat` | X-axis for IAT Correction/Retard Curves |
| `batteryVoltage`| `vbatt` | X-axis for Dwell Voltage Curve |

---

## 📐 Scaling & Range Standards
Speeduino stores raw integers. UI MUST apply these scales:

| Data Type | Var Name | Scale | Offset| Display Example |
|---|---|---|---|---|
| **AFR** | `afrTable` | 0.1 | 0.0 | `147` -> 14.7 AFR |
| **Timing** | `ignTable` | 1.0 | 0.0 | `12` -> 12° BTDC |
| **Voltage** | `brvBins` | 0.1 | 0.0 | `124` -> 12.4 V |
| **Temp** | `cltBins` | 1.0 | -40 | Stored raw is CLT+40 |
| **RPM** | `rpmBins` | 100.0 | 0.0 | Stored `50` -> 5000 RPM |

---

## ✅ Standard Validation Patterns
Rules to check before `saveProject()`:

1.  **Monotonicity**: Bin values (X and Y axis) MUST ALWAYS be in increasing order.
    - *Fail Case*: `[1000, 2000, 1500, 3000]` -> `false`
2.  **Range Guards**: 
    - AFR: 7.0 to 25.5
    - Ignition: -40 to 90
    - VE: 0 to 255
3.  **Hardware Conflicts**:
    - If `sparkMode` = Wasted Spark, and `perToothIgn` = ON -> Warning (Hardware Stress).

---

## 🎨 Semantic Design System

| Domain | Semantic Color | Tailwind | Glow |
|---|---|---|---|
| **Fuel** | Cyan | `neon-cyan` | `shadow-glow-cyan` |
| **Spark** | Purple | `neon-purple` | `shadow-glow-purple` |
| **AFR** | Green | `neon-green` | `shadow-glow-green` |
| **Hardware** | Yellow | `yellow-400` | `shadow-glow-yellow` |

> [!IMPORTANT]
> **SVG Defs Warning**: In `CurveEditor.jsx`, always place `<defs>` at the top of the `<svg>` to ensure gradient stroke resolutions on initial mount.
