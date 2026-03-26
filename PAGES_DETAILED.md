# Speeduino INI - Detailed Page Breakdown

## All 15 Pages Overview

---

## **Page 1: Master Engine Configuration** (128 bytes)
**The most critical page - contains all fundamental engine settings**

### Core Engine Settings
- `reqFuel` - Required fuel in ms per cylinder
- `nCylinders` - Number of cylinders (1-8)
- `algorithm` - Load algorithm (Speed Density/Alpha-N/MAF/IMAP)
- `engineType` - Even fire / Odd fire
- `twoStroke` - 2-stroke or 4-stroke engine
- `divider` - Injection divider
- `alternate` - Simultaneous vs Alternating injection
- `injLayout` - Paired/Semi-Sequential/Sequential
- `nInjectors` - Number of injector outputs (1-8)
- `injType` - Port or Throttle Body injection
- `mapSample` - MAP sampling method

### Hardware Configuration
- `pinLayout` - Board type (v0.2, v0.3, v0.4, Teensy, STM32, etc.)
- `tachoPin` / `tachoDiv` / `tachoDuration` - Tachometer output config

### Sensor Calibration
- `tpsMin` / `tpsMax` - TPS voltage calibration (ADC values)
- `mapMin` / `mapMax` - MAP sensor range (kPa)
- `stoich` - Stoichiometric AFR ratio (14.7 for gasoline)
- `baroMin` / `baroMax` - Barometric sensor range

### Injector Settings
- `injOpen` - Injector opening time (dead time) in ms
- `injAng` - Injection angle array [4 values] in degrees
- `dutyLim` - Maximum injector duty cycle limit (%)

### Flex Fuel
- `flexEnabled` - Enable/disable flex fuel sensor
- `flexFreqLow` / `flexFreqHigh` - Flex sensor frequency range (Hz)

### Starting & Enrichment
- `aseTaperTime` - After-start enrichment taper time (seconds)
- `aeColdPct` - Cold acceleration enrichment percentage
- `aeColdTaperMin` / `aeColdTaperMax` - Cold AE temperature range
- `wueRates` - Warmup enrichment rates array [10 values]
- `crankingPct` - Cranking enrichment percentage

### Acceleration Enrichment
- `aeMode` - AE based on TPS or MAP
- `aeTime` - AE duration (ms)
- `aeApplyMode` - PW Multiplier or Adder
- `maeThresh` - MAP threshold for triggering AE (kPa/s)
- `taeThresh` - TPS threshold for triggering AE (%/s)
- `maeMinChange` - Minimum MAP change to trigger AE
- `taeMinChange` - Minimum TPS change to trigger AE

### Engine Protection
- `hardCutType` - Rev limiter type (Full/Rolling)
- `dfcoEnabled` - Deceleration Fuel Cut Off
- `perToothIgn` - Per-tooth ignition timing

### Display Options
- `displayB1` / `displayB2` - OLED display field selections

### Advanced Flags & Features
- `includeAFR` - Include AFR in fuel calculations
- `ignAlgorithm` - Ignition load algorithm
- `indInjAng` - Individual injection angles per cylinder
- `fixAngEnable` - Fixed injection angle enable
- `legacyMAP` - Legacy MAP reading mode
- `multiplyMAP` - MAP multiplication mode (Baro/Fixed)
- `SoftLimitMode` - Soft limiter behavior
- `useTachoSweep` - Tacho sweep on startup
- `fpPrime` - Fuel pump prime duration (seconds)
- `boostMaxDuty` - Maximum boost solenoid duty (%)
- `oddfire2/3/4` - Odd-fire cylinder timing offsets

**Total: ~60+ variables**

---

## **Page 2: VE Table (Fuel Map)** (288 bytes)
**Primary volumetric efficiency table for fuel delivery**

