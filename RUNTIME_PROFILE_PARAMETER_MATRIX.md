# Runtime Profile Parameter Matrix

## Purpose

This document supports [RYN_CONFIGURATOR_RUNTIME_PROFILE_PLAN.md](C:/Users/ryn/speeduino/speeduino/RYN_CONFIGURATOR_RUNTIME_PROFILE_PLAN.md).

Its purpose is to provide a concrete working inventory of parameters that may be used by `ryn-speeduino-configurator` for **runtime vehicle profile application via serial**.

This is an implementation-facing document.

## Classification Rules

Each parameter should be classified into one of the following runtime safety classes:

- `SAFE_RUNTIME`
- `CAUTION_RUNTIME`
- `STATIC_ONLY`
- `UNKNOWN`

### SAFE_RUNTIME

Expected to be safe for live runtime switching under normal guarded conditions.

### CAUTION_RUNTIME

May be changed at runtime, but only when strict apply conditions are met.

### STATIC_ONLY

Should not be used for runtime profile switching.

### UNKNOWN

Not yet reviewed or not yet proven.

## Required Columns

Each parameter should be evaluated using these fields:

- `Parameter`
- `Subsystem`
- `Source`
- `Current Use`
- `Serial Read`
- `Serial Write`
- `Safety Class`
- `Why`
- `Profile Relevance`
- `Notes`

## Discovery Process

When evaluating a parameter:

1. identify its source field or runtime state
2. determine whether configurator can read it over serial
3. determine whether configurator can write it over serial
4. classify runtime safety
5. note whether it belongs in V1, later, or never

## Runtime Guard Assumption

Unless explicitly noted otherwise, assume runtime profile application only occurs when:

- ECU handshake is valid
- engine is not cranking
- TPS is low
- RPM is low

Recommended default guard for V1:

- TPS `< 5%`
- RPM `< 1500`

## Matrix

