// Project-level constants and defaults

export const SCHEMA_VERSION = 4;

export const DEFAULT_PROJECT_UNITS = {
  temperature: "celsius",
  pressure: "kpa",
  speed: "kmh",
};

export const DEFAULT_RUNTIME_PROFILE_FIELDS = [
  "fuel2Mode",
  "fuel2SwitchVariable",
  "fuel2SwitchValue",
  "spark2Mode",
  "spark2SwitchVariable",
  "spark2SwitchValue",
  "rumbleIdleEnabled",
  "alsEnabled",
  "alsMaxDuration",
];

export const DEFAULT_RUNTIME_PROFILE_GUARDS = {
  max_tps_pct: 5,
  max_rpm: 1500,
  engine_not_cranking: true,
};

export const DEFAULT_ACTIVE_PAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
