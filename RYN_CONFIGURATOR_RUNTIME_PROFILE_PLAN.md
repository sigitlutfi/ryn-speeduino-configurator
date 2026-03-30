# Runtime Vehicle Profile Plan for `ryn-speeduino-configurator`

## Purpose

This document defines a concrete implementation plan for adding **runtime vehicle profiles via serial** in `ryn-speeduino-configurator`.

The goal is to make the vehicle feel different on demand without permanently changing the base tune stored in Speeduino.

This plan is intentionally biased toward:

- minimal changes to Speeduino core
- no EEPROM burn for profile activation
- safe runtime behavior
- a laptop-first workflow
- a clean path to future ESP32-based profile switching

## Core Product Decision

### V1 behavior

Profiles are:

- **runtime only**
- **not written to EEPROM**
- **reset when ECU/vehicle powers off**
- **applied over serial**
- **owned by `ryn-speeduino-configurator`, not by Speeduino core**

### Why this approach

- avoids repeated EEPROM writes
- reduces upstream merge/rebase risk
- keeps Speeduino mostly stock
- makes experimentation safe
- allows fast iteration in the configurator before any embedded hardware controller exists

## High-Level Concept

Treat the Speeduino tune as two layers:

1. `Base tune`
- the user's permanent tune
- the source of truth
- remains untouched during normal profile switching

2. `Runtime profile overlay`
- temporary adjustments applied during the session
- controlled externally over serial
- discarded on ECU restart

The configurator becomes the **profile orchestration layer**.

## Non-Goals for V1

These are explicitly out of scope for the first version:

- adding new permanent profile storage inside Speeduino
- adding VE3/VE4 or Spark3/Spark4 inside firmware
- editing fuel/spark tables bin-by-bin manually while driving
- forcing profile persistence across ECU power cycles
- building an ESP32 controller first

## Profile Model

A profile is a named package of runtime changes.

Examples:

- `Street`
- `Aggressive`
- `Race`
- `Fun`

Each profile may contain a combination of:

- fuel behavior
- ignition behavior
- AFR-related behavior
- rumble idle behavior
- ALS behavior
- pit limiter behavior
- later: launch, boost, limiter presets, etc.

## Recommended V1 Scope

Start with one profile only:

- `Aggressive`

Plus one system action:

- `Return To Base`

This keeps the first release small and testable.

## Recommended Technical Strategy

Use a mixed strategy:

1. Reuse existing Speeduino capabilities where possible
- `fuel2`
- `spark2`
- existing enable flags and mode fields

2. Apply carefully selected runtime changes over serial where needed
- but do not redesign Speeduino internals

## VE / Spark Strategy

### Guiding idea

The user tunes:

- `VE1` as the permanent base fuel map
- `Spark1` as the permanent base ignition map

`VE2` and `Spark2` are treated as the best available "adjustable second layer" where useful.

### Practical interpretation

For V1, the configurator should support one of these approaches:

1. `Switch-based profile`
- activate existing `fuel2` / `spark2` behavior through serial-configurable runtime parameters

2. `Generated secondary profile`
- derive `VE2` and `Spark2` from base maps using a deterministic preset rule
- example: enrich or reshape selected load/rpm zones

### Important note

Do **not** define "Aggressive" as only `VE +10% everywhere`.

That may be useful as an experiment, but it is not a complete vehicle character.

A real profile may eventually include:

- VE behavior
- spark behavior
- AFR target behavior
- ALS enablement
- rumble enablement
- other feature settings

## Runtime Safety Policy

All parameters considered for live application must be classified into one of these groups:

### 1. Safe Runtime

Can be changed while the engine is running with low risk.

Examples:

- switching secondary table behavior
- feature enable flags that are already runtime-driven
- temporary mode selectors
- profile indicator state in configurator

### 2. Caution Runtime

Can be changed live, but only under controlled conditions.

Examples:

- values that directly affect fueling
- values that directly affect ignition timing
- profile changes that could alter drivability immediately

These should only be applied when conditions are safe.

### 3. Static Only

Should not be changed by runtime profile switching.

Examples:

- structural tune data
- calibration-like settings
- anything that requires EEPROM commit to behave correctly
- values that should only change during offline tuning workflows

## Safe Apply Conditions

The configurator must refuse profile application unless safe conditions are met.

Recommended V1 conditions:

- ECU connection valid
- communication handshake successful
- engine not cranking
- TPS below threshold
- RPM below threshold
- optionally MAP/load below threshold

Recommended default thresholds for V1:

- TPS `< 5%`
- RPM `< 1500`

These may later be made configurable.

## Serial Workflow

### Required flow

1. Connect to ECU
2. Perform handshake
3. Read current runtime-relevant state
4. Validate safe apply conditions
5. Apply profile payload
6. Read back values to verify
7. Mark profile as active in configurator session state

