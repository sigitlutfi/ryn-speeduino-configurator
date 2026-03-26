# Speeduino INI File - Comprehensive Summary

## Overview
**Version:** speeduino 202504-dev
**INI Spec Version:** 3.64
**MegaTune Version:** 2.25
**File Size:** 1.1 MB (36,375 lines JSON)

---

## Table of Contents
1. [General Information](#general-information)
2. [Sections Overview](#sections-overview)
3. [Data Pages Structure](#data-pages-structure)
4. [Variables & Channels](#variables--channels)
5. [User Interface Components](#user-interface-components)
6. [Menu Structure](#menu-structure)
7. [Editors & Tools](#editors--tools)
8. [Preprocessor Definitions](#preprocessor-definitions)

---

## General Information

### MegaTune Configuration
- **MTversion:** 2.25
- **Query Command:** "Q"
- **Signature:** "speeduino 202504-dev"
- **Version Info:** "S" (displayed to user)

### TunerStudio Configuration
- **INI Spec Version:** 3.64

### Endianness
- **Byte Order:** Little Endian

---

## Sections Overview

Total of **22 main sections** in the INI file:

| Section | Description | Entry Count |
|---------|-------------|-------------|
| **MegaTune** | MegaTune protocol configuration | Properties only |
| **TunerStudio** | TunerStudio version info | Properties only |
| **SettingGroups** | User setting groups and options | ~50+ entries |
| **PcVariables** | PC-side calculated variables | 52 entries |
| **Constants** | ECU configuration constants | 15 pages |
| **EventTriggers** | Event-based triggers | 1 entry |
| **ConstantsExtensions** | Extended constant definitions | Multiple |
| **Menu** | Menu structure for TunerStudio | 123 items |
| **SettingContextHelp** | Context-sensitive help text | Multiple |
| **UserDefined** | User-defined parameters | Multiple |
| **ControllerCommands** | ECU command definitions | Multiple |
| **CurveEditor** | Curve configuration definitions | 34 curves |
| **TableEditor** | Table configuration definitions | 21 tables |
| **GaugeConfigurations** | Dashboard gauge definitions | 96 gauges |
| **FrontPage** | Main dashboard layout | Multiple |
| **OutputChannels** | Real-time data channels | 170 channels |
| **Datalog** | Data logging configuration | Multiple |
| **LoggerDefinition** | Logger field definitions | Multiple |
| **ReferenceTables** | Reference lookup tables | Multiple |
| **Tools** | Tool definitions | Multiple |
| **VeAnalyze** | VE table analysis tool | Multiple |
| **WueAnalyze** | Warmup enrichment analysis | Multiple |

---

## Data Pages Structure

### Constants Section - 15 Pages

The ECU configuration is divided into **15 data pages**, each containing related parameters:

| Page # | Content Category | Size | Key Contents |
|--------|------------------|------|--------------|
| **Page 1** | **MASTER ENGINE CONFIGURATION** | 128 B | **reqFuel, nCylinders, algorithm, pinLayout, tpsMin/Max, mapMin/Max, stoich, injLayout, nInjectors** + ASE/AE, Flex Fuel, Display (60+ vars) |
| **Page 2** | **VE Table (Fuel Map)** | 288 B | **veTable[16×16]**, rpmBins[16], fuelLoadBins[16] - Primary fuel map |
| **Page 3** | **Ignition Advance Table** | 288 B | **advTable1[16×16]**, rpmBins2[16], mapBins1[16] - Primary timing map |
| **Page 4** | **Ignition Settings** | 128 B | TrigPattern, sparkMode, dwell, numTeeth, revLimits, TAE/WUE bins |
| **Page 5** | **AFR Target Table** | 288 B | **lambdaTable/afrTable[16×16]**, rpmBinsAFR[16], loadBinsAFR[16] |
| **Page 6** | **O2 & Control Systems** | 128 B | egoType, egoKP/KI/KD, boostEnabled, vvtEnabled, engineProtect, launch |
| **Page 7** | **Boost/VVT/Staging Tables** | 240 B | boostTable[8×8], vvtTable[8×8], stagingTable[8×8] + bins |
| **Page 8** | **Fuel Trim Tables** | Large | fuelTrim1-6[6×6], ignTrim1-4[4×4] - Per-cylinder corrections |
| **Page 9** | **CAN Bus & Serial Comms** | Large | CAN settings, secondarySerial protocol, 16 input channels |
| **Page 10** | **Cranking & Rotary** | 128 B | crankingEnrich curves, rotaryType, stagedInjSize, EMAP |
| **Page 11** | **Secondary VE Table** | 288 B | **veTable2[16×16]** - Dual fuel map switching |
| **Page 12** | **WMI, VVT2, Dwell Tables** | 184 B | wmiTable[8×8], vvt2Table[8×8], dwellTable[4×4] |
| **Page 13** | **Programmable Outputs** | 128 B | 8 GPIO outputs with logic conditions (fans, pumps, etc.) |
| **Page 14** | **Secondary Ignition Table** | 288 B | **advTable2[16×16]** - Dual timing map switching |
| **Page 15** | **Boost Duty Lookup** | 128 B | boostDutyLookup[8×8], advanced boost control settings |

#### **Page 1 Detailed Breakdown** (Master Page - 128 bytes)

**1. Core Engine Settings** (Critical for startup):
- `reqFuel` (offset 24) - Required fuel in ms per cylinder
- `nCylinders` (offset 36) - Number of cylinders (1-8)
- `algorithm` (offset 37) - Load algorithm (Speed Density/Alpha-N/MAF)
- `engineType` (offset 38) - Even fire / Odd fire
- `divider` (offset 25) - Injection divider
- `alternate` (offset 26) - Simultaneous vs Alternating injection
- `injLayout` (offset 38) - Paired/Semi-Sequential/Sequential
- `nInjectors` (offset 37) - Number of injector outputs (1-8)
- `twoStroke` (offset 36) - 2-stroke or 4-stroke

**2. Hardware Configuration**:
- `pinLayout` (offset 15) - Board type selection (v0.2, v0.3, v0.4, Teensy, etc.)
- `tachoPin` (offset 16) - Tachometer output pin
- `tachoDiv` / `tachoDuration` (offset 16-17) - Tacho configuration

**3. Sensor Calibration**:
- `tpsMin` / `tpsMax` (offset 44-45) - TPS voltage calibration
- `mapMin` / `mapMax` (offset 46-47) - MAP sensor range (kPa)
- `stoich` (offset 50) - Stoichiometric AFR ratio

**4. Injector Settings**:
- `injOpen` (offset 27) - Injector opening time (dead time)
- `injAng` (offset 28) - Injection angle array [4 values]
- `dutyLim` (offset 40) - Maximum injector duty cycle limit

**5. Flex Fuel**:
- `flexEnabled` (offset 38) - Enable/disable flex fuel
- `flexFreqLow` / `flexFreqHigh` (offset 41-42) - Flex sensor frequency range

**6. Starting & Enrichment**:
- `aseTaperTime` (offset 0) - After-start enrichment taper time
- `aeColdPct` / `aeColdTaperMin` / `aeColdTaperMax` (offset 1-2, 39) - Cold AE adjustment
- `wueRates` (offset 4) - Warmup enrichment rates [10 values]
- `crankingPct` (offset 14) - Cranking enrichment percentage

**7. Acceleration Enrichment**:
- `aeMode` (offset 3) - AE based on TPS or MAP
- `aeTime` (offset 20) - AE duration
- `maeThresh` / `taeThresh` (offset 18-19) - MAP/TPS thresholds for triggering AE
- `maeMinChange` / `taeMinChange` (offset 21-22) - Minimum change to trigger AE
- `aeApplyMode` (offset 3) - PW Multiplier or Adder

**8. Engine Protection & Features**:
- `hardCutType` (offset 26) - Rev limiter type (Full/Rolling)
- `dfcoEnabled` (offset 38) - Deceleration Fuel Cut Off
- `baroCorr` (offset 38) - Barometric correction enable
- `perToothIgn` (offset 38) - Per-tooth ignition

**9. Fuel Pump & Other**:
- `fpPrime` (offset 49) - Fuel pump prime duration (seconds)
- `boostMaxDuty` (offset 43) - Maximum boost solenoid duty
- `oddfire2/3/4` (offset 51+) - Odd-fire cylinder timing offsets

**10. Display Options**:
- `displayB1` / `displayB2` (offset 23) - OLED display field selections

**11. Advanced Flags**:
- `includeAFR` (offset 26) - Include AFR in calculations
- `ignAlgorithm` (offset 26) - Ignition load algorithm
- `indInjAng` (offset 26) - Individual injection angles
- `fixAngEnable` (offset 37) - Fixed angle enable
- `legacyMAP` (offset 38) - Legacy MAP reading mode
- `mapSample` (offset 36) - MAP sampling method
- `injType` (offset 36) - Port or Throttle Body injection
- `multiplyMAP` (offset 3) - MAP multiplication mode
- `SoftLimitMode` (offset 3) - Soft limiter behavior
- `useTachoSweep` (offset 3) - Tacho sweep on startup

**Total:** ~60+ variables in 128 bytes

### Data Types Used

- **scalar** - Single value parameters
- **array** - Multi-dimensional data arrays
- **bits** - Bit-field selections
- **string** - Text strings

### Variable Types
- **U08** - Unsigned 8-bit (0-255)
- **U16** - Unsigned 16-bit (0-65535)
- **S08** - Signed 8-bit (-128 to 127)
- **S16** - Signed 16-bit (-32768 to 32767)

---

## Variables & Channels

### PcVariables (52 entries)
PC-side calculated variables for display and analysis:
- Derived calculations from raw ECU data
- Unit conversions
- Complex mathematical expressions
- Display formatting helpers

### OutputChannels (170 entries)
Real-time data channels from ECU:
- **Engine Status:** RPM, Load, TPS, MAP
- **Fuel System:** Injector pulse width, AFR, fuel pressure
- **Ignition:** Advance, dwell time, knock detection
- **Sensors:** CLT, IAT, O2, battery voltage
- **Control Systems:** Idle, boost, VVT status
- **Diagnostics:** Error codes, sync status
- **Advanced:** CAN data, flex fuel %, knock counts

---

## User Interface Components

### Setting Groups
User-configurable display options:
- **Pressure Units:** PSI vs BAR
- **Hardware Test Page:** Enable/disable
- **Reset Control Features:** Basic vs Advanced
- **MCU Selection:** Arduino Mega 2560, Teensy, etc.

### Dialogs & Panels
Multiple dialog boxes for configuration categories:
- Fuel settings dialogs
- Ignition configuration panels
- Sensor calibration dialogs
- Advanced features panels

### Gauge Configurations (96 gauges)
Pre-defined dashboard gauges including:
- RPM tachometer
- Speedometer
- AFR gauge
- Boost gauge
- Temperature gauges (CLT, IAT)
- Voltage/current meters
- Duty cycle indicators
- Status indicators

---

## Menu Structure

**Total Menu Items:** 123

Main menu categories typically include:
- **Tuning:**
  - VE Table (Primary fuel)
  - AFR Table (Target AFR)
  - Spark/Timing Table
  - Boost Table

- **Acceleration:**
  - Acceleration Enrichment
  - Deceleration Settings

- **Starting:**
  - Cranking Settings
  - After-Start Enrichment
  - Warmup Enrichment

- **Idle:**
  - Idle Control Settings
  - Idle Advance Table

- **Sensors:**
  - CLT Sensor Calibration
  - IAT Sensor Calibration
  - O2 Sensor Settings
  - TPS Calibration

- **Spark/Ignition:**
  - Dwell Settings
  - Spark Output Configuration
  - Trigger Setup

- **Engine Protection:**
  - Rev Limiter
  - Over-boost Protection
  - Temperature Limits

- **Advanced:**
  - CAN Bus
  - Flex Fuel
  - Launch Control
  - Flat Shift
  - Programmable Outputs

---

## Editors & Tools

### Curve Editor (34 curves)
Pre-defined curve editors for:
- Warmup Enrichment (WUE)
- Cranking Enrichment
- After-Start Enrichment (ASE)
- Air Density Correction
- Injector Dead Time
- Battery Voltage Correction
- MAP vs BAR0 calibration
- Knock window curves

### Table Editor (21 tables)
2D and 3D table editors:
- **Primary Tables:**
  - VE Table 1 & 2 (Fuel)
  - Ignition Advance Table
  - AFR Target Table

- **Secondary Tables:**
  - Boost Target Table
  - VVT Target Table
  - Trim Tables
  - Staging Tables

### Analysis Tools
- **VeAnalyze:** VE table auto-tuning from logs
- **WueAnalyze:** Warmup enrichment optimization

---

## Preprocessor Definitions

**Total Preprocessor Directives:** 81
- **Defines:** 80
- **Unsets:** 1

### Common Preprocessor Macros

#### Invalid Data Patterns
```
invalid_x8  = "INVALID" repeated 8 times
invalid_x16 = invalid_x8, invalid_x8
invalid_x32 = invalid_x16, invalid_x16
invalid_x64 = invalid_x32, invalid_x32
```

#### Load Source Names
Predefined names for load algorithms:
- Speed Density (MAP)
- Alpha-N (TPS)
- MAF-based
- IMAP (Blended)

#### Pin Definitions
Predefined pin names for various boards:
- Arduino Mega 2560 pins
- Teensy pins
- STM32 pins
- Custom board mappings

#### Common Value Sets
- Cylinder counts (1-12)
- Injector configurations (1-8 channels)
- Ignition outputs (1-8 channels)
- Enable/Disable options
- On/Off states

---

## Key Features & Capabilities

### Engine Control
- Sequential fuel injection (up to 8 cylinders)
- Coil-on-plug ignition (up to 8 cylinders)
- Multiple trigger patterns (60-2, 36-1, 24-1, etc.)
- Multi-spark at low RPM
- Staged injection support
- Variable cam timing (VVT)

### Fuel Management
- Speed Density or Alpha-N algorithms
- Flex fuel support
- Closed-loop AFR control
- MAP-based or TPS-based fuel tables
- Acceleration enrichment
- Deceleration fuel cut
- Injector staging

### Ignition Control
- 3D timing tables
- Dwell control (fixed or battery-compensated)
- Knock control integration
- Multiple spark per revolution
- Launch control
- Flat shift
- Timing trim by gear

### Advanced Features
- Boost control (open or closed loop)
- Nitrous control (wet or dry)
- Anti-lag system
- Traction control
- CAN bus communication
- Programmable I/O (GPIO)
- OLED display support

### Diagnostics & Logging
- Real-time data streaming
- 170+ output channels
- Integrated data logging
- Error code system
- Tooth logging (trigger debugging)
- Composite logging

---

## Technical Specifications

### Memory Structure
- **Total Pages:** 15
- **Page Size:** Variable (typically 128-256 bytes each)
- **Total Configuration:** ~2-3KB of EEPROM

### Communication Protocol
- **Protocol:** MegaTune/TunerStudio compatible
- **Query Command:** "Q"
- **Baud Rate:** Configurable (typically 115200)
- **Interface:** Serial, USB, or CAN

### Supported Hardware
- Arduino Mega 2560
- Teensy 3.x/4.x
- STM32 (Black Pill)
- Various speeduino shield boards

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Lines (JSON) | 36,375 |
| File Size | 1.1 MB |
| Sections | 22 |
| Data Pages | 15 |
| Menu Items | 123 |
| Output Channels | 170 |
| PcVariables | 52 |
| Curves | 34 |
| Tables | 21 |
| Gauges | 96 |
| Preprocessor Defines | 80 |

---

## Generated Files

This summary is based on the JSON conversion of the Speeduino INI file:
- **Source:** `reference/202202.ini`
- **Converted to:** `speeduino.json`
- **Conversion tool:** `speeduino_ini_to_json.py`
- **Date:** 2026-03-26

---

## Notes

- This is a development version (202504-dev) and may contain features not present in stable releases
- Some features require specific hardware or firmware versions
- Page layout and variable positions may change between versions
- Always verify compatibility between INI version and firmware version

---

**End of Summary**
