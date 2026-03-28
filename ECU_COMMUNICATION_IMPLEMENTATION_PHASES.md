# ECU Communication Implementation Phases

This document defines the target architecture and phased implementation plan for reliable ECU communication in `ryn-speeduino-configurator`.

It is intended to become the working reference for communication-related changes. The goal is to keep the project aligned around one model of truth:

- The ECU stores raw bytes.
- The embedded `.ini` inside `.rynproj` defines what those bytes mean.
- The app must read, decode, edit, encode, write, burn, and verify using that `.ini`.

## Core Decisions

### 1. `.rynproj` is the portable project container

`.rynproj` should continue to embed the full INI in `ini.content`.

This is correct and should remain the foundation because the INI is not just a UI definition. It is also:

- the memory map
- the field descriptor set
- the transport command template source
- the scaling and translation contract

### 2. `constants` should become the main ECU data source of truth

Recommended direction:

- `constants` should store raw page snapshots
- decoded field objects should be derived from raw pages, not treated as the primary truth
- `tables` should be treated as optional UI cache only

Recommended structure:

```json
{
  "schemaVersion": 3,
  "ini": {
    "path": "C:\\path\\to\\file.ini",
    "signature": "speeduino 202501",
    "version": "2.25",
    "content": "...full ini text..."
  },
  "ecu": {
    "signature": "speeduino 202501",
    "product": "Speeduino 2025.01.6",
    "protocol": {
      "legacyProbe": "002",
      "messageEnvelope": "msEnvelope_1.0"
    },
    "lastConnectedAt": "2026-03-28T10:00:00.000Z",
    "lastSyncAt": "2026-03-28T10:02:00.000Z"
  },
  "constants": {
    "pages": {
      "1": {
        "size": 128,
        "rawBase64": "...",
        "crc32": "B110E9D3",
        "lastReadAt": "2026-03-28T10:01:00.000Z",
        "lastVerifiedAt": "2026-03-28T10:02:00.000Z",
        "syncState": "verified"
      }
    }
  },
  "tables": {
    "ve": {}
  }
}
```

Notes:

- `rawBase64` is recommended because JSON does not store binary cleanly.
- `crc32` should be stored as uppercase hex string for readability and stable comparison.
- `syncState` should be page-local, not only global.

### 3. `tables` should not be the basis for ECU writes

`tables` may still be persisted because they are useful for startup speed and UI convenience, but they should be considered derived cache.

The authoritative write path should be:

- UI value
- field descriptor from embedded INI
- encode to raw bytes
- patch page buffer
- write page region to ECU
- burn page
- read back and/or CRC verify
- commit updated raw page cache

### 4. CRC after connect is required, but CRC is not a replacement for page reads

CRC is ideal for initial sync classification and fast verification.

CRC alone does not provide field values for UI.

Therefore:

- use CRC to decide whether project cache still matches ECU
- use page read to actually populate or refresh values

## Recommended `constants` Model

Recommended final direction:

```text
constants
  pages
    pageId
      size
      rawBase64
      crc32
      syncState
      lastReadAt
      lastVerifiedAt
```

Why this is the best fit:

- it matches how the ECU actually works: page-based raw storage
- it makes CRC comparison natural
- it avoids ambiguity between UI-shaped values and memory-shaped values
- it allows precise dirty-region tracking during writes
- it makes readback verification straightforward

This is preferable to storing only decoded objects like:

```json
{
  "constants": {
    "1": {
      "nCylinders": 4,
      "reqFuel": 8.2
    }
  }
}
```

That decoded shape is useful, but it should be derived, not authoritative.

## Recommended Runtime Layers

The app should clearly separate these layers:

### Layer 1: Transport

Responsible for:

- open port
- wait boot delay
- flush RX
- send legacy commands
- send modern framed commands
- receive responses
- validate response framing and CRC where applicable
- separate command responses from realtime packets

### Layer 2: Raw ECU Cache

Responsible for:

- holding raw page snapshots
- holding page CRC values
- tracking page sync state
- tracking last read and verify timestamps

This should map closely to `currentProject.constants.pages`.

### Layer 3: Descriptor Layer

Built from embedded `ini.content`.

Responsible for:

- field to page mapping
- field offset and length
- data type and endianness rules
- scale and translate rules
- bitfield descriptors
- table and curve descriptors
- output channel descriptors

### Layer 4: Decoded Domain State

Responsible for:

- turning raw page bytes into field values
- turning field edits back into raw bytes
- exposing data for forms and tuning modules

### Layer 5: UI Cache

Responsible for:

- table editor state
- dialog state
- transient dirty state
- user selection/highlight state

This layer must never become the transport truth.

## Required Connection Flow

The connect flow should be standardized to this:

1. Open serial port
2. Wait board reset delay
3. Flush RX buffer
4. Send legacy `F`
5. Expect legacy probe response such as `002`
6. Send legacy `Q`
7. Read firmware signature
8. Confirm signature matches the embedded INI in the loaded `.rynproj`
9. Optionally read `S` for product/version string
10. Run page CRC checks for the required pages
11. Mark each page as:
   - `verified`
   - `different`
   - `missing-local`
   - `unknown`
12. If no local raw cache exists, mark project state as `needs-initial-sync`

