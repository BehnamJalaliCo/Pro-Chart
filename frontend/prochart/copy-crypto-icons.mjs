// کپیِ لوگوهای واقعیِ ارزها (cryptocurrency-icons، رنگی) به public/crypto-icons/
// تا SymbolLogo بتواند با <img src="/crypto-icons/{ticker}.svg"> لوگوی دقیقِ هر کوین را نشان دهد.
// self-hosted (بدونِ CDN خارجی). اگر بسته نبود، بی‌صدا رد می‌شود (fallback به بَجِ رنگی).
import { cp, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const src = path.resolve('node_modules/cryptocurrency-icons/svg/color');
const dst = path.resolve('public/crypto-icons');
// لوگوهای واقعیِ کوین‌هایی که در بستهٔ cryptocurrency-icons نیستند (PEPE/WIF/SUI/TIA/…)؛
// committed در repo تا build داخل Docker/CI هم آن‌ها را داشته باشد (dir بالا gitignore است و بازتولید می‌شود).
const extra = path.resolve('crypto-icons-extra');

try {
  await mkdir(dst, { recursive: true });
  if (existsSync(src)) {
    await cp(src, dst, { recursive: true });
  } else {
    console.warn('[crypto-icons] package not found — using extras + badge fallback only');
  }
  // extraها بعد از بسته کپی می‌شوند تا لوگوی برندِ دقیقِ کوین‌های تازه غالب/اضافه شود.
  if (existsSync(extra)) {
    await cp(extra, dst, { recursive: true });
  }
  const n = (await readdir(dst)).length;
  console.log(`[crypto-icons] copied ${n} coin logos → public/crypto-icons/`);
} catch (e) {
  console.warn('[crypto-icons] copy failed (non-fatal):', e?.message || e);
}
