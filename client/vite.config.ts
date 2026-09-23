import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  envDir: '..',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false, // Smaller production bundle
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'query': ['@tanstack/react-query'],
          'maplibre': ['maplibre-gl'],
          'web3': ['wagmi', 'viem', '@rainbow-me/rainbowkit'],
          'charts': ['lightweight-charts'],
          'flexlayout': ['flexlayout-react'],
          'icons': ['lucide-react'],
          'state': ['zustand'],
          'motion': ['framer-motion'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  server: {
    port: 5174,
    host: true,
    // No proxy: the client calls the API server directly (see API_URL in src/api/client.ts)
  },
});
