# Referensi hasil ekstraksi source

Dihasilkan oleh [generator](tools/generate-reference.mjs). Jalankan `node docs/tools/generate-reference.mjs` dari root repository. Snapshot CELSIUS; Fahrenheit tetap harus diuji. Ekstraksi literal bukan daftar lengkap kontrol dinamis, dan nama field yang ditemukan belum tentu editable di layar itu.

## Baseline

- Firmware: `speeduino 202504-ryn-perf-v5`
- Firmware commit: `139eee865fa7743cf9812656e9564da82f79db25`
- App HEAD: `4284293804c38010e7126d81c10dd8e0c94737e4`; dokumentasi mencakup perubahan working tree, bukan HEAD saja.
- INI SHA-256: `166ef191c160dffa1399dac1b686b6c9c35ee87ff894e556ba087b53a5537a73`
- Telemetry: 167 byte.

## Pages

| Page | Bytes | Fields | requiresPowerCycle |
| --- | --- | --- | --- |
| 1 | 128 | 120 | pinLayout, reqFuel, alternate, injOpen, twoStroke, nCylinders, engineType, flexEnabled, legacyMAP, injLayout, oddfire2, oddfire3, oddfire4, idleUpEnabled, iacCLminValue, iacCLmaxValue, CTPSPin, CTPSPolarity, CTPSEnabled, vssMode, vssPin, idleUpOutputEnabled |
| 2 | 288 | 3 |  |
| 3 | 288 | 3 |  |
| 4 | 128 | 73 | TrigEdge, IgInv, TrigEdgeSec, trigPatternSec, resetControl, resetControlPin, sparkMode, numTeeth, missingTeeth, ignBypassEnable, inj4CylPairing |
| 5 | 288 | 4 |  |
| 6 | 143 | 102 | boostEnabled, vvtEnabled, useExtBaro, useEMAP, boostFreq, vvtFreq, idleFreq, launchPin, launchEnable, launchHiLo, baroPin, fanInv, fanPin, pitLimiterEnabled, pitLimiterPin, pitLimiterPinMode, rumbleIdleEnabled, rumbleIdlePin, rumbleIdlePinMode |
| 7 | 240 | 9 |  |
| 8 | 384 | 24 |  |
| 9 | 192 | 232 | caninput_sel0a, caninput_sel0b, caninput_sel1a, caninput_sel1b, caninput_sel2a, caninput_sel2b, caninput_sel3a, caninput_sel3b, caninput_sel4a, caninput_sel4b, caninput_sel5a, caninput_sel5b, caninput_sel6a, caninput_sel6b, caninput_sel7a, caninput_sel7b, caninput_sel8a, caninput_sel8b, caninput_sel9a, caninput_sel9b, caninput_sel10a, caninput_sel10b, caninput_sel11a, caninput_sel11b, caninput_sel12a, caninput_sel12b, caninput_sel13a, caninput_sel13b, caninput_sel14a, caninput_sel14b, caninput_sel15a, caninput_sel15b |
| 10 | 220 | 155 | rotaryType, stagingEnabled, stagedInjSizePri, stagedInjSizeSec, n2o_enable, n2o_arming_pin, n2o_pin_polarity, knock_mode, knock_pin, knock_trigger, knock_pullup, fuel2InputPin, fuel2InputPolarity, fuelPressureEnable, oilPressureEnable, oilPressurePin, fuelPressurePin, wmiEnabled, wmiIndicatorEnabled, wmiIndicatorPin, wmiIndicatorPolarity, wmiEmptyEnabled, wmiEmptyPin, wmiEmptyPolarity, vvtCLminDuty, vvtCLmaxDuty, alsEnabled, alsSwitchPolarity, alsSwitchPin, rollingPopBangEnabled, rollingPopBangPin, rollingPopBangPinMode |
| 11 | 288 | 3 |  |
| 12 | 192 | 9 |  |
| 13 | 128 | 104 | outputPin, onboard_log_file_style |
| 14 | 288 | 3 |  |
| 15 | 256 | 53 | airConEnable, airConCompPol, airConReqPol, airConFanEnabled, airConFanPol, airConCompPin, airConReqPin, airConFanPin |

## Semua route terpasang

GettingStarted tampil bila belum ada project; ProjectSettings dan dialog sinkronisasi bukan route terpisah.

| Route ID | Path | Component/source |
| --- | --- | --- |
| ANALYSIS | /analysis | [Analysis](../src/renderer/features/dashboard/Analysis.jsx) |
| TUNING_VE | /tuning/ve | [VETable](../src/renderer/features/fuel/VETable.jsx) |
| TUNING_VE2 | /tuning/ve2 | [VETable2](../src/renderer/features/fuel/VETable2.jsx) |
| TUNING_IGNITION | /tuning/ignition | [IgnitionTable](../src/renderer/features/spark/IgnitionTable.jsx) |
| TUNING_IGNITION2 | /tuning/ignition2 | [IgnitionTable2](../src/renderer/features/spark/IgnitionTable2.jsx) |
| TUNING_AFR | /tuning/afr | [AFRTable](../src/renderer/features/fuel/AFRTable.jsx) |
| TUNING_LAMBDA | /tuning/lambda | [LambdaTable](../src/renderer/features/fuel/LambdaTable.jsx) |
| SETTINGS_FUEL | /fuel/strategy | [FuelSettings](../src/renderer/features/fuel/FuelSettings.jsx) |
| SETTINGS_ENGINE | /settings/engine | [EngineSettings](../src/renderer/features/engine/EngineSettings.jsx) |
| SETTINGS_TRIGGER | /settings/trigger | [TriggerSetup](../src/renderer/features/engine/TriggerSetup.jsx) |
| SETTINGS_IAT | /settings/iat | [IATCorrection](../src/renderer/features/fuel/curves/IATCorrection.jsx) |
| SETTINGS_INJECTOR | /settings/injector | [InjectorCharacteristics](../src/renderer/features/engine/InjectorCharacteristics.jsx) |
| SETTINGS_PROGRAMMABLE | /settings/programmable | [ProgrammableOutputs](../src/renderer/features/io/ProgrammableOutputs.jsx) |
| SETTINGS_IO_SUMMARY | /io/summary | [IOSummary](../src/renderer/features/io/IOSummary.jsx) |
| SETTINGS_SPARK | /settings/spark | [SparkSetup](../src/renderer/features/spark/SparkSetup.jsx) |
| SETTINGS_AFR | /settings/afr | [AFRO2Settings](../src/renderer/features/fuel/AFRO2Settings.jsx) |
| SETTINGS_FLEX | /settings/flex | [FlexFuelSettings](../src/renderer/features/fuel/FlexFuelSettings.jsx) |
| SETTINGS_PROTECTION | /engine/protection | [EngineProtection](../src/renderer/features/engine/EngineProtection.jsx) |
| STARTUP_CRANKING | /startup/cranking | [CrankingSettings](../src/renderer/features/startup/CrankingSettings.jsx) |
| STARTUP_CURVES | /startup/curves | [StartupCurves](../src/renderer/features/startup/StartupCurves.jsx) |
| STARTUP_IDLE | /startup/idle | [IdleControl](../src/renderer/features/startup/IdleControl.jsx) |
| RACING_LAUNCH | /racing/launch | [LaunchControl](../src/renderer/features/racing/LaunchControl.jsx) |
| RACING_FLATSHIFT | /racing/flatshift | [FlatShift](../src/renderer/features/racing/FlatShift.jsx) |
| RACING_PITLIMITER | /racing/pit-limiter | [PitLimiter](../src/renderer/features/racing/PitLimiter.jsx) |
| RACING_RUMBLEIDLE | /racing/rumble-idle | [RumbleIdle](../src/renderer/features/racing/RumbleIdle.jsx) |
| RACING_ANTILAG | /racing/anti-lag | [AntiLag](../src/renderer/features/racing/AntiLag.jsx) |
| RACING_POPANDBANG | /racing/popandbang | [PopAndBang](../src/renderer/features/racing/PopAndBang.jsx) |
| RACING_PROFILES | /racing/runtime-profiles | [RuntimeProfiles](../src/renderer/features/dashboard/RuntimeProfiles.jsx) |
| RACING_PROFILE_EDITOR | /racing/runtime-profiles/:profileId | [RuntimeProfileEditor](../src/renderer/features/dashboard/RuntimeProfileEditor.jsx) |
| RACING_NITROUS | /racing/nitrous | [Nitrous](../src/renderer/features/racing/Nitrous.jsx) |
| ADDON_FUELPUMP | /io/fuelpump | [FuelPump](../src/renderer/features/io/FuelPump.jsx) |
| SETTINGS_FAN | /io/fan | [FanSettings](../src/renderer/features/io/FanSettings.jsx) |
| SETTINGS_WMI | /io/wmi | [WMI](../src/renderer/features/racing/WMI.jsx) |
| SETTINGS_VVT | /engine/vvt | [VVTControl](../src/renderer/features/engine/VVTControl.jsx) |
| SETTINGS_BOOST | /fuel/boost | [BoostControl](../src/renderer/features/fuel/BoostControl.jsx) |
| SETTINGS_STAGED | /fuel/staged | [StagedInjection](../src/renderer/features/fuel/StagedInjection.jsx) |
| SETTINGS_CALIBRATION | /tools/calibration | [SensorCalibration](../src/renderer/features/tools/SensorCalibration.jsx) |
| TOOLS_DIAGNOSTICS | /tools/diagnostics | [ProtocolStats](../src/renderer/features/tools/ProtocolStats.jsx) |
| TOOLS_FLASH_FIRMWARE | /tools/flash-firmware | [FlashFirmware](../src/renderer/features/system/FlashFirmware.jsx) |
| SETTINGS_TACHO | /io/tacho | [TachoOutput](../src/renderer/features/io/TachoOutput.jsx) |
| COMM | /comm | [Communications](../src/renderer/features/system/Communications.jsx) |
| TERMINAL | /terminal | [RawConsole](../src/renderer/features/tools/RawConsole.jsx) |
| APP_SETTINGS | /app-settings | [GlobalPreferencesPage](../src/renderer/features/system/GlobalPreferencesPage.jsx) |
| DASHBOARD | / | [Dashboard](../src/renderer/features/dashboard/Dashboard.jsx) |

