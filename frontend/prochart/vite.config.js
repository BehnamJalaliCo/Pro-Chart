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
        // ⚠️ مبهم‌سازیِ سبک و امن. گزینه‌های تهاجمی (selfDefending / debugProtection /
        // disableConsoleOutput / numbersToExpressions / splitStrings) خاموش‌اند چون
        // کدِ محافظتی/خودتغییرده تزریق می‌کنند که پشتِ Cloudflare یا در بعضی مرورگرها
        // می‌شکند و «s is not a function» / صفحهٔ مشکی می‌ساخت (۲۰۲۶-۰۷-۰۹).
        // controlFlowFlattening هم از قبل به‌خاطرِ خطای TDZ خاموش بود.
        compact: true,
        simplify: true,
        identifierNamesGenerator: 'mangled',
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        rotateStringArray: true,
        shuffleStringArray: true,
        splitStrings: false,
        selfDefending: false,
        disableConsoleOutput: false,
        numbersToExpressions: false,
        debugProtection: false,
        controlFlowFlattening: false,
        deadCodeInjection: false,
      },
    })]),
  ],
  build: { outDir: 'dist', sourcemap: false, minify: process.env.NO_OBF ? false : 'esbuild' },
});