### Contents
- `veTable` - 16×16 VE table (main fuel map) [256 bytes]
- `rpmBins` - RPM axis bins [16 values, 100-25500 RPM]
- `fuelLoadBins` - Load axis bins [16 values, kPa/TPS/%]

**Purpose:** This is the primary fuel map that determines base fuel delivery based on engine load and RPM.

---

## **Page 3: Ignition Advance Table** (288 bytes)
**Primary ignition timing map**

### Contents
- `advTable1` - 16×16 Ignition advance table (degrees) [256 bytes]
- `rpmBins2` - RPM axis bins [16 values]
- `mapBins1` - Load axis bins [16 values]

**Purpose:** Controls ignition timing advance based on engine load and RPM.

---

## **Page 4: Ignition Settings** (128 bytes)
**Trigger pattern, dwell, and ignition-related configurations**

### Trigger Configuration
- `TrigAng` - Trigger angle (degrees, -360 to 360)
- `FixAng` - Fixed angle offset (degrees)
- `CrankAng` - Cranking advance angle (degrees)
- `TrigPattern` - Trigger wheel pattern (Missing Tooth, 60-2, 36-1, etc.)
- `TrigEdge` / `TrigEdgeSec` - Trigger edge (Rising/Falling)
- `TrigSpeed` - Crank or Cam speed sensor
- `trigPatternSec` - Secondary trigger pattern
- `numTeeth` - Number of teeth on wheel
- `missingTeeth` - Number of missing teeth
- `useResync` - Resync enable
- `TrigFilter` - Trigger filter level
- `SkipCycles` - Skip cycles on startup

### Spark/Dwell Configuration
- `sparkMode` - Wasted Spark / Single / Wasted COP / Sequential / Rotary
- `sparkDur` - Spark duration (ms)
- `dwellcrank` - Cranking dwell (ms)
- `dwellrun` - Running dwell (ms)
- `dwellLim` - Dwell limiter (ms)
- `useDwellLim` - Use dwell limiter (On/Off)
- `ignCranklock` - Ignition cranklock

### Ignition Outputs & Control
- `IgInv` - Ignition output inversion
- `fuelPumpPin` - Fuel pump output pin

### Rev Limiter
- `SoftRevLim` - Soft rev limit (RPM)
- `hardRevLim` - Hard rev limit (RPM)
- `SoftLimRetard` - Soft limiter retard (degrees)
- `SoftLimMax` - Soft limiter max duration (seconds)
- `crankRPM` - Cranking RPM threshold

### TPS & WUE Bins
- `taeBins` - TPS-based AE bins [4 values] (%/s)
- `taeRates` - TPS-based AE rates [4 values] (%)
- `wueBins` - Warmup enrichment temperature bins [10 values]
- `tpsflood` - TPS flood clear threshold (%)

### Boost Control
- `boostType` - Open Loop / Closed Loop

### Reset Control
- `bootloaderCaps` - Bootloader capabilities
- `resetControl` - Reset control mode
- `resetControlPin` - Reset control pin

**Total: ~40+ variables**

---

## **Page 5: AFR/Lambda Target Table** (288 bytes)
**Target air-fuel ratio map**

### Contents
- `lambdaTable` - 16×16 Lambda target table [256 bytes]
- `afrTable` - 16×16 AFR target table [256 bytes] (alternate view)
- `rpmBinsAFR` - RPM axis bins [16 values]
- `loadBinsAFR` - Load axis bins [16 values]

**Purpose:** Defines target AFR/Lambda values for closed-loop fueling across RPM and load.

---

## **Page 6: O2/AFR Correction & Control Systems** (128 bytes)
**O2 sensor, boost, VVT, and engine protection settings**

