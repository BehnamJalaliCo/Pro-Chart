import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import obfuscator from 'vite-plugin-javascript-obfuscator';

export default defineConfig({
  plugins: [
    react(),
    // مبهم‌سازیِ کدِ اپ (نه node_modules) — با NO_OBF=1 موقتاً خاموش (برای دیباگِ خطای خوانا)
    ...(process.env.NO_OBF ? [] : [obfuscator({
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
        // غیرفعال: روی برخی الگوهای کد declarationها را جابه‌جا و خطای TDZ
        // («Cannot access X before initialization» = صفحهٔ مشکی) می‌ساختند.
        controlFlowFlattening: false,
        deadCodeInjection: false,
      },
    })]),
  ],
  build: { outDir: 'dist', sourcemap: false, minify: process.env.NO_OBF ? false : 'esbuild' },
});