## Tabel INI

| ID | Page | X / Y / Z | Z shape |
| --- | --- | --- | --- |
| veTable1Tbl | 2 | rpmBins / fuelLoadBins / veTable | 16 × 16 |
| fuelTable2Tbl | 11 | fuelRPM2Bins / fuelLoad2Bins / veTable2 | 16 × 16 |
| sparkTbl | 3 | rpmBins2 / mapBins1 / advTable1 | 16 × 16 |
| spark2Tbl | 14 | rpmBins3 / mapBins2 / advTable2 | 16 × 16 |
| afrTable1Tbl | 5 | rpmBinsAFR / loadBinsAFR / afrTable | 16 × 16 |
| lambdaTable1Tbl | 5 | rpmBinsAFR / loadBinsAFR / lambdaTable | 16 × 16 |
| boostTbl | 7 | rpmBinsBoost / tpsBinsBoost / boostTable | 8 × 8 |
| boostDCLupTbl | 15 | rpmBinsDutyLookup / loadBinsDutyLookup / boostTableDutyLookup | 8 × 8 |
| vvtTbl | 7 | rpmBinsVVT / loadBinsVVT / vvtTable | 8 × 8 |
| vvt2Tbl | 12 | rpmBinsVVT2 / loadBinsVVT2 / vvt2Table | 8 × 8 |
| wmiTbl | 12 | rpmBinsWMI / mapBinsWMI / wmiTable | 8 × 8 |
| stagingTbl | 7 | rpmBinsStaging / loadBinsStaging / stagingTable | 8 × 8 |
| fuelTrimTable1Tbl | 8 | fuelTrim1rpmBins / fuelTrim1loadBins / fuelTrim1Table | 6 × 6 |
| fuelTrimTable2Tbl | 8 | fuelTrim2rpmBins / fuelTrim2loadBins / fuelTrim2Table | 6 × 6 |
| fuelTrimTable3Tbl | 8 | fuelTrim3rpmBins / fuelTrim3loadBins / fuelTrim3Table | 6 × 6 |
| fuelTrimTable4Tbl | 8 | fuelTrim4rpmBins / fuelTrim4loadBins / fuelTrim4Table | 6 × 6 |
| fuelTrimTable5Tbl | 8 | fuelTrim5rpmBins / fuelTrim5loadBins / fuelTrim5Table | 6 × 6 |
| fuelTrimTable6Tbl | 8 | fuelTrim6rpmBins / fuelTrim6loadBins / fuelTrim6Table | 6 × 6 |
| fuelTrimTable7Tbl | 8 | fuelTrim7rpmBins / fuelTrim7loadBins / fuelTrim7Table | 6 × 6 |
| fuelTrimTable8Tbl | 8 | fuelTrim8rpmBins / fuelTrim8loadBins / fuelTrim8Table | 6 × 6 |
| dwell_map | 12 | rpmBinsDwell / loadBinsDwell / dwellTable | 4 × 4 |

## Referensi field literal per layar

Gabungkan dengan child component/curve dan kontrak INI. Field dengan `type=bits` adalah nilai enum hasil ekstraksi bit, bukan byte penuh.

### FuelSettings

[Source](../src/renderer/features/fuel/FuelSettings.jsx) · `/fuel/strategy`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| multiplyMAP | 1 | bits/U08 | 3 | 6:7 |  | 1; 0 |
| includeAFR | 1 | bits/U08 | 26 | 2:2 |  | 1; 0 |
| incorporateAFR | 1 | bits/U08 | 70 | 7:7 |  | 1; 0 |
| fuel2Mode | 10 | bits/U08 | 122 | 3:5 |  | 1; 0 |
| fuel2SwitchVariable | 10 | bits/U08 | 122 | 6:7 |  | 1; 0 |
| fuel2SwitchValue | 10 | scalar/U16 | 123 |  | { bitStringValue(fuel2SwitchUnits,  fuel2SwitchVariable) } | 1; 0 |
| fuel2InputPin | 10 | bits/U08 | 125 | 0:5 |  | 1; 0 |
| fuel2InputPolarity | 10 | bits/U08 | 125 | 6:6 |  | 1; 0 |
| fuel2InputPullup | 10 | bits/U08 | 125 | 7:7 |  | 1; 0 |

### EngineSettings

[Source](../src/renderer/features/engine/EngineSettings.jsx) · `/settings/engine`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| pinLayout | 1 | bits/U08 | 15 | 0:7 |  | 1; 0 |
| reqFuel | 1 | scalar/U08 | 24 |  | ms | 0.1; 0 |
| divider | 1 | scalar/U08 | 25 |  |  | 1; 0 |
| alternate | 1 | bits/U08 | 26 | 0:0 |  | 1; 0 |
| injOpen | 1 | scalar/U08 | 27 |  | ms | 0.1; 0 |
| mapSample | 1 | bits/U08 | 36 | 0:1 |  | 1; 0 |
| twoStroke | 1 | bits/U08 | 36 | 2:2 |  | 1; 0 |
| injType | 1 | bits/U08 | 36 | 3:3 |  | 1; 0 |
| nCylinders | 1 | bits/U08 | 36 | 4:7 |  | 1; 0 |
| algorithm | 1 | bits/U08 | 37 | 0:2 |  | 1; 0 |
| nInjectors | 1 | bits/U08 | 37 | 4:7 |  | 1; 0 |
| engineType | 1 | bits/U08 | 38 | 0:0 |  | 1; 0 |
| injLayout | 1 | bits/U08 | 38 | 4:5 |  | 1; 0 |
| stoich | 1 | scalar/U08 | 50 |  | :1 | 0.1; 0 |
| sparkMode | 4 | bits/U08 | 12 | 2:4 |  | 1; 0 |

### TriggerSetup

[Source](../src/renderer/features/engine/TriggerSetup.jsx) · `/settings/trigger`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| TrigAng | 4 | scalar/S16 | 0 |  | Deg | 1; 0 |
| TrigAngMul | 4 | scalar/U08 | 4 |  |  | 1; 0 |
| TrigEdge | 4 | bits/U08 | 5 | 0:0 |  | 1; 0 |
| TrigSpeed | 4 | bits/U08 | 5 | 1:1 |  | 1; 0 |
| TrigPattern | 4 | bits/U08 | 5 | 3:7 |  | 1; 0 |
| TrigEdgeSec | 4 | bits/U08 | 6 | 0:0 |  | 1; 0 |
| useResync | 4 | bits/U08 | 6 | 7:7 |  | 1; 0 |
| trigPatternSec | 4 | bits/U08 | 8 | 0:6 |  | 1; 0 |
| SkipCycles | 4 | scalar/U08 | 11 |  | cycles | 1; 0 |
| TrigFilter | 4 | bits/U08 | 12 | 5:6 |  | 1; 0 |
| dwellcrank | 4 | scalar/U08 | 13 |  | ms | 0.1; 0 |
| numTeeth | 4 | scalar/U08 | 15 |  | teeth | 1; 0 |
| missingTeeth | 4 | scalar/U08 | 16 |  | teeth | 1; 0 |
| crankRPM | 4 | scalar/U08 | 17 |  | rpm | 10; 0 |

### IATCorrection

