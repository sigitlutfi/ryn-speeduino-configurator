# RYNPROJ Schema v3 Blueprint

This document defines the proposed `.rynproj` schema v3 for reliable Speeduino communication.

It is intended to work together with:

- [`ECU_COMMUNICATION_IMPLEMENTATION_PHASES.md`](C:\Users\ryn\node\ryn-speeduino-configurator\ECU_COMMUNICATION_IMPLEMENTATION_PHASES.md)

The design goal is simple:

- keep the embedded INI as the memory schema
- keep raw ECU page snapshots as the authoritative project data
- derive decoded values and UI state from those raw pages

## Design Principles

### 1. The ECU speaks in raw bytes

The ECU does not store UI values. It stores bytes organized into pages.

Therefore the saved project format should preserve page-oriented raw data cleanly.

### 2. The INI defines meaning

The embedded INI is the decoding and encoding contract for:

- page layout
- field offset
- field size
- type
- scale
- translate
- bitfield labels
- table geometry
- output channel structure

### 3. Raw page cache is authoritative

`constants.pages` should become the primary project state for ECU config.

Anything like:

- settings forms
- table editors
- displayed values

should be derived from those pages.

## Top-Level Schema

Recommended top-level structure:

```json
{
  "schemaVersion": 3,
  "projectName": "My Tune",
  "description": "",
  "engine": {
    "displacement": 2000,
    "cylinders": 4,
    "type": "inline"
  },
  "ini": {
    "path": "C:\\Users\\ryn\\Downloads\\202501.6.ini",
    "signature": "speeduino 202501",
    "version": "2.25",
    "content": "...full ini text..."
  },
  "ecu": {
    "signature": "speeduino 202501",
    "product": "Speeduino 2025.01.6",
    "protocol": {
      "probe": "002",
      "envelope": "msEnvelope_1.0",
      "baud": 115200
    },
    "sync": {
      "state": "needs-initial-sync",
      "activePages": [1, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      "lastConnectedAt": null,
      "lastSyncAt": null
    }
  },
  "constants": {
    "pages": {}
  },
  "tables": {},
  "units": {
    "temperature": "celsius",
    "pressure": "kpa",
    "speed": "kmh"
  },
  "ui": {
    "accentColor": "cyan"
  },
  "createdAt": "2026-03-28T10:00:00.000Z",
  "updatedAt": "2026-03-28T10:00:00.000Z",
  "filePath": "C:\\Users\\ryn\\node\\ryn-speeduino-configurator\\my_project.rynproj"
}
```

## Field Definitions

### `schemaVersion`

Type:

- number

Required:

- yes

Value:

- `3`

Purpose:

- hard switch to the new project structure

### `projectName`

Type:

- string

Required:

- yes

Purpose:

- user-facing project label

### `description`

Type:

- string

Required:

- no

Purpose:

- freeform notes

### `engine`

Type:

- object

Required:

- optional metadata only

Purpose:

- user-facing engine info
- not authoritative for ECU communication

### `ini`

Type:

- object

Required:

- yes

Fields:

- `path`
- `signature`
- `version`
- `content`

Rules:

- `content` is required
- `signature` should match the embedded INI's declared signature
- `path` is informational only once embedded

### `ecu`

Type:

- object

Required:

- yes

Purpose:

- stores latest observed ECU identity and connection-derived sync metadata

This is not a replacement for the embedded INI.

It is runtime/project evidence about the ECU this project was last synced against.

### `constants`

Type:

- object

Required:

- yes

Purpose:

- authoritative ECU configuration cache

### `tables`

Type:

- object

Required:

- optional

Purpose:

- optional UI cache for editor startup speed

Rules:

- may be deleted and rebuilt from `constants.pages + ini.content`
- must not be the main write source

### `units`

Type:

- object

Required:

- optional

Purpose:

- user display preferences

Not authoritative for raw ECU bytes.

### `ui`

Type:

- object

Required:

- optional

Purpose:

- purely presentational project preferences

## `constants.pages` Structure

Recommended page object:

```json
{
  "constants": {
    "pages": {
      "1": {
        "pageId": 1,
        "size": 128,
        "rawEncoding": "base64",
        "rawData": "AAECAwQFBgcICQ==",
        "crc32": "B110E9D3",
        "syncState": "verified",
        "lastReadAt": "2026-03-28T10:01:00.000Z",
        "lastVerifiedAt": "2026-03-28T10:02:00.000Z",
        "source": "ecu-read"
      }
    }
  }
}
```

### Required page fields

#### `pageId`

Type:

- number

Purpose:

- redundant but explicit page identity

#### `size`

Type:

- number

Purpose:

- expected page size used when decoding and validating reads

Should match the page size derived from the embedded INI.

#### `rawEncoding`

Type:

- string

Allowed value:

- `base64`

Purpose:

- future-proofing and explicitness

#### `rawData`

Type:

- string

Purpose:

- raw page bytes encoded in base64

This is the heart of the project state.

#### `crc32`

Type:

- string

Format:

- 8-character uppercase hex

Purpose:

- last known CRC for this cached page

#### `syncState`

Type:

- string

Allowed values:

- `missing-local`
- `unknown`
- `different`
- `verified`
- `dirty-local`
- `write-pending`
- `verify-failed`

Purpose:

- track trust level of the local cache relative to the ECU

#### `lastReadAt`

Type:

- ISO timestamp or `null`

Purpose:

- latest successful page read from ECU

#### `lastVerifiedAt`

Type:

- ISO timestamp or `null`

Purpose:

- latest successful verification event

#### `source`

Type:

- string

Allowed values:

- `ecu-read`
- `imported`
- `generated`

