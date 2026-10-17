# Contributing

Report bugs and feature requests through [GitHub issues](https://github.com/sigitlutfi/ryn-speeduino-configurator/issues). Include reproduction steps, expected/actual behavior, OS, firmware signature, INI pairing, and relevant logs. Remove personal paths and private tune data before sharing.

## Setup

Use Bun 1.4.0 and Node 24 or newer.

```sh
bun install --frozen-lockfile
bun run start
```

Read [AGENTS.md](AGENTS.md) for source layout, style and transaction rules, and [docs/README.md](docs/README.md) for application behavior.

## Changes and review

Create a focused branch, preserve unrelated changes, and describe the concrete behavior changed in the pull request. Follow existing JavaScript/React conventions. Keep Save, RAM upload and EEPROM Burn semantics distinct.

Run the relevant tests with `bun run test` and renderer validation with `bun run build:renderer` for UI changes. Package/native-runtime changes also need `bun run package` and `bun run test:package`. The lint script is currently a placeholder.

For firmware, INI, pin contracts or dependency changes, follow [UPGRADE_WORKFLOW.md](UPGRADE_WORKFLOW.md). Use a reviewed firmware checkout and record pairing. A mock test does not establish hardware compatibility.

Update maintained docs and fixtures when public behavior or contracts change. Explain validation performed and any remaining hardware/platform limitations. Keep discussion professional, respectful and focused on constructive feedback.