Recommended required pages for initial CRC check:

- every page defined by the loaded INI that the app actively edits

For the current project direction, that likely means:

- page 1
- pages 7 to 15 when present in the INI and used by the app

Rationale:

- page 1 usually contains core engine and settings data
- pages 7 to 15 typically contain tuning tables or feature pages used in this app

Do not CRC-check unused pages just because they exist.

## Required Read Flow

The read flow should be standardized to this:

1. Build read command from page id and page size defined by the embedded INI
2. Send modern framed `p` command
3. Validate response status
4. Store raw page bytes in `constants.pages[pageId]`
5. Compute or store page CRC
6. Decode values from raw bytes using INI descriptors
7. Populate derived state and tables
8. Mark page `syncState = verified`

If the app needs all working pages after first connect, perform a full initial page sync.

## Required Write Flow

The write flow should be standardized to this:

1. User edits a field or table value
2. App resolves the field descriptor from embedded INI
3. App patches the local raw page buffer first
4. App determines the dirty byte region
5. App sends modern framed `M` write for only the changed region
6. App waits write-settle delay
7. App sends `b` burn for that page
8. App waits burn-settle delay
9. App re-reads page CRC
10. App optionally re-reads the changed bytes or the full page
11. App compares ECU result against the local raw page buffer
12. App only commits page state as `verified` if verification succeeds

If verification fails:

- page state becomes `unknown` or `different`
- UI should warn the user
- local cache should not be blindly trusted as persisted

## Dirty Region Strategy

Dirty-region writes are recommended.

Minimum behavior:

- track original raw page
- track modified raw page
- find first and last differing byte
- write only that continuous span

This is a good balance between simplicity and precision.

Advanced optimization:

- multiple sparse ranges per page

This is optional and can come later.

## Sync State Model

Recommended page-level states:

- `missing-local`
- `unknown`
- `different`
- `verified`
- `dirty-local`
- `write-pending`
- `verify-failed`

Recommended project-level states:

- `disconnected`
- `connected-unverified`
- `needs-initial-sync`
- `partially-synced`
- `fully-verified`

## Schema Migration Decision

Project backward compatibility is not required.

Therefore we should explicitly move to a new schema version rather than trying to preserve ambiguous old shapes.

Recommended:

- introduce `schemaVersion: 3`
- migrate project load/save logic to require the new `constants.pages` raw-page structure
- allow one-time import from older `.rynproj` only if practical
- otherwise treat old projects as legacy assets, not primary format

## Implementation Phases

### Phase 1: Freeze the data contract

Goal:

- finalize `.rynproj` schema v3
- define `constants.pages` raw-page storage format
- define page sync states and project sync states

Deliverables:

- updated project schema definition
- migration notes
- state diagram for page sync lifecycle

### Phase 2: Centralize serial transport

Goal:

- make one communication path authoritative
- eliminate mixed direct parsing in feature/store code

Required outcomes:

- one serial service handles connect, probe, command send, response parse, retries, delays
- no page read/write logic should parse raw serial bytes independently inside store slices

### Phase 3: Implement connect and sync classification

Goal:

- make connect deterministic and informative

Required outcomes:

- boot delay respected
- RX flush performed
- legacy `F` and `Q` sequence implemented
- signature matched against project INI
- initial CRC checks run on active pages
- project marked `needs-initial-sync` when no local raw cache exists

### Phase 4: Implement raw page cache lifecycle

Goal:

- establish `constants.pages` as the main truth

Required outcomes:

- page reads stored as raw page snapshots
- CRC values stored per page
- timestamps and sync states updated
- derived field and table state rebuilt from raw pages

### Phase 5: Implement safe write and burn flow

Goal:

- ensure write operations are precise and verifiable

Required outcomes:

- field edits patch local raw buffer first
- dirty region computed from raw buffer diff
- `M` write sent only for changed bytes
- burn performed after write
- delays respected
- CRC and readback verification required before success state

### Phase 6: Rebuild UI bindings on top of raw truth

Goal:

- ensure UI reflects the ECU model instead of driving it directly

Required outcomes:

- forms read from decoded raw-page state
- table editors decode from raw-page state
- save actions encode back into raw-page state first
- UI cache remains optional and disposable

### Phase 7: Hardware validation

Goal:

- confirm behavior on real ECU

Required outcomes:

- connect sequence works reliably after repeated reconnects
- initial sync classification is correct
- page reads decode to expected values
- writes persist correctly after burn
- CRC and readback verification behave consistently

## Immediate Priority Order

The next major work should follow this exact order:

1. Define schema v3 for `.rynproj`
2. Decide exact `constants.pages` shape
3. Centralize transport and parsing
4. Implement connect plus CRC classification
5. Implement initial page sync
6. Implement write, burn, and verify
7. Rebind UI flows to raw-page truth

This order is important. If UI refactors happen before the raw-page model is stable, the project will continue to mix transport, schema, and presentation concerns.

## Final Direction

The project should move toward this principle:

`embedded INI + raw page cache = authoritative project state`

Everything else should be derived from that pair.

That includes:

- constants shown in forms
- tables shown in editors
- CRC checks
- burn safety
- readback verification

If we keep that boundary clear, the ECU communication layer will become much easier to reason about and much safer to evolve.