### On failure

If any apply step fails:

1. stop applying remaining changes
2. attempt rollback to known session baseline
3. notify user that profile application failed

## Session Baseline

When the configurator first connects, it should capture a **session baseline**.

This baseline is:

- the reference state for `Return To Base`
- the state to restore after failed apply
- not a permanent backup file unless explicitly exported

## Profile State Ownership

For V1, profile state should live in the configurator, not in Speeduino.

This means:

- Speeduino does not need a new persistent "active profile" concept
- the configurator tracks which profile it applied
- after ECU restart, configurator must assume profile state is lost until reconfirmed

## Proposed Profile Payload Format

The configurator should internally represent a profile as structured data.

Suggested shape:

```json
{
  "name": "Aggressive",
  "version": 1,
  "runtime_only": true,
  "apply_requirements": {
    "max_tps_pct": 5,
    "max_rpm": 1500,
    "engine_not_cranking": true
  },
  "changes": [
    {
      "key": "fuel2Mode",
      "type": "scalar",
      "value": 4
    },
    {
      "key": "spark2Mode",
      "type": "scalar",
      "value": 4
    }
  ]
}
```

The exact format can change, but the implementation should keep these concepts:

- metadata
- apply requirements
- list of changes

## Recommended V1 Features in Configurator

### UI

Minimum UI:

- `Connect`
- `Aggressive`
- `Return To Base`
- status display

Status display should show:

- ECU connected/disconnected
- safe to apply: yes/no
- active runtime profile: base/aggressive/unknown
- last apply result

### User messaging

The UI must clearly say:

- profiles are runtime only
- profiles reset after ECU power cycle
- no EEPROM burn is performed

## Engineering Plan

### Phase 1: Discovery

Goals:

- identify which parameters can be safely modified via serial
- identify which commands are already supported
- identify which fields should be excluded from runtime editing

Deliverables:

- parameter whitelist
- parameter blacklist
- command capability notes

### Phase 2: Baseline/Apply Engine

Goals:

- implement session baseline capture
- implement profile payload parser
- implement guarded apply flow
- implement readback verification

Deliverables:

- baseline manager
- apply engine
- rollback mechanism

### Phase 3: First Profile

Goals:

- implement one concrete `Aggressive` profile
- define exactly which settings are included
- prove profile can be applied and removed safely

Deliverables:

- one tested profile
- documented expected behavior

### Phase 4: Vehicle Validation

Goals:

- verify live behavior on a controlled setup
- confirm no unwanted persistence
- validate recovery after power cycle

Deliverables:

- validation checklist
- known limitations

### Phase 5: Generalize Profile System

Goals:

- add more named profiles
- support richer payloads
- prepare profile engine for future ESP32 transport

Deliverables:

- reusable profile model
- transport-independent apply layer

## Required Separation in Code

`ryn-speeduino-configurator` should separate:

1. `Transport`
- serial communication only

2. `Speeduino API Layer`
- read/write/verify operations for specific fields/commands

3. `Profile Engine`
- profile definitions
- safe-apply logic
- rollback logic

4. `UI Layer`
- buttons
- profile selection
- user feedback

This separation is critical for future ESP32 migration.

## Path to ESP32

The future ESP32 version should reuse the same profile model and apply rules.

The only thing that should change is the transport/frontend.

### Laptop V1

- profile engine in configurator
- serial direct from laptop

### ESP32 V2

- same profile payload concept
- same safety policy
- same apply sequence
- different transport and user interaction layer

## Open Questions

These must be answered during Phase 1:

1. Which exact Speeduino parameters are safe to manipulate live over serial?
2. Which existing serial commands are available for field-level reads/writes?
3. Is runtime editing of the chosen fields already supported cleanly, or will configurator-side workarounds be needed?
4. Should `Aggressive` V1 use only existing secondary-table switching, or also generated runtime overlays?
5. Should baseline restoration always happen automatically after reconnect, or only on explicit user action?

## Success Criteria for V1

V1 is successful if all of the following are true:

- user can connect from laptop using `ryn-speeduino-configurator`
- configurator can determine whether it is safe to apply a profile
- configurator can apply one `Aggressive` profile over serial
- configurator can verify the change
- configurator can restore the session baseline
- no EEPROM burn is required
- restarting the ECU naturally returns the vehicle to base tune behavior

## Recommended Immediate Next Step

The next concrete task for the configurator team is:

**Build a parameter whitelist for runtime profile application.**

Without that whitelist, all later work remains speculative.

Suggested output file for next step:

- `RUNTIME_PROFILE_PARAMETER_MATRIX.md`

That document should list:

- parameter name
- source page/field
- serial read support
- serial write support
- safe runtime / caution runtime / static only
- notes

