// گاردِ رگرسیون — یکدست‌سازیِ آیکون (فاز ۴).
// باگ: `export * from 'lucide-react'` کنترل‌نشده بود؛ حالا آیکون‌ها tuned و صریح
// export می‌شوند. اگر جایی آیکونی import شود که در لیست نیست، بیلد می‌شکند — این
// تست همان را زودتر می‌گیرد. ضمناً Eye/Search که خراب بودند بازکشیده شدند.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname;
const TVICONS = readFileSync(new URL('../src/bazaarnama/tvIcons.jsx', import.meta.url), 'utf8');

// همهٔ آیکون‌های import‌شده از tvIcons را از کلِ src جمع کن
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(f));
    else if (/\.(jsx?|tsx?)$/.test(e.name)) out.push(f);
  }
  return out;
}
const imported = new Set();
for (const f of walk(SRC)) {
  const txt = readFileSync(f, 'utf8');
  for (const m of txt.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*tvIcons['"]/gs)) {
    for (const name of m[1].split(',')) {
      const n = name.trim().split(/\s+as\s+/)[0].trim();
      if (n && /^[A-Z]/.test(n)) imported.add(n);
    }
  }
}

// نام‌های export‌شده از tvIcons (override + tuned)
const overridden = new Set([...TVICONS.matchAll(/^export const (\w+) = mk/gm)].map(m => m[1]));
const tunedBlock = TVICONS.match(/export const \{([^}]*)\} = _tuned;/s);
const tuned = new Set((tunedBlock ? tunedBlock[1] : '').split(',').map(s => s.trim()).filter(Boolean));

test('export * from lucide-react حذف شده — یک سیستمِ کنترل‌شده', () => {
  assert.ok(!/export \* from ['"]lucide-react['"]/.test(TVICONS), 'export * هنوز هست');
});

test('هر آیکونِ import‌شده export می‌شود (override یا tuned)', () => {
  const missing = [...imported].filter(n => !overridden.has(n) && !tuned.has(n));
  assert.deepEqual(missing, [], `import شده ولی export نشده (بیلد می‌شکند): ${missing.join(', ')}`);
});

test('Eye و Search بازکشیده شده‌اند (باگِ شِوران/رعدوبرق)', () => {
  const eye = TVICONS.match(/Eye:\s*\{[^}]*inner:\s*'([^']*)'/s);
  assert.ok(eye, 'Eye تعریف نشده');
  assert.ok(/circle/.test(eye[1]), 'Eye مردمک (circle) ندارد — هنوز شِوران است');
  assert.ok(!/M1 8l8\.5/.test(eye[1]), 'Eye هنوز مسیرِ شِورانِ قدیمی را دارد');

  const search = TVICONS.match(/Search:\s*\{[^}]*inner:\s*'([^']*)'/s);
  assert.ok(search, 'Search تعریف نشده');
  assert.ok(/circle/.test(search[1]), 'Search دایرهٔ ذره‌بین ندارد');
  assert.ok(!/17 4v4h2/.test(search[1]), 'Search هنوز مسیرِ رعدوبرقِ قدیمی را دارد');
});

test('آیکون‌های lucide با strokeWidth یکدست tune می‌شوند', () => {
  assert.match(TVICONS, /strokeWidth:\s*1\.5/, 'وزنِ استروکِ یکدست تعریف نشده');
  assert.match(TVICONS, /const tuneLucide/, 'wrapperِ tune وجود ندارد');
});

test('هیچ transition-all در سطوحِ زنده نمانده (پراپرتیِ ناخواسته animate نشود)', () => {
  const files = walk(join(SRC, 'bazaarnama')).concat([join(SRC, 'pages/BazaarNama.jsx')]);
  const bad = [];
  for (const f of files) {
    const txt = readFileSync(f, 'utf8');
    if (/\btransition-all\b/.test(txt)) bad.push(f.replace(SRC, ''));
  }
  assert.deepEqual(bad, [], `transition-all باقی مانده: ${bad.join(', ')}`);
});
