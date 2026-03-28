# Realtime Widget Dashboard Blueprint

## Goal

Redesign `Realtime View` from a fixed gauge wall into a dynamic widget dashboard.

The dashboard should:

- support user-selected widgets
- keep all tiles on a consistent grid footprint
- honor units from project/app settings globally
- allow different presentation types for the same telemetry channel
- remain lightweight enough for continuous ECU telemetry updates

## Core Principles

1. Data semantics are global

- Units come from `.rynproj` and app unit settings
- Channel meaning comes from ECU output channels / realtime store
- Widgets do not override engineering meaning

2. Presentation is local

- Each widget can choose how to present a channel
- Widget type is independent from the channel
- Styling and thresholds may be widget-specific

3. Layout is modular

- Every widget uses the same base tile size
- Dashboard is a grid of interchangeable tiles
- Priority comes from placement and style, not from giant hero widgets

4. Tuning-first UX

- Fast scan at a glance
- Clear warnings
- Stable layout while driving / tuning
- Customizable without being messy

## Widget Types

### 1. Gauge

Use for values that benefit from bands and glanceable sweep:

- `rpm`
- `map`
- `tps`
- `afr`
- `coolant`
- `iat`
- `battery`
- `advance`
- `vss`

### 2. Digital

Use for precise values where exact number matters more than arc:

- `gear`
- `pw1`
- `dwell`
- `ethanolPct`
- `corrections`
- `loopsPerSecond`
- `freeRAM`
- `syncLossCounter`

### 3. Status

Use for boolean / flag clusters:

- `engine.running`
- `engine.cranking`
- `engine.sync`
- `engine.halfSync`
- `engine.warmup`
- `engine.ase`
- `engine.dfco`
- `engine.launchHard`
- `engine.launchSoft`
- `engine.protectActive`
- `engine.burnPending`
- `engine.vvt1Error`
- `engine.wmiEmpty`
- `engine.ioError`
- `performance.pitLimiterActive`
- `performance.rumbleIdleActive`
- `performance.alsActive`

### 4. Trace

Use for short time-history mini charts:

- `rpm`
- `map`
- `afr`
- `tps`
- `battery`
- `coolant`
- `iat`

## Global vs Local Settings

### Global

Must stay consistent across the whole app:

- temperature unit
- pressure unit
- speed unit
- AFR vs Lambda display policy
- project/ECU telemetry meanings

### Per-widget

Allowed to vary:

- widget type
- selected channel
- label override
- precision override
- color accent
- warning/danger visibility
- range mode (`auto` or `fixed`)
- sparkline visibility
- trend arrow visibility

## Dashboard Data Model

Recommended settings shape:

```json
{
  "realtimeDashboard": {
    "version": 1,
    "activePresetId": "tune",
    "presets": [
      {
        "id": "tune",
        "name": "Tune",
        "widgets": [
          {
            "id": "rpm-main",
            "type": "gauge",
            "channelKey": "rpm",
            "label": "RPM",
            "color": "cyan",
            "rangeMode": "fixed",
            "min": 0,
            "max": 8000,
            "showUnit": true,
            "showTrend": true,
            "enabled": true
          }
        ]
      }
    ]
  }
}
```

## Channel Registry

Create one central registry for widgets.

Suggested shape:

```js
{
  rpm: {
    label: "RPM",
    category: "engine",
    defaultWidget: "gauge",
    supportedWidgets: ["gauge", "digital", "trace"],
    unitKind: "rpm",
    getValue: (rt) => rt.rpm,
  }
}
```

Benefits:

- one place for labels
- one place for unit conversion
- one place for default ranges
- one place for which widget types are allowed

## Unit Rules

Widget rendering must not hardcode unit text or conversion rules.

Instead:

- channel registry returns raw store value
- widget renderer asks unit helpers for display conversion
- label/unit come from global unit policy

Examples:

- `map`
  uses pressure unit helper
- `coolant`, `iat`
  use temperature unit helper
- `vss`
  uses speed unit helper
- `afr`
  uses AFR/Lambda display policy

## AFR / Lambda Policy

Current dashboard behavior is ambiguous.

Recommended future rule:

- global setting: `mixtureDisplayMode = "afr" | "lambda"`
- if `afr`
  widget label shows `AFR`
- if `lambda`
  widget label shows `Lambda`
- same underlying ECU channel, different presentation

This should be global, not per-widget.

## Recommended Default Presets

### 1. Tune

Best for everyday tuning:

- RPM gauge
- Load gauge (`MAP` or `TPS` depending on algorithm)
- AFR/Lambda gauge
- Advance gauge
- Coolant gauge
- IAT digital
- PW1 digital
- Engine state status tile
- AFR mini trace
- RPM mini trace

### 2. Street

Best for calmer driving view:

- RPM
- MAP/boost
- AFR/Lambda
- Coolant
- Battery
- Speed
- Gear
- Warnings/status

### 3. Diagnostics

Best for troubleshooting:

- loopsPerSecond
- freeRAM
- syncLossCounter
- battery
- coolant
- iat
- io/protect status cluster
- RPM trace
- MAP trace
- battery trace

## Layout Rules

- all tiles use same grid footprint by default
- no oversized hero widget in v1
- allow future support for `span 2x1` or `2x2`, but not required initially
- maintain stable positions between sessions

Recommended base grid:

- desktop: 4 columns
- tablet/smaller desktop: 3 columns
- mobile/narrow window: 2 columns

## UX Interactions

### Widget actions

- add widget
- remove widget
- change channel
- change widget type
- rename label
- move left/right/up/down

### Preset actions

- switch preset
- duplicate preset
- rename preset
- reset preset to default

## Performance Rules

- widget renders should consume already-decoded realtime store data
- avoid per-widget heavy math
- traces should reuse existing chart infrastructure where possible
- limit high-frequency rerenders with stable selectors when needed

## Suggested File Structure

Recommended additions:

- `src/renderer/features/dashboard/widgets/channelRegistry.js`
- `src/renderer/features/dashboard/widgets/widgetPresets.js`
- `src/renderer/features/dashboard/widgets/renderWidget.jsx`
- `src/renderer/features/dashboard/widgets/GaugeWidget.jsx`
- `src/renderer/features/dashboard/widgets/DigitalWidget.jsx`
- `src/renderer/features/dashboard/widgets/StatusWidget.jsx`
- `src/renderer/features/dashboard/widgets/TraceWidget.jsx`

Potential settings storage:

- `settings.realtimeDashboard`

## Migration Plan

### Phase 1

- define channel registry
- define preset schema
- store dashboard config in settings

### Phase 2

- rebuild `Dashboard.jsx` around dynamic widget grid
- keep existing `Gauge` and `RealtimeChart` initially

### Phase 3

- improve custom gauge visuals
- add digital/status/trace widgets

### Phase 4

- widget editor UI
- presets switching
- drag/drop or directional reorder

## Recommendation

Do not replace chart engine.

- keep `uPlot` for trace widgets / analysis
- evolve internal gauge component
- build dashboard as a dynamic widget platform rather than a fixed realtime page
