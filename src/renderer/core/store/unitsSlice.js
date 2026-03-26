import { DEFAULT_PROJECT_UNITS } from './projectSlice.js';

export const createUnitsSlice = (set, get) => ({
  convertTemp: (celsius) => {
    const u = get().currentProject?.units ?? DEFAULT_PROJECT_UNITS;
    return u.temperature === 'fahrenheit' ? (celsius * 9 / 5) + 32 : celsius;
  },

  convertPress: (kpa) => {
    const u = get().currentProject?.units ?? DEFAULT_PROJECT_UNITS;
    if (u.pressure === 'psi') return kpa * 0.145038;
    if (u.pressure === 'bar') return kpa / 100;
    return kpa;
  },

  convertSpeed: (kmh) => {
    const u = get().currentProject?.units ?? DEFAULT_PROJECT_UNITS;
    return u.speed === 'mph' ? kmh * 0.621371 : kmh;
  },

  tempUnit: () => {
    const u = get().currentProject?.units ?? DEFAULT_PROJECT_UNITS;
    return u.temperature === 'fahrenheit' ? '°F' : '°C';
  },

  pressUnit: () => {
    const u = get().currentProject?.units ?? DEFAULT_PROJECT_UNITS;
    if (u.pressure === 'psi') return 'psi';
    if (u.pressure === 'bar') return 'bar';
    return 'kPa';
  },

  speedUnit: () => {
    const u = get().currentProject?.units ?? DEFAULT_PROJECT_UNITS;
    return u.speed === 'mph' ? 'mph' : 'km/h';
  },
});