### O2/AFR Correction
- `egoAlgorithm` - EGO correction algorithm (Simple/PID/None)
- `egoType` - O2 sensor type (Disabled/Narrowband/Wideband)
- `egoKP` / `egoKI` / `egoKD` - PID gains for closed-loop (%, %, %)
- `egoTemp` - Minimum temperature for O2 correction
- `egoCount` - O2 sensor sample count
- `egoLimit` - EGO correction limit (%)
- `ego_min` / `ego_max` - EGO correction range
- `egoRPM` - RPM threshold for O2 correction
- `egoTPSMax` - Maximum TPS for O2 correction

### Boost Control
- `boostEnabled` - Enable/disable boost control
- `boostPin` - Boost control output pin
- `boostLimit` - Boost limit (kPa)
- `boostFreq` - Boost solenoid PWM frequency (Hz)

### VVT (Variable Valve Timing)
- `vvtEnabled` - Enable/disable VVT
- `vvtMode` - VVT mode (On/Off, Open Loop, Closed Loop)
- `vvtLoadSource` - VVT load source (MAP/TPS)
- `vvtPWMdir` - VVT direction (Advance/Retard)
- `vvtCLUseHold` - Use hold position in closed loop
- `vvtPin` - VVT output pin
- `vvtFreq` - VVT PWM frequency (Hz)

### Engine Protection
- `engineProtectType` - Protection type (Off/Spark/Fuel/Both)
- `engineProtectRPM` - Protection RPM threshold
- `engineProtectCLT` - Protection coolant temp threshold
- `engineProtectMAP` - Protection MAP threshold
- `engineProtectAFR` - Protection AFR threshold

### Idle Control
- `idleFreq` - Idle valve PWM frequency
- `idlePID` - Idle PID settings

### Launch Control
- `launchEnabled` - Enable/disable launch control
- `launchHiLo` - Launch switch polarity

### Fan Control
- `fanEnable` - Enable cooling fan output

**Total: ~40+ variables**

---

## **Page 7: Boost, VVT, & Staging Tables** (240 bytes)
**3D tables for boost, VVT, and fuel staging**

### Boost Table
- `boostTable` - 8×8 Boost target table (kPa or Duty %) [64 bytes]
- `rpmBinsBoost` - RPM bins [8 values]
- `tpsBinsBoost` - TPS bins [8 values]

### VVT Table
- `vvtTable` - 8×8 VVT target table (%) [64 bytes]
- `rpmBinsVVT` - RPM bins [8 values]
- `loadBinsVVT` - Load bins [8 values]

### Fuel Staging Table
- `stagingTable` - 8×8 Staging table (%) [64 bytes]
- `rpmBinsStaging` - RPM bins [8 values]
- `loadBinsStaging` - Load bins [8 values]

**Purpose:** Fine control of boost pressure, VVT position, and staged injection activation.

---

## **Page 8: Fuel Trim Tables** (Large page)
**Six 6×6 fuel trim tables for individual cylinder corrections**

### Trim Tables (6 tables × 48 bytes each)
- `fuelTrim1Table` through `fuelTrim6Table` - 6×6 trim tables (%)
- Each table has its own RPM and load bins [6 values each]

### Ignition Trim Tables
- `ignTrim1Table` through `ignTrim4Table` - 4×4 ignition trim tables
- Each with RPM and load bins

### Additional Trims
- `trimLoadSource` - Load source for trim tables
- `trimEnabled` - Enable/disable trim tables

**Purpose:** Per-cylinder fuel and timing adjustments for balancing multi-cylinder engines.

---

## **Page 9: CAN Bus & Secondary Serial** (Large page)
**Communication protocols and external input mapping**

### Secondary Serial
- `enable_secondarySerial` - Enable secondary serial port
- `secondarySerialProtocol` - Protocol selection (Generic/CAN/msDroid/RealDash/etc.)

### Internal CAN Bus
- `intcan_available` - Internal CAN available
- `enable_intcan` - Enable internal CAN
- `canBMWCluster` - BMW cluster mode
- `canVAGCluster` - VAG cluster mode

