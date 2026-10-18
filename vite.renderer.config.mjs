import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  // Keep Forge's renderer URL on the same loopback interface as this server.
  // `localhost` can resolve to another project's IPv6 Vite server on the same
  // port even when this server is listening on IPv4.
  server: {
    host: '127.0.0.1',
  },
  define: {
    // Polyfill Buffer for browser environment
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
});
