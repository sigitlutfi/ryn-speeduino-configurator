# ECU Communication Runtime Flow

This document records the final runtime behavior for ECU configuration sync in
`ryn-speeduino-configurator`.

## Core Model

- ECU stores raw bytes per page.
- Embedded `ini.content` inside `.rynproj` is the schema for those bytes.
- `.rynproj.constants.pages[pageId]` stores the raw page snapshot used for sync.
- `.rynproj.constants.decodedPages` is runtime/UI cache derived from raw page data.
- UI must not be treated as the source of truth for serial sync.

## Connect Flow

On serial connect:

1. wait boot delay
2. flush serial RX buffer
3. send legacy `F`
4. send legacy `Q`
5. send legacy `S`
6. store ECU connection info in project state
7. run `compareWithECU()`
8. if any page is `different`, `missing-local`, or `unknown`, open sync dialog

## Hybrid Protocol Rules

Commands use the wrapped modern envelope:

```text
[len_be][payload][crc32_be]
```

But responses are hybrid:

- handshake commands use legacy text responses
- config commands may arrive as wrapped responses
- page read may behave like wrapped, raw+status, or raw page bytes

Because of this, transport handling must be command-specific.

## Page Read Rules

Page read must respect `blockingFactor` from project/INI.

Never request a full large page in one read if it exceeds the block limit.
Instead:

1. split page into chunks using `blockingFactor`
2. read each chunk with `p page offset length`
3. concatenate all chunks into one page buffer
4. decode page buffer with INI metadata

## CRC Rules

CRC is used for sync classification, not for UI rendering.

Rules:

- use ECU CRC to quickly classify page state
- if local CRC equals ECU CRC, page is `verified`
- if local CRC differs, app may read the page and compare raw bytes
- if raw page bytes match, treat it as a healed CRC mismatch and update local
  snapshot CRC to ECU CRC
- if raw page bytes do not match, page is truly `different`

This healing path is important because local CRC calculation may not always
match the ECU's internal page CRC behavior exactly.

## Download From ECU

`SyncDialog -> Download from ECU` should:

1. read each active page from ECU using chunked page reads
2. read ECU CRC for each page
3. store raw page snapshot in `constants.pages`
4. store decoded page cache in `constants.decodedPages`
5. mark each page `verified`
6. persist ECU CRC into snapshot metadata

After download, saving the project should preserve those page snapshots for the
next reconnect.

## Compare Behavior

`compareWithECU()` should produce page states:

- `verified`
- `different`
- `missing-local`
- `unknown`

The project sync dialog should appear only when at least one page is not
`verified`.

## Save Behavior

`saveProject()` must serialize:

- `constants.pages`
- project metadata
- optional UI tables cache

It must not discard raw page snapshots after an ECU download.

## Write / Burn Behavior

Write flow:

1. derive raw bytes from INI metadata
2. write dirty region to ECU RAM
3. burn page when requested
4. verify with CRC and/or read-back
5. only then mark page `verified`

## Troubleshooting

If reconnect still shows mismatch:

1. inspect `compareWithECU summary`
2. if page is `different`, compare raw page bytes before assuming parser/UI bug
3. if page is `unknown`, inspect transport response shape first
4. if project is new and many pages are `missing-local`, prefer `Download from ECU`

## Expected Healthy State

After:

1. connect
2. download from ECU
3. save project
4. reconnect

Expected summary:

```text
matching: all active pages
different: []
missing: []
errors: []
```