### CAN Input Mapping (16 channels)
- `caninput_sel0` through `caninput_sel15` - Input channel selectors
  - Off / External Source / Analog local / Digital local
  - Via Secondary Serial or Via Internal CAN
- `caninput_source_can_address0` through `15` - CAN addresses
- `caninput_source_start_byte0` through `15` - Start bytes
- `caninput_source_num_bytes0` through `15` - Number of bytes

### Broadcast Settings
- `canBroadcastInterval` - Broadcast interval (ms)
- `serialSecondaryInUse` - Secondary serial in use flag

**Purpose:** Integrate external sensors and displays via CAN bus or secondary serial protocols.

---

## **Page 10: Cranking & Rotary Settings** (128 bytes)
**Cranking enrichment curves and rotary-specific features**

### Cranking Enrichment
- `crankingEnrichBins` - Temperature bins [4 values]
- `crankingEnrichValues` - Enrichment values [4 values] (%)

### Rotary Engine Settings
- `rotaryType` - Rotary type (FC/FD/RX8)
- `rotarySplitValues` - Split angle values [8 values]
- `rotarySplitBins` - Split load bins [8 values]

### Staged Injection
- `stagingEnabled` - Enable/disable staging
- `stagingMode` - Table or Automatic mode
- `stagedInjSizePri` - Primary injector size (cc/min)
- `stagedInjSizeSec` - Secondary injector size (cc/min)

### Boost Control Advanced
- `boostIntv` - Boost control interval (ms)
- `boostSens` - Boost sensor sensitivity

### EMAP (Exhaust MAP)
- `EMAPPin` - EMAP sensor pin selection

**Total: ~20+ variables**

---

## **Page 11: Secondary VE Table** (288 bytes)
**Second fuel map for dual fuel table mode**

### Contents
- `veTable2` - 16×16 Secondary VE table [256 bytes]
- `fuelRPM2Bins` - RPM axis bins [16 values]
- `fuelLoad2Bins` - Load axis bins [16 values]

**Purpose:** Allows switching between two different fuel maps based on conditions (e.g., different fuel types, nitrous, boost).

---

## **Page 12: WMI, VVT2, & Dwell Tables** (184 bytes)
**Water-methanol injection, second VVT, and dwell tables**

### Water-Methanol Injection (WMI)
- `wmiTable` - 8×8 WMI duty cycle table (%) [64 bytes]
- `rpmBinsWMI` - RPM bins [8 values]
- `mapBinsWMI` - MAP bins [8 values]

### Second VVT Channel
- `vvt2Table` - 8×8 VVT2 target table (%) [64 bytes]
- `rpmBinsVVT2` - RPM bins [8 values]
- `loadBinsVVT2` - Load bins [8 values]

### Dwell Table
- `dwellTable` - 4×4 Dwell table (ms) [16 bytes]
- `rpmBinsDwell` - RPM bins [4 values]
- `loadBinsDwell` - Load bins [4 values]

**Purpose:** Advanced control for water-methanol injection systems, dual VVT setups, and load-based dwell control.

---

## **Page 13: Programmable Outputs** (128 bytes)
**GPIO configuration for 8 programmable outputs**

### Output Configuration (8 outputs: 0-7)
For each output:
- `firstDataIn` / `secondDataIn` - Input data sources
- `firstCompType` / `secondCompType` - Comparison operators
- `firstTarget` / `secondTarget` - Target values
- `firstBitwise` / `secondBitwise` - Bitwise operations
- `outputInverted0-7` - Output polarity (Active High/Low)
- `outputPin0-7` - Pin assignments
- `outputDelay0-7` - Activation delays
- `outputMode0-7` - PWM or On/Off mode
- `outputFreq0-7` - PWM frequency
- `outputDuty0-7` - PWM duty cycle

### Limiting Configuration
- `kindOfLimiting0-3` - Minimum or Maximum limiting

**Purpose:** Fully programmable outputs for fans, pumps, shift lights, nitrous, etc., based on any sensor input with logical conditions.

