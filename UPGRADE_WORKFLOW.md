# Upgrading the paired RYN firmware and configurator

Firmware is the authority for the binary layout, EEPROM map, controller behavior
and MCU pin routing. The reviewed baseline is `compatibility/contract.json`.
The configurator pins a tested firmware commit in `compatibility/firmware.json`;
its bundled INI, AVR map and runtime INI contract are derived artifacts.

## Normal verification

Use Git Bash, Linux or WSL syntax, with paths to the actual two checkouts:

```bash
# Firmware checkout; needs Node 24, no npm dependencies.
node scripts/check-compatibility.mjs
node --test scripts/check-compatibility.test.mjs

# Configurator checkout; dependencies installed using npm ci.
npm run upgrade:check -- --firmware /path/to/firmware

# Complete software gate. Windows uses WSL for native tests.
npm run upgrade:check -- --firmware /path/to/firmware --full --report upgrade-report.json
```

`--full` runs both Node suites, the renderer build, twelve native firmware
suites, all three Mega channel builds, and compilation of the generated INI
assertions for each AVR build. It never uploads firmware or writes to an ECU.
The report is written only after success and records both actual Git revisions,
tracked/untracked dirty state, INI SHA-256 and firmware contract SHA-256. The firmware
revision recorded in the pairing file is the accepted reference; a newer checkout
may pass if its contract is unchanged. A dirty report is development evidence,
not a reproducible release. Do not reuse an old report after a failed run.

On Windows, install PlatformIO natively for AVR and in WSL for `native_base`.
The complete command uses Ubuntu WSL for native tests against the same firmware
checkout, with Linux build/libdeps directories. Select another distribution with
`--wsl-distro NAME`. Optional `--native-build-dir` and `--native-libdeps-dir` accept
Linux absolute paths for existing caches. `--pio PATH` selects the native AVR
executable on Windows or PlatformIO on Linux. CI pins PlatformIO 6.1.19, matching
the tested WSL installation; the local Windows installation is 6.2.0. No native
tests use the Windows compiler.

## Integration procedure

1. Keep one maintained custom firmware branch and one configurator branch.
   Fetch the chosen remote and identify the exact commit to integrate. In this
   firmware repository `origin` is the RYN fork and `upstream` is Speeduino.
   Record the chosen base SHA; do not infer it from a branch name.
2. Create a temporary `codex/upgrade-...` integration branch from the maintained
   custom firmware branch. Merge the chosen base there and resolve conflicts.
3. Run the firmware check and inspect its failures. Compare binary layouts,
   base and appended bytes, enum meanings, telemetry, pin translation/ownership,
   activation gates, and standard protections. Source hashes intentionally force
   review even for an apparently harmless refactor in these files. They are
   review triggers, not a C++ semantic analyzer.
4. Update firmware and `reference/speeduino.ini` together. Any change to the wire
   source group requires a new modern, legacy and INI signature before accepting
   the baseline. The policy is conservative, including wire-source refactors.
   INI-only metadata edits may retain the signature; the runtime metadata guard
   then requires projects to update their embedded INI.
5. For EEPROM or custom page-size changes, document whether the layout is
   preserved or a migration is needed. Implement and test a migration before
   acceptance. A note does not implement a migration or prove preservation.
6. Accept the reviewed firmware baseline and regenerate its byte-layout tests:

   ```bash
   node scripts/check-compatibility.mjs --accept \
     --review-note 'Describe the reviewed upstream changes and custom compatibility' \
     --storage-note 'Describe layout preservation or the tested migration'
   ```

   `--storage-note` is mandatory when storage sources or custom sizes change.
   Review the generated test diff. It checks all fifteen wire page sizes and
   writes each of the 56 current custom fields independently, proving byte/bit
   positions and signed scalar types against the compiled C++ representation.
   It also checks custom telemetry bits and little-endian values. It does not
   assert every upstream base field offset; source review remains necessary.
7. Commit the reviewed firmware candidate (the sync command verifies that its
   baseline and relevant sources/tooling are committed). In the configurator checkout, fix
   any affected UI, pin ownership rules and protocol code, then derive artifacts:

   ```bash
   npm run upgrade:sync -- --firmware /path/to/firmware
   npm run upgrade:check -- --firmware /path/to/firmware --full --report upgrade-report.json
   ```

   Sync requires a current accepted firmware baseline. It copies the INI,
   regenerates the AVR map and the Celsius/Fahrenheit runtime metadata contract,
   and records the firmware SHA and reviewed configurator ownership sources.
   It does not fix ownership logic, modify firmware, bump signatures or migrate
   existing `.rynproj` files. Commit the configurator after the complete gate
   passes. Existing projects require an explicit embedded INI update.
8. Update `compatibility/configurator.json` in firmware to the tested configurator
   commit. Firmware CI checks its current candidate against that pinned
   configurator, while configurator CI checks against its pinned firmware.
   Contract-preserving documentation/CI commits can differ from the recorded
   firmware SHA; both candidates must share the same contract digest.
9. Require the RYN compatibility workflows to pass before promoting the
   integration branch. Repository branch protection must be configured on GitHub
   by the repository owner; adding a workflow alone cannot enforce merge rules.
   Record the base SHA, final firmware/configurator SHAs, INI digest, software
report and bench result in the release. Merge the verified integration and
   remove the temporary branch so only the maintained branches remain.

## Limits

The gate deliberately fails on changes in known wire, storage, pin/standard
controller and custom behavior sources. If upstream moves these responsibilities
into new files, extend the checker source groups and probe generator during the
integration review. It does not discover every possible new dependency or verify
connector wiring. Current physical maps target Mega AVR.
Firmware signature and INI schema are separate checks: schema comparison blocks
a stale same-signature custom INI at every existing ECU write guard.
Other signatures retain the existing matching-signature behavior; they are not
certified by this paired RYN gate.

Software validation does not replace an ECU bench test. Before a release, back
up the tune, exercise migrations and power-cycle pin routing on the actual board,
and verify activation, cuts and standard protections without engine operation.
