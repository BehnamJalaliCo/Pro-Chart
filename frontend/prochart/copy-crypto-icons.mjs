// کپیِ لوگوهای واقعیِ ارزها (cryptocurrency-icons، رنگی) به public/crypto-icons/
// تا SymbolLogo بتواند با <img src="/crypto-icons/{ticker}.svg"> لوگوی دقیقِ هر کوین را نشان دهد.
// self-hosted (بدونِ CDN خارجی). اگر بسته نبود، بی‌صدا رد می‌شود (fallback به بَجِ رنگی).
import { cp, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const src = path.resolve('node_modules/cryptocurrency-icons/svg/color');
const dst = path.resolve('public/crypto-icons');

try {
  if (!existsSync(src)) {
    console.warn('[crypto-icons] package not found — skipping (badge fallback will be used)');
    process.exit(0);
  }
  await mkdir(dst, { recursive: true });
  await cp(src, dst, { recursive: true });
  const n = (await readdir(dst)).length;
  console.log(`[crypto-icons] copied ${n} coin logos → public/crypto-icons/`);
} catch (e) {
  console.warn('[crypto-icons] copy failed (non-fatal):', e?.message || e);
}