[Source](../src/renderer/features/fuel/curves/IATCorrection.jsx) · `/settings/iat`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| airDenBins | 6 | array/U08 | 27 | 9 | C | 1; -40 |
| airDenRates | 6 | array/U08 | 36 | 9 | % | 1; 0 |

### InjectorCharacteristics

[Source](../src/renderer/features/engine/InjectorCharacteristics.jsx) · `/settings/injector`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| injOpen | 1 | scalar/U08 | 27 |  | ms | 0.1; 0 |
| injAng | 1 | array/U16 | 28 | 4 | deg | 1; 0 |
| dutyLim | 1 | scalar/U08 | 40 |  | % | 1; 0 |
| injAngRPM | 1 | array/U08 | 95 | 4 | RPM | 100; 0 |
| brvBins | 6 | array/U08 | 15 | 6 | V | 0.1; 0 |
| injBatRates | 6 | array/U08 | 21 | 6 | % | 1; 0 |

### ProgrammableOutputs

[Source](../src/renderer/features/io/ProgrammableOutputs.jsx) · `/settings/programmable`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| outputPin | 13 | array/U08 | 2 | 8 |  | 1; 0 |
| outputDelay | 13 | array/U08 | 10 | 8 | S | 0.1; 0 |
| firstDataIn | 13 | array/U08 | 18 | 8 |  | 1; 0 |
| secondDataIn | 13 | array/U08 | 26 | 8 |  | 1; 0 |
| outputTimeLimit | 13 | array/U08 | 34 | 8 | S | 0.1; 0 |
| firstTarget | 13 | array/S16 | 50 | 8 |  | 1; 0 |
| secondTarget | 13 | array/S16 | 66 | 8 |  | 1; 0 |

### SparkSetup

[Source](../src/renderer/features/spark/SparkSetup.jsx) · `/settings/spark`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| ignAlgorithm | 1 | bits/U08 | 26 | 4:6 |  | 1; 0 |
| fixAngEnable | 1 | bits/U08 | 37 | 3:3 |  | 1; 0 |
| perToothIgn | 1 | bits/U08 | 38 | 6:6 |  | 1; 0 |
| useDwellMap | 1 | bits/U08 | 70 | 2:2 |  | 1; 0 |
| FixAng | 4 | scalar/S08 | 2 |  | Deg | 1; 0 |
| CrankAng | 4 | scalar/S08 | 3 |  | Deg | 1; 0 |
| IgInv | 4 | bits/U08 | 5 | 2:2 |  | 1; 0 |
| sparkDur | 4 | scalar/U08 | 7 |  | ms | 0.1; 0 |
| useDwellLim | 4 | bits/U08 | 12 | 1:1 |  | 1; 0 |
| sparkMode | 4 | bits/U08 | 12 | 2:4 |  | 1; 0 |
| dwellcrank | 4 | scalar/U08 | 13 |  | ms | 0.1; 0 |
| dwellrun | 4 | scalar/U08 | 14 |  | ms | 0.1; 0 |
| dwellLim | 4 | scalar/U08 | 41 |  | ms | 1; 0 |
| dwellErrCorrect | 4 | bits/U08 | 123 | 3:3 |  | 1; 0 |

### AFRO2Settings

[Source](../src/renderer/features/fuel/AFRO2Settings.jsx) · `/settings/afr`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| egoAlgorithm | 6 | bits/U08 | 0 | 0:1 |  | 1; 0 |
| egoType | 6 | bits/U08 | 0 | 2:3 |  | 1; 0 |
| egoKP | 6 | scalar/U08 | 1 |  | % | 1; 0 |
| egoKI | 6 | scalar/U08 | 2 |  | % | 1; 0 |
| egoKD | 6 | scalar/U08 | 3 |  | % | 1; 0 |
| egoTemp | 6 | scalar/U08 | 4 |  | C | 1; -40 |
| egoCount | 6 | scalar/U08 | 5 |  |  | 4; 0 |
| egoLimit | 6 | scalar/U08 | 7 |  |  | 1; 0 |
| ego_min_afr | 6 | scalar/U08 | 8 |  | AFR | 0.1; 0 |
| ego_max_afr | 6 | scalar/U08 | 9 |  | AFR | 0.1; 0 |
| ego_sdelay | 6 | scalar/U08 | 10 |  | sec | 1; 0 |
| egoRPM | 6 | scalar/U08 | 11 |  | rpm | 100; 0 |
| egoTPSMax | 6 | scalar/U08 | 12 |  | % | 0.5; 0 |

### FlexFuelSettings

[Source](../src/renderer/features/fuel/FlexFuelSettings.jsx) · `/settings/flex`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| flexEnabled | 1 | bits/U08 | 38 | 1:1 |  | 1; 0 |
| flexFreqLow | 1 | scalar/U08 | 41 |  | Hz | 1; 0 |
| flexFreqHigh | 1 | scalar/U08 | 42 |  | Hz | 1; 0 |
| FILTER_FLEX | 4 | scalar/U08 | 125 |  | % | 1; 0 |
| boostEnabled | 6 | bits/U08 | 0 | 4:4 |  | 1; 0 |
| flexBoostBins | 10 | array/U08 | 32 | 6 | % | 1; 0 |
| flexBoostAdj | 10 | array/S16 | 38 | 6 | kPa | 1; 0 |
| flexFuelBins | 10 | array/U08 | 50 | 6 | % | 1; 0 |
| flexFuelAdj | 10 | array/U08 | 56 | 6 | % | 1; 0 |
| flexAdvBins | 10 | array/U08 | 62 | 6 | % | 1; 0 |
| flexAdvAdj | 10 | array/U08 | 68 | 6 | Deg | 1; -40 |

### EngineProtection

[Source](../src/renderer/features/engine/EngineProtection.jsx) · `/engine/protection`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| hardCutType | 1 | bits/U08 | 26 | 3:3 |  | 1; 0 |
| SoftRevLim | 4 | scalar/U08 | 19 |  | rpm | 100; 0 |
| SoftLimRetard | 4 | scalar/U08 | 20 |  | deg | 1; 0 |
| SoftLimMax | 4 | scalar/U08 | 21 |  | s | 0.1; 0 |
| hardRevLim | 4 | scalar/U08 | 22 |  | rpm | 100; 0 |
| engineProtectMaxRPM | 4 | scalar/U08 | 120 |  | rpm | 100; 0 |
| engineProtectType | 6 | bits/U08 | 0 | 6:7 |  | 1; 0 |
| boostCutEnabled | 6 | bits/U08 | 6 | 7:7 |  | 1; 0 |
| boostLimit | 6 | scalar/U08 | 56 |  | kPa | 2; 0 |
| coolantProtRPM | 9 | array/U08 | 167 | 6 | RPM | 100; 0 |
| coolantProtTemp | 9 | array/U08 | 173 | 6 | C | 1; -40 |
| afrProtectEnabled | 9 | bits/U08 | 185 | 0:1 |  | 1; 0 |
| afrProtectMAP | 9 | scalar/U08 | 186 |  | kPa | 2; 0 |
| afrProtectRPM | 9 | scalar/U08 | 187 |  | RPM | 100; 0 |
| afrProtectTPS | 9 | scalar/U08 | 188 |  | % | 0.5; 0 |
| afrProtectDeviation | 9 | scalar/U08 | 189 |  | AFR | 0.1; 0 |
| oilPressureMin | 10 | scalar/S08 | 139 |  | psi | 1; 0 |
| oilPressureMax | 10 | scalar/U08 | 140 |  | psi | 1; 0 |
| oilPressureProtMins | 10 | array/U08 | 145 | 4 | psi | 1; 0 |
| oilPressureProtRPM | 10 | array/U08 | 141 | 4 | RPM | 100; 0 |
| rollingProtRPMDelta | 15 | array/S08 | 98 | 4 | RPM | 10; 0 |
| rollingProtCutPercent | 15 | array/U08 | 102 | 4 | % | 1; 0 |

### CrankingSettings

[Source](../src/renderer/features/startup/CrankingSettings.jsx) · `/startup/cranking`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| aseTaperTime | 1 | scalar/U08 | 0 |  | S | 0.1; 0 |
| aeColdPct | 1 | scalar/U08 | 1 |  | % | 1; 0 |
| aeColdTaperMin | 1 | scalar/U08 | 2 |  | C | 1; -40 |
| crankingPct | 1 | scalar/U08 | 14 |  | % | 1; 0 |
| crkngAddCLTAdv | 1 | bits/U08 | 26 | 1:1 |  | 1; 0 |
| aeColdTaperMax | 1 | scalar/U08 | 39 |  | C | 1; -40 |
| fpPrime | 1 | scalar/U08 | 49 |  | s | 1; 0 |
| primingDelay | 1 | scalar/U08 | 120 |  | S | 0.1; 0 |
| crankRPM | 4 | scalar/U08 | 17 |  | rpm | 10; 0 |
| tpsflood | 4 | scalar/U08 | 18 |  | % | 0.5; 0 |