| Parameter | Subsystem | Source | Current Use | Serial Read | Serial Write | Safety Class | Why | Profile Relevance | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `fuel2Mode` | Fuel secondary table | `configPage10` | selects off / multiply / add / conditional switch / input switch for Fuel Table 2 | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | map selection logic is already intended to alter fuel behavior dynamically | High | good candidate for profile-controlled fuel behavior |
| `fuel2Algorithm` | Fuel secondary table | `configPage10` | selects load source for Fuel Table 2 | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | changing load source live changes how VE2 is interpreted | Medium | likely safer when engine is idle only |
| `fuel2SwitchVariable` | Fuel secondary table | `configPage10` | conditional trigger source for Fuel Table 2 | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | switching trigger logic is conceptually mode control rather than core tune editing | Medium | useful for profile orchestration |
| `fuel2SwitchValue` | Fuel secondary table | `configPage10` | threshold for conditional Fuel Table 2 activation | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | threshold changes are mode-like and are expected to be low risk if guarded | Medium | useful for mode thresholds |
| `fuel2InputPin` | Fuel secondary table | `configPage10` | input pin for Fuel Table 2 switching | `UNKNOWN` | `UNKNOWN` | `STATIC_ONLY` | pin routing should not be changed during runtime profile switching | Low | treat as installation/tune structure |
| `fuel2InputPolarity` | Fuel secondary table | `configPage10` | polarity for Fuel Table 2 input | `UNKNOWN` | `UNKNOWN` | `STATIC_ONLY` | hardware input semantics should remain stable | Low | not a profile parameter |
| `fuel2InputPullup` | Fuel secondary table | `configPage10` | pullup setting for Fuel Table 2 input | `UNKNOWN` | `UNKNOWN` | `STATIC_ONLY` | hardware electrical behavior should remain stable | Low | not a profile parameter |
| `spark2Mode` | Spark secondary table | `configPage10` | selects off / multiply / add / conditional switch / input switch for Spark Table 2 | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | intended to alter ignition behavior dynamically | High | strong candidate for profile switching |
| `spark2Algorithm` | Spark secondary table | `configPage10` | selects load source for Spark Table 2 | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | changing live ignition load interpretation can have immediate effect | Medium | apply only under strict guard |
| `spark2SwitchVariable` | Spark secondary table | `configPage10` | conditional trigger source for Spark Table 2 | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | mode-like threshold logic | Medium | useful for dynamic profile rules |
| `spark2SwitchValue` | Spark secondary table | `configPage10` | threshold for conditional Spark Table 2 activation | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | likely acceptable under low-load guard | Medium | candidate for profile-specific trigger behavior |
| `spark2InputPin` | Spark secondary table | `configPage10` | input pin for Spark Table 2 switching | `UNKNOWN` | `UNKNOWN` | `STATIC_ONLY` | hardware input mapping should not change live | Low | installation-level field |
| `spark2InputPolarity` | Spark secondary table | `configPage10` | polarity for Spark Table 2 input | `UNKNOWN` | `UNKNOWN` | `STATIC_ONLY` | hardware semantic | Low | not a runtime profile field |
| `spark2InputPullup` | Spark secondary table | `configPage10` | pullup setting for Spark Table 2 input | `UNKNOWN` | `UNKNOWN` | `STATIC_ONLY` | hardware semantic | Low | not a runtime profile field |
| `pitLimiterEnabled` | Pit limiter | `configPage6` | enables pit limiter logic | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | logical feature enable is a good profile candidate | Medium | useful for race-oriented profiles |
| `pitLimiterRPM` | Pit limiter | `configPage6` | RPM threshold for pit limiter | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | affects active cut threshold directly | Medium | allow only under guard |
| `pitLimiterSpeed` | Pit limiter | `configPage6` | speed threshold for pit limiter | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | affects limiter activation threshold | Medium | maybe profile-specific for pit mode |
| `pitLimiterCutType` | Pit limiter | `configPage6` | hard / soft / rolling cut behavior | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | changes intervention style | Medium | useful but should not change under load casually |
| `rumbleIdleEnabled` | Rumble idle | `configPage6` | enables rumble idle logic | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | logical feature enable/disable | High | strong profile candidate for fun/street split |
| `rumbleIdleCutType` | Rumble idle | `configPage6` | ignition / fuel / both cut behavior | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | directly changes intervention behavior | Medium | use only under guard |
| `rumbleIdleMinRPM` | Rumble idle | `configPage6` | lower RPM activation threshold | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | threshold-like behavior | Medium | profile tuning candidate |
| `rumbleIdleMaxRPM` | Rumble idle | `configPage6` | upper RPM activation threshold | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | threshold-like behavior | Medium | profile tuning candidate |
| `rumbleIdleMaxTPS` | Rumble idle | `configPage6` | TPS threshold for rumble activation | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | gating behavior | Medium | useful for character tuning |
| `rumbleIdleDutyCycle` | Rumble idle | `configPage6` | rumble intensity behavior | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | directly changes effect intensity | High | good profile candidate but apply guarded |
| `rumbleIdleFrequency` | Rumble idle | `configPage6` | beat frequency | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | directly changes live oscillation behavior | High | strong profile candidate |
| `rumbleIdlePatternBits` | Rumble idle | `configPage6` | pattern bitmask | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | directly changes live behavior | High | useful for fun profiles, but not while unstable |
| `rumbleIdlePatternLength` | Rumble idle | `configPage6` | active pattern length | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | changes runtime patterning | Medium | acceptable with guard |
| `alsEnabled` | Anti-lag | `configPage10` | enables ALS logic | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | feature enable flag is suitable for profile packaging | High | strong race profile candidate |
| `alsTimingRetard` | Anti-lag | `configPage10` | retard amount used by ALS | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | directly changes combustion timing during ALS | High | should be changed only while not active |
| `alsFuelModifier` | Anti-lag | `configPage10` | fuel change used during ALS | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | directly changes fueling during ALS | High | do not change while ALS is active |
| `alsMaxTPS` | Anti-lag | `configPage10` | TPS gate for ALS activation | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | threshold-like behavior | Medium | good profile candidate |
| `alsMinRPM` | Anti-lag | `configPage10` | RPM gate for ALS activation | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | threshold-like behavior | Medium | profile tuning candidate |
| `alsMinBoost` | Anti-lag | `configPage10` | MAP/boost gate for ALS activation | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | threshold-like behavior | Medium | useful for profile tuning |
| `alsMaxDuration` | Anti-lag | `configPage10` | timeout for ALS operation | `UNKNOWN` | `UNKNOWN` | `SAFE_RUNTIME` | safety envelope parameter | High | good candidate for race vs conservative profile |
| `alsIgnCutEnable` | Anti-lag | `configPage10` | ignition cut component enable | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | directly changes ALS harshness and risk | High | useful but apply only under strict guard |
| `alsIgnCutPattern` | Anti-lag | `configPage10` | ignition cut pattern | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | direct behavior change during ALS | Medium | should not change while ALS is engaged |
| `alsFuelCutPattern` | Anti-lag | `configPage10` | fuel cut pattern | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | direct behavior change during ALS | Medium | should not change while ALS is engaged |
| `VE2 table contents` | Fuel table data | `fuelTable2` | secondary VE table data | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | directly changes fueling map; effect may be immediate in active cells | High | runtime editing possible in theory, but avoid for V1 unless strictly controlled |
| `Spark2 table contents` | Ignition table data | `ignitionTable2` | secondary ignition table data | `UNKNOWN` | `UNKNOWN` | `CAUTION_RUNTIME` | directly changes ignition map; can be immediately felt | High | avoid for V1 unless tightly controlled |
| `VE1 table contents` | Fuel table data | `fuelTable1` | primary fuel map | `UNKNOWN` | `UNKNOWN` | `STATIC_ONLY` | base tune should remain authoritative in V1 | High | preserve as source of truth |
| `Spark1 table contents` | Ignition table data | `ignitionTable1` | primary ignition map | `UNKNOWN` | `UNKNOWN` | `STATIC_ONLY` | base tune should remain authoritative in V1 | High | preserve as source of truth |

