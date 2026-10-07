# Paired upgrade gate validation — 2026-10-07

The upgrade gate adds reviewed source baselines, actual-checkout compatibility
checks, compiled firmware probes, generated app metadata and paired CI. The
firmware executable sources, EEPROM extension and v3 signature are unchanged.
Both INIs still share SHA-256
`c67487f5f6558559b7e62478c6d97adfa1812741d9beb49f46e886f4dcabde62`.
The reviewed contract SHA-256 is
`fd85c52ea15639ab9325b9921f7399c041878b4ed21df0d44895950d5d33a94f`.

## Checks exercised

- Firmware checker: 4 Node tests passed, including source drift, generated probe
  drift, modern signature mismatch, signature bump enforcement and EEPROM review.
- Configurator: 40 Node tests passed with `RYN_FIRMWARE_ROOT` set. New cases reject
  stale same-signature offsets, types, bits, enum meanings, scaling, defaults,
  page/telemetry sizes and power-cycle flags; stale INIs/maps, source/digest drift,
  floating CI references and old success reports are also rejected.
- Native firmware: 427 passed, 4 skipped across twelve suites. The four existing
  initialization cases require the Mega board. The generated probe checks all
  15 page sizes, 56 custom fields, scalar signedness, bit packing, zero unaffected
  bytes and custom telemetry. Standard ignition corrections and scheduling,
  storage/migration, pin ownership and protection regressions also passed.
- Renderer production build passed; output goes to `.cache/upgrade-renderer`
  so tracked `dist` assets are preserved. Existing bundle/Browserslist warnings
  remain. Repeated schema values are interned, reducing generated metadata from
  approximately 3.4 MB to 176 KB without replacing exact comparisons with hashes.
- Mega AVR builds passed: standard RAM/flash 6436/196980 bytes, 6/3 6524/196046,
  8/1 6618/194346 (limits 8192/253952). INI offset/signedness assertions compiled
  for all three builds. AVR test programs were compiled without upload or test
  execution; they were not run on hardware.
- The complete orchestrator was exercised from Windows using WSL for native
  tests against the same checkout. PlatformIO versions: Windows 6.2.0, WSL
  6.1.19. Workflow YAML parsed successfully; CI uses Node 24 and PlatformIO 6.1.19.

Detailed local evidence: configurator `.upgrade-full.log`,
`.test-upgrade-final.log`, `build-upgrade-final.log`, `.cache/upgrade-report.json`;
firmware `.cache/upgrade-ign-regression.log`. The report describes the development
candidate and records its dirty state; it is not a published release attestation.

The two repository workflows use immutable pairing SHAs. The configurator pins
the firmware baseline commit; firmware pins the resulting configurator commit.
Later CI/documentation commits may differ while preserving the contract digest.
See [UPGRADE_WORKFLOW.md](UPGRADE_WORKFLOW.md) for the upgrade and promotion steps.

No ECU was flashed or bench-tested. No branches were created or pushed. GitHub
Actions has not run for these local commits, and required branch checks must be
configured on GitHub before the workflow can enforce a merge policy.
