// بازارنما — سازندهٔ انواعِ چارتِ «غیراستاندارد» که داده را از OHLC بازنویسی می‌کنند.
// خروجی: آرایهٔ کندل {t,o,h,l,c} (برای Renko/Range/LineBreak) یا نقاطِ خط {t,value} (Kagi/PnF).
// زمان‌ها به‌صورتِ صعودیِ یکتا تخصیص می‌یابند (این چارت‌ها مستقل از زمان‌اند).

// میانگینِ بازهٔ واقعی برای اندازهٔ پیش‌فرضِ آجر/بازه
export function avgRange(cs, p = 14) {
  if (!cs.length) return 1;
  let sum = 0, n = 0;
  for (let i = 1; i < cs.length; i++) {
    const tr = Math.max(cs[i].h - cs[i].l, Math.abs(cs[i].h - cs[i - 1].c), Math.abs(cs[i].l - cs[i - 1].c));
    sum += tr; n++;
    if (n >= p && i >= p) break;
  }
  return n ? sum / n : (cs[0].h - cs[0].l) || 1;
}

// تخصیصِ زمانِ صعودیِ یکتا
function timer() { let last = 0; return (t) => { const v = Math.max(t || 0, last + 1); last = v; return v; }; }

// ── Renko ── (آجرها بر پایهٔ close)
export function renko(cs, brick) {
  if (!cs.length) return [];
  brick = brick || avgRange(cs) || 1;
  const out = []; const nt = timer();
  let base = cs[0].c, dir = 0;
  for (const c of cs) {
    let price = c.c;
    while (price >= base + brick) { const o = base, cl = base + brick; out.push({ t: nt(c.t), o, h: cl, l: o, c: cl }); base += brick; dir = 1; }
    while (price <= base - brick) { const o = base, cl = base - brick; out.push({ t: nt(c.t), o, h: o, l: cl, c: cl }); base -= brick; dir = -1; }
  }
  return out;
}

// ── Range bars ── (هر بار وقتی قیمت به اندازهٔ rng حرکت کند)
export function rangeBars(cs, rng) {
  if (!cs.length) return [];
  rng = rng || avgRange(cs) || 1;
  const out = []; const nt = timer();
  let o = cs[0].o, hi = cs[0].o, lo = cs[0].o;
  for (const c of cs) {
    [c.o, c.h, c.l, c.c].forEach((px) => {
      hi = Math.max(hi, px); lo = Math.min(lo, px);
      if (hi - lo >= rng) { out.push({ t: nt(c.t), o, h: hi, l: lo, c: px }); o = px; hi = px; lo = px; }
    });
  }
  return out;
}

// ── Line Break ── (شکستِ n خط)
export function lineBreak(cs, n = 3) {
  if (!cs.length) return [];
  const out = []; const nt = timer();
  const lines = []; // {o,c}
  for (const c of cs) {
    const price = c.c;
    if (!lines.length) { if (cs[0] && Math.abs(price - cs[0].o) > 1e-9) { lines.push({ o: cs[0].o, c: price }); out.push({ t: nt(c.t), o: cs[0].o, h: Math.max(cs[0].o, price), l: Math.min(cs[0].o, price), c: price }); } continue; }
    const last = lines[lines.length - 1];
    const ref = lines.slice(-n);
    const hi = Math.max(...ref.map((l) => Math.max(l.o, l.c)));
    const lo = Math.min(...ref.map((l) => Math.min(l.o, l.c)));
    const up = last.c >= last.o;
    if (up && price > last.c) { lines.push({ o: last.c, c: price }); out.push({ t: nt(c.t), o: last.c, h: price, l: last.c, c: price }); }
    else if (!up && price < last.c) { lines.push({ o: last.c, c: price }); out.push({ t: nt(c.t), o: last.c, h: last.c, l: price, c: price }); }
    else if (up && price < lo) { lines.push({ o: lo, c: price }); out.push({ t: nt(c.t), o: lo, h: lo, l: price, c: price }); }
    else if (!up && price > hi) { lines.push({ o: hi, c: price }); out.push({ t: nt(c.t), o: hi, h: price, l: hi, c: price }); }
  }
  return out;
}

// ── Kagi ── (خطِ پیوسته که با برگشتِ ≥reversal جهت عوض می‌کند) → نقاطِ خط
export function kagi(cs, reversal) {
  if (!cs.length) return [];
  reversal = reversal || avgRange(cs) || 1;
  const nt = timer();
  const pts = [{ t: nt(cs[0].t), value: cs[0].c }];
  let dir = 0, ext = cs[0].c;
  for (const c of cs) {
    const p = c.c;
    if (dir >= 0 && p > ext) { ext = p; pts[pts.length - 1] = { t: nt(c.t), value: p }; dir = 1; }
    else if (dir <= 0 && p < ext) { ext = p; pts[pts.length - 1] = { t: nt(c.t), value: p }; dir = -1; }
    else if (dir === 1 && p <= ext - reversal) { pts.push({ t: nt(c.t), value: p }); ext = p; dir = -1; }
    else if (dir === -1 && p >= ext + reversal) { pts.push({ t: nt(c.t), value: p }); ext = p; dir = 1; }
  }
  return pts;
}

// ── Point & Figure ── (سادهٔ ستونی) → نقاطِ خطِ سقف/کفِ ستون‌ها
export function pnf(cs, box, reversal = 3) {
  if (!cs.length) return [];
  box = box || avgRange(cs) || 1;
  const nt = timer();
  const pts = []; let dir = 0, ext = cs[0].c;
  for (const c of cs) {
    const p = c.c;
    if (dir >= 0 && p >= ext + box) { ext = ext + Math.floor((p - ext) / box) * box; pts.push({ t: nt(c.t), value: ext }); dir = 1; }
    else if (dir <= 0 && p <= ext - box) { ext = ext - Math.floor((ext - p) / box) * box; pts.push({ t: nt(c.t), value: ext }); dir = -1; }
    else if (dir === 1 && p <= ext - box * reversal) { ext = p; pts.push({ t: nt(c.t), value: ext }); dir = -1; }
    else if (dir === -1 && p >= ext + box * reversal) { ext = p; pts.push({ t: nt(c.t), value: ext }); dir = 1; }
  }
  return pts;
}

export const NONSTANDARD = ['renko', 'range', 'linebreak', 'kagi', 'pnf'];
export function buildNonStandard(type, cs) {
  if (type === 'renko') return { kind: 'candle', data: renko(cs) };
  if (type === 'range') return { kind: 'candle', data: rangeBars(cs) };
  if (type === 'linebreak') return { kind: 'candle', data: lineBreak(cs, 3) };
  if (type === 'kagi') return { kind: 'line', data: kagi(cs) };
  if (type === 'pnf') return { kind: 'line', data: pnf(cs) };
  return null;
}
