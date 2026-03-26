import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // Externalize native modules — they cannot be bundled by Vite/Rollup
      external: ['serialport', '@serialport/bindings-cpp'],
    },
  },
});
