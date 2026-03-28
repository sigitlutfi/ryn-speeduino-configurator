# Phase 1 Execution Checklist

This checklist translates the architecture documents into concrete implementation work for the current codebase.

Related references:

- [`ECU_COMMUNICATION_IMPLEMENTATION_PHASES.md`](C:\Users\ryn\node\ryn-speeduino-configurator\ECU_COMMUNICATION_IMPLEMENTATION_PHASES.md)
- [`RYNPROJ_SCHEMA_V3_BLUEPRINT.md`](C:\Users\ryn\node\ryn-speeduino-configurator\RYNPROJ_SCHEMA_V3_BLUEPRINT.md)

## Goal of Phase 1

Freeze the new project contract before transport and UI rewiring begins.

At the end of Phase 1, we should know exactly:

- what `.rynproj` v3 looks like
- what `constants.pages` stores
- which modules own migration, decoding, sync state, and save/load
- what order the codebase should be changed in

## Decisions Locked In

- `schemaVersion` moves to `3`
- `ini.content` remains required and authoritative
- `constants.pages[pageId]` stores raw page snapshots plus CRC and sync metadata
- `tables` become optional derived cache
- backward compatibility is not required

## File-by-File Work Map

### 1. Project schema and migration

Files:

- [`src/renderer/core/store/projectSlice.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\renderer\core\store\projectSlice.js)
- [`src/renderer/core/store/index.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\renderer\core\store\index.js)

Required changes:

- raise `SCHEMA_VERSION` from `2` to `3`
- replace current `migrateProject()` shape with schema v3 shape
- stop treating legacy `constants` object as the authoritative format
- initialize:
  - `ecu`
  - `ecu.sync`
  - `constants.pages`
  - `ui`
- normalize fresh projects so missing raw cache becomes `needs-initial-sync`

Concrete tasks:

- define `createEmptyProjectV3()`
- define `normalizeProjectV3(raw)`
- define `normalizePageSnapshot(pageId, size, rawData?)`
- ensure save/load always writes schema v3

### 2. Raw page encoding helpers

Files:

- [`src/shared/protocol/binary-parser.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\shared\protocol\binary-parser.js)
- [`src/shared/protocol/binary-serializer.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\shared\protocol\binary-serializer.js)
- new helper file recommended:
  - [`src/shared/protocol/page-cache.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\shared\protocol\page-cache.js)

Required changes:

- add helper to convert `Buffer <-> base64`
- add helper to create page snapshot objects
- add helper to compute and store page CRC
- add helper to patch a raw page buffer by offset
- add helper to diff two page buffers and return dirty region

Concrete tasks:

- `encodePageBuffer(buffer) -> base64`
- `decodePageBuffer(base64) -> Buffer`
- `createPageSnapshot({ pageId, size, buffer, crc32, source })`
- `replacePageRegion(buffer, offset, dataBuffer)`
- `findDirtyRegion(beforeBuffer, afterBuffer)`

### 3. INI descriptor access

Files:

- [`src/shared/ini-parser.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\shared\ini-parser.js)

Required changes:

- keep current parser as the source for metadata
- add or clarify helpers needed by v3 flow

Concrete tasks:

- expose a stable helper to get page size for a page id
- expose helper to list active config pages from parsed INI
- expose helper to get field descriptor by variable name
- expose helper to distinguish config-page fields from output-channel fields

Recommended helper additions:

- `getPageSize(parsedIni, pageId)`
- `getActiveConfigPages(parsedIni)`
- `getFieldDescriptor(parsedIni, fieldName)`

### 4. Decoding from raw-page truth

Files:

- [`src/shared/protocol/binary-parser.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\shared\protocol\binary-parser.js)
- new helper recommended:
  - [`src/shared/protocol/project-decode.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\shared\protocol\project-decode.js)

Required changes:

- stop treating parsed field objects as if they were the stored project truth
- support rebuilding decoded project state from `constants.pages`

Concrete tasks:

- `decodePageSnapshot(parsedIni, pageSnapshot)`
- `decodeAllKnownPages(parsedIni, pageSnapshots)`
- `rebuildTablesFromPages(parsedIni, pageSnapshots)`

### 5. Serial transport centralization prep

Files:

- [`src/renderer/core/services/serialService.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\renderer\core\services\serialService.js)
- [`src/main/preload.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\main\preload.js)
- [`src/main/index.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\main\index.js)

Required changes for later phases:

- identify every place currently bypassing `serialService`
- list missing lower-level transport features needed by the official flow

Concrete tasks:

- add `flush()` support in preload/main serial bridge
- ensure `connect()` waits until the port is truly open
- keep one parser/response path authoritative

Phase 1 output here is planning, not implementation yet.

### 6. Project sync state ownership

Files:

- [`src/renderer/core/store/projectSlice.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\renderer\core\store\projectSlice.js)
- [`src/renderer/core/store/connectionSlice.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\renderer\core\store\connectionSlice.js)

Required changes:

- define where page sync states live
- define where project sync state lives
- define who updates them

Decision:

- page sync states live inside `currentProject.constants.pages[pageId].syncState`
- project sync state lives inside `currentProject.ecu.sync.state`
- transport should report results, but project store commits them

Concrete tasks:

- add page sync-state update helpers
- add project sync-state recompute helper
- add timestamp update helpers

### 7. UI cache boundaries

Files:

- [`src/renderer/core/store/tableSlice.js`](C:\Users\ryn\node\ryn-speeduino-configurator\src\renderer\core\store\tableSlice.js)
- any tuning module hooks that write directly to constants/tables

Required changes:

- define the future rule that UI state is derived and disposable

Concrete tasks:

- identify code paths that write from UI directly into project structures without patching raw pages first
- note these as later refactor targets

## Current Code Risks to Address Later

These are already visible and should guide implementation order:

- `projectSlice.js` currently mixes project migration, serial reads, page parsing, and upload logic in one slice
- page reads are currently parsed directly inside the store instead of going through one transport layer
- writes and burns currently do not clearly depend on a raw-page source of truth
- UI caches appear stronger than raw ECU cache in persisted project files

These should not all be solved in Phase 1, but they justify the sequence.

## Implementation Order After Phase 1

### Phase 2 start order

1. build project schema helpers
2. build page-cache helpers
3. update `projectSlice.js` migration and save/load
4. add decode-from-page helpers
5. then begin transport centralization

This order is recommended because it gives the transport work a stable data target.

## Acceptance Criteria for Phase 1

Phase 1 is complete when all of the following are true:

- schema v3 is documented and fixed
- `constants.pages` raw-page shape is final
- sync states are defined and named
- file ownership for migration, decoding, and sync updates is clear
- the next implementation sequence is unambiguous

## Recommended Next Coding Tasks

When we begin code changes, the first coding tasks should be:

1. add page snapshot helper module
2. migrate `projectSlice.js` to schema v3
3. make project save/load emit `constants.pages`
4. add decode helpers from raw pages
5. remove assumptions that `tables` are authoritative

## Short Summary

Phase 1 is not about making communication work yet.

It is about making sure the project format and ownership model are strong enough that communication can be implemented once, cleanly, around the real ECU model:

- embedded INI defines meaning
- raw page cache defines project truth
- UI state is derived
