# Runtime Profile Serial Capability

## Purpose

This document connects:

- [RYN_CONFIGURATOR_RUNTIME_PROFILE_PLAN.md](C:/Users/ryn/speeduino/speeduino/RYN_CONFIGURATOR_RUNTIME_PROFILE_PLAN.md)
- [RUNTIME_PROFILE_PARAMETER_MATRIX.md](C:/Users/ryn/speeduino/speeduino/RUNTIME_PROFILE_PARAMETER_MATRIX.md)

Its purpose is to describe what `ryn-speeduino-configurator` needs from the Speeduino serial interface in order to support **runtime-only vehicle profiles**.

This document is not a full protocol reference.

It is a capability-oriented implementation guide for profile support.

## Product Assumption

Profiles are:

- applied at runtime
- not burned to EEPROM
- restored to base behavior after ECU power cycle

Therefore, the serial layer must support session-oriented control rather than permanent tune writes.

## Required Capability Groups

The configurator needs the following serial capability groups.

### 1. Connection / Session

The configurator must be able to:

- detect ECU presence
- establish communication
- identify protocol readiness
- detect disconnect / reconnect

Minimum V1 requirement:

- reliable connection detection
- reliable disconnect detection

## 2. Runtime State Read

The configurator must be able to read enough live state to decide whether profile application is safe.

Minimum V1 safety inputs:

- RPM
- TPS
- cranking state or equivalent

Recommended V1 additions:

- MAP / load
- coolant temperature
- current active secondary table status if available

## 3. Parameter Read

The configurator must be able to read the current value of any profile-controlled field before applying changes.

This is needed for:

- baseline capture
- verification after apply
- rollback

Without parameter readback, profile application becomes fragile.

## 4. Parameter Write

The configurator must be able to change selected tune/config fields at runtime over serial.

For V1, this must be limited to a small approved whitelist.

Examples:

- `fuel2Mode`
- `fuel2SwitchVariable`
- `fuel2SwitchValue`
- `spark2Mode`
- `spark2SwitchVariable`
- `spark2SwitchValue`
- selected feature enable flags

## 5. Verification

After writing a parameter, the configurator must be able to confirm that:

- the write was accepted
- the resulting value matches expectation

This can be done by:

- explicit write acknowledgement
- or post-write readback

Readback verification is preferred.

## 6. Optional Runtime Observability

These are not mandatory for V1, but highly desirable:

- `secondSparkTableActive`
- `fuel2Active`
- `alsActive`
- `pitLimiterActive`
- `rumbleIdleActive`

These improve UX and help profile debugging.

## Capability Matrix

This section describes what the configurator needs conceptually.

| Capability | V1 Required | Why |
|---|---|---|
| Connect / disconnect detect | Yes | required for session safety |
| Read live RPM | Yes | required for safe-apply guard |
| Read live TPS | Yes | required for safe-apply guard |
| Read cranking state | Yes | required for safe-apply guard |
| Read config field by key/address | Yes | required for baseline and verification |
| Write approved config field by key/address | Yes | required for profile apply |
| Readback after write | Yes | required for trustable runtime overlay |
| Batch write | No | useful later, not required for V1 |
| Atomic multi-field transaction | No | desirable later, not required for first prototype |
| Runtime feature status bits | No | useful for UX, not mandatory |

## V1 Serial Behavior Requirements

For V1, the configurator should assume the serial interface may be imperfect and should therefore implement a cautious workflow.

### Required V1 behavior

1. connect
2. read safety state
3. validate safe-to-apply
4. read current values for affected parameters
5. store session baseline
6. write one parameter at a time
7. read back each parameter
8. stop immediately on mismatch
9. rollback if apply fails midway

## Recommended Write Strategy

For V1, use:

- **single-parameter write**
- followed by **single-parameter readback**

Do not assume multi-write atomicity.

This is slower, but much safer and easier to debug.

## Session Baseline Strategy

The configurator should capture a **session baseline** for all parameters touched by profiles.

### Baseline capture timing

Recommended V1 behavior:

- capture baseline at first successful connection
- refresh baseline if ECU reconnects
- refresh baseline if user explicitly requests `Re-scan Base`

### Baseline scope

The baseline should include only parameters that the active profile system may modify.

Do not attempt to mirror the full tune in V1.

## Proposed Apply Transaction

### Apply sequence

1. Confirm ECU connected
2. Confirm safe apply conditions
3. Resolve profile payload into parameter writes
4. Capture baseline values for all affected parameters
5. For each parameter:
- write requested value
- read back value
- compare against expected
6. If all succeed:
- mark profile active in configurator session state
7. If any fail:
- stop immediately
- rollback parameters already changed
- mark profile state as unknown or reverted

## Proposed Rollback Transaction

### Rollback sequence

1. Confirm ECU connected
2. For each changed parameter:
- write baseline value
- read back baseline value
- verify match
3. If all succeed:
- mark profile as `Base`
4. If any fail:
- mark profile state as `Unknown`
- notify user that manual review is required

## Failure Modes

The configurator should explicitly handle these failure classes.

| Failure | Meaning | Required V1 Response |
|---|---|---|
| ECU not connected | no valid session | refuse apply |
| Unsafe runtime state | TPS/RPM/cranking guard failed | refuse apply |
| Parameter read failed | baseline or verify unavailable | abort apply |
| Parameter write failed | write not accepted | abort apply |
| Readback mismatch | applied value cannot be trusted | abort and rollback |
| Mid-apply disconnect | partial apply possible | mark state unknown, attempt recovery on reconnect |
| Rollback failure | base state cannot be guaranteed | warn user, mark unknown |

## Profile State Model in Configurator

The configurator should maintain one of these states:

- `Disconnected`
- `Base`
- `Applying`
- `ProfileActive(<name>)`
- `RollingBack`
- `Unknown`

### Meaning of `Unknown`

`Unknown` means:

- configurator can no longer guarantee what runtime overlay is active
- user should reconnect and re-read known fields
- no automatic assumption should be made

## Candidate V1 Parameters

The serial layer should first target the most useful and least dangerous whitelist.

Recommended first-pass serial targets:

- `fuel2Mode`
- `fuel2SwitchVariable`
- `fuel2SwitchValue`
- `spark2Mode`
- `spark2SwitchVariable`
- `spark2SwitchValue`
- `rumbleIdleEnabled`
- `alsEnabled`
- `alsMaxDuration`

These should be validated first before any attempt to manipulate table contents.

## Parameters to Avoid in Early Serial Work

Avoid these in the first profile prototype:

- input pin assignment fields
- polarity / pullup hardware fields
- primary table contents (`VE1`, `Spark1`)
- broad tune structure writes
- any write that implicitly expects EEPROM persistence as part of its behavior

## Open Serial Questions

These questions must be answered during implementation discovery.

1. What is the exact existing serial mechanism for reading arbitrary config fields?
2. What is the exact existing serial mechanism for writing arbitrary config fields?
3. Are writes applied only in RAM until burned, or do any write paths implicitly trigger persistence?
4. Are there fields that behave differently when changed live versus loaded on boot?
5. Which runtime status values are already available without custom firmware changes?

## Implementation Deliverables

The developer team should produce the following from this document:

### 1. Capability probe list

A concrete list of serial operations to test, such as:

- connect
- read RPM
- read TPS
- read field X
- write field X
- readback field X

### 2. Proven whitelist

A reduced set of parameters that are confirmed to support:

- read
- write
- readback verification
- safe runtime usage

### 3. V1 apply engine

A module in the configurator that performs:

- guarded apply
- readback verification
- rollback
- session state tracking

## Recommended Immediate Next Step

The next implementation step should be:

**Build a real-world serial probe checklist and execute it against a running Speeduino session.**

The output of that work should update:

- `Serial Read`
- `Serial Write`

fields in [RUNTIME_PROFILE_PARAMETER_MATRIX.md](C:/Users/ryn/speeduino/speeduino/RUNTIME_PROFILE_PARAMETER_MATRIX.md).