Purpose:

- provenance for the current raw page snapshot

## `ecu.sync` Structure

Recommended structure:

```json
{
  "ecu": {
    "sync": {
      "state": "partially-synced",
      "activePages": [1, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      "lastConnectedAt": "2026-03-28T10:00:00.000Z",
      "lastSyncAt": "2026-03-28T10:02:00.000Z"
    }
  }
}
```

### `state`

Allowed values:

- `disconnected`
- `connected-unverified`
- `needs-initial-sync`
- `partially-synced`
- `fully-verified`

Purpose:

- high-level summary for project-level sync trust

### `activePages`

Type:

- number array

Purpose:

- pages that matter for this project's tuning workflows

Recommended initial active pages:

- page `1`
- pages `7` through `15` when present and used by the current app

Reasoning:

- they cover core settings and major tuning pages in the current Speeduino-like workflow
- CRC and initial sync should focus on pages the app actively edits or displays

### `lastConnectedAt`

Type:

- ISO timestamp or `null`

### `lastSyncAt`

Type:

- ISO timestamp or `null`

## Sync State Semantics

### Page-level states

#### `missing-local`

Meaning:

- project has no raw page snapshot yet

Typical case:

- fresh project before initial ECU read

#### `unknown`

Meaning:

- project has a page snapshot but ECU trust is not established right now

Typical case:

- just opened project, not connected yet

#### `different`

Meaning:

- ECU CRC/readback disagrees with local cached page

Typical case:

- ECU changed since last sync
- different tune burned outside this app

#### `verified`

Meaning:

- local raw page matches ECU according to latest verification

#### `dirty-local`

Meaning:

- user has changed local data but it has not yet been written and verified

#### `write-pending`

Meaning:

- write/burn operation is in progress

#### `verify-failed`

Meaning:

- write was attempted but ECU readback or CRC verification failed

### Project-level states

#### `disconnected`

Meaning:

- no active ECU session

#### `connected-unverified`

Meaning:

- transport is connected but sync checks are not complete

#### `needs-initial-sync`

Meaning:

- project has embedded INI but no trustworthy raw page cache yet

#### `partially-synced`

Meaning:

- some active pages are verified, some are different or unknown

#### `fully-verified`

Meaning:

- all active pages are verified

## Example Minimal Fresh Project

```json
{
  "schemaVersion": 3,
  "projectName": "2025.1.6",
  "description": "",
  "engine": {
    "displacement": null,
    "cylinders": null,
    "type": null
  },
  "ini": {
    "path": "C:\\Users\\ryn\\Downloads\\202501.6.ini",
    "signature": "speeduino 202501",
    "version": "2.25",
    "content": "...full ini text..."
  },
  "ecu": {
    "signature": null,
    "product": null,
    "protocol": {
      "probe": null,
      "envelope": "msEnvelope_1.0",
      "baud": 115200
    },
    "sync": {
      "state": "needs-initial-sync",
      "activePages": [1, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      "lastConnectedAt": null,
      "lastSyncAt": null
    }
  },
  "constants": {
    "pages": {}
  },
  "tables": {},
  "units": {
    "temperature": "celsius",
    "pressure": "kpa",
    "speed": "kmh"
  },
  "ui": {
    "accentColor": "cyan"
  }
}
```

## Example Verified Project

```json
{
  "schemaVersion": 3,
  "projectName": "2025.1.6",
  "ini": {
    "path": "C:\\Users\\ryn\\Downloads\\202501.6.ini",
    "signature": "speeduino 202501",
    "version": "2.25",
    "content": "...full ini text..."
  },
  "ecu": {
    "signature": "speeduino 202501",
    "product": "Speeduino 2025.01.6",
    "protocol": {
      "probe": "002",
      "envelope": "msEnvelope_1.0",
      "baud": 115200
    },
    "sync": {
      "state": "fully-verified",
      "activePages": [1, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      "lastConnectedAt": "2026-03-28T10:00:00.000Z",
      "lastSyncAt": "2026-03-28T10:02:00.000Z"
    }
  },
  "constants": {
    "pages": {
      "1": {
        "pageId": 1,
        "size": 128,
        "rawEncoding": "base64",
        "rawData": "AAECAwQFBgcICQ==",
        "crc32": "B110E9D3",
        "syncState": "verified",
        "lastReadAt": "2026-03-28T10:01:00.000Z",
        "lastVerifiedAt": "2026-03-28T10:02:00.000Z",
        "source": "ecu-read"
      }
    }
  }
}
```

## What Should Be Derived at Runtime

The following should not be treated as primary persistent truth:

- decoded field objects
- editor-specific table state
- display-scaled values
- currently selected cells
- unsaved panel-local transient inputs

These should be rebuildable from:

- `ini.content`
- `constants.pages`

## Non-Goals for v3

The schema does not need to:

- preserve backward compatibility with older `.rynproj`
- store every decoded field redundantly
- store every UI detail permanently
- support multiple ECUs in one project

## Implementation Notes

When code work begins, the schema should be introduced in this order:

1. add schema v3 load/save support
2. write helpers to encode/decode raw page buffers to base64
3. add page sync-state helpers
4. rebuild read flow to populate `constants.pages`
5. rebuild decode flow from `constants.pages + ini.content`
6. rebuild write flow to patch raw buffers first

## Final Recommendation

For `constants`, the best choice is:

- raw page snapshots in base64
- one object per page
- page-level CRC and sync metadata attached directly to each page

This is the most faithful representation of how Speeduino actually works, and it gives the app a stable foundation for:

- CRC checks
- readback verification
- accurate decoding
- precise write targeting
- safer burn operations
