# Default pin, INI and configurator audit — 2026-10-07

Baseline: firmware `c7fdbc9e`, configurator `a9dc2f5`. The actual user's board/MCU
has not been confirmed. Firmware checks apply across targets; the new web
physical map explicitly supports Arduino Mega 2560 and its compiled layouts.

## What the defaults mean

The INI default `pinLayout = 1` selects Speeduino v0.2. This is an INI/project
initialization default, not proof that an existing ECU uses that board. Read its
stored `pinLayout`; changing an INI default does not migrate an existing tune.

Injector, ignition, trigger, TPS, MAP, IAT, CLT, O2 and battery pins come from
`speeduino/src/pins/pinMapping.cpp`. They are not individually configurable INI
pin constants. A web registry that only discovers INI pin fields misses them.

For fields such as `fuelPumpPin`, `tachoPin`, `fanPin`, `boostPin`, `vvt1Pin`,
`launchPin` and `vssPin`, raw 0 means board routing. It is not physical D0 and it
does not enable the function. A nonzero override replaces the default route.

| Route | v0.2 (ID 1) | v0.3 (ID 2) | v0.4 (ID 3) | UA4C (ID 41) |
| --- | --- | --- | --- | --- |
| Injectors 1–4 | D8,9,10,11 | D8,9,10,11 | D8,9,10,11 | D8,7,6,5 |
| Ignition 1–4 | D28,24,40,36 | D28,24,40,36 | D40,38,52,50 | D35,36,33,34 |
| Crank / cam | D20 / D21 | D19 / D18 | D19 / D18 | D19 / D18 |
| Fuel pump | D4 | D4 | D45 | D23 |
| Tacho | D49 | D49 | D49 | D22 |
| Fan | D47 | A13 / D67 | D47 | D24 |
| TPS / MAP | A2 / A3 | A2 / A3 | A2 / A3 | A3 / A0 |
| IAT / CLT / O2 / battery | A0 / A1 / A8 / A4 | A0 / A1 / A8 / A4 | A0 / A1 / A8 / A4 | A5 / A4 / A1 / A2 |

Numbers above are MCU pins, not connector terminals. The standard Mega build
compiles 4 injector and **5 ignition** pins, including the mapping's fifth
placeholder. The 6/3 and 8/1 builds compile different arrays. Firmware reserves
the compiled arrays regardless of engine cylinder count or currently firing
channels; the web map follows this rule. Unknown build selection conservatively
reserves all mapped channels. v0.4 D50 is shared by injector 6 and ignition 4 in
the source; choosing the correct build avoids reporting both as live channels.

Custom input raw 0 has distinct meanings: ALS/Rumble auto mode claims no switch
pin; Pit/Pop require an explicit switch and remain inactive without one.

## Findings and corrections

| Finding | Correction |
| --- | --- |
| Board Default and fixed firmware routes had no physical web claims | Generate 14 AVR layout maps from the firmware source; add fixed injector/ignition/trigger/sensor rows; resolve zero/default and explicit overrides |
| Analog/digital labels were separate resources | With a selected Mega map, canonicalize physical MCU pins: analog A8 and digital A8 both claim D62; A15 claims D69 |
| Custom input rejection did not reserve crank/cam or several active standard resources | Extend `pinIsUsed`/`pinIsOutput` for assigned trigger inputs, O2 2, active VSS/launch/flat-shift/table switches/pressure/baro/EMAP/idle-up/CTPS/AC/WMI/knock and nitrous routing |
| AVR analog translation table omitted A15 although INI offers it | Include A15 and compile-time assertion; raw analog 15 now resolves A15, not D15 |
| Idle-up input/output and CTPS zero advertised Board Default but firmware translates zero directly | Correct the three INI labels to Pin Required; reject enabled zero-pin saves in the tuning hook |
| INI visibility overrode feature enable gates | Follow firmware activation gates for mapped fields; flat shift also owns launch input, only external VSS uses its input, only mode 4 uses table-switch inputs |
| PinSelect locked inactive configured owners even though the registry released them | Lock and warn for active owners; retain inactive configuration information |
| INVALID entries could appear as selectable No Pin | Hide new invalid choices, show existing invalid values as unavailable, retain range validation |
| Dropdown checks could be bypassed by loading an existing conflicting custom assignment | Validate candidate project pages at Save/Burn; enabled custom inputs cannot take a known firmware-owned pin |
| MCU and compiled channels were implicit | Add persistent project choices in I/O Summary. Other/unknown MCUs and unsupported layouts stay explicitly unverified |

Generated AVR IDs: **1, 2, 3, 6, 8, 9, 10, 20, 30, 31, 40, 41, 42, 45**.
The INI lists layouts for multiple CPU families. For example ID 61 is the FCR
Micro F4; it is not a Mega layout. Unsupported IDs in a standard Mega build
fall back to v0.2 in firmware; the web warns instead of claiming a verified map.

The map preserves factory VSS/tertiary sharing where explicitly present in the
source. Custom switches still cannot take any assigned trigger pin. Knock
digital mode uses its raw pin directly; analog mode uses analog positions
47–62, with A15 fallback for a non-analog selection. Web choices now follow the
mode and reserve the actual pin. Nitrous stage pins remain reserved even while
disabled, because its initialization still sets both stage pins as outputs.

## How to use the matched configuration

1. Update the project's embedded INI. Confirm its `pinLayout` matches the PCB.
2. In I/O Summary select the actual MCU and channel build; save the project.
   These are project-only pin map settings and do not write a new ECU pinout.
3. Review default, explicit and conflicting routes there. For each custom
   switch select a pin that is both available in the MCU map and physically
   brought out to a suitable board input.
4. Back up the tune, Burn changes and power-cycle for firmware input routing.
   Review any old analog-15 selection because its previous firmware routing was
   incorrect. No EEPROM layout, page size or signature change was needed here;
   the paired contract remains `speeduino 202504-ryn-perf-v3`.

## Verification and limits

- Node tests: **33 passed**, including physical defaults, overrides, compiled
  channels, aliases, feature gating, missing defaults, Save rejection,
  invalid options, map extraction and project save/load persistence.
- Native firmware: **357 passed, 4 skipped** across initialization, custom
  performance, programmable I/O, storage, nitrous, secondary maps, sensors,
  general utilities, ignition and engine protection suites.
- Vite renderer production build passed. Both INIs are byte-identical.
- Mega, 6/3 and 8/1 AVR builds passed. RAM/flash: standard 6436/196980 bytes;
  6/3 6524/196046; 8/1 6618/194346 (limits 8192/253952).

No ECU was flashed or bench-tested, and no interactive visual browser test was
performed. Teensy/STM32 physical web maps, connector-level PCB wiring, external
peripherals and decoder-specific sharing still need board-specific validation.
Unknown MCU/build must not be inferred from cylinder count or the INI signature.
The MCU map establishes software ownership; it cannot establish that a spare
MCU pin is exposed, conditioned or electrically suitable on a particular PCB.

Regenerate the bundled AVR map after firmware mapping changes:

```bash
node scripts/avr-pin-mapping.mjs /path/to/speeduino/src/pins/pinMapping.cpp
```

The generator records the source SHA-256, honors CORE_AVR conditional branches,
preserves assignment order and rejects unrecognized pin expressions.