---

## **Page 14: Secondary Ignition Table** (288 bytes)
**Second ignition timing map for dual spark table mode**

### Contents
- `advTable2` - 16×16 Secondary advance table [256 bytes]
- `rpmBins3` - RPM axis bins [16 values]
- `mapBins2` - Load axis bins [16 values]

**Purpose:** Allows switching between two different ignition maps (e.g., for nitrous retard, race fuel, or different boost levels).

---

## **Page 15: Boost Duty Lookup & Advanced Boost** (128 bytes)
**Boost control duty cycle lookup table and advanced settings**

### Boost Duty Lookup Table
- `boostTableDutyLookup` - 8×8 Boost duty lookup (%) [64 bytes]
- `rpmBinsDutyLookup` - RPM bins [8 values]
- `loadBinsDutyLookup` - Load bins [8 values]

### Advanced Boost Control
- `boostControlEnable` - Baro or Fixed reference
- `boostDCWhenDisabled` - Duty cycle when disabled (%)
- `boostControlEnableThreshold` - Enable threshold (kPa)

### Additional Settings
- Various unused/reserved bits for future features

**Purpose:** Fine-tuned boost control with duty cycle mapping for better transient response.

---

## Summary Table

| Page | Name | Size | Primary Content |
|------|------|------|-----------------|
| 1 | Master Engine Config | 128 B | reqFuel, nCylinders, sensors, ASE/AE, flex |
| 2 | VE Table | 288 B | 16×16 fuel map + bins |
| 3 | Ignition Table | 288 B | 16×16 timing map + bins |
| 4 | Ignition Settings | 128 B | Trigger, dwell, rev limits, TAE/WUE bins |
| 5 | AFR Target Table | 288 B | 16×16 lambda/AFR map + bins |
| 6 | O2 & Control Systems | 128 B | EGO, boost, VVT, protection, idle, launch |
| 7 | Boost/VVT/Staging Tables | 240 B | 3× 8×8 tables + bins |
| 8 | Fuel Trim Tables | Large | 6× 6×6 trim tables + 4× ign trims |
| 9 | CAN & Serial Comms | Large | CAN bus, secondary serial, 16 input channels |
| 10 | Cranking & Rotary | 128 B | Cranking curves, rotary settings, staging size |
| 11 | Secondary VE Table | 288 B | 16×16 fuel map #2 + bins |
| 12 | WMI/VVT2/Dwell | 184 B | WMI 8×8, VVT2 8×8, Dwell 4×4 |
| 13 | Programmable Outputs | 128 B | 8 GPIO outputs with logic conditions |
| 14 | Secondary Ignition Table | 288 B | 16×16 timing map #2 + bins |
| 15 | Boost Duty Lookup | 128 B | 8×8 boost duty + advanced settings |

**Total Configuration Space: ~2.5 KB across 15 pages**

---

## Data Flow & Dependencies

### Critical Boot Sequence (Page 1 must be read first)
1. **Page 1** provides all fundamental engine parameters
2. **Page 4** provides trigger configuration (must match engine)
3. **Page 2** and **Page 3** provide fuel and spark maps
4. **Page 5** provides AFR targets for closed-loop
5. Other pages provide optional/advanced features

### Table Relationships
- **VE Tables** (Page 2, 11) work with **AFR Targets** (Page 5) to calculate fuel
- **Ignition Tables** (Page 3, 14) use same RPM/Load structure
- **Trim Tables** (Page 8) modify outputs from main tables
- **Staging Table** (Page 7) determines when to activate secondary injectors

### Control System Integration
- **Page 6** enables/disables systems (boost, VVT, O2, protection)
- **Page 7** provides target tables for those systems
- **Page 9** allows external inputs via CAN to influence any parameter
- **Page 13** provides outputs based on sensor conditions

---

**End of Detailed Page Breakdown**