### StartupCurves

[Source](../src/renderer/features/startup/StartupCurves.jsx) · `/startup/curves`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| aseTaperTime | 1 | scalar/U08 | 0 |  | S | 0.1; 0 |
| wueRates | 1 | array/U08 | 4 | 10 | % | 1; 0 |
| crankingPct | 1 | scalar/U08 | 14 |  | % | 1; 0 |
| fpPrime | 1 | scalar/U08 | 49 |  | s | 1; 0 |
| asePct | 1 | array/U08 | 71 | 4 | % | 1; 0 |
| aseCount | 1 | array/U08 | 75 | 4 | s | 1; 0 |
| aseBins | 1 | array/U08 | 79 | 4 | C | 1; -40 |
| primePulse | 1 | array/U08 | 83 | 4 | ms | 0.5; 0 |
| primeBins | 1 | array/U08 | 87 | 4 | C | 1; -40 |
| SoftRevLim | 4 | scalar/U08 | 19 |  | rpm | 100; 0 |
| wueBins | 4 | array/U08 | 31 | 10 | C | 1; -40 |
| iacCLValues | 6 | array/U08 | 64 | 10 | RPM | 10; 0 |
| iacBins | 6 | array/U08 | 94 | 10 | C | 1; -40 |
| iacCrankSteps | 6 | array/U08 | 104 | 4 | Steps | 3; 0 |
| iacCrankDuty | 6 | array/U08 | 108 | 4 | Duty % | 1; 0 |

### IdleControl

[Source](../src/renderer/features/startup/IdleControl.jsx) · `/startup/idle`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| idleUpPin | 1 | bits/U08 | 57 | 0:5 |  | 1; 0 |
| idleUpPolarity | 1 | bits/U08 | 57 | 6:6 |  | 1; 0 |
| idleUpEnabled | 1 | bits/U08 | 57 | 7:7 |  | 1; 0 |
| idleUpAdder | 1 | scalar/U08 | 58 |  | % / Steps | 1; 0 |
| iacCLminValue | 1 | scalar/U08 | 61 |  | % / Steps | 1; 0 |
| iacCLmaxValue | 1 | scalar/U08 | 62 |  | % / Steps | 1; 0 |
| idleAdvEnabled | 1 | bits/U08 | 92 | 0:1 |  | 1; 0 |
| idleAdvDelay | 1 | bits/U08 | 92 | 3:7 |  | 1; 0 |
| idleAdvRPM | 1 | scalar/U08 | 93 |  | rpm | 100; 0 |
| idleAdvTPS | 1 | scalar/U08 | 94 |  | % | 0.5; 0 |
| idleTaperTime | 1 | scalar/U08 | 99 |  | S | 0.1; 0 |
| iacTPSlimit | 1 | scalar/U08 | 121 |  | % | 0.5; 0 |
| iacRPMlimitHysteresis | 1 | scalar/U08 | 122 |  | RPM | 10; 0 |
| idleFreq | 6 | scalar/U08 | 47 |  | Hz | 2; 0 |
| idleKP | 6 | scalar/U08 | 53 |  | % | 0.03125; 0 |
| idleKI | 6 | scalar/U08 | 54 |  | % | 0.03125; 0 |
| idleKD | 6 | scalar/U08 | 55 |  | % | 0.00781; 0 |
| iacPWMrun | 6 | bits/U08 | 60 | 1:1 |  | 1; 0 |
| iacAlgorithm | 6 | bits/U08 | 116 | 0:2 |  | 1; 0 |
| iacStepTime | 6 | bits/U08 | 116 | 3:5 |  | 1; 0 |
| iacChannels | 6 | bits/U08 | 116 | 6:6 |  | 1; 0 |
| iacPWMdir | 6 | bits/U08 | 116 | 7:7 |  | 1; 0 |
| iacStepHome | 6 | scalar/U08 | 118 |  | Steps | 3; 0 |
| iacStepHyster | 6 | scalar/U08 | 119 |  | Steps | 1; 0 |
| iacStepperPower | 9 | bits/U08 | 153 | 7:7 |  | 1; 0 |
| iacMaxSteps | 9 | scalar/U08 | 154 |  | Steps | 3; 0 |

### LaunchControl

[Source](../src/renderer/features/racing/LaunchControl.jsx) · `/racing/launch`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| launchPin | 6 | bits/U08 | 48 | 0:5 |  | 1; 0 |
| launchEnable | 6 | bits/U08 | 48 | 6:6 |  | 1; 0 |
| launchHiLo | 6 | bits/U08 | 48 | 7:7 |  | 1; 0 |
| lnchSoftLim | 6 | scalar/U08 | 49 |  | rpm | 100; 0 |
| lnchRetard | 6 | scalar/S08 | 50 |  | deg | 1; 0 |
| lnchHardLim | 6 | scalar/U08 | 51 |  | rpm | 100; 0 |
| lnchFuelAdd | 6 | scalar/S08 | 52 |  | % | 1; 0 |
| lnchPullRes | 6 | bits/U08 | 60 | 0:0 |  | 1; 0 |
| lnchCtrlTPS | 10 | scalar/U08 | 74 |  | %TPS | 0.5; 0 |
| lnchCtrlVss | 10 | scalar/U08 | 191 |  | KPh | 1; 0 |

### FlatShift

[Source](../src/renderer/features/racing/FlatShift.jsx) · `/racing/flatshift`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| launchPin | 6 | bits/U08 | 48 | 0:5 |  | 1; 0 |
| launchHiLo | 6 | bits/U08 | 48 | 7:7 |  | 1; 0 |
| lnchPullRes | 6 | bits/U08 | 60 | 0:0 |  | 1; 0 |
| flatSEnable | 6 | bits/U08 | 60 | 3:3 |  | 1; 0 |
| flatSSoftWin | 6 | scalar/U08 | 61 |  | rpm | 100; 0 |
| flatSRetard | 6 | scalar/S08 | 62 |  | deg | 1; 0 |
| flatSArm | 6 | scalar/U08 | 63 |  | rpm | 100; 0 |

### PitLimiter

[Source](../src/renderer/features/racing/PitLimiter.jsx) · `/racing/pit-limiter`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| SoftLimitMode | 1 | bits/U08 | 3 | 3:3 |  | 1; 0 |
| SoftLimRetard | 4 | scalar/U08 | 20 |  | deg | 1; 0 |
| engineProtectType | 6 | bits/U08 | 0 | 6:7 |  | 1; 0 |
| pitLimiterEnabled | 6 | bits/U08 | 128 | 0:0 |  | 1; 0 |
| pitLimiterPin | 6 | bits/U08 | 128 | 1:6 |  | 1; 0 |
| pitLimiterPinMode | 6 | bits/U08 | 128 | 7:7 |  | 1; 0 |
| pitLimiterRPM | 6 | scalar/U08 | 129 |  | rpm | 100; 0 |
| pitLimiterSpeed | 6 | scalar/U08 | 130 |  | km/h | 1; 0 |
| pitLimiterCutType | 6 | bits/U08 | 131 | 0:1 |  | 1; 0 |
| pitLimiterSoftWindow | 6 | scalar/U08 | 132 |  | rpm | 100; 0 |

### RumbleIdle

[Source](../src/renderer/features/racing/RumbleIdle.jsx) · `/racing/rumble-idle`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| rumbleIdleEnabled | 6 | bits/U08 | 133 | 0:0 |  | 1; 0 |
| rumbleIdlePin | 6 | bits/U08 | 133 | 1:6 |  | 1; 0 |
| rumbleIdlePinMode | 6 | bits/U08 | 133 | 7:7 |  | 1; 0 |
| rumbleIdleCutType | 6 | bits/U08 | 134 | 0:1 |  | 1; 0 |
| rumbleIdleMinRPM | 6 | scalar/U08 | 135 |  | rpm | 100; 0 |
| rumbleIdleMaxRPM | 6 | scalar/U08 | 136 |  | rpm | 100; 0 |
| rumbleIdleMaxTPS | 6 | scalar/U08 | 137 |  | % | 0.5; 0 |
| rumbleIdleFrequency | 6 | scalar/U08 | 139 |  | steps/s | 1; 0 |
| rumbleIdleMinCLT | 6 | scalar/S08 | 140 |  | C | 1; 0 |
| rumbleIdlePatternBits | 6 | scalar/U08 | 141 |  |  | 1; 0 |
| rumbleIdlePatternLength | 6 | bits/U08 | 142 | 0:3 |  | 1; 0 |
| rumbleIdleMinVSS | 6 | bits/U08 | 142 | 4:7 |  | 1; 0 |

