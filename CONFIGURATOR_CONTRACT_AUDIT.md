# Firmware, INI and web app contract audit — 2026-10-07

Firmware baseline: merge `7bf91a50` on `feature/performance-features`, including
upstream `fb602718`. Configurator baseline: `53d3c63` on
`codex/performance-protocol-v2`.

## Result

This report describes the v2 metadata audit. The later
[custom behavior audit](CUSTOM_FEATURE_BEHAVIOR_AUDIT.md) supersedes its runtime
baseline with the paired v3 firmware/INI and additional web corrections.

The bundled INI and firmware reference INI are byte-identical after the fixes.
The performance v2 signature, page 6 (143 bytes), page 10 (220 bytes), and
output channels (152 bytes) agree. Every binary constant checked fits its
declared page. All field targets used by the four custom tuning screens exist.
The audit does not establish complete hardware compatibility for every board.

## Findings and corrections

| Finding | Impact before correction | Correction |
| --- | --- | --- |
| `pinLayout` added/subtracted 61 | Board 3 could be written as 64; board 61 decoded as 0 | Preserve direct firmware board IDs in full-page and runtime paths |
| Rumble CLT used U08 with -40 translation | UI 70 C could become firmware 110 C; negative values were unsigned | S08 Celsius at offset 140, correct Fahrenheit translation |
| Scaling used raw × scale + translate | Nonzero translation with scaling gave wrong display/write values | Use (raw + translate) × scale throughout tuning, output channels and runtime tables |
| Custom defaults supplied raw bytes as `defaultValue` | A 6000 RPM default was defined as user value 60 | Use `rawValue` for custom defaults; parse both extensions correctly |
| Full-page serialization started from zeros | Saving an ALS field could clear padding or unmodeled bytes | Overlay edits onto the existing raw page snapshot |
| Remaining serial paths dropped 145-byte chunks | Valid page fragments were discarded | Remove length-only filtering; wait for full frame and CRC before raw fallback |
| Signature mismatch only warned | Save/Burn could still write using another firmware's offsets | Guard project sync, burn and runtime writes with the connected signature |
| Direct constant sync accessed nonexistent `meta.meta` | Direct sync failed or ignored shared bitfields | Read/modify/write through runtime field metadata |
| Custom numeric inputs could exceed INI ranges | Silent serializer clipping changed requested settings | Reject out-of-range saves, including duration above 30 seconds |
| Pit validation displayed without blocking Save | Invalid pin/threshold combinations could still save | Apply the screen's validation to Save/Burn |
| Rumble polarity missing from screen | Active-high input could not be configured there | Add polarity selector |
| Temperature labels and fuel help disagreed with metadata | Fahrenheit settings showed C; ALS fuel modifier described absolute percent | Follow metadata units; explain signed fuel modifier |
| Pin claims separated input from output | Same digital pin looked available across directions | Share digital pin claims; release claims for disabled features |
| Custom routing initialized only at startup | Saved pin changes appeared immediately effective | INI power-cycle metadata plus Save notification to burn and restart |
| Mock lacked page CRC command | Compare/Burn verification failed in development | Implement `d` with BE CRC32 over the real INI page size |

Scaling and default semantics were verified against the
[EFI Analytics ECU definition specification](https://www.efianalytics.com/TunerStudio/docs/EFI%20Analytics%20ECU%20Definition%20files.pdf),
sections 4.4.7 and 6.1.2–6.1.3, and the formulas in the repository INI.

## Remaining limits and follow-up

Follow-up: the [default pin audit](PIN_DEFAULT_AUDIT.md) resolves item 1 for
the supported Mega/AVR layouts, with explicit MCU/channel selections. Physical
web maps for other MCU families and connector-level PCB wiring remain outside
that verified scope. The numbered limits below describe the original audit.

1. **Board pin map coverage:** the web pin registry tracks configurable resources,
   but does not fully reserve every fixed/default injector, ignition, trigger,
   sensor and auxiliary pin for every board. Analog labels and digital aliases
   also need board-specific physical mapping. A pin displayed as free is not
   sufficient evidence of hardware availability. Firmware rejects occupied
   custom input pins at initialization. Complete board mapping before relying
   exclusively on the web selector for wiring.
2. **Embedded project metadata:** existing `.rynproj` files retain their embedded
   INI. Explicitly update it. Old values previously encoded with the wrong board
   or temperature conversion are not automatically repaired; inspect them
   against the ECU backup. A matching signature alone cannot detect a stale INI
   with the same signature but older definitions.
3. **INI language coverage:** the parser supports the numeric wire metadata used
   by these tests, not every TunerStudio expression, PcVariable, or UI directive.
   Expression-dependent definitions require dedicated implementation/tests.
4. **Hardware validation:** use a backed-up tune and bench ECU to verify routing,
   power-cycle behavior, timing/fuel correction, feature priority and timeout
   rearming. No ECU was flashed during this audit.

## Verification

`node --test test/*.test.mjs`: 17 passed. Tests cover all constant page bounds,
custom screen field targets, shared bitfields, signed values, Celsius/Fahrenheit,
defaults, reserved-byte preservation, signature rejection, numeric ranges,
digital pin conflicts and disabled inputs, delayed framed responses, existing
telemetry tests, and mock write/read/burn/CRC for pages 6 and 10.

Vite production build passed. This is source/build verification of the web app;
no interactive visual browser session or physical serial ECU test was performed.
Firmware executable code did not change in this audit; its INI was corrected.
