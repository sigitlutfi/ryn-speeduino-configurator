# Rolling Pop & Bang Feature

This document describes the new `Rolling Pop & Bang` feature for the `ryn-speeduino-configurator` team.

## Summary

`Rolling Pop & Bang` is a button-driven overrun theatrics mode.

It is intended to feel closer to a manual "fashion" mode than to ALS:
- driver-controlled by switch/button
- active only inside a safety window
- uses timing retard and fuel adjustment
- can optionally add scheduler cut with an 8-bit repeating pattern

The implementation lives in:
- `speeduino/rolling_pop_bang.h`
- `speeduino/rolling_pop_bang.cpp`

## Runtime Behavior

Activation requires all of the following:
- feature enabled
- valid switch pin configured
- switch active with configured polarity
- TPS less than or equal to `rollingPopBangMaxTPS`
- RPM between `rollingPopBangMinRPM` and `rollingPopBangMaxRPM`
- VSS greater than or equal to `rollingPopBangMinVSS`
- CLT greater than or equal to `rollingPopBangMinCLT`
- active time less than `rollingPopBangMaxDuration`

When active:
- `rollingPopBangActive` becomes `true`
- ignition timing is retarded by `rollingPopBangTimingRetard`
- fuel correction becomes `100 + rollingPopBangFuelModifier`
- optional cut pattern advances while cut mode and pattern are enabled

When inactive:
- timing correction resets to `0`
- fuel correction resets to `100`
- cut counter resets to `0`

## Cut Strategy

V2 adds optional scheduler cut support.

Two new config values are used:
- `rollingPopBangCutType`
- `rollingPopBangCutPattern`

`rollingPopBangCutType` values:
- `0`: Disabled
- `1`: Ignition Only
- `2`: Fuel Only
- `3`: Both

`rollingPopBangCutPattern` is an 8-bit repeating mask:
- bit set: cut is applied on that step
- bit clear: no cut on that step

Examples:
- `1` or `0x01`: one cut step, then seven clear steps
- `85` or `0x55`: alternating cut steps
- `170` or `0xAA`: alternating cut steps with opposite phase
- `240` or `0xF0`: four clear steps, then four cut steps

Current implementation applies the selected cut mode to all configured ignition/fuel channels for the active pattern step, then restores normal scheduler state on clear steps.

## Config Fields

The feature currently occupies config page 10 offsets `208-218`.

Fields:
- `rollingPopBangEnabled`
- `rollingPopBangPin`
- `rollingPopBangPinMode`
- `rollingPopBangMinRPM`
- `rollingPopBangMaxRPM`
- `rollingPopBangMaxTPS`
- `rollingPopBangMinVSS`
- `rollingPopBangMinCLT`
- `rollingPopBangTimingRetard`
- `rollingPopBangFuelModifier`
- `rollingPopBangMaxDuration`
- `rollingPopBangCutType`
- `rollingPopBangCutPattern`

## Runtime Status

The following runtime fields were added:
- `rollingPopBangActive`
- `rollingPopBangSwitchState`
- `rollingPopBangActiveTime`
- `rollingPopBangCutCounter`
- `rollingPopBangTimingCorrection`
- `rollingPopBangFuelCorrection`

## TunerStudio / Configurator Notes

The feature has been added to `reference/speeduino.ini` as:
- menu entry: `Rolling Pop & Bang`
- dialog: `Rolling Pop & Bang Settings`

Current UI fields:
- enable
- switch pin
- pin mode
- min RPM
- max RPM
- max TPS
- min VSS
- min CLT
- timing retard
- fuel modifier
- max duration
- cut type
- cut pattern

Recommended configurator presentation:
- present this as a distinct manual feature, not as ALS
- group `timing retard`, `fuel modifier`, and `cut settings` under an "Effect" section
- expose pattern field with helper text and example presets if possible

## Suggested UX Copy

Suggested short description:

`Manual overrun theatrics mode for rolling conditions. Retards timing, adjusts fueling, and can optionally apply patterned ignition/fuel cut for stronger pop-and-bang behavior.`

Suggested warning:

`Use with care. Aggressive retard and cut patterns can increase exhaust temperature and stress turbo/exhaust components.`

## Validation Notes

Relevant code paths touched:
- `speeduino/rolling_pop_bang.cpp`
- `speeduino/corrections.cpp`
- `speeduino/engineProtection.cpp`
- `speeduino/config_pages.h`
- `speeduino/statuses.h`
- `reference/speeduino.ini`

Relevant tests extended:
- `test/test_ign/test_corrections.cpp`
- `test/test_engineprotect/main.cpp`

## Future Extensions

Likely next evolutions:
- logger/output channels for live monitoring
- optional TPS-dot / decel-trigger mode
- richer pattern presets in configurator
- optional interlock rules against ALS or other performance modes