### AntiLag

[Source](../src/renderer/features/racing/AntiLag.jsx) · `/racing/anti-lag`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| alsEnabled | 10 | bits/U08 | 192 | 0:0 |  | 1; 0 |
| alsSwitchPolarity | 10 | bits/U08 | 192 | 1:1 |  | 1; 0 |
| alsIgnCutEnable | 10 | bits/U08 | 192 | 2:2 |  | 1; 0 |
| alsMinRPM | 10 | scalar/U08 | 193 |  | rpm | 100; 0 |
| alsMaxTPS | 10 | scalar/U08 | 194 |  | % | 0.5; 0 |
| alsMinBoost | 10 | scalar/U08 | 195 |  | kPa | 1; 0 |
| alsTimingRetard | 10 | scalar/U08 | 196 |  | deg | 1; 0 |
| alsFuelModifier | 10 | scalar/S08 | 197 |  | % | 1; 0 |
| alsMinCLT | 10 | scalar/S08 | 198 |  | C | 1; 0 |
| alsMaxCLT | 10 | scalar/S08 | 199 |  | C | 1; 0 |
| alsMinVSS | 10 | scalar/U08 | 200 |  | km/h | 1; 0 |
| alsMaxDuration | 10 | scalar/U08 | 201 |  | sec | 1; 0 |
| alsSwitchPin | 10 | bits/U08 | 202 | 0:5 |  | 1; 0 |
| alsTargetRPM | 10 | scalar/U08 | 203 |  | rpm | 100; 0 |
| alsIgnCutPattern | 10 | scalar/U08 | 204 |  |  | 1; 0 |
| alsFuelCutPattern | 10 | scalar/U08 | 205 |  |  | 1; 0 |

### PopAndBang

[Source](../src/renderer/features/racing/PopAndBang.jsx) · `/racing/popandbang`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| rollingPopBangEnabled | 10 | bits/U08 | 208 | 0:0 |  | 1; 0 |
| rollingPopBangPin | 10 | bits/U08 | 208 | 1:6 |  | 1; 0 |
| rollingPopBangPinMode | 10 | bits/U08 | 208 | 7:7 |  | 1; 0 |
| rollingPopBangMinRPM | 10 | scalar/U08 | 209 |  | rpm | 100; 0 |
| rollingPopBangMaxRPM | 10 | scalar/U08 | 210 |  | rpm | 100; 0 |
| rollingPopBangMaxTPS | 10 | scalar/U08 | 211 |  | % | 0.5; 0 |
| rollingPopBangMinVSS | 10 | scalar/U08 | 212 |  | km/h | 1; 0 |
| rollingPopBangMinCLT | 10 | scalar/S08 | 213 |  | C | 1; 0 |
| rollingPopBangTimingRetard | 10 | scalar/U08 | 214 |  | deg | 1; 0 |
| rollingPopBangFuelModifier | 10 | scalar/S08 | 215 |  | % | 1; 0 |
| rollingPopBangMaxDuration | 10 | scalar/U08 | 216 |  | sec | 1; 0 |
| rollingPopBangCutType | 10 | bits/U08 | 217 | 0:1 |  | 1; 0 |
| rollingPopBangCutPattern | 10 | scalar/U08 | 218 |  |  | 1; 0 |

### RuntimeProfileEditor

[Source](../src/renderer/features/dashboard/RuntimeProfileEditor.jsx) · `/racing/runtime-profiles/:profileId`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| rumbleIdleEnabled | 6 | bits/U08 | 133 | 0:0 |  | 1; 0 |
| fuel2Mode | 10 | bits/U08 | 122 | 3:5 |  | 1; 0 |
| spark2Mode | 10 | bits/U08 | 186 | 3:5 |  | 1; 0 |
| alsEnabled | 10 | bits/U08 | 192 | 0:0 |  | 1; 0 |
| alsMaxDuration | 10 | scalar/U08 | 201 |  | sec | 1; 0 |

### Nitrous

[Source](../src/renderer/features/racing/Nitrous.jsx) · `/racing/nitrous`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| n2o_enable | 10 | bits/U08 | 75 | 0:1 |  | 1; 0 |
| n2o_arming_pin | 10 | bits/U08 | 75 | 2:7 |  | 1; 0 |
| n2o_minCLT | 10 | scalar/U08 | 76 |  | C | 1; -40 |
| n2o_maxMAP | 10 | scalar/U08 | 77 |  | kPa | 2; 0 |
| n2o_minTPS | 10 | scalar/U08 | 78 |  | %TPS | 0.5; 0 |
| n2o_maxAFR | 10 | scalar/U08 | 79 |  | AFR | 0.1; 0 |
| n2o_stage1_pin | 10 | bits/U08 | 80 | 0:5 |  | 1; 0 |
| n2o_pin_polarity | 10 | bits/U08 | 80 | 6:6 |  | 1; 0 |
| n2o_stage1_minRPM | 10 | scalar/U08 | 81 |  | RPM | 100; 0 |
| n2o_stage1_maxRPM | 10 | scalar/U08 | 82 |  | RPM | 100; 0 |
| n2o_stage1_adderMin | 10 | scalar/U08 | 83 |  | ms | 0.1; 0 |
| n2o_stage1_adderMax | 10 | scalar/U08 | 84 |  | ms | 0.1; 0 |
| n2o_stage1_retard | 10 | scalar/U08 | 85 |  | Deg | 1; 0 |
| n2o_stage2_pin | 10 | bits/U08 | 86 | 0:5 |  | 1; 0 |
| n2o_stage2_minRPM | 10 | scalar/U08 | 87 |  | RPM | 100; 0 |
| n2o_stage2_maxRPM | 10 | scalar/U08 | 88 |  | RPM | 100; 0 |
| n2o_stage2_adderMin | 10 | scalar/U08 | 89 |  | ms | 0.1; 0 |
| n2o_stage2_adderMax | 10 | scalar/U08 | 90 |  | ms | 0.1; 0 |
| n2o_stage2_retard | 10 | scalar/U08 | 91 |  | Deg | 1; 0 |

### FuelPump

[Source](../src/renderer/features/io/FuelPump.jsx) · `/io/fuelpump`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| fpPrime | 1 | scalar/U08 | 49 |  | s | 1; 0 |
| fuelPumpPin | 4 | bits/U08 | 6 | 1:6 |  | 1; 0 |

### FanSettings

[Source](../src/renderer/features/io/FanSettings.jsx) · `/io/fan`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| fanWhenOff | 1 | bits/U08 | 70 | 0:0 |  | 1; 0 |
| fanWhenCranking | 1 | bits/U08 | 70 | 1:1 |  | 1; 0 |
| fanEnable | 1 | bits/U08 | 70 | 3:4 |  | 1; 0 |
| fanInv | 6 | bits/U08 | 120 | 0:0 |  | 1; 0 |
| fanPin | 6 | bits/U08 | 120 | 2:7 |  | 1; 0 |
| fanSP | 6 | scalar/U08 | 121 |  | C | 1; -40 |
| fanHyster | 6 | scalar/U08 | 122 |  | C | 1; 0 |
| fanFreq | 6 | scalar/U08 | 123 |  | Hz | 2; 0 |
| fanPWMBins | 6 | array/U08 | 124 | 4 | C | 1; -40 |
| PWMFanDuty | 9 | array/U08 | 162 | 4 | % | 0.5; 0 |

### WMI

[Source](../src/renderer/features/racing/WMI.jsx) · `/io/wmi`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| vvtFreq | 6 | scalar/U08 | 46 |  | Hz | 2; 0 |
| wmiEnabled | 10 | bits/U08 | 149 | 0:0 |  | 1; 0 |
| wmiMode | 10 | bits/U08 | 149 | 1:2 |  | 1; 0 |
| wmiAdvEnabled | 10 | bits/U08 | 149 | 7:7 |  | 1; 0 |
| wmiTPS | 10 | scalar/U08 | 150 |  | %TPS | 0.5; 0 |
| wmiRPM | 10 | scalar/U08 | 151 |  | RPM | 100; 0 |
| wmiMAP | 10 | scalar/U08 | 152 |  | kPa | 2; 0 |
| wmiMAP2 | 10 | scalar/U08 | 153 |  | kPa | 2; 0 |
| wmiIAT | 10 | scalar/U08 | 154 |  | C | 1; -40 |
| wmiOffset | 10 | scalar/S08 | 155 |  | ms | 1; 0 |
| wmiIndicatorEnabled | 10 | bits/U08 | 156 | 0:0 |  | 1; 0 |
| wmiIndicatorPin | 10 | bits/U08 | 156 | 1:6 |  | 1; 0 |
| wmiIndicatorPolarity | 10 | bits/U08 | 156 | 7:7 |  | 1; 0 |
| wmiEmptyEnabled | 10 | bits/U08 | 157 | 0:0 |  | 1; 0 |
| wmiEmptyPin | 10 | bits/U08 | 157 | 1:6 |  | 1; 0 |
| wmiEmptyPolarity | 10 | bits/U08 | 157 | 7:7 |  | 1; 0 |
| wmiEnabledPin | 10 | bits/U08 | 158 | 0:5 |  | 1; 0 |
| wmiAdvBins | 10 | array/U08 | 159 | 6 | kPa | 2; 0 |
| wmiAdvAdj | 10 | array/U08 | 165 | 6 | Deg | 1; -40 |
| vvt2Pin | 10 | bits/U08 | 173 | 0:5 |  | 1; 0 |

