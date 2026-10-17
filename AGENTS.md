# Repository guidance

RYN Speeduino Configurator is an Electron/React desktop ECU tuning application. Read [docs/README.md](docs/README.md) for the maintained product and Flutter handoff specification, and [UPGRADE_WORKFLOW.md](UPGRADE_WORKFLOW.md) before changing firmware, INI, pin contracts or dependencies.

## Commands

Use Bun 1.4.0 for installation/scripts and Node 24 or newer for Forge and node:test.

```sh
bun install --frozen-lockfile
bun run start
bun run test
bun run build:renderer
bun run package
bun run test:package -- "out/RYN CONFIGURATOR-win32-x64"
bun run upgrade:check -- --firmware /path/to/reviewed/firmware
```

Set `RYN_FIRMWARE_ROOT` to the reviewed firmware checkout for paired rejection tests; the full upgrade gate supplies it. Run checks appropriate to the change. Lint is currently a placeholder. Contract synchronization is an explicit reviewed operation; do not use `upgrade:sync` to silently accept unexpected drift.

## Conventions

- Use JavaScript unless TypeScript is explicitly requested. Preload remains CommonJS; main/shared/renderer use ES modules.
- Prefer 2-space indentation, single quotes and no semicolons unless the surrounding file differs. Use camelCase, PascalCase components and uppercase constants.
- Domain screens belong in `src/renderer/features/`, reusable presentation in `src/renderer/ui/`, and ECU-independent codecs in `src/shared/`.
- Treat `src/renderer/core/store/index.js` and its slices as the canonical state layout; routes are in `src/renderer/routes.js`.
- Prefer Git Bash examples; use native PowerShell when safer or clearer on Windows.
- UI uses compact spacing, acrylic surfaces, restrained blur and restrained neon accents.
- Preserve unrelated working-tree changes. Read and write text as UTF-8.

## Current contracts

- Baseline: paired perf-v5 firmware, project schema 5, configuration pages 1–15 and full telemetry 167 bytes. Refer to pairing metadata and codecs for compatibility variants.
- Preserve complete raw page buffers, reserved bytes, bitfield neighbors and table draft ownership. Scale display values exactly once using the active INI.
- Legacy discovery commands and modern frames are distinct. Modern length/CRC32 are big endian; tune scalars are generally little endian; calibration offset/count use their documented big-endian format. See [wire contract](docs/06_SERIAL_PROTOCOL.md).
- Save to project, write ECU RAM and Burn EEPROM are separate actions. Validate the entire write plan before sending, preserve bytes outside its scope, read back writes and verify Burn completion. Persist restart requirements before affected writes.
- Honor operation ownership, serial queues, connection generations and cancellation after every await. Old responses/finally handlers must never overwrite or release a newer session's state.
- Connection is not proof of valid telemetry. Never publish old, invalid or unverified data as LIVE.
- Preserve schema-5 integrity/revision checks, atomic project writes, backup/recovery behavior and workspace/project guards.
- Keep firmware Drive Mode separate from legacy application-side runtime overlays. See [custom feature contract](docs/10_CUSTOM_FEATURES_AND_DRIVE_MODE.md).

## Documentation and validation

Maintain durable specifications in `docs/`; temporary execution logs belong in `.cache/`. Avoid new root-level audit/fix reports duplicating the maintained docs.

For protocol/schema/behavior changes, update relevant documentation and acceptance criteria. Regenerate references and fixtures with `node docs/tools/generate-reference.mjs` when their source inputs change; review semantic documentation manually. See [source map](docs/14_SOURCE_MAP_AND_MAINTENANCE.md).

Do not treat old comments, mock packet sizes or historical examples as a substitute for current paired contracts and tests. A passing software test or mock does not establish hardware acceptance.
