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
        // seedِ ثابت → خروجیِ مبهم‌ساز قطعی/reproducible (رفعِ TDZِ رَندومِ «Cannot access X before initialization»)
        seed: 20260709,
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
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    // تک‌چانک: چون اپ داخلِ WebView از دیسکِ محلی لود می‌شود، تقسیمِ چانک سودی ندارد و
    // چانک‌های dynamicِ مبهم‌سازی‌شده گاهی در APK جا نمی‌افتند. همه‌چیز در یک فایل = مطمئن.
    rollupOptions: { output: { manualChunks: () => 'index', inlineDynamicImports: false } },
  },
});