### VVTControl

[Source](../src/renderer/features/engine/VVTControl.jsx) · `/engine/vvt`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| vvtEnabled | 6 | bits/U08 | 0 | 5:5 |  | 1; 0 |
| vvtMode | 6 | bits/U08 | 6 | 0:1 |  | 1; 0 |
| vvtFreq | 6 | scalar/U08 | 46 |  | Hz | 2; 0 |

### BoostControl

[Source](../src/renderer/features/fuel/BoostControl.jsx) · `/fuel/boost`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| boostType | 4 | bits/U08 | 12 | 0:0 |  | 1; 0 |
| boostEnabled | 6 | bits/U08 | 0 | 4:4 |  | 1; 0 |
| boostCutEnabled | 6 | bits/U08 | 6 | 7:7 |  | 1; 0 |
| boostMode | 6 | bits/U08 | 13 | 7:7 |  | 1; 0 |
| boostFreq | 6 | scalar/U08 | 45 |  | Hz | 2; 0 |
| boostKP | 6 | scalar/U08 | 57 |  | % | 1; 0 |
| boostKI | 6 | scalar/U08 | 58 |  | % | 1; 0 |
| boostKD | 6 | scalar/U08 | 59 |  | % | 1; 0 |

### StagedInjection

[Source](../src/renderer/features/fuel/StagedInjection.jsx) · `/fuel/staged`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| stagingTable | 7 | array/U08 | 160 | 8×8 | % | 1; 0 |
| rpmBinsStaging | 7 | array/U08 | 224 | 8 | RPM | 100; 0 |
| loadBinsStaging | 7 | array/U08 | 232 | 8 | { bitStringValue(algorithmUnits ,  algorithm) } | 1; 0 |
| stagingEnabled | 10 | bits/U08 | 8 | 2:2 |  | 1; 0 |
| stagingMode | 10 | bits/U08 | 8 | 3:3 |  | 1; 0 |
| stagedInjSizePri | 10 | scalar/U16 | 28 |  | cc/min | 1; 0 |
| stagedInjSizeSec | 10 | scalar/U16 | 30 |  | cc/min | 1; 0 |

### SensorCalibration

[Source](../src/renderer/features/tools/SensorCalibration.jsx) · `/tools/calibration`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| tpsMin | 1 | scalar/U08 | 44 |  | ADC | 1; 0 |
| tpsMax | 1 | scalar/U08 | 45 |  | ADC | 1; 0 |
| mapMin | 1 | scalar/S08 | 46 |  | kpa | 1; 0 |
| mapMax | 1 | scalar/U16 | 47 |  | kpa | 1; 0 |
| baroMin | 1 | scalar/S08 | 64 |  | kpa | 1; 0 |
| baroMax | 1 | scalar/U16 | 65 |  | kpa | 1; 0 |
| EMAPMin | 1 | scalar/S08 | 67 |  | kpa | 1; 0 |
| EMAPMax | 1 | scalar/U16 | 68 |  | kpa | 1; 0 |
| ADCFILTER_TPS | 4 | scalar/U08 | 64 |  | % | 1; 0 |
| ADCFILTER_CLT | 4 | scalar/U08 | 65 |  | % | 1; 0 |
| ADCFILTER_IAT | 4 | scalar/U08 | 66 |  | % | 1; 0 |
| ADCFILTER_O2 | 4 | scalar/U08 | 67 |  | % | 1; 0 |
| ADCFILTER_BAT | 4 | scalar/U08 | 68 |  | % | 1; 0 |
| ADCFILTER_MAP | 4 | scalar/U08 | 69 |  | % | 1; 0 |
| ADCFILTER_BARO | 4 | scalar/U08 | 70 |  | % | 1; 0 |
| batVoltCorrect | 4 | scalar/S08 | 91 |  | v | 0.1; 0 |
| FILTER_FLEX | 4 | scalar/U08 | 125 |  | % | 1; 0 |

### TachoOutput

[Source](../src/renderer/features/io/TachoOutput.jsx) · `/io/tacho`

| Field | Page | Type | Offset | Shape/bits | Unit INI | Scale; translate |
| --- | --- | --- | --- | --- | --- | --- |
| useTachoSweep | 1 | bits/U08 | 3 | 4:4 |  | 1; 0 |
| tachoPin | 1 | bits/U08 | 16 | 0:5 |  | 1; 0 |
| tachoDiv | 1 | bits/U08 | 16 | 6:7 |  | 1; 0 |
| tachoDuration | 1 | scalar/U08 | 17 |  | ms | 1; 0 |
| tachoSweepMaxRPM | 1 | scalar/U08 | 119 |  | RPM | 100; 0 |
| tachoMode | 6 | bits/U08 | 14 | 6:6 |  | 1; 0 |

## Output channels

Ini metadata raw; canonical model pada [telemetry](08_TELEMETRY_WIDGETS_LOGGING.md) melakukan pemetaan dan konversi khusus.

