import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@pb/shared': resolve(__dirname, '../packages/shared/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PbBundles',
      formats: ['iife'],
      fileName: () => 'pb-bundles.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: () => 'pb-bundles.js',
      },
    },
    minify: 'esbuild',
    sourcemap: true,
  },
});
