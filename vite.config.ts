import path from 'node:path';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import type { UserConfig } from 'vite';

const experimentalOptions = {
  enableNativePlugin: false
} as unknown as NonNullable<UserConfig['experimental']>;

// https://vite.dev/config/
export default defineConfig({
  experimental: experimentalOptions,
  server: {
    proxy: {
      '/api': {
        changeOrigin: true,
        target: 'http://127.0.0.1:3000'
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  plugins: [
    react(),
    tailwindcss()
  ]
});