| Field | Offset | Type | Bits | Scale | Translate | Unit |
| --- | --- | --- | --- | --- | --- | --- |
| secl | 0 | U08 |  | 1 | 0 | sec |
| status1 | 1 | U08 |  | 1 | 0 | bits |
| inj1Status | 1 | U08 | 0:0 | 1 | 0 |  |
| inj2Status | 1 | U08 | 1:1 | 1 | 0 |  |
| inj3Status | 1 | U08 | 2:2 | 1 | 0 |  |
| inj4Status | 1 | U08 | 3:3 | 1 | 0 |  |
| DFCOOn | 1 | U08 | 4:4 | 1 | 0 |  |
| boostCutFuel | 1 | U08 | 5:5 | 1 | 0 |  |
| toothLog1Ready | 1 | U08 | 6:6 | 1 | 0 |  |
| toothLog2Ready | 1 | U08 | 7:7 | 1 | 0 |  |
| engine | 2 | U08 |  | 1 | 0 | bits |
| running | 2 | U08 | 0:0 | 1 | 0 |  |
| crank | 2 | U08 | 1:1 | 1 | 0 |  |
| ase | 2 | U08 | 2:2 | 1 | 0 |  |
| warmup | 2 | U08 | 3:3 | 1 | 0 |  |
| tpsaccaen | 2 | U08 | 4:4 | 1 | 0 |  |
| tpsaccden | 2 | U08 | 5:5 | 1 | 0 |  |
| mapaccaen | 2 | U08 | 6:6 | 1 | 0 |  |
| mapaccden | 2 | U08 | 7:7 | 1 | 0 |  |
| syncLossCounter | 3 | U08 |  | 1 | 0 |  |
| map | 4 | U16 |  | 1 | 0 | kpa |
| iatRaw | 6 | U08 |  | 1 | 0 | °C |
| coolantRaw | 7 | U08 |  | 1 | 0 | °C |
| batCorrection | 8 | U08 |  | 1 | 0 | % |
| batteryVoltage | 9 | U08 |  | 0.1 | 0 | V |
| afr | 10 | U08 |  | 0.1 | 0 | O2 |
| egoCorrection | 11 | U08 |  | 1 | 0 | % |
| airCorrection | 12 | U08 |  | 1 | 0 | % |
| warmupEnrich | 13 | U08 |  | 1 | 0 | % |
| rpm | 14 | U16 |  | 1 | 0 | rpm |
| accelEnrich | 16 | U08 |  | 2 | 0 | % |
| gammaEnrich | 17 | U16 |  | 1 | 0 | % |
| VE1 | 19 | U08 |  | 1 | 0 | % |
| VE2 | 20 | U08 |  | 1 | 0 | % |
| afrTarget | 21 | U08 |  | 0.1 | 0 | O2 |
| TPSdot | 22 | S16 |  | 1 | 0 | %/s |
| advance | 24 | S08 |  | 1 | 0 | deg |
| tps | 25 | U08 |  | 0.5 | 0 | % |
| loopsPerSecond | 26 | U16 |  | 1 | 0 | loops |
| freeRAM | 28 | U16 |  | 1 | 0 | bytes |
| boostTarget | 30 | U08 |  | 2 | 0 | kPa |
| boostDuty | 31 | U08 |  | 1 | 0 | % |
| status2 | 32 | U08 |  | 1 | 0 | bits |
| launchHard | 32 | U08 | 0:0 | 1 | 0 |  |
| launchSoft | 32 | U08 | 1:1 | 1 | 0 |  |
| hardLimitOn | 32 | U08 | 2:2 | 1 | 0 |  |
| softlimitOn | 32 | U08 | 3:3 | 1 | 0 |  |
| boostCutSpark | 32 | U08 | 4:4 | 1 | 0 |  |
| error | 32 | U08 | 5:5 | 1 | 0 |  |
| idleControlOn | 32 | U08 | 6:6 | 1 | 0 |  |
| sync | 32 | U08 | 7:7 | 1 | 0 |  |
| rpmDOT | 33 | S16 |  | 1 | 0 | rpm/s |
| flex | 35 | U08 |  | 1 | 0 | % |
| flexFuelCor | 36 | U08 |  | 1 | 0 | % |
| flexIgnCor | 37 | S08 |  | 1 | 0 | deg |
| idleLoad | 38 | U08 |  | 1 | 0 | { bitStringValue( idleUnits , iacAlgorithm  ) } |
| testoutputs | 39 | U08 |  | 1 | 0 | bits |
| testenabled | 39 | U08 | 0:0 | 1 | 0 |  |
| testactive | 39 | U08 | 1:1 | 1 | 0 |  |
| afr2 | 40 | U08 |  | 0.1 | 0 | O2 |
| baro | 41 | U08 |  | 1 | 0 | kpa |
| auxin_gauge0 | 42 | U16 |  | 1 | 0 |  |
| auxin_gauge1 | 44 | U16 |  | 1 | 0 |  |
| auxin_gauge2 | 46 | U16 |  | 1 | 0 |  |
| auxin_gauge3 | 48 | U16 |  | 1 | 0 |  |
| auxin_gauge4 | 50 | U16 |  | 1 | 0 |  |
| auxin_gauge5 | 52 | U16 |  | 1 | 0 |  |
| auxin_gauge6 | 54 | U16 |  | 1 | 0 |  |
| auxin_gauge7 | 56 | U16 |  | 1 | 0 |  |
| auxin_gauge8 | 58 | U16 |  | 1 | 0 |  |
| auxin_gauge9 | 60 | U16 |  | 1 | 0 |  |
| auxin_gauge10 | 62 | U16 |  | 1 | 0 |  |
| auxin_gauge11 | 64 | U16 |  | 1 | 0 |  |
| auxin_gauge12 | 66 | U16 |  | 1 | 0 |  |
| auxin_gauge13 | 68 | U16 |  | 1 | 0 |  |
| auxin_gauge14 | 70 | U16 |  | 1 | 0 |  |
| auxin_gauge15 | 72 | U16 |  | 1 | 0 |  |
| tpsADC | 74 | U08 |  | 1 | 0 | ADC |
| errors | 75 | U08 |  | 1 | 0 | bits |
| errorNum | 75 | U08 | 0:1 | 1 | 0 |  |
| currentError | 75 | U08 | 2:7 | 1 | 0 |  |
| pulseWidth | 76 | U16 |  | 0.001 | 0 | ms |
| pulseWidth2 | 78 | U16 |  | 0.001 | 0 | ms |
| pulseWidth3 | 80 | U16 |  | 0.001 | 0 | ms |
| pulseWidth4 | 82 | U16 |  | 0.001 | 0 | ms |
| status3 | 84 | U08 |  | 1 | 0 | bits |
| resetLockOn | 84 | U08 | 0:0 | 1 | 0 |  |
| nitrousOn | 84 | U08 | 1:1 | 1 | 0 |  |
| fuel2Active | 84 | U08 | 2:2 | 1 | 0 |  |
| vssRefresh | 84 | U08 | 3:3 | 1 | 0 |  |
| halfSync | 84 | U08 | 4:4 | 1 | 0 |  |
| nSquirts | 84 | U08 | 5:7 | 1 | 0 |  |
| engineProtectStatus | 85 | U08 |  | 1 | 0 | bits |
| engineProtectRPM | 85 | U08 | 0:0 | 1 | 0 |  |
| engineProtectMAP | 85 | U08 | 1:1 | 1 | 0 |  |
| engineProtectOil | 85 | U08 | 2:2 | 1 | 0 |  |
| engineProtectAFR | 85 | U08 | 3:3 | 1 | 0 |  |
| engineProtectCoolant | 85 | U08 | 4:4 | 1 | 0 |  |
| engineProtectOth | 85 | U08 | 5:6 | 1 | 0 |  |
| IOError | 85 | U08 | 7:7 | 1 | 0 |  |
| fuelLoad | 86 | S16 |  | 1 | 0 | { bitStringValue( algorithmUnits , algorithm  ) } |
| ignLoad | 88 | S16 |  | 1 | 0 | { bitStringValue( algorithmUnits , ignAlgorithm  ) } |
| dwell | 90 | U16 |  | 0.001 | 0 | ms |
| CLIdleTarget | 92 | U08 |  | 10 | 0 | RPM |
| MAPdot | 93 | S16 |  | 1 | 0 | kPa/s |
| vvt1Angle | 95 | S16 |  | 0.5 | 0 | deg |
| vvt1Target | 97 | U08 |  | 0.5 | 0 | deg |
| vvt1Duty | 98 | U08 |  | 0.5 | 0 | % |
| flexBoostCor | 99 | S16 |  | 1 | 0 | kPa |
| baroCorrection | 101 | U08 |  | 1 | 0 | % |
| veCurr | 102 | U08 |  | 1 | 0 | % |
| ASECurr | 103 | U08 |  | 1 | 0 | % |
| vss | 104 | U16 |  | 1 | 0 | km/h |
| gear | 106 | U08 |  | 1 | 0 |  |
| fuelPressure | 107 | U08 |  | 1 | 0 | PSI |
| oilPressure | 108 | U08 |  | 1 | 0 | PSI |
| wmiPW | 109 | U08 |  | 1 | 0 | % |
| status4 | 110 | U08 |  | 1 | 0 | bits |
| wmiEmptyBit | 110 | U08 | 0:0 | 1 | 0 |  |
| vvt1Error | 110 | U08 | 1:1 | 1 | 0 |  |
| vvt2Error | 110 | U08 | 2:2 | 1 | 0 |  |
| fanStatus | 110 | U08 | 3:3 | 1 | 0 |  |
| burnPending | 110 | U08 | 4:4 | 1 | 0 |  |
| stagingActive | 110 | U08 | 5:5 | 1 | 0 |  |
| commsCompatability | 110 | U08 | 6:6 | 1 | 0 |  |
| legacyCommsAllow | 110 | U08 | 7:7 | 1 | 0 |  |
| vvt2Angle | 111 | S16 |  | 0.5 | 0 | deg |
| vvt2Target | 113 | U08 |  | 0.5 | 0 | deg |
| vvt2Duty | 114 | U08 |  | 0.5 | 0 | % |
| outputsStatus0 | 115 | U08 | 0:0 | 1 | 0 |  |
| outputsStatus1 | 115 | U08 | 1:1 | 1 | 0 |  |
| outputsStatus2 | 115 | U08 | 2:2 | 1 | 0 |  |
| outputsStatus3 | 115 | U08 | 3:3 | 1 | 0 |  |
| outputsStatus4 | 115 | U08 | 4:4 | 1 | 0 |  |
| outputsStatus5 | 115 | U08 | 5:5 | 1 | 0 |  |
| outputsStatus6 | 115 | U08 | 6:6 | 1 | 0 |  |
| outputsStatus7 | 115 | U08 | 7:7 | 1 | 0 |  |
| fuelTempRaw | 116 | U08 |  | 1 | 0 | °C |
| fuelTempCor | 117 | U08 |  | 1 | 0 | % |
| advance1 | 118 | S08 |  | 1 | 0 | deg |
| advance2 | 119 | S08 |  | 1 | 0 | deg |
| sd_status | 120 | U08 |  | 1 | 0 |  |
| emap | 121 | U16 |  | 1 | 0 | kpa |
| fanDuty | 123 | U08 |  | 0.5 | 0 | % |
| airConStatus | 124 | U08 |  | 1 | 0 | bits |
| airConRequest | 124 | U08 | 0:0 | 1 | 0 |  |
| airConCompressor | 124 | U08 | 1:1 | 1 | 0 |  |
| airConRPMMLockout | 124 | U08 | 2:2 | 1 | 0 |  |
| airConTPSLockout | 124 | U08 | 3:3 | 1 | 0 |  |
| airConTurningOn | 124 | U08 | 4:4 | 1 | 0 |  |
| airConCLTLockout | 124 | U08 | 5:5 | 1 | 0 |  |
| airConFanStatus | 124 | U08 | 6:6 | 1 | 0 |  |
| airConUnusedBits | 124 | U08 | 7:7 | 1 | 0 |  |
| dwellActual | 125 | U16 |  | 0.001 | 0 | ms |
| status5 | 127 | U08 |  | 1 | 0 | bits |
| flatShiftHardActive | 127 | U08 | 0:0 | 1 | 0 |  |
| flatShiftSoftActive | 127 | U08 | 1:1 | 1 | 0 |  |
| spark2Active | 127 | U08 | 2:2 | 1 | 0 |  |
| knockActive | 127 | U08 | 3:3 | 1 | 0 |  |
| knockIGNORE | 127 | U08 | 4:4 | 1 | 0 |  |
| clutchPressed | 127 | U08 | 5:5 | 1 | 0 |  |
| UnusedBits5-6 | 127 | U08 | 6:6 | 1 | 0 |  |
| UnusedBits5-7 | 127 | U08 | 7:7 | 1 | 0 |  |
| knockEventCount | 128 | U08 |  | 1 | 0 |  |
| knockCor | 129 | U08 |  | 1 | 0 | deg |
| pulseWidth5 | 130 | U16 |  | 0.001 | 0 | ms |
| pulseWidth6 | 132 | U16 |  | 0.001 | 0 | ms |
| pulseWidth7 | 134 | U16 |  | 0.001 | 0 | ms |
| pulseWidth8 | 136 | U16 |  | 0.001 | 0 | ms |
| systemTempRaw | 138 | U08 |  | 1 | 0 | C |
| perfStatus1 | 139 | U08 |  | 1 | 0 | bits |
| pitLimiterActive | 139 | U08 | 0:0 | 1 | 0 |  |
| pitLimiterSwitchState | 139 | U08 | 1:1 | 1 | 0 |  |
| rumbleIdleActive | 139 | U08 | 2:2 | 1 | 0 |  |
| rumbleIdleBeatState | 139 | U08 | 3:3 | 1 | 0 |  |
| perfStatus2 | 140 | U08 |  | 1 | 0 | bits |
| alsActive | 140 | U08 | 0:0 | 1 | 0 |  |
| alsSwitchState | 140 | U08 | 1:1 | 1 | 0 |  |
| alsTimingCorrection | 141 | S08 |  | 1 | 0 | deg |
| alsFuelCorrection | 142 | U08 |  | 1 | 0 | % |
| alsActiveTime | 143 | U16 |  | 1 | 0 | ms |
| rollingPopBangStatus | 145 | U08 |  | 1 | 0 | bits |
| rollingPopBangActive | 145 | U08 | 0:0 | 1 | 0 |  |
| rollingPopBangSwitchState | 145 | U08 | 1:1 | 1 | 0 |  |
| rollingPopBangActiveTime | 146 | U16 |  | 1 | 0 | ms |
| rollingPopBangCutCounter | 148 | U16 |  | 1 | 0 |  |
| rollingPopBangTimingCorrection | 150 | S08 |  | 1 | 0 | deg |
| rollingPopBangFuelCorrection | 151 | U08 |  | 1 | 0 | % |
| driveVersion | 152 | U08 |  | 1 | 0 |  |
| driveActive | 153 | U08 |  | 1 | 0 |  |
| driveRequested | 154 | U08 |  | 1 | 0 |  |
| driveState | 155 | U08 |  | 1 | 0 |  |
| driveReason | 156 | U08 |  | 1 | 0 |  |
| driveRequestToken | 157 | U16 |  | 1 | 0 |  |
| driveAppliedToken | 159 | U16 |  | 1 | 0 |  |
| driveConfigCRC | 161 | U16 |  | 1 | 0 |  |
| driveFuel | 163 | U08 |  | 1 | 0 |  |
| driveIgnition | 164 | S08 |  | 1 | 0 |  |
| driveFeatures | 165 | U08 |  | 1 | 0 |  |
| driveFlags | 166 | U08 |  | 1 | 0 |  |
| coolant |  |  |  | 1 | 0 |  |
| iat |  |  |  | 1 | 0 |  |
| fuelTemp |  |  |  | 1 | 0 |  |
| systemTemp |  |  |  | 1 | 0 |  |
| time |  |  |  | 1 | 0 |  |
| seconds |  |  |  | 1 | 0 |  |
| fuelPressure_bar |  |  |  | 1 | 0 |  |
| oilPressure_bar |  |  |  | 1 | 0 |  |
| fuelPressure_kpa |  |  |  | 1 | 0 |  |
| oilPressure_kpa |  |  |  | 1 | 0 |  |
| throttle |  |  |  | 1 | 0 |  |
| revolutionTime |  |  |  | 1 | 0 |  |
| strokeMultipler |  |  |  | 1 | 0 |  |
| cycleTime |  |  |  | 1 | 0 |  |
| pulseLimit |  |  |  | 1 | 0 |  |
| nFuelChannels |  |  |  | 1 | 0 |  |
| nIgnChannels |  |  |  | 1 | 0 |  |
| sequentialFuelAvailable |  |  |  | 1 | 0 |  |
| sequentialIgnitionAvailable |  |  |  | 1 | 0 |  |
| dutyCycle |  |  |  | 1 | 0 |  |
| stgDutyCycle |  |  |  | 1 | 0 |  |
| boostCutOut |  |  |  | 1 | 0 |  |
| lambda |  |  |  | 1 | 0 |  |
| lambdaTarget |  |  |  | 1 | 0 |  |
| MAPxRPM |  |  |  | 1 | 0 |  |
| loopsPerRev |  |  |  | 1 | 0 |  |
| loopsPerSecSmooth |  |  |  | 1 | 0 |  |
| req_fuel |  |  |  | 1 | 0 |  |
| inj_open |  |  |  | 1 | 0 |  |
| ase_enrich |  |  |  | 1 | 0 |  |
| map_multiply_amt |  |  |  | 1 | 0 |  |
| map_bar |  |  |  | 1 | 0 |  |
| map_psi |  |  |  | 1 | 0 |  |
| map_inhg |  |  |  | 1 | 0 |  |
| map_vacboost |  |  |  | 1 | 0 |  |
| vssMPH |  |  |  | 1 | 0 |  |
| fuelLoadMax |  |  |  | 1 | 0 |  |
| ignLoadMax |  |  |  | 1 | 0 |  |
| fuel2LoadMax |  |  |  | 1 | 0 |  |
| ign2LoadMax |  |  |  | 1 | 0 |  |
| ign2ValuesMin |  |  |  | 1 | 0 |  |
| ign2ValuesMax |  |  |  | 1 | 0 |  |
| advance2ForGauge |  |  |  | 1 | 0 |  |
| ign2ValueLoD |  |  |  | 1 | 0 |  |
| ign2ValueHiD |  |  |  | 1 | 0 |  |
| ign2ValueLoW |  |  |  | 1 | 0 |  |
| ign2ValueHiW |  |  |  | 1 | 0 |  |
| fuelLoad2 |  |  |  | 1 | 0 |  |
| ignLoad2 |  |  |  | 1 | 0 |  |
| vvtLoad |  |  |  | 1 | 0 |  |
| vvtLoadMax |  |  |  | 1 | 0 |  |
| wmiLoadMax |  |  |  | 1 | 0 |  |
| idleRes |  |  |  | 1 | 0 |  |
| idleResMax |  |  |  | 1 | 0 |  |
| vvtLoadRes |  |  |  | 1 | 0 |  |
| wmiLoadRes |  |  |  | 1 | 0 |  |
| fuelLoadRes |  |  |  | 1 | 0 |  |
| ignLoadRes |  |  |  | 1 | 0 |  |
| fuelLoadFeedBack |  |  |  | 1 | 0 |  |
| ignLoadFeedBack |  |  |  | 1 | 0 |  |
| fuel2LoadRes |  |  |  | 1 | 0 |  |
| ign2LoadRes |  |  |  | 1 | 0 |  |
| vvtDecimalRes |  |  |  | 1 | 0 |  |
| fuelDecimalRes |  |  |  | 1 | 0 |  |
| ignDecimalRes |  |  |  | 1 | 0 |  |
| fuel2DecimalRes |  |  |  | 1 | 0 |  |
| ign2DecimalRes |  |  |  | 1 | 0 |  |
| boostTableLimit |  |  |  | 1 | 0 |  |
| CLIdleDelta |  |  |  | 1 | 0 |  |
| syncStatus |  |  |  | 1 | 0 |  |
| CANisAvailable |  |  |  | 1 | 0 |  |
| anyEngineProtectFlag |  |  |  | 1 | 0 |  |
