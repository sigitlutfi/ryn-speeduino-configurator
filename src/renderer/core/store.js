// Re-export shim — semua komponen yang import dari sini tetap berfungsi.
// Logic sudah dipindah ke store/ (slices).
export { useStore, DEFAULT_PROJECT_UNITS, SCHEMA_VERSION, migrateProject } from './store/index.js';
