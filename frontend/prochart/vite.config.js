import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import obfuscator from 'vite-plugin-javascript-obfuscator';

export default defineConfig({
  plugins: [
    react(),
    // مبهم‌سازیِ کدِ اپ (نه node_modules) — خواندن/کپی‌برداری از کد را عملاً غیرممکن می‌کند
    obfuscator({
      apply: 'build',
      exclude: [/node_modules/],
      options: {
        compact: true,
        simplify: true,
        identifierNamesGenerator: 'mangled',
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 1,
        rotateStringArray: true,
        shuffleStringArray: true,
        splitStrings: true,
        splitStringsChunkLength: 6,
        selfDefending: true,
        disableConsoleOutput: true,
        numbersToExpressions: true,
        // قفلِ DevTools: با باز شدنِ کنسول، حلقهٔ debugger تب را عملاً فریز می‌کند
        debugProtection: true,
        debugProtectionInterval: 2000,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.6,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.2,
      },
    }),
  ],
  build: { outDir: 'dist', sourcemap: false },
});
