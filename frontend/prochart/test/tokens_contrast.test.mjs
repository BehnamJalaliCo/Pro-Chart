// گاردِ رگرسیون — کنتراستِ AA و نظمِ سایه.
//
// دو باگ:
//  ۱. `--text-muted: #787b86` در **هر دو تم یکسان** بود — یک خاکستری نمی‌تواند هم روی
//     #131722ِ تیره کار کند هم روی #ffffffِ روشن. هر شش ترکیب (۳ سطح × ۲ تم) AA را
//     رد می‌کرد: ۳.۲۱ تا ۴.۲۴ (حداقل ۴.۵). و در ۹–۱۱px استفاده می‌شد.
//  ۲. چهار سیستمِ موازیِ سایه: --elev-*، --pc-shadow-*، --pc-elev-*، و پیش‌فرض‌های
//     Tailwind. رندرِ زنده ۱۱ سایهٔ متمایز نشان داد؛ TradingView دقیقاً یکی دارد.
//
// اجرا:  node --test test/tokens_contrast.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const TW = readFileSync(new URL('../tailwind.config.js', import.meta.url), 'utf8');

// ── کنتراستِ WCAG ──
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => {
  const h = hex.replace('#', '');
  return 0.2126 * lin(parseInt(h.slice(0, 2), 16)) + 0.7152 * lin(parseInt(h.slice(2, 4), 16)) + 0.0722 * lin(parseInt(h.slice(4, 6), 16));
};
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };

// بلوکِ :root = تاریک، .light = روشن
const block = (name) => {
  const i = name === 'dark' ? CSS.indexOf(':root') : CSS.indexOf('.light');
  const j = CSS.indexOf('}', i);
  return CSS.slice(i, j);
};
const varOf = (theme, name) => {
  const m = block(theme).match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `${name} در تمِ ${theme} پیدا نشد`);
  return m[1];
};

const AA = 4.5;

test('text-muted در هر دو تم AA است — روی هر سه سطح', () => {
  const fails = [];
  for (const theme of ['dark', 'light']) {
    const muted = varOf(theme, '--text-muted');
    for (const s of ['--surface-default', '--surface-card', '--surface-elevated']) {
      const surf = varOf(theme, s);
      const r = ratio(muted, surf);
      if (r < AA) fails.push(`${theme}/${s}: ${muted} روی ${surf} = ${r.toFixed(2)}`);
    }
  }
  assert.deepEqual(fails, [], `text-muted کنتراستِ AA ندارد:\n${fails.join('\n')}`);
});

test('text-muted در دو تم مقدارِ متفاوت دارد', () => {
  // باگِ اصلی: یک مقدار برای هر دو تم — ذاتاً نمی‌تواند هر دو را پاس کند
  assert.notEqual(varOf('dark', '--text-muted'), varOf('light', '--text-muted'),
    'یک مقدار برای هر دو تم — همان باگی که هر شش ترکیب را رد می‌کرد');
});

test('text-primary و text-secondary هم AA‌اند', () => {
  const fails = [];
  for (const theme of ['dark', 'light']) {
    for (const t of ['--text-primary', '--text-secondary']) {
      const r = ratio(varOf(theme, t), varOf(theme, '--surface-default'));
      if (r < AA) fails.push(`${theme}/${t} = ${r.toFixed(2)}`);
    }
  }
  assert.deepEqual(fails, [], fails.join('\n'));
});

// ── نظمِ سایه ──
test('سایه دقیقاً سه نقش دارد و هر نقش در هر دو تم تعریف شده', () => {
  for (const role of ['--pc-shadow-pop', '--pc-shadow-modal', '--pc-shadow-chip']) {
    for (const theme of ['dark', 'light']) {
      assert.match(block(theme), new RegExp(role.replace(/-/g, '\\-') + ':'), `${role} در تمِ ${theme} نیست`);
    }
  }
});

test('هیچ توکنِ سایهٔ دیگری مقدارِ خام ندارد — همه به نقش‌ها نگاشته‌اند', () => {
  // --elev-* و --pc-elev-* باید در نهایت به --pc-shadow-* برسند.
  // نگاشت می‌تواند **زنجیره‌ای** باشد (--pc-elev-pop → --pc-elev-menu → --pc-shadow-pop)،
  // پس زنجیره را دنبال می‌کنیم نه فقط یک سطح.
  const defs = {};
  for (const m of CSS.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) defs[m[1]] = m[2].trim();

  const resolves = (name, seen = new Set()) => {
    if (seen.has(name)) return false;            // حلقه
    seen.add(name);
    if (/^--pc-shadow-(pop|modal|chip)$/.test(name)) return true;
    const v = defs[name];
    if (!v) return false;
    const ref = v.match(/^var\(\s*(--[a-z0-9-]+)/);
    return ref ? resolves(ref[1], seen) : false;  // مقدارِ خام ⇒ نگاشته نشده
  };

  const raw = Object.keys(defs)
    .filter((k) => /^--(pc-)?elev/.test(k))
    .filter((k) => !resolves(k))
    .map((k) => `${k}: ${defs[k].slice(0, 40)}`);
  assert.deepEqual(raw, [], `این توکن‌ها به نقش‌های سایه نمی‌رسند:\n${raw.join('\n')}`);
});

test('مقیاسِ سایهٔ Tailwind به نقش‌های ما بسته شده', () => {
  // وگرنه پیش‌فرض‌های تم‌ناآگاهِ Tailwind کنارِ توکن‌ها نشت می‌کنند
  assert.match(TW, /boxShadow:\s*\{/, 'مقیاسِ boxShadow بازتعریف نشده');
  for (const k of ['sm', 'md', 'lg']) {
    assert.match(TW, new RegExp(`${k}:\\s*'var\\(--pc-shadow-pop\\)'`), `shadow-${k} به نقشِ pop وصل نیست`);
  }
  for (const k of ['xl', "'2xl'"]) {
    assert.match(TW, new RegExp(`${k}:\\s*'var\\(--pc-shadow-modal\\)'`), `shadow-${k} به نقشِ modal وصل نیست`);
  }
});

test('شمارشِ مقادیرِ خامِ سایه در CSS محدود مانده', () => {
  const values = new Set();
  for (const m of CSS.matchAll(/--(?:pc-)?(?:shadow|elev)[a-z0-9-]*:\s*(\d[^;]*);/g)) values.add(m[1].trim());
  // ۳ نقش × ۲ تم = ۶ مقدارِ خام. بیشتر یعنی سیستمِ پنجمی جوانه زده.
  assert.ok(values.size <= 6, `${values.size} مقدارِ خامِ سایه — بیش از ۳ نقش × ۲ تم:\n${[...values].join('\n')}`);
});
