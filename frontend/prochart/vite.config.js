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
        // پروفایلِ کم‌هزینهٔ مستندِ obfuscator: رشته‌ها همچنان در آرایهٔ
        // چرخان/درهم‌ریخته پنهان می‌شوند، اما decodeِ base64 در runtime ندارند.
        stringArrayEncoding: [],
        stringArrayThreshold: 0.75,
        rotateStringArray: true,
        shuffleStringArray: true,
        splitStrings: false,
        splitStringsChunkLength: 6,
        selfDefending: true,
        disableConsoleOutput: true,
        numbersToExpressions: false,
        // debugProtection برای هر ماژول یک حلقه/interval جدا تزریق می‌کند و روی
        // اپِ بزرگ main-thread را دوره‌ای متوقف می‌کند؛ مبهم‌سازیِ خودِ کد فعال است.
        debugProtection: false,
        debugProtectionInterval: 0,
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