## Recommended V1 Whitelist Candidate

These are the strongest first-pass candidates for V1 runtime profiles:

- `fuel2Mode`
- `fuel2SwitchVariable`
- `fuel2SwitchValue`
- `spark2Mode`
- `spark2SwitchVariable`
- `spark2SwitchValue`
- `rumbleIdleEnabled`
- `alsEnabled`
- `alsMaxDuration`

These are useful but should be treated carefully:

- `rumbleIdleDutyCycle`
- `rumbleIdleFrequency`
- `rumbleIdlePatternBits`
- `alsTimingRetard`
- `alsFuelModifier`
- `alsIgnCutEnable`

These should not be used for V1 runtime profile application:

- `fuel2InputPin`
- `fuel2InputPolarity`
- `fuel2InputPullup`
- `spark2InputPin`
- `spark2InputPolarity`
- `spark2InputPullup`
- `VE1 table contents`
- `Spark1 table contents`

## Immediate Next Actions

1. Confirm serial read/write capability for each V1 whitelist candidate.
2. Mark each candidate `YES/NO/UNKNOWN` for serial read.
3. Mark each candidate `YES/NO/UNKNOWN` for serial write.
4. Build the first `Aggressive` profile only from confirmed V1-safe fields.
5. Revisit `VE2 table contents` and `Spark2 table contents` only after switch-based profiles are proven.

## Notes for Developers

- Treat this document as a living matrix.
- Do not expand V1 scope by default.
- Prefer runtime switching of existing mechanisms over live rewrite of primary tune data.
- If a parameter cannot be confidently classified, leave it as `UNKNOWN` until proven.

