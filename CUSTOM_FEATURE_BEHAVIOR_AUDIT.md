# Custom performance behavior audit — 2026-10-07

Firmware baseline: `c03d3bfb` on `feature/performance-features`, including upstream
`fb602718` through merge `7bf91a50`. Configurator baseline: `3166171` on
`codex/performance-protocol-v2`. This audit follows the earlier wire/INI audit
and checks how the four custom controllers actually behave together.

## Findings and fixes

| Finding | Resulting correction |
| --- | --- |
| Rumble INI encoded Ignition/Fuel/Both as 0/1/2, but firmware uses OFF/IGN/FUEL/BOTH as 0/1/2/3 | Correct labels and default to ignition raw 1; preserve the meaning of existing raw bytes |
| Custom cuts had a priority, but ALS and pop/bang fuel/timing could stack | One selector now governs custom cuts, fuel and timing: Pit → Rumble → ALS → Pop/bang |
| Controllers could activate during cranking or when stopped | Require the upstream engine rotation state to be Running; reset on other states |
| Signed fuel modifiers narrowed to uint8 before clamping | Clamp 100 + modifier to 70–150 before narrowing; INI/UI modifier range is -30…+50 |
| Out-of-range unsigned retard bytes could become negative signed correction | Clamp ALS retard to 90 and pop/bang to 40 before narrowing; corrupted high values cannot become an advance request |
| ALS/pop first activation advanced past pattern bit 0 | Start at bit 0; advance on subsequent 30 Hz calls |
| Rumble first bit was delayed and length/frequency could exceed the usable sequencer | Evaluate bit 0 immediately, constrain length 1–8 and rate 1–30 steps/s; reset phase on reactivation; catch up elapsed steps and handle 32-bit millis rollover |
| Rolling pit cuts inherited previous scheduler masks and used a 49/100 comparison | Generate a fresh custom mask, with 50/100 random decisions; intersect standard cuts afterward |
| Pit soft timing ignored a reached VSS limit below the RPM window; subtraction could overflow int8 | Honor VSS activation in the timing path and clamp relative timing using int16 |
| ALS target RPM had no web control; pit shared dependencies were hidden | Expose ALS cut target and pit Engine Protection/SoftLimitMode/SoftLimRetard settings, explaining their shared scope |
| Web configuration admitted ineffective windows/modes and misleading pattern descriptions | Validate enabled feature windows/dependencies; allow zero cut target and speed-only hard/rolling pit operation; describe decimal masks and actual boundaries |
| ALS fuel display forced all corrections to at least 100%; status labels overstated effect execution | Display actual requested fuel, including reduction, and distinguish met conditions from the selected effect |

## Behavioral contract

All features require Running. Standard cuts, no-sync/staging requirements,
fixed timing and DFCO retain their existing authority. A fire/clear custom step
does not restore a channel disabled by standard protection. An active flag means
its activation conditions passed; a higher-priority custom feature can suppress
its corrections. Lower-priority controllers still advance their phase and
timeout while waiting; they do not get a fresh timeout when selected.

| Feature | Activation and effect |
| --- | --- |
| Pit | Dedicated switch; hard/rolling at RPM or VSS threshold. Soft starts at RPM limit minus window, or at the VSS threshold. Hard cuts both; rolling uses shared engineProtectType; soft requires an RPM limit and ignition-enabled engineProtectType and uses shared soft timing. Soft timing alone does not guarantee a hard speed/RPM cap. |
| Rumble | Auto or optional switch; inclusive RPM range, strict TPS less-than, CLT/VSS minimums. Pattern 1=fire, 0=cut; bit 0 first. Rate is steps/s, so an 8-step pattern at 10 steps/s repeats at 1.25 cycles/s. Cut OFF disables the effect. |
| ALS | Auto or optional switch; RPM strictly above minimum, TPS strictly below maximum, absolute MAP strictly above minimum, inclusive CLT range and VSS minimum. Target RPM gates both cut patterns; 0 removes that gate. Ignition pattern needs its enable flag; fuel pattern is independent. 1=cut, 0=clear, bit 0 first, eight steps at nominal 30 steps/s. |
| Pop/bang | Dedicated switch; inclusive RPM range and TPS maximum, CLT/VSS minimums. Same eight-step clock and bit semantics as ALS. Cut type OFF permits timing/fuel-only operation. |

ALS/pop fuel is a multiplier relative to 100%, not an absolute enrichment value.
Positive timing values are degrees subtracted from incoming advance, clamped to
-30…+40 degrees. Telemetry reports the controller's requested correction, not
the final advance or delivered fuel after priority, DFCO and other corrections.
ALS/pop timeout is limited to 30 seconds; zero prevents activation. Expiry
latches until activation conditions clear, the feature is disabled, or the
engine leaves Running.

## Paired release and existing tunes

Modern and legacy signatures, both INIs and the mock identify
`speeduino 202504-ryn-perf-v3`. This semantic version change makes a v2 embedded
INI fail the existing write guard against a v3 ECU. Branch names are unchanged.
Page 6 remains 143 bytes, page 10 remains 220 bytes, and realtime remains 152
bytes. EEPROM addresses and the `RYN1` extension marker remain unchanged;
existing extension settings are preserved, with no new migration/reset.

Use the paired firmware and INI. Explicitly update the INI embedded in existing
`.rynproj` files. Review Rumble cut selection: a saved raw 0 still means OFF,
1 ignition, 2 fuel, 3 both; corrected labels do not reconstruct a user's prior
intent. Review old Rumble rates above 30 and fuel modifiers outside -30…+50;
firmware clamps these, and the new UI rejects out-of-range saves. Input routing
changes still require Burn and a power cycle.

## Verification and limits

- Native storage, initialization, performance, ignition and engine protection:
  235 cases, 231 passed and 4 skipped. New cases cover cut enums, pattern phase,
  millis rollover, cranking/stopped exclusion, correction priority, signed fuel
  limits and VSS-triggered pit soft timing.
- Configurator: `node --test test/*.test.mjs`, 23 passed. Existing tests cover
  wire bounds, telemetry, normalization, page preservation and signature guards;
  additional tests cover enums, usable ranges, priority and shared controls.
- Vite renderer production build passed. Both INIs are byte-identical.
- AVR builds passed for Mega, 6-injector/3-ignition and 8-injector/1-ignition
  variants (Windows PlatformIO; native tests use Ubuntu/WSL).

| AVR variant | RAM / 8192 bytes | Flash / 253952 bytes |
| --- | ---: | ---: |
| Mega | 6436 (78.6%) | 196374 (77.3%) |
| 6 injectors / 3 ignition | 6522 (79.6%) | 195044 (76.8%) |
| 8 injectors / 1 ignition | 6616 (80.8%) | 193782 (76.3%) |

No physical ECU was flashed or exercised. No interactive browser/serial bench
verification was performed. Board pin reservations and analog/digital physical
aliases remain incomplete in the web registry; firmware routing rejects occupied
custom input pins at initialization. Confirm the actual board pinout and bench
behavior before relying on the screen's free-pin choices.

Follow-up: the [default pin audit](PIN_DEFAULT_AUDIT.md) resolves the web's AVR
board defaults and physical aliases with explicit MCU/channel selections and
additional firmware reservation checks. Other MCU/PCB mappings remain unverified.
