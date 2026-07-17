// src/bazaarnama/drawtools_ext.js
var FIB_DEF = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2, 2.618, 3.618, 4.236];
var FIB_SEQ = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
var GANN_RATIOS = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1];
var GANN_FAN = [
  { k: 8, lbl: "8\xD71" },
  { k: 4, lbl: "4\xD71" },
  { k: 3, lbl: "3\xD71" },
  { k: 2, lbl: "2\xD71" },
  { k: 1, lbl: "1\xD71" },
  { k: 1 / 2, lbl: "1\xD72" },
  { k: 1 / 3, lbl: "1\xD73" },
  { k: 1 / 4, lbl: "1\xD74" },
  { k: 1 / 8, lbl: "1\xD78" }
];
var dash = (ctx, on) => ctx.setLineDash(on ? [6, 4] : []);
function style(ctx, d) {
  ctx.lineWidth = d.width || 1.5;
  ctx.strokeStyle = d.color || "#2962FF";
  ctx.fillStyle = d.color || "#2962FF";
  ctx.font = "12px IRANYekanX, Ravagh, Vazirmatn, sans-serif";
  dash(ctx, d.dashed);
}
function seg(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function rayTo(ctx, x0, y0, x1, y1, W, H, both) {
  const dx = x1 - x0, dy = y1 - y0, k = Math.max(W, H) * 4 || 8e3;
  ctx.beginPath();
  if (both) ctx.moveTo(x0 - dx / Math.hypot(dx, dy || 1) * k, y0 - dy / Math.hypot(dx, dy || 1) * k);
  else ctx.moveTo(x0, y0);
  const L = Math.hypot(dx, dy) || 1;
  ctx.lineTo(x0 + dx / L * k, y0 + dy / L * k);
  ctx.stroke();
}
function distSeg(x, y, x0, y0, x1, y1) {
  const A = x - x0, B = y - y0, C = x1 - x0, D = y1 - y0;
  const len = C * C + D * D, dot = A * C + B * D;
  const t = len ? Math.max(0, Math.min(1, dot / len)) : 0;
  return Math.hypot(x - (x0 + t * C), y - (y0 + t * D));
}
function distLine(x, y, x0, y0, x1, y1) {
  const C = x1 - x0, D = y1 - y0, len = Math.hypot(C, D) || 1;
  return Math.abs((y - y0) * C - (x - x0) * D) / len;
}
function arrowHead(ctx, x0, y0, x1, y1, size) {
  const a = Math.atan2(y1 - y0, x1 - x0), s = size || 10;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - s * Math.cos(a - Math.PI / 7), y1 - s * Math.sin(a - Math.PI / 7));
  ctx.lineTo(x1 - s * Math.cos(a + Math.PI / 7), y1 - s * Math.sin(a + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}
function labelBox(ctx, x, y, text, opts) {
  opts = opts || {};
  const lines = String(text).replace(/\\n/g, "\n").split("\n");
  ctx.font = opts.font || "11px IRANYekanX, Ravagh, Vazirmatn, sans-serif";
  let w = 0;
  lines.forEach((ln) => {
    w = Math.max(w, ctx.measureText(ln).width);
  });
  const padX = 6, padY = 4, lh = 14, bw = w + padX * 2, bh = lines.length * lh + padY * 2;
  let bx = x, by = y;
  if (opts.anchor === "center") {
    bx = x - bw / 2;
    by = y - bh / 2;
  }
  if (opts.anchor === "above") {
    bx = x - bw / 2;
    by = y - bh - 6;
  }
  ctx.fillStyle = opts.bg || "rgba(20,24,33,.92)";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 4);
    ctx.fill();
  } else ctx.fillRect(bx, by, bw, bh);
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 1;
    dash(ctx, false);
    if (ctx.roundRect) ctx.stroke();
    else ctx.strokeRect(bx, by, bw, bh);
  }
  ctx.fillStyle = opts.fg || "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines.forEach((ln, i) => ctx.fillText(ln, bx + padX, by + padY + i * lh));
  ctx.textBaseline = "alphabetic";
  return { bx, by, bw, bh };
}
function bezierHit(P, x, y, order) {
  if (!P || P.some((q) => !q || q.x == null || q.y == null)) return false;
  const N = 26;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    let q;
    if (order === 2) q = { x: u * u * P[0].x + 2 * u * t * P[1].x + t * t * P[2].x, y: u * u * P[0].y + 2 * u * t * P[1].y + t * t * P[2].y };
    else q = { x: u * u * u * P[0].x + 3 * u * u * t * P[1].x + 3 * u * t * t * P[2].x + t * t * t * P[3].x, y: u * u * u * P[0].y + 3 * u * u * t * P[1].y + 3 * u * t * t * P[2].y + t * t * t * P[3].y };
    if (prev) {
      const C = q.x - prev.x, D = q.y - prev.y, len = C * C + D * D;
      const tt = len ? Math.max(0, Math.min(1, ((x - prev.x) * C + (y - prev.y) * D) / len)) : 0;
      if (Math.hypot(x - (prev.x + tt * C), y - (prev.y + tt * D)) < 6) return true;
    }
    prev = q;
  }
  return false;
}
function arcPoints(A, B, C, N) {
  const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
  if (Math.abs(d) < 1e-3) return [A, C];
  const A2 = A.x * A.x + A.y * A.y, B2 = B.x * B.x + B.y * B.y, C2 = C.x * C.x + C.y * C.y;
  const ux = (A2 * (B.y - C.y) + B2 * (C.y - A.y) + C2 * (A.y - B.y)) / d;
  const uy = (A2 * (C.x - B.x) + B2 * (A.x - C.x) + C2 * (B.x - A.x)) / d;
  const r = Math.hypot(A.x - ux, A.y - uy);
  const un = (a, ref) => {
    while (a - ref > Math.PI) a -= 2 * Math.PI;
    while (a - ref < -Math.PI) a += 2 * Math.PI;
    return a;
  };
  const a0 = Math.atan2(A.y - uy, A.x - ux);
  const aB = un(Math.atan2(B.y - uy, B.x - ux), a0);
  const a1 = un(Math.atan2(C.y - uy, C.x - ux), aB);
  const out = [];
  for (let i = 0; i <= N; i++) {
    const a = a0 + (a1 - a0) * i / N;
    out.push({ x: ux + r * Math.cos(a), y: uy + r * Math.sin(a) });
  }
  return out;
}
function fibLevels(d, base, diff) {
  const lv = d.levels || FIB_DEF;
  return lv.map((r) => ({ ratio: r, price: base + diff * r }));
}
var px = (api, pt) => ({ x: api.x(pt.t), y: api.y(pt.p) });
var ok = (P) => P && P.x != null && P.y != null;
var EXT_REGISTRY = {
  // ───────── ۴.۲ خطوط ─────────
  // خطِ نامتناهی (هر دو جهت)
  extline: {
    label: "\u062E\u0637\u0650 \u0627\u0645\u062A\u062F\u0627\u062F\u200C\u06CC\u0627\u0641\u062A\u0647",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      style(ctx, d);
      rayTo(ctx, a.x, a.y, b.x, b.y, api.W, api.H, true);
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      return distLine(x, y, a.x, a.y, b.x, b.y) < 7;
    }
  },
  // خطِ اطلاعاتی: قطعه + برچسبِ Δقیمت/Δدرصد/Δبار/Δزمان/زاویه
  infoline: {
    label: "\u062E\u0637\u0650 \u0627\u0637\u0644\u0627\u0639\u0627\u062A\u06CC",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      style(ctx, d);
      seg(ctx, a.x, a.y, b.x, b.y);
      const dp = d.p1.p - d.p0.p, pct = d.p0.p ? dp / d.p0.p * 100 : 0;
      const bars = Math.round((b.x - a.x) / (api.barWidth() || 6));
      const ang = Math.atan2(-(b.y - a.y), b.x - a.x) * 180 / Math.PI;
      const txt = `\u0394 ${dp.toFixed(api.digits())}
${pct.toFixed(2)}%  |  ${bars} \u0628\u0627\u0631
${ang.toFixed(1)}\xB0`;
      labelBox(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, txt, { anchor: "center", border: d.color });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      return distSeg(x, y, a.x, a.y, b.x, b.y) < 7;
    }
  },
  // زاویهٔ روند: شعاع + قوسِ زاویه نسبت به افق
  angle: {
    label: "\u0632\u0627\u0648\u06CC\u0647\u0654 \u0631\u0648\u0646\u062F",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      style(ctx, d);
      rayTo(ctx, a.x, a.y, b.x, b.y, api.W, api.H, false);
      dash(ctx, false);
      ctx.globalAlpha = 0.5;
      seg(ctx, a.x, a.y, a.x + 40, a.y);
      ctx.globalAlpha = 1;
      const ang = Math.atan2(-(b.y - a.y), b.x - a.x) * 180 / Math.PI;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 26, 0, -ang * Math.PI / 180, ang > 0);
      ctx.stroke();
      labelBox(ctx, a.x + 30, a.y - 8, `${ang.toFixed(1)}\xB0`, { border: d.color });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      return distLine(x, y, a.x, a.y, b.x, b.y) < 7;
    }
  },
  // پرتوِ افقی: از p0 تا راست
  hray: {
    label: "\u067E\u0631\u062A\u0648\u0650 \u0627\u0641\u0642\u06CC",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return;
      style(ctx, d);
      seg(ctx, a.x, a.y, api.W, a.y);
      ctx.fillText(d.p0.p.toFixed(api.digits()), a.x + 4, a.y - 3);
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return false;
      return Math.abs(y - a.y) < 7 && x >= a.x - 7;
    }
  },
  // خطِ صلیبی: افقی + عمودی از یک لنگر
  crossline: {
    label: "\u062E\u0637\u0650 \u0635\u0644\u06CC\u0628\u06CC",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return;
      style(ctx, d);
      seg(ctx, 0, a.y, api.W, a.y);
      seg(ctx, a.x, 0, a.x, api.H);
      const col = d.color || "#3b82f6", th = 15, pad = 4;
      ctx.save();
      ctx.font = "11px sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const pl = d.p0.p.toFixed(api.digits());
      const pw = ctx.measureText(pl).width, ptW = pw + pad * 2, pTx = api.W - ptW - 2;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.95;
      ctx.fillRect(pTx, a.y - th / 2, ptW, th);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.fillText(pl, pTx + pad, a.y);
      if (d.p0.t != null) {
        const dl = api.timeFmt(d.p0.t);
        if (dl) {
          const s = String(dl);
          const dw = ctx.measureText(s).width, dtW = dw + pad * 2;
          let dTx = a.x - dtW / 2;
          dTx = Math.max(2, Math.min(dTx, api.W - dtW - 2));
          const dTy = api.H - th - 1;
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.95;
          ctx.fillRect(dTx, dTy, dtW, th);
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#fff";
          ctx.fillText(s, dTx + pad, dTy + th / 2);
        }
      }
      ctx.restore();
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return false;
      return Math.abs(y - a.y) < 7 || Math.abs(x - a.x) < 7;
    }
  },
  // ───────── ۴.۳ کانال‌ها و چنگال‌ها ─────────
  // کانالِ رگرسیون: خطِ رگرسیونِ خطیِ close روی بازه + باندِ ±۲σ
  regchannel: {
    label: "\u06A9\u0627\u0646\u0627\u0644\u0650 \u0631\u06AF\u0631\u0633\u06CC\u0648\u0646",
    points: 2,
    draw(ctx, d, api) {
      const t0 = Math.min(d.p0.t, d.p1.t), t1 = Math.max(d.p0.t, d.p1.t);
      const cs = (api.candles || []).filter((c) => c.t >= t0 && c.t <= t1);
      style(ctx, d);
      if (cs.length < 2) {
        const a = px(api, d.p0), b = px(api, d.p1);
        if (ok(a) && ok(b)) seg(ctx, a.x, a.y, b.x, b.y);
        return;
      }
      const n = cs.length;
      let sx = 0, sy = 0, sxy = 0, sxx = 0;
      cs.forEach((c, i) => {
        sx += i;
        sy += c.c;
        sxy += i * c.c;
        sxx += i * i;
      });
      const m = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1), b0 = (sy - m * sx) / n;
      let ss = 0;
      cs.forEach((c, i) => {
        const e = c.c - (m * i + b0);
        ss += e * e;
      });
      const sd = Math.sqrt(ss / n);
      const pv = (i) => m * i + b0, x0 = api.x(cs[0].t), x1 = api.x(cs[n - 1].t);
      const yM0 = api.y(pv(0)), yM1 = api.y(pv(n - 1));
      const yT0 = api.y(pv(0) + 2 * sd), yT1 = api.y(pv(n - 1) + 2 * sd);
      const yB0 = api.y(pv(0) - 2 * sd), yB1 = api.y(pv(n - 1) - 2 * sd);
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.moveTo(x0, yT0);
      ctx.lineTo(x1, yT1);
      ctx.lineTo(x1, yB1);
      ctx.lineTo(x0, yB0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      seg(ctx, x0, yM0, x1, yM1);
      ctx.globalAlpha = 0.75;
      dash(ctx, true);
      seg(ctx, x0, yT0, x1, yT1);
      seg(ctx, x0, yB0, x1, yB1);
      dash(ctx, false);
      ctx.globalAlpha = 1;
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      return x >= Math.min(a.x, b.x) - 7 && x <= Math.max(a.x, b.x) + 7 && y >= Math.min(a.y, b.y) - 30 && y <= Math.max(a.y, b.y) + 30;
    }
  },
  // کانالِ سقف/کفِ صاف: خطِ روند (p0→p1) + خطِ افقی در p2
  flatchannel: {
    label: "\u06A9\u0627\u0646\u0627\u0644\u0650 \u0633\u0642\u0641/\u06A9\u0641\u0650 \u0635\u0627\u0641",
    points: 3,
    draw(ctx, d, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 3) return;
      style(ctx, d);
      const xL = Math.min(P[0].x, P[1].x), xR = Math.max(P[0].x, P[1].x);
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.moveTo(P[0].x, P[0].y);
      ctx.lineTo(P[1].x, P[1].y);
      ctx.lineTo(xR, P[2].y);
      ctx.lineTo(xL, P[2].y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      seg(ctx, P[0].x, P[0].y, P[1].x, P[1].y);
      seg(ctx, xL, P[2].y, xR, P[2].y);
    },
    hit(d, x, y, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 3) return false;
      return distSeg(x, y, P[0].x, P[0].y, P[1].x, P[1].y) < 7 || Math.abs(y - P[2].y) < 7 && x >= Math.min(P[0].x, P[1].x) - 7 && x <= Math.max(P[0].x, P[1].x) + 7;
    }
  },
  // کانالِ ناپیوسته: دو خطِ مستقلِ p0→p1 و p2→p3
  disjointchannel: {
    label: "\u06A9\u0627\u0646\u0627\u0644\u0650 \u0646\u0627\u067E\u06CC\u0648\u0633\u062A\u0647",
    points: 4,
    draw(ctx, d, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 4) return;
      style(ctx, d);
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.moveTo(P[0].x, P[0].y);
      ctx.lineTo(P[1].x, P[1].y);
      ctx.lineTo(P[3].x, P[3].y);
      ctx.lineTo(P[2].x, P[2].y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      seg(ctx, P[0].x, P[0].y, P[1].x, P[1].y);
      seg(ctx, P[2].x, P[2].y, P[3].x, P[3].y);
    },
    hit(d, x, y, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 4) return false;
      return distSeg(x, y, P[0].x, P[0].y, P[1].x, P[1].y) < 7 || distSeg(x, y, P[2].x, P[2].y, P[3].x, P[3].y) < 7;
    }
  },
  // چنگالِ شیف (median از میانِ p0..mid عمودی)
  schiff: { label: "\u0686\u0646\u06AF\u0627\u0644\u0650 \u0634\u06CC\u0641", points: 3, draw: drawFork("schiff"), hit: hitFork },
  // چنگالِ شیفِ اصلاح‌شده (median از میانِ p0..mid در هر دو محور)
  modschiff: { label: "\u0686\u0646\u06AF\u0627\u0644\u0650 \u0634\u06CC\u0641\u0650 \u0627\u0635\u0644\u0627\u062D\u200C\u0634\u062F\u0647", points: 3, draw: drawFork("modschiff"), hit: hitFork },
  // چنگالِ داخلی (پرونگ‌ها از نیمه‌راهِ لنگرها)
  insidepitchfork: { label: "\u0686\u0646\u06AF\u0627\u0644\u0650 \u062F\u0627\u062E\u0644\u06CC", points: 3, draw: drawFork("inside"), hit: hitFork },
  // پیچ‌فنِ فیبوناچی: شعاع‌های موازی در نسبت‌های فیبوناچی بینِ دو پرونگ
  pitchfan: {
    label: "\u067E\u06CC\u0686\u200C\u0641\u0646\u0650 \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC",
    points: 3,
    draw(ctx, d, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 3) return;
      const mid = { x: (P[1].x + P[2].x) / 2, y: (P[1].y + P[2].y) / 2 };
      const O = P[0], dx = mid.x - O.x, dy = mid.y - O.y;
      style(ctx, d);
      rayTo(ctx, O.x, O.y, mid.x, mid.y, api.W, api.H, false);
      (d.levels || [0.25, 0.382, 0.5, 0.618, 0.75, 1]).forEach((r) => {
        const bx = P[1].x + (P[2].x - P[1].x) * r, by = P[1].y + (P[2].y - P[1].y) * r;
        ctx.globalAlpha = 0.7;
        rayTo(ctx, bx, by, bx + dx, by + dy, api.W, api.H, false);
        ctx.globalAlpha = 1;
        ctx.fillText((r * 100).toFixed(1) + "%", bx + 3, by);
      });
    },
    hit(d, x, y, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 3) return false;
      const mid = { x: (P[1].x + P[2].x) / 2, y: (P[1].y + P[2].y) / 2 };
      return distLine(x, y, P[0].x, P[0].y, mid.x, mid.y) < 7 || distSeg(x, y, P[1].x, P[1].y, P[2].x, P[2].y) < 7;
    }
  },
  // ───────── ۴.۴ فیبوناچی ─────────
  // فیبوی گسترشیِ سه‌نقطه‌ای (A→B→C) با تصویرِ صحیح از C
  fib3: {
    label: "\u0641\u06CC\u0628\u0648\u06CC \u06AF\u0633\u062A\u0631\u0634\u06CC\u0650 \u06F3\u0646\u0642\u0637\u0647",
    points: 3,
    draw(ctx, d, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p))) return;
      const A = d.pts[0].p, B = d.pts[1].p, C = d.pts[2].p, dir = B - A >= 0 ? 1 : -1, mag = Math.abs(B - A);
      const xa = api.x(d.pts[1].t), xb = api.x(d.pts[2].t) + 60;
      style(ctx, d);
      ctx.globalAlpha = 0.5;
      seg(ctx, P[0].x, P[0].y, P[1].x, P[1].y);
      seg(ctx, P[1].x, P[1].y, P[2].x, P[2].y);
      ctx.globalAlpha = 1;
      fibLevels(d, C, dir * mag).forEach((L) => {
        const y = api.y(L.price);
        if (y == null) return;
        dash(ctx, false);
        seg(ctx, xa, y, xb, y);
        ctx.fillText(`${(L.ratio * 100).toFixed(1)}%  ${L.price.toFixed(api.digits())}`, xa + 4, y - 2);
      });
    },
    hit(d, x, y, api) {
      const xa = api.x(d.pts[1].t), xb = api.x(d.pts[2].t) + 60;
      if (xa == null) return false;
      if (x < Math.min(xa, xb) - 7 || x > Math.max(xa, xb) + 7) return false;
      const A = d.pts[0].p, B = d.pts[1].p, C = d.pts[2].p, dir = B - A >= 0 ? 1 : -1, mag = Math.abs(B - A);
      return fibLevels(d, C, dir * mag).some((L) => {
        const yy = api.y(L.price);
        return yy != null && Math.abs(yy - y) < 7;
      });
    }
  },
  // بادبزنِ فیبوناچی: شعاع از p0 از دلِ تقسیماتِ جعبه
  fibfan: {
    label: "\u0628\u0627\u062F\u0628\u0632\u0646\u0650 \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      style(ctx, d);
      ctx.globalAlpha = 0.25;
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.globalAlpha = 1;
      (d.levels || [0.236, 0.382, 0.5, 0.618, 0.786, 1]).forEach((r) => {
        const ty = a.y + (b.y - a.y) * r;
        dash(ctx, false);
        ctx.globalAlpha = 0.85;
        rayTo(ctx, a.x, a.y, b.x, ty, api.W, api.H, false);
        ctx.globalAlpha = 1;
        ctx.fillText((r * 100).toFixed(1) + "%", b.x + 3, ty);
      });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      return (d.levels || [0.236, 0.382, 0.5, 0.618, 0.786, 1]).some((r) => {
        const ty = a.y + (b.y - a.y) * r;
        return distLine(x, y, a.x, a.y, b.x, ty) < 7 && x >= Math.min(a.x, b.x) - 7;
      });
    }
  },
  // ناحیه‌های زمانیِ فیبوناچی: خطوطِ عمودی در شمارشِ فیبوناچی
  fibtime: {
    label: "\u0646\u0627\u062D\u06CC\u0647\u0654 \u0632\u0645\u0627\u0646\u06CC\u0650 \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return;
      const unit = d.p1.t - d.p0.t;
      if (!unit) return;
      style(ctx, d);
      FIB_SEQ.forEach((n) => {
        const xx = api.x(d.p0.t + n * unit);
        if (xx == null) return;
        seg(ctx, xx, 0, xx, api.H);
        ctx.fillText(String(n), xx + 3, 14);
      });
    },
    hit(d, x, y, api) {
      const unit = d.p1.t - d.p0.t;
      if (!unit) return false;
      return FIB_SEQ.some((n) => {
        const xx = api.x(d.p0.t + n * unit);
        return xx != null && Math.abs(xx - x) < 7;
      });
    }
  },
  // فیبوی زمانیِ روندی (۳نقطه): مضرب‌های فیبوناچیِ (t1-t0) از t2
  fibtimeext: {
    label: "\u0641\u06CC\u0628\u0648\u06CC \u0632\u0645\u0627\u0646\u06CC\u0650 \u0631\u0648\u0646\u062F\u06CC",
    points: 3,
    draw(ctx, d, api) {
      const unit = d.pts[1].t - d.pts[0].t;
      if (!unit) return;
      style(ctx, d);
      FIB_DEF.forEach((r) => {
        const xx = api.x(d.pts[2].t + r * unit);
        if (xx == null) return;
        ctx.globalAlpha = 0.85;
        seg(ctx, xx, 0, xx, api.H);
        ctx.globalAlpha = 1;
        ctx.fillText(r.toFixed(3), xx + 3, 14);
      });
    },
    hit(d, x, y, api) {
      const unit = d.pts[1].t - d.pts[0].t;
      if (!unit) return false;
      return FIB_DEF.some((r) => {
        const xx = api.x(d.pts[2].t + r * unit);
        return xx != null && Math.abs(xx - x) < 7;
      });
    }
  },
  // کانالِ فیبوناچی (۳نقطه): کانالِ موازی با خطوطِ داخلیِ فیبوناچی
  fibchannel: {
    label: "\u06A9\u0627\u0646\u0627\u0644\u0650 \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC",
    points: 3,
    draw(ctx, d, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 3) return;
      const ox = P[2].x - P[0].x, oy = P[2].y - P[0].y;
      style(ctx, d);
      (d.levels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618]).forEach((r) => {
        const a = { x: P[0].x + ox * r, y: P[0].y + oy * r }, b = { x: P[1].x + ox * r, y: P[1].y + oy * r };
        ctx.globalAlpha = r === 0 || r === 1 ? 1 : 0.7;
        seg(ctx, a.x, a.y, b.x, b.y);
        ctx.globalAlpha = 1;
        ctx.fillText((r * 100).toFixed(1) + "%", b.x + 3, b.y);
      });
    },
    hit(d, x, y, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p))) return false;
      const ox = P[2].x - P[0].x, oy = P[2].y - P[0].y;
      return [0, 0.5, 1].some((r) => distSeg(x, y, P[0].x + ox * r, P[0].y + oy * r, P[1].x + ox * r, P[1].y + oy * r) < 7);
    }
  },
  // دایره‌های فیبوناچی (بیضیِ هم‌مرکز برای تصحیحِ مقیاسِ price/time)
  fibcircles: {
    label: "\u062F\u0627\u06CC\u0631\u0647\u200C\u0647\u0627\u06CC \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const rx = Math.abs(b.x - a.x), ry = Math.abs(b.y - a.y);
      style(ctx, d);
      (d.levels || [0.236, 0.382, 0.5, 0.618, 1, 1.618, 2.618]).forEach((r) => {
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.ellipse(a.x, a.y, rx * r, ry * r, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      const rx = Math.abs(b.x - a.x) || 1, ry = Math.abs(b.y - a.y) || 1;
      return (d.levels || [0.236, 0.382, 0.5, 0.618, 1, 1.618, 2.618]).some((r) => {
        const e = Math.hypot((x - a.x) / (rx * r || 1), (y - a.y) / (ry * r || 1));
        return Math.abs(e - 1) < 0.08;
      });
    }
  },
  // کمان‌های فیبوناچی (نیم‌بیضیِ پایین)
  fibarcs: {
    label: "\u06A9\u0645\u0627\u0646\u200C\u0647\u0627\u06CC \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const rx = Math.abs(b.x - a.x), ry = Math.abs(b.y - a.y), down = b.y >= a.y;
      style(ctx, d);
      (d.levels || [0.382, 0.5, 0.618, 1]).forEach((r) => {
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.ellipse(a.x, a.y, rx * r, ry * r, 0, down ? 0 : Math.PI, down ? Math.PI : 0);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      const rx = Math.abs(b.x - a.x) || 1, ry = Math.abs(b.y - a.y) || 1;
      return (d.levels || [0.382, 0.5, 0.618, 1]).some((r) => Math.abs(Math.hypot((x - a.x) / (rx * r || 1), (y - a.y) / (ry * r || 1)) - 1) < 0.1);
    }
  },
  // مارپیچِ فیبوناچی (لگاریتمیِ طلایی): p0 مرکز، p1 شعاع/زاویهٔ شروع
  fibspiral: {
    label: "\u0645\u0627\u0631\u067E\u06CC\u0686\u0650 \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const r0 = Math.hypot(b.x - a.x, b.y - a.y) || 1, a0 = Math.atan2(b.y - a.y, b.x - a.x);
      const growth = Math.log(1.6180339887) / (Math.PI / 2), TH = Math.PI * 6;
      style(ctx, d);
      ctx.beginPath();
      let started = false;
      for (let th = 0; th <= TH; th += 0.1) {
        const r = r0 * Math.exp(-growth * (TH - th));
        const x = a.x + r * Math.cos(a0 + th), y = a.y + r * Math.sin(a0 + th);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      const r0 = Math.hypot(b.x - a.x, b.y - a.y) || 1, a0 = Math.atan2(b.y - a.y, b.x - a.x);
      const growth = Math.log(1.6180339887) / (Math.PI / 2), TH = Math.PI * 6;
      for (let th = 0; th <= TH; th += 0.1) {
        const r = r0 * Math.exp(-growth * (TH - th));
        const xx = a.x + r * Math.cos(a0 + th), yy = a.y + r * Math.sin(a0 + th);
        if (Math.hypot(xx - x, yy - y) < 7) return true;
      }
      return false;
    }
  },
  // گُوِهٔ فیبوناچی (۳نقطه): قوس‌های فیبوناچی بینِ دو شعاع از رأس
  fibwedge: {
    label: "\u06AF\u064F\u0648\u0650\u0647\u0654 \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC",
    points: 3,
    draw(ctx, d, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 3) return;
      const O = P[0], v1 = { x: P[1].x - O.x, y: P[1].y - O.y }, v2 = { x: P[2].x - O.x, y: P[2].y - O.y };
      style(ctx, d);
      ctx.globalAlpha = 0.7;
      seg(ctx, O.x, O.y, P[1].x, P[1].y);
      seg(ctx, O.x, O.y, P[2].x, P[2].y);
      ctx.globalAlpha = 1;
      (d.levels || [0.236, 0.382, 0.5, 0.618, 0.786, 1]).forEach((r) => {
        const a = { x: O.x + v1.x * r, y: O.y + v1.y * r }, b = { x: O.x + v2.x * r, y: O.y + v2.y * r };
        const cx = O.x + (v1.x + v2.x) / 2 * r * 1.15, cy = O.y + (v1.y + v2.y) / 2 * r * 1.15;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(cx, cy, b.x, b.y);
        ctx.stroke();
        ctx.fillText((r * 100).toFixed(1) + "%", b.x + 3, b.y);
      });
    },
    hit(d, x, y, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 3) return false;
      return distSeg(x, y, P[0].x, P[0].y, P[1].x, P[1].y) < 7 || distSeg(x, y, P[0].x, P[0].y, P[2].x, P[2].y) < 7;
    }
  },
  // ───────── ۴.۵ گان ─────────
  // جعبهٔ گان: شبکهٔ قیمت/زمان + قطرها
  gannbox: {
    label: "\u062C\u0639\u0628\u0647\u0654 \u06AF\u0627\u0646",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const X = Math.min(a.x, b.x), Y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      style(ctx, d);
      ctx.strokeRect(X, Y, w, h);
      ctx.globalAlpha = 0.45;
      GANN_RATIOS.forEach((r) => {
        if (r === 0 || r === 1) return;
        seg(ctx, X, Y + h * r, X + w, Y + h * r);
        seg(ctx, X + w * r, Y, X + w * r, Y + h);
      });
      ctx.globalAlpha = 0.8;
      seg(ctx, X, Y + h, X + w, Y);
      seg(ctx, X, Y, X + w, Y + h);
      ctx.globalAlpha = 1;
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      return x >= Math.min(a.x, b.x) - 7 && x <= Math.max(a.x, b.x) + 7 && y >= Math.min(a.y, b.y) - 7 && y <= Math.max(a.y, b.y) + 7;
    }
  },
  // بادبزنِ گان: شعاع‌ها در زوایای 1×1،2×1،... از p0
  gannfan: {
    label: "\u0628\u0627\u062F\u0628\u0632\u0646\u0650 \u06AF\u0627\u0646",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const ux = b.x - a.x, uy = b.y - a.y;
      style(ctx, d);
      GANN_FAN.forEach((g) => {
        ctx.globalAlpha = g.k === 1 ? 1 : 0.6;
        rayTo(ctx, a.x, a.y, a.x + ux, a.y + uy * g.k, api.W, api.H, false);
        ctx.globalAlpha = 1;
      });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      const ux = b.x - a.x, uy = b.y - a.y;
      return GANN_FAN.some((g) => distLine(x, y, a.x, a.y, a.x + ux, a.y + uy * g.k) < 7 && (x - a.x) * ux >= 0);
    }
  },
  // مربعِ گان: جعبه + شبکهٔ هشتم + قطرها + بیضی‌های هم‌مرکز از p0
  gannsquare: {
    label: "\u0645\u0631\u0628\u0639\u0650 \u06AF\u0627\u0646",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const X = Math.min(a.x, b.x), Y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      style(ctx, d);
      ctx.strokeRect(X, Y, w, h);
      ctx.globalAlpha = 0.4;
      for (let i = 1; i < 8; i++) {
        seg(ctx, X + w * i / 8, Y, X + w * i / 8, Y + h);
        seg(ctx, X, Y + h * i / 8, X + w, Y + h * i / 8);
      }
      ctx.globalAlpha = 0.85;
      seg(ctx, a.x, a.y, b.x, b.y);
      seg(ctx, a.x, b.y, b.x, a.y);
      ctx.globalAlpha = 0.5;
      [0.25, 0.5, 0.75, 1].forEach((r) => {
        ctx.beginPath();
        ctx.ellipse(a.x, a.y, w * r, h * r, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      return x >= Math.min(a.x, b.x) - 7 && x <= Math.max(a.x, b.x) + 7 && y >= Math.min(a.y, b.y) - 7 && y <= Math.max(a.y, b.y) + 7;
    }
  },
  // مربعِ ثابتِ گان: مربعِ واقعی (ضلعِ برابر) + شبکهٔ هشتم + قطرهای ۴۵°
  gannfixed: {
    label: "\u0645\u0631\u0628\u0639\u0650 \u062B\u0627\u0628\u062A\u0650 \u06AF\u0627\u0646",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) || 40, sx = b.x >= a.x ? 1 : -1, sy = b.y >= a.y ? 1 : -1;
      const X = Math.min(a.x, a.x + sx * s), Y = Math.min(a.y, a.y + sy * s);
      style(ctx, d);
      ctx.strokeRect(X, Y, s, s);
      ctx.globalAlpha = 0.4;
      for (let i = 1; i < 8; i++) {
        seg(ctx, X + s * i / 8, Y, X + s * i / 8, Y + s);
        seg(ctx, X, Y + s * i / 8, X + s, Y + s * i / 8);
      }
      ctx.globalAlpha = 0.85;
      seg(ctx, X, Y, X + s, Y + s);
      seg(ctx, X, Y + s, X + s, Y);
      ctx.globalAlpha = 1;
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) || 40, sx = b.x >= a.x ? 1 : -1, sy = b.y >= a.y ? 1 : -1;
      const X = Math.min(a.x, a.x + sx * s), Y = Math.min(a.y, a.y + sy * s);
      return x >= X - 7 && x <= X + s + 7 && y >= Y - 7 && y <= Y + s + 7;
    }
  },
  // ───────── ۴.۶ الگوها ─────────
  // XABCD: پلی‌لاینِ ۵نقطه + نسبت‌های فیبوناچیِ لگ‌ها
  xabcd: { label: "\u0627\u0644\u06AF\u0648\u06CC XABCD", points: 5, draw: drawPattern(["X", "A", "B", "C", "D"], true), hit: hitPoly },
  abcd: { label: "\u0627\u0644\u06AF\u0648\u06CC ABCD", points: 4, draw: drawPattern(["A", "B", "C", "D"], true), hit: hitPoly },
  cypher: { label: "\u0627\u0644\u06AF\u0648\u06CC \u0633\u0627\u06CC\u0641\u0631", points: 5, draw: drawPattern(["X", "A", "B", "C", "D"], true), hit: hitPoly },
  tripattern: {
    label: "\u0645\u062B\u0644\u062B\u0650 \u0627\u0644\u06AF\u0648",
    points: 3,
    draw(ctx, d, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 3) return;
      style(ctx, d);
      ctx.beginPath();
      ctx.moveTo(P[0].x, P[0].y);
      ctx.lineTo(P[1].x, P[1].y);
      ctx.lineTo(P[2].x, P[2].y);
      ctx.closePath();
      ctx.globalAlpha = d.fillOpacity != null ? d.fillOpacity : 0.1;
      ctx.fillStyle = d.fill || d.color || "#2962FF";
      ctx.fill();
      ctx.fillStyle = d.color || "#2962FF";
      ctx.globalAlpha = 1;
      ctx.stroke();
    },
    hit: hitPoly
  },
  hns: { label: "\u0633\u0631 \u0648 \u0634\u0627\u0646\u0647", points: 5, draw: drawPattern(["LS", "H", "RS", "", ""], false), hit: hitPoly },
  ell_impulse: { label: "\u0645\u0648\u062C\u0650 \u0627\u06CC\u0645\u067E\u0627\u0644\u0633\u0650 \u0627\u0644\u06CC\u0648\u062A", points: 6, draw: drawPattern(["0", "1", "2", "3", "4", "5"], false), hit: hitPoly },
  ell_abc: { label: "\u0645\u0648\u062C\u0650 \u0627\u0635\u0644\u0627\u062D\u06CC\u0650 \u0627\u0644\u06CC\u0648\u062A", points: 4, draw: drawPattern(["0", "A", "B", "C"], false), hit: hitPoly },
  // مثلثِ الیوت (ABCDE)
  ell_triangle: { label: "\u0645\u062B\u0644\u062B\u0650 \u0627\u0644\u06CC\u0648\u062A", points: 6, draw: drawPattern(["0", "A", "B", "C", "D", "E"], false), hit: hitPoly },
  // ترکیبِ دوگانهٔ الیوت (WXY)
  ell_wxy: { label: "\u062A\u0631\u06A9\u06CC\u0628\u0650 \u062F\u0648\u06AF\u0627\u0646\u0647\u0654 \u0627\u0644\u06CC\u0648\u062A", points: 4, draw: drawPattern(["0", "W", "X", "Y"], false), hit: hitPoly },
  // ترکیبِ سه‌گانهٔ الیوت (WXYXZ)
  ell_wxyxz: { label: "\u062A\u0631\u06A9\u06CC\u0628\u0650 \u0633\u0647\u200C\u06AF\u0627\u0646\u0647\u0654 \u0627\u0644\u06CC\u0648\u062A", points: 6, draw: drawPattern(["0", "W", "X", "Y", "X", "Z"], false), hit: hitPoly },
  // سه‌حرکت (Three Drives): درایوها + اصلاح‌ها با نسبت‌های فیبوناچی
  threedrives: { label: "\u0627\u0644\u06AF\u0648\u06CC \u0633\u0647\u200C\u062D\u0631\u06A9\u062A", points: 7, draw: drawPattern(["0", "1", "A", "2", "B", "3", "C"], true), hit: hitPoly },
  // خطوطِ دوره‌ای / سیکلِ زمانی: عمودی‌های تکرارشونده با دورهٔ (t1-t0)
  cyclic: {
    label: "\u062E\u0637\u0648\u0637\u0650 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC",
    points: 2,
    draw(ctx, d, api) {
      const per = d.p1.t - d.p0.t;
      if (!per) return;
      style(ctx, d);
      for (let n = 0; n < 60; n++) {
        const xx = api.x(d.p0.t + n * per);
        if (xx == null) continue;
        if (xx > api.W + 4) break;
        seg(ctx, xx, 0, xx, api.H);
      }
    },
    hit(d, x, y, api) {
      const per = d.p1.t - d.p0.t;
      if (!per) return false;
      for (let n = 0; n < 60; n++) {
        const xx = api.x(d.p0.t + n * per);
        if (xx != null && Math.abs(xx - x) < 7) return true;
      }
      return false;
    }
  },
  // خطِ سینوسی: موجِ سینوس بینِ دو لنگر
  sine: {
    label: "\u062E\u0637\u0650 \u0633\u06CC\u0646\u0648\u0633\u06CC",
    points: 2,
    draw(ctx, d, api) {
      const lam = d.p1.t - d.p0.t;
      if (!lam) return;
      const mid = (d.p0.p + d.p1.p) / 2, amp = Math.abs(d.p1.p - d.p0.p) / 2;
      style(ctx, d);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 120; i++) {
        const tt = d.p0.t + lam * (i / 120) * 4;
        const pp = mid + amp * Math.sin(2 * Math.PI * (tt - d.p0.t) / lam);
        const xx = api.x(tt), yy = api.y(pp);
        if (xx == null || yy == null) continue;
        if (!started) {
          ctx.moveTo(xx, yy);
          started = true;
        } else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    },
    hit(d, x, y, api) {
      const lam = d.p1.t - d.p0.t;
      if (!lam) return false;
      const mid = (d.p0.p + d.p1.p) / 2, amp = Math.abs(d.p1.p - d.p0.p) / 2;
      for (let i = 0; i <= 120; i++) {
        const tt = d.p0.t + lam * (i / 120) * 4;
        const pp = mid + amp * Math.sin(2 * Math.PI * (tt - d.p0.t) / lam);
        const xx = api.x(tt), yy = api.y(pp);
        if (xx != null && yy != null && Math.hypot(xx - x, yy - y) < 7) return true;
      }
      return false;
    }
  },
  // چرخه‌های زمانی: نیم‌دایره‌های متوالی در کفِ فریم با دورهٔ (t1-t0)
  timecycles: {
    label: "\u0686\u0631\u062E\u0647\u200C\u0647\u0627\u06CC \u0632\u0645\u0627\u0646\u06CC",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const per = d.p1.t - d.p0.t;
      if (!per) return;
      const r0 = Math.abs(b.x - a.x) / 2 || (api.barWidth() || 6), base = api.H - 2;
      style(ctx, d);
      for (let n = 1; n <= 24; n++) {
        const cx = api.x(d.p0.t + (n - 0.5) * per);
        if (cx == null) continue;
        if (cx - r0 > api.W) break;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(cx, base, r0, Math.PI, 0, false);
        ctx.stroke();
        ctx.globalAlpha = 1;
        const xx = api.x(d.p0.t + n * per);
        if (xx != null) {
          ctx.globalAlpha = 0.25;
          seg(ctx, xx, 0, xx, api.H);
          ctx.globalAlpha = 1;
        }
      }
    },
    hit(d, x, y, api) {
      const per = d.p1.t - d.p0.t;
      if (!per) return false;
      for (let n = 0; n <= 24; n++) {
        const xx = api.x(d.p0.t + n * per);
        if (xx != null && Math.abs(xx - x) < 7) return true;
      }
      return false;
    }
  },
  // ───────── ۴.۷ پروجکشن و اندازه‌گیری ─────────
  // بازهٔ قیمت: براکتِ عمودی + Δقیمت/Δدرصد
  pricerange: {
    label: "\u0628\u0627\u0632\u0647\u0654 \u0642\u06CC\u0645\u062A",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const cx = (a.x + b.x) / 2;
      style(ctx, d);
      seg(ctx, cx, a.y, cx, b.y);
      seg(ctx, cx - 8, a.y, cx + 8, a.y);
      seg(ctx, cx - 8, b.y, cx + 8, b.y);
      const dp = d.p1.p - d.p0.p, pct = d.p0.p ? dp / d.p0.p * 100 : 0;
      const col = dp >= 0 ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)";
      ctx.fillStyle = col;
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x) || 30, Math.abs(b.y - a.y));
      labelBox(ctx, cx, (a.y + b.y) / 2, `${dp.toFixed(api.digits())}
${pct.toFixed(2)}%`, { anchor: "center", border: d.color });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      const cx = (a.x + b.x) / 2;
      return Math.abs(x - cx) < 14 && y >= Math.min(a.y, b.y) - 7 && y <= Math.max(a.y, b.y) + 7;
    }
  },
  // بازهٔ زمان: براکتِ افقی + Δبار/Δزمان
  daterange: {
    label: "\u0628\u0627\u0632\u0647\u0654 \u0632\u0645\u0627\u0646",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const cy = (a.y + b.y) / 2;
      style(ctx, d);
      seg(ctx, a.x, cy, b.x, cy);
      seg(ctx, a.x, cy - 8, a.x, cy + 8);
      seg(ctx, b.x, cy - 8, b.x, cy + 8);
      const bars = Math.round((b.x - a.x) / (api.barWidth() || 6)), dt = Math.abs(d.p1.t - d.p0.t);
      const hh = Math.floor(dt / 3600), dd = Math.floor(dt / 86400);
      labelBox(ctx, (a.x + b.x) / 2, cy, `${Math.abs(bars)} \u0628\u0627\u0631
${dd ? dd + " \u0631\u0648\u0632" : hh + " \u0633\u0627\u0639\u062A"}`, { anchor: "center", border: d.color });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      const cy = (a.y + b.y) / 2;
      return Math.abs(y - cy) < 14 && x >= Math.min(a.x, b.x) - 7 && x <= Math.max(a.x, b.x) + 7;
    }
  },
  // بازهٔ قیمت و زمان: جعبه + هر چهار Δ
  dprange: {
    label: "\u0628\u0627\u0632\u0647\u0654 \u0642\u06CC\u0645\u062A \u0648 \u0632\u0645\u0627\u0646",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const X = Math.min(a.x, b.x), Y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      style(ctx, d);
      ctx.globalAlpha = 0.1;
      ctx.fillRect(X, Y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeRect(X, Y, w, h);
      const dp = d.p1.p - d.p0.p, pct = d.p0.p ? dp / d.p0.p * 100 : 0, bars = Math.round(w / (api.barWidth() || 6)), dt = Math.abs(d.p1.t - d.p0.t);
      const timeStr = dt >= 86400 ? `${Math.floor(dt / 86400)} \u0631\u0648\u0632` : dt >= 3600 ? `${Math.floor(dt / 3600)} \u0633\u0627\u0639\u062A` : `${Math.max(0, Math.floor(dt / 60))} \u062F\u0642\u06CC\u0642\u0647`;
      labelBox(ctx, X + w / 2, Y + h / 2, `${dp.toFixed(api.digits())}  (${pct.toFixed(2)}%)
${Math.abs(bars)} \u0628\u0627\u0631  |  ${timeStr}`, { anchor: "center", border: d.color });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      return x >= Math.min(a.x, b.x) - 7 && x <= Math.max(a.x, b.x) + 7 && y >= Math.min(a.y, b.y) - 7 && y <= Math.max(a.y, b.y) + 7;
    }
  },
  // پیش‌بینی: مخروطِ سایه‌دار از p0 به p1 + Δدرصد
  forecast: {
    label: "\u067E\u06CC\u0634\u200C\u0628\u06CC\u0646\u06CC",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const spread = Math.abs(b.y - a.y) * 0.4 + 10;
      style(ctx, d);
      ctx.fillStyle = d.p1.p >= d.p0.p ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.10)";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y - spread);
      ctx.lineTo(b.x, b.y + spread);
      ctx.closePath();
      ctx.fill();
      dash(ctx, true);
      seg(ctx, a.x, a.y, b.x, b.y);
      dash(ctx, false);
      const pct = d.p0.p ? (d.p1.p - d.p0.p) / d.p0.p * 100 : 0;
      labelBox(ctx, b.x + 4, b.y, `${pct.toFixed(2)}%`, { border: d.color });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      return distSeg(x, y, a.x, a.y, b.x, b.y) < 12;
    }
  },
  // پروجکشن (۳نقطه): لگِ مرجع p0→p1 تصویر می‌شود از p2 (حرکتِ اندازه‌گیری‌شده) + Δدرصد
  projection: {
    label: "\u067E\u0631\u0648\u062C\u06A9\u0634\u0646",
    points: 3,
    draw(ctx, d, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 3) return;
      style(ctx, d);
      ctx.globalAlpha = 0.7;
      seg(ctx, P[0].x, P[0].y, P[1].x, P[1].y);
      ctx.globalAlpha = 1;
      const dx = P[1].x - P[0].x, dy = P[1].y - P[0].y, tip = { x: P[2].x + dx, y: P[2].y + dy };
      const up = d.pts[1].p - d.pts[0].p >= 0;
      ctx.fillStyle = up ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.10)";
      ctx.beginPath();
      ctx.moveTo(P[2].x, P[2].y);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(tip.x, P[2].y);
      ctx.closePath();
      ctx.fill();
      dash(ctx, true);
      seg(ctx, P[2].x, P[2].y, tip.x, tip.y);
      dash(ctx, false);
      const pct = d.pts[0].p ? (d.pts[1].p - d.pts[0].p) / d.pts[0].p * 100 : 0;
      labelBox(ctx, tip.x + 4, tip.y, `${pct.toFixed(2)}%`, { border: d.color });
    },
    hit(d, x, y, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 3) return false;
      const dx = P[1].x - P[0].x, dy = P[1].y - P[0].y;
      return distSeg(x, y, P[0].x, P[0].y, P[1].x, P[1].y) < 8 || distSeg(x, y, P[2].x, P[2].y, P[2].x + dx, P[2].y + dy) < 8;
    }
  },
  // خطِ روندِ قیمت‌ـزمان (ruler/measure سریع) — مثلِ بازهٔ کامل اما با نمایشِ پیوسته
  ruler: {
    label: "\u062E\u0637\u200C\u06A9\u0634 (\u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC)",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      style(ctx, d);
      dash(ctx, true);
      seg(ctx, a.x, a.y, b.x, b.y);
      dash(ctx, false);
      const dp = d.p1.p - d.p0.p, pct = d.p0.p ? dp / d.p0.p * 100 : 0, bars = Math.round((b.x - a.x) / (api.barWidth() || 6));
      const dt = Math.abs((d.p1.t || 0) - (d.p0.t || 0));
      const timeStr = dt >= 86400 ? `${Math.floor(dt / 86400)} \u0631\u0648\u0632` : dt >= 3600 ? `${Math.floor(dt / 3600)} \u0633\u0627\u0639\u062A` : `${Math.max(0, Math.floor(dt / 60))} \u062F\u0642\u06CC\u0642\u0647`;
      ctx.fillStyle = dp >= 0 ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)";
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      labelBox(ctx, b.x, b.y, `${dp >= 0 ? "\u25B2" : "\u25BC"} ${Math.abs(dp).toFixed(api.digits())} (${pct.toFixed(2)}%)
${Math.abs(bars)} \u0628\u0627\u0631  \xB7  ${timeStr}`, { anchor: "above", bg: dp >= 0 ? "rgba(22,101,52,.92)" : "rgba(127,29,29,.92)" });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      return distSeg(x, y, a.x, a.y, b.x, b.y) < 8;
    }
  },
  // ───────── ۴.۸ اشکال ─────────
  // دایره (به‌صورتِ بیضیِ محاطِ مربع‌شده)
  circle: {
    label: "\u062F\u0627\u06CC\u0631\u0647",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const r = Math.hypot(b.x - a.x, b.y - a.y);
      style(ctx, d);
      ctx.globalAlpha = d.fillOpacity != null ? d.fillOpacity : 0.1;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.fillStyle = d.fill || d.color || "#2962FF";
      ctx.fill();
      ctx.fillStyle = d.color || "#2962FF";
      ctx.globalAlpha = 1;
      ctx.stroke();
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      const r = Math.hypot(b.x - a.x, b.y - a.y);
      return Math.abs(Math.hypot(x - a.x, y - a.y) - r) < 8;
    }
  },
  // بیضیِ محاطِ جعبه
  ellipse: {
    label: "\u0628\u06CC\u0636\u06CC",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
      style(ctx, d);
      ctx.globalAlpha = d.fillOpacity != null ? d.fillOpacity : 0.1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = d.fill || d.color || "#2962FF";
      ctx.fill();
      ctx.fillStyle = d.color || "#2962FF";
      ctx.globalAlpha = 1;
      ctx.stroke();
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, rx = Math.abs(b.x - a.x) / 2 || 1, ry = Math.abs(b.y - a.y) / 2 || 1;
      const e = Math.hypot((x - cx) / rx, (y - cy) / ry);
      return Math.abs(e - 1) < 0.12;
    }
  },
  // مثلث (۳ رأس)
  triangle: {
    label: "\u0645\u062B\u0644\u062B",
    points: 3,
    draw(ctx, d, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 3) return;
      style(ctx, d);
      ctx.beginPath();
      ctx.moveTo(P[0].x, P[0].y);
      ctx.lineTo(P[1].x, P[1].y);
      ctx.lineTo(P[2].x, P[2].y);
      ctx.closePath();
      ctx.globalAlpha = d.fillOpacity != null ? d.fillOpacity : 0.1;
      ctx.fillStyle = d.fill || d.color || "#2962FF";
      ctx.fill();
      ctx.fillStyle = d.color || "#2962FF";
      ctx.globalAlpha = 1;
      ctx.stroke();
    },
    hit: hitPoly
  },
  // مستطیلِ چرخیده (۳نقطه: جهت از p0→p1، عرض از p2)
  rotrect: {
    label: "\u0645\u0633\u062A\u0637\u06CC\u0644\u0650 \u0686\u0631\u062E\u06CC\u062F\u0647",
    points: 3,
    draw(ctx, d, api) {
      const P = d.pts.map((p) => px(api, p));
      if (P.some((p) => !ok(p)) || P.length < 3) return;
      const ux = P[1].x - P[0].x, uy = P[1].y - P[0].y, L = Math.hypot(ux, uy) || 1;
      const nx = -uy / L, ny = ux / L;
      const w = (P[2].x - P[0].x) * nx + (P[2].y - P[0].y) * ny;
      const c = [P[0], P[1], { x: P[1].x + nx * w, y: P[1].y + ny * w }, { x: P[0].x + nx * w, y: P[0].y + ny * w }];
      style(ctx, d);
      ctx.beginPath();
      ctx.moveTo(c[0].x, c[0].y);
      c.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.globalAlpha = d.fillOpacity != null ? d.fillOpacity : 0.1;
      ctx.fillStyle = d.fill || d.color || "#2962FF";
      ctx.fill();
      ctx.fillStyle = d.color || "#2962FF";
      ctx.globalAlpha = 1;
      ctx.stroke();
    },
    hit: hitPoly
  },
  // پیکان (p0→p1 با سرِ پیکان)
  arrow: {
    label: "\u067E\u06CC\u06A9\u0627\u0646",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      style(ctx, d);
      seg(ctx, a.x, a.y, b.x, b.y);
      arrowHead(ctx, a.x, a.y, b.x, b.y, 12);
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return false;
      return distSeg(x, y, a.x, a.y, b.x, b.y) < 8;
    }
  },
  // قلم‌مو / آزاد: پلی‌لاینِ نرمِ نمونه‌برداری‌شده (d.pts با چند نقطه)
  brush: {
    label: "\u0642\u0644\u0645\u200C\u0645\u0648\u06CC \u0622\u0632\u0627\u062F",
    points: -1,
    freehand: true,
    draw(ctx, d, api) {
      if (!d.pts || d.pts.length < 2) return;
      style(ctx, d);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      let started = false;
      d.pts.forEach((pt) => {
        const P = px(api, pt);
        if (!ok(P)) return;
        if (!started) {
          ctx.moveTo(P.x, P.y);
          started = true;
        } else ctx.lineTo(P.x, P.y);
      });
      ctx.stroke();
    },
    hit(d, x, y, api) {
      if (!d.pts) return false;
      for (let i = 1; i < d.pts.length; i++) {
        const a = px(api, d.pts[i - 1]), b = px(api, d.pts[i]);
        if (ok(a) && ok(b) && distSeg(x, y, a.x, a.y, b.x, b.y) < 7) return true;
      }
      return false;
    }
  },
  // ماژیک / های‌لایتر: قلم‌موی ضخیمِ نیمه‌شفاف
  highlighter: {
    label: "\u0647\u0627\u06CC\u200C\u0644\u0627\u06CC\u062A\u0631",
    points: -1,
    freehand: true,
    draw(ctx, d, api) {
      if (!d.pts || d.pts.length < 2) return;
      ctx.strokeStyle = d.color || "#facc15";
      ctx.lineWidth = d.width || 12;
      ctx.globalAlpha = 0.3;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      dash(ctx, false);
      ctx.beginPath();
      let started = false;
      d.pts.forEach((pt) => {
        const P = px(api, pt);
        if (!ok(P)) return;
        if (!started) {
          ctx.moveTo(P.x, P.y);
          started = true;
        } else ctx.lineTo(P.x, P.y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
    hit(d, x, y, api) {
      if (!d.pts) return false;
      for (let i = 1; i < d.pts.length; i++) {
        const a = px(api, d.pts[i - 1]), b = px(api, d.pts[i]);
        if (ok(a) && ok(b) && distSeg(x, y, a.x, a.y, b.x, b.y) < 8) return true;
      }
      return false;
    }
  },
  // ───────── ۴.۹ یادداشت‌ها ─────────
  // کال‌اوت: حبابِ متن + خطِ راهنما به نقطهٔ هدف
  callout: {
    label: "\u06A9\u0627\u0644\u200C\u0627\u0648\u062A",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0), b = px(api, d.p1);
      if (!ok(a) || !ok(b)) return;
      style(ctx, d);
      seg(ctx, a.x, a.y, b.x, b.y);
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
      labelBox(ctx, a.x, a.y, d.text || "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A", { border: d.color, bg: "rgba(20,24,33,.95)" });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return false;
      return Math.hypot(x - a.x, y - a.y) < 40;
    }
  },
  // برچسبِ قیمت: تگِ چسبیده به اسکیلِ راست
  pricelabel: {
    label: "\u0628\u0631\u0686\u0633\u0628\u0650 \u0642\u06CC\u0645\u062A",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return;
      style(ctx, d);
      dash(ctx, true);
      seg(ctx, 0, a.y, api.W, a.y);
      dash(ctx, false);
      const txt = (d.text ? d.text + "  " : "") + d.p0.p.toFixed(api.digits());
      ctx.font = "11px IRANYekanX, Ravagh, Vazirmatn, sans-serif";
      const w = ctx.measureText(txt).width + 12;
      ctx.fillStyle = d.color || "#2962FF";
      ctx.fillRect(api.W - w, a.y - 9, w, 18);
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, api.W - w + 6, a.y);
      ctx.textBaseline = "alphabetic";
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return false;
      return Math.abs(y - a.y) < 7;
    }
  },
  // یادداشت/نوت: نشانگرِ کوچک که با hover متن را نشان می‌دهد (اینجا همیشه نمایش)
  note: {
    label: "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return;
      style(ctx, d);
      ctx.beginPath();
      ctx.arc(a.x, a.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("i", a.x, a.y + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      if (d.text) labelBox(ctx, a.x + 12, a.y - 8, d.text, { border: d.color });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return false;
      return Math.hypot(x - a.x, y - a.y) < 10;
    }
  },
  // پیکانِ جهت‌دار (گلیفِ تک‌لنگر): up/down/left/right
  arrowdir: {
    label: "\u067E\u06CC\u06A9\u0627\u0646\u0650 \u062C\u0647\u062A\u200C\u062F\u0627\u0631",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return;
      style(ctx, d);
      const dir = d.dir || "up", s = 14;
      const ends = { up: [0, -s], down: [0, s], left: [-s, 0], right: [s, 0] }[dir] || [0, -s];
      seg(ctx, a.x - ends[0], a.y - ends[1], a.x, a.y);
      arrowHead(ctx, a.x - ends[0], a.y - ends[1], a.x, a.y, 12);
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return false;
      return Math.hypot(x - a.x, y - a.y) < 16;
    }
  },
  // پرچمِ نشانه (گلیفِ تک‌لنگر) — هم‌ترازِ «Flag Mark»ِ TV: میله + بادبانِ مثلثیِ رنگی روی نقطهٔ لنگر.
  flag: {
    label: "\u067E\u0631\u0686\u0645\u0650 \u0646\u0634\u0627\u0646\u0647",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return;
      style(ctx, d);
      const H = 18, W = 11;
      const topY = a.y - H;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x, topY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.x, topY);
      ctx.lineTo(a.x + W, topY + 4);
      ctx.lineTo(a.x, topY + 8);
      ctx.closePath();
      ctx.fillStyle = d.color || "#2962FF";
      ctx.fill();
      if (d.text) labelBox(ctx, a.x + W + 4, topY - 2, d.text, { border: d.color });
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return false;
      return Math.hypot(x - a.x, y - (a.y - 9)) < 14;
    }
  },
  // تابلوِ راهنما (Signpost) — تک‌لنگر: میله + تابلوِ رنگی با نوکِ پیکانی و متن (هم‌ترازِ Signpostِ TV).
  signpost: {
    label: "\u062A\u0627\u0628\u0644\u0648\u0650 \u0631\u0627\u0647\u0646\u0645\u0627",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return;
      style(ctx, d);
      const H = 22, topY = a.y - H;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x, topY);
      ctx.stroke();
      const txt = (d.text || "\u0631\u0627\u0647\u0646\u0645\u0627").replace(/\\n|[\r\n]/g, " ");
      ctx.font = "11px IRANYekanX, Ravagh, Vazirmatn, sans-serif";
      const w = ctx.measureText(txt).width + 18;
      ctx.fillStyle = d.color || "#2962FF";
      ctx.beginPath();
      ctx.moveTo(a.x + 7, topY - 9);
      ctx.lineTo(a.x + 7 + w, topY - 9);
      ctx.lineTo(a.x + 7 + w, topY + 9);
      ctx.lineTo(a.x + 7, topY + 9);
      ctx.lineTo(a.x, topY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(txt, a.x + 15, topY);
      ctx.textBaseline = "alphabetic";
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return false;
      return Math.abs(x - a.x) < 7 && y <= a.y && y >= a.y - 22 || Math.hypot(x - (a.x + 20), y - (a.y - 22)) < 18;
    }
  },
  // نشانگرِ فلشِ رو‌به‌بالا (Arrow mark up) — تک‌لنگر: فلشِ پُرِ رو‌به‌بالا (سیگنالِ خرید). متمایز از arrowdirِ خطی.
  arrowup: {
    label: "\u0646\u0634\u0627\u0646\u06AF\u0631\u0650 \u0641\u0644\u0634\u0650 \u0628\u0627\u0644\u0627",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return;
      const s = 9;
      ctx.fillStyle = d.color || "#089981";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - s);
      ctx.lineTo(a.x + s, a.y + 2);
      ctx.lineTo(a.x + 3, a.y + 2);
      ctx.lineTo(a.x + 3, a.y + s + 4);
      ctx.lineTo(a.x - 3, a.y + s + 4);
      ctx.lineTo(a.x - 3, a.y + 2);
      ctx.lineTo(a.x - s, a.y + 2);
      ctx.closePath();
      ctx.fill();
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return false;
      return Math.hypot(x - a.x, y - a.y) < 14;
    }
  },
  // نشانگرِ فلشِ رو‌به‌پایین (Arrow mark down) — تک‌لنگر: فلشِ پُرِ رو‌به‌پایین (سیگنالِ فروش).
  arrowdown: {
    label: "\u0646\u0634\u0627\u0646\u06AF\u0631\u0650 \u0641\u0644\u0634\u0650 \u067E\u0627\u06CC\u06CC\u0646",
    points: 2,
    draw(ctx, d, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return;
      const s = 9;
      ctx.fillStyle = d.color || "#f23645";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + s);
      ctx.lineTo(a.x + s, a.y - 2);
      ctx.lineTo(a.x + 3, a.y - 2);
      ctx.lineTo(a.x + 3, a.y - s - 4);
      ctx.lineTo(a.x - 3, a.y - s - 4);
      ctx.lineTo(a.x - 3, a.y - 2);
      ctx.lineTo(a.x - s, a.y - 2);
      ctx.closePath();
      ctx.fill();
    },
    hit(d, x, y, api) {
      const a = px(api, d.p0);
      if (!ok(a)) return false;
      return Math.hypot(x - a.x, y - a.y) < 14;
    }
  },
  // خطِ چندتکه (Polyline) — چند-نقطه‌ایِ باز: کلیک برای هر رأس، دابل‌کلیک/Enter برای پایان (هم‌ترازِ Polylineِ TV).
  //   points:-1 و freehand نیست ⇒ در DrawingLayer.down شاخهٔ اختصاصی نقاط را جمع می‌کند. handleها از مسیرِ عمومیِ pts می‌آیند.
  polyline: {
    label: "\u062E\u0637\u0650 \u0686\u0646\u062F\u062A\u06A9\u0647",
    points: -1,
    draw(ctx, d, api) {
      const P = (d.pts || []).map((p) => px(api, p)).filter(ok);
      if (P.length < 2) return;
      style(ctx, d);
      ctx.beginPath();
      ctx.moveTo(P[0].x, P[0].y);
      for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y);
      ctx.stroke();
    },
    hit(d, x, y, api) {
      const P = (d.pts || []).map((p) => px(api, p));
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], bb = P[i + 1];
        if (!ok(a) || !ok(bb)) continue;
        const C = bb.x - a.x, D = bb.y - a.y, len = C * C + D * D;
        const t = len ? Math.max(0, Math.min(1, ((x - a.x) * C + (y - a.y) * D) / len)) : 0;
        if (Math.hypot(x - (a.x + t * C), y - (a.y + t * D)) < 6) return true;
      }
      return false;
    }
  },
  // مسیرِ پیکان‌دار (Path) — مثلِ polyline ولی با سرپیکان در انتها. جمعِ نقاط در DrawingLayer.down با polyline مشترک است.
  path: {
    label: "\u0645\u0633\u06CC\u0631\u0650 \u067E\u06CC\u06A9\u0627\u0646\u200C\u062F\u0627\u0631",
    points: -1,
    draw(ctx, d, api) {
      const P = (d.pts || []).map((p) => px(api, p)).filter(ok);
      if (P.length < 2) return;
      style(ctx, d);
      ctx.beginPath();
      ctx.moveTo(P[0].x, P[0].y);
      for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y);
      ctx.stroke();
      const a = P[P.length - 2], bb = P[P.length - 1];
      arrowHead(ctx, a.x, a.y, bb.x, bb.y, 13);
    },
    hit(d, x, y, api) {
      const P = (d.pts || []).map((p) => px(api, p));
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], bb = P[i + 1];
        if (!ok(a) || !ok(bb)) continue;
        const C = bb.x - a.x, D = bb.y - a.y, len = C * C + D * D;
        const t = len ? Math.max(0, Math.min(1, ((x - a.x) * C + (y - a.y) * D) / len)) : 0;
        if (Math.hypot(x - (a.x + t * C), y - (a.y + t * D)) < 6) return true;
      }
      return false;
    }
  },
  // منحنی (Curve/quadratic bezier) — ۳ نقطه: آغاز · کنترل · پایان (points:3 ⇒ در EXT_NEED، جمعِ خودکارِ نقاط).
  curve: {
    label: "\u0645\u0646\u062D\u0646\u06CC",
    points: 3,
    draw(ctx, d, api) {
      const P = (d.pts || []).map((p) => px(api, p));
      if (P.length < 3 || P.some((q) => !ok(q))) return;
      style(ctx, d);
      ctx.beginPath();
      ctx.moveTo(P[0].x, P[0].y);
      ctx.quadraticCurveTo(P[1].x, P[1].y, P[2].x, P[2].y);
      ctx.stroke();
    },
    hit(d, x, y, api) {
      return bezierHit((d.pts || []).map((p) => px(api, p)), x, y, 2);
    }
  },
  // منحنیِ دوگانه (Double curve/cubic bezier) — ۴ نقطه: آغاز · کنترل۱ · کنترل۲ · پایان (points:4).
  doublecurve: {
    label: "\u0645\u0646\u062D\u0646\u06CC\u0650 \u062F\u0648\u06AF\u0627\u0646\u0647",
    points: 4,
    draw(ctx, d, api) {
      const P = (d.pts || []).map((p) => px(api, p));
      if (P.length < 4 || P.some((q) => !ok(q))) return;
      style(ctx, d);
      ctx.beginPath();
      ctx.moveTo(P[0].x, P[0].y);
      ctx.bezierCurveTo(P[1].x, P[1].y, P[2].x, P[2].y, P[3].x, P[3].y);
      ctx.stroke();
    },
    hit(d, x, y, api) {
      return bezierHit((d.pts || []).map((p) => px(api, p)), x, y, 3);
    }
  },
  // کمان (Arc) — ۳ نقطه: آغاز · میانی (کنترلِ خمیدگی) · پایان؛ کمانِ دایره‌ایِ گذرنده از هر سه (points:3).
  arc: {
    label: "\u06A9\u0645\u0627\u0646",
    points: 3,
    draw(ctx, d, api) {
      const P = (d.pts || []).map((p) => px(api, p));
      if (P.length < 3 || P.some((q) => !ok(q))) return;
      style(ctx, d);
      const S = arcPoints(P[0], P[1], P[2], 30);
      ctx.beginPath();
      ctx.moveTo(S[0].x, S[0].y);
      for (let i = 1; i < S.length; i++) ctx.lineTo(S[i].x, S[i].y);
      ctx.stroke();
    },
    hit(d, x, y, api) {
      const P = (d.pts || []).map((p) => px(api, p));
      if (P.length < 3 || P.some((q) => !ok(q))) return false;
      const S = arcPoints(P[0], P[1], P[2], 30);
      for (let i = 0; i < S.length - 1; i++) {
        const a = S[i], bb = S[i + 1], C = bb.x - a.x, D = bb.y - a.y, len = C * C + D * D;
        const t = len ? Math.max(0, Math.min(1, ((x - a.x) * C + (y - a.y) * D) / len)) : 0;
        if (Math.hypot(x - (a.x + t * C), y - (a.y + t * D)) < 6) return true;
      }
      return false;
    }
  }
};
function drawPattern(labels, ratios) {
  return function(ctx, d, api) {
    const P = d.pts.map((p) => px(api, p));
    if (P.some((p) => !ok(p)) || P.length < 2) return;
    style(ctx, d);
    ctx.beginPath();
    ctx.moveTo(P[0].x, P[0].y);
    P.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.globalAlpha = 0.06;
    for (let i = 0; i + 2 < P.length; i++) {
      ctx.beginPath();
      ctx.moveTo(P[i].x, P[i].y);
      ctx.lineTo(P[i + 1].x, P[i + 1].y);
      ctx.lineTo(P[i + 2].x, P[i + 2].y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    P.forEach((p, i) => {
      const lb = labels[i];
      if (!lb) return;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = d.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = d.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 10px IRANYekanX, Ravagh, Vazirmatn, sans-serif";
      ctx.fillText(lb, p.x, p.y + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    });
    if (ratios) {
      for (let i = 1; i + 1 < d.pts.length; i++) {
        const leg1 = Math.abs(d.pts[i].p - d.pts[i - 1].p), leg2 = Math.abs(d.pts[i + 1].p - d.pts[i].p);
        const r = leg1 ? leg2 / leg1 : 0;
        const mx = (P[i].x + P[i + 1].x) / 2, my = (P[i].y + P[i + 1].y) / 2;
        ctx.fillStyle = d.color;
        ctx.font = "10px IRANYekanX, Ravagh, Vazirmatn, sans-serif";
        ctx.fillText(r.toFixed(3), mx + 4, my);
      }
    }
  };
}
function hitPoly(d, x, y, api) {
  if (!d.pts) return false;
  for (let i = 1; i < d.pts.length; i++) {
    const a = px(api, d.pts[i - 1]), b = px(api, d.pts[i]);
    if (ok(a) && ok(b) && distSeg(x, y, a.x, a.y, b.x, b.y) < 7) return true;
  }
  return false;
}
function drawFork(mode) {
  return function(ctx, d, api) {
    const P = d.pts.map((p) => px(api, p));
    if (P.some((p) => !ok(p)) || P.length < 3) return;
    const mid = { x: (P[1].x + P[2].x) / 2, y: (P[1].y + P[2].y) / 2 };
    let O = P[0], A1 = P[1], A2 = P[2];
    if (mode === "schiff") O = { x: P[0].x, y: (P[0].y + mid.y) / 2 };
    else if (mode === "modschiff") O = { x: (P[0].x + mid.x) / 2, y: (P[0].y + mid.y) / 2 };
    else if (mode === "inside") {
      A1 = { x: (P[0].x + P[1].x) / 2, y: (P[0].y + P[1].y) / 2 };
      A2 = { x: (P[0].x + P[2].x) / 2, y: (P[0].y + P[2].y) / 2 };
    }
    const dx = mid.x - O.x, dy = mid.y - O.y;
    style(ctx, d);
    rayTo(ctx, O.x, O.y, mid.x, mid.y, api.W, api.H, false);
    ctx.globalAlpha = 0.85;
    rayTo(ctx, A1.x, A1.y, A1.x + dx, A1.y + dy, api.W, api.H, false);
    rayTo(ctx, A2.x, A2.y, A2.x + dx, A2.y + dy, api.W, api.H, false);
    ctx.globalAlpha = 0.6;
    seg(ctx, A1.x, A1.y, A2.x, A2.y);
    ctx.globalAlpha = 1;
  };
}
function hitFork(d, x, y, api) {
  const P = d.pts.map((p) => px(api, p));
  if (P.some((p) => !ok(p)) || P.length < 3) return false;
  const mid = { x: (P[1].x + P[2].x) / 2, y: (P[1].y + P[2].y) / 2 }, dx = mid.x - P[0].x, dy = mid.y - P[0].y;
  return distLine(x, y, P[0].x, P[0].y, mid.x, mid.y) < 7 || distLine(x, y, P[1].x, P[1].y, P[1].x + dx, P[1].y + dy) < 7 || distLine(x, y, P[2].x, P[2].y, P[2].x + dx, P[2].y + dy) < 7;
}
var SINGLE_ANCHOR = /* @__PURE__ */ new Set(["hray", "crossline", "pricelabel", "note", "arrowdir", "flag", "signpost", "arrowup", "arrowdown"]);
var EXT_NEED = (() => {
  const m = {};
  Object.entries(EXT_REGISTRY).forEach(([k, v]) => {
    if (v.points >= 3) m[k] = v.points;
  });
  return m;
})();
var EXT_DRAG2 = Object.entries(EXT_REGISTRY).filter(([, v]) => v.points === 2).map(([k]) => k);
var EXT_FREEHAND = Object.entries(EXT_REGISTRY).filter(([, v]) => v.freehand).map(([k]) => k);
var EXT_LABELS = (() => {
  const m = {};
  Object.entries(EXT_REGISTRY).forEach(([k, v]) => {
    m[k] = v.label;
  });
  return m;
})();
var isExt = (type) => Object.prototype.hasOwnProperty.call(EXT_REGISTRY, type);
function extApi(layer) {
  return {
    x: (t) => layer._x(t),
    y: (p) => layer._y(p),
    t: (x) => layer._t(x),
    p: (y) => layer._p(y),
    barWidth: () => layer._barWidth(),
    digits: () => layer && Number.isFinite(layer.digits) ? layer.digits : 5,
    // دقتِ اعشارِ نمادِ فعال برای برچسبِ ابزارِ اندازه‌گیری (پیش‌فرض ۵ = رفتارِ قبلی)
    timeFmt: (t) => {
      try {
        return layer.timeFmt ? String(layer.timeFmt(t) || "") : "";
      } catch (e) {
        return "";
      }
    },
    // فرمترِ زمانِ tz-aware برای برچسبِ تاریخِ خطِ صلیبی (#282)
    get W() {
      return layer.canvas.width;
    },
    get H() {
      return layer.canvas.height;
    },
    candles: layer.candles
  };
}
function extDraw(ctx, d, layer) {
  const e = EXT_REGISTRY[d.type];
  if (!e) return false;
  if (d.visible === false) return true;
  e.draw(ctx, d, extApi(layer));
  return true;
}
function extHit(d, x, y, layer) {
  const e = EXT_REGISTRY[d.type];
  if (!e || !e.hit) return false;
  return e.hit(d, x, y, extApi(layer));
}
function extHandles(d, layer) {
  const api = extApi(layer);
  if (SINGLE_ANCHOR.has(d.type) && d.p0) return [{ x: api.x(d.p0.t), y: api.y(d.p0.p), set: (t, p) => {
    d.p0 = { t, p };
  } }];
  return null;
}

// src/bazaarnama/drawing_history.js
var clone = (value) => JSON.parse(JSON.stringify(value));
var DrawingHistory = class {
  constructor(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError("history limit must be a positive integer");
    this.limit = limit;
    this.past = [];
    this.future = [];
  }
  record(current) {
    this.past.push(clone(current));
    if (this.past.length > this.limit) this.past.splice(0, this.past.length - this.limit);
    this.future.length = 0;
  }
  undo(current) {
    if (!this.past.length) return null;
    this.future.push(clone(current));
    return clone(this.past.pop());
  }
  redo(current) {
    if (!this.future.length) return null;
    this.past.push(clone(current));
    return clone(this.future.pop());
  }
  canUndo() {
    return this.past.length > 0;
  }
  canRedo() {
    return this.future.length > 0;
  }
};

// src/bazaarnama/drawings.js
var FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
var FIB_COLORS = ["#787b86", "#f23645", "#81c784", "#4caf50", "#089981", "#64b5f6", "#787b86"];
var DrawingLayer = class {
  constructor(canvas, chart) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.chart = chart;
    this.series = null;
    this.tool = "cursor";
    this.color = "#2962FF";
    this.toolDefaults = {};
    this.digits = 5;
    this.drawings = [];
    this.tmp = null;
    this.dragging = false;
    this.onChange = null;
    this.profile = null;
    this.script = null;
    this.selected = -1;
    this.multiSel = /* @__PURE__ */ new Set();
    this.marquee = null;
    this.candles = null;
    this.magnet = false;
    this.magnetMode = "strong";
    this.pending = null;
    this.order = null;
    this.onOrder = null;
    this.dragOrder = null;
    this.dragHandle = null;
    this.dragMove = null;
    this.hover = -1;
    this.onSelect = null;
    this.stayInMode = false;
    this._history = new DrawingHistory(100);
    this._undo = this._history.past;
    this._redo = this._history.future;
    this._bind();
  }
  // برچسبِ فارسیِ نوعِ ترسیم (برای Object Tree)
  static label(type) {
    return { trend: "\u062E\u0637\u0650 \u0631\u0648\u0646\u062F", ray: "\u067E\u0631\u062A\u0648", hline: "\u062E\u0637\u0650 \u0627\u0641\u0642\u06CC", vline: "\u062E\u0637\u0650 \u0639\u0645\u0648\u062F\u06CC", rect: "\u0645\u0633\u062A\u0637\u06CC\u0644", fib: "\u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC", fibext: "\u0641\u06CC\u0628\u0648\u06CC \u06AF\u0633\u062A\u0631\u0634\u06CC", longshort: "\u0645\u0648\u0642\u0639\u06CC\u062A\u0650 \u0644\u0627\u0646\u06AF", short: "\u0645\u0648\u0642\u0639\u06CC\u062A\u0650 \u0634\u0648\u0631\u062A", text: "\u0645\u062A\u0646", channel: "\u06A9\u0627\u0646\u0627\u0644", pitchfork: "\u0686\u0646\u06AF\u0627\u0644" }[type] || EXT_LABELS[type] || type;
  }
  // snapshotِ عمیق برای undo/redo
  _snapshot() {
    return JSON.parse(JSON.stringify(this.drawings));
  }
  _pushUndo() {
    this._history.record(this.drawings);
  }
  undo() {
    const next = this._history.undo(this.drawings);
    if (!next) return;
    this.drawings = next;
    this.selected = -1;
    this.multiSel = /* @__PURE__ */ new Set();
    this._changed();
    this.onSelect && this.onSelect(-1);
  }
  redo() {
    const next = this._history.redo(this.drawings);
    if (!next) return;
    this.drawings = next;
    this.selected = -1;
    this.multiSel = /* @__PURE__ */ new Set();
    this._changed();
    this.onSelect && this.onSelect(-1);
  }
  canUndo() {
    return this._history.canUndo();
  }
  canRedo() {
    return this._history.canRedo();
  }
  // ── API برای Object Tree / نوارِ استایل ──
  selectAt(i) {
    this.selected = i >= 0 && i < this.drawings.length ? i : -1;
    this.render();
    this.onSelect && this.onSelect(this.selected);
  }
  getSelected() {
    return this.selected >= 0 ? this.drawings[this.selected] : null;
  }
  // فرمان‌های صفحه‌کلید فقط از dispatcher سراسری BazaarNama وارد می‌شوند. این دو
  // متد رفتارهای داخلی Canvas را بدون نصب keydown دوم در اختیار آن dispatcher می‌گذارند.
  cancelInteraction() {
    this.selected = -1;
    this.multiSel = /* @__PURE__ */ new Set();
    this.marquee = null;
    this.pending = null;
    this.tmp = null;
    this.twoClick = false;
    this.dragging = false;
    this.measuring = false;
    this.render();
    this.onSelect && this.onSelect(-1);
  }
  nudgeSelected(key, large = false) {
    if (this.selected < 0) return false;
    const d = this.drawings[this.selected];
    if (!d || d.locked) return false;
    const h = this._handlePoints(d).find((p) => p.x != null && p.y != null);
    if (!h) return false;
    const step = large ? 8 : 1;
    let dt = 0, dp = 0;
    if (key === "ArrowUp") dp = this._p(h.y - step) - this._p(h.y);
    else if (key === "ArrowDown") dp = this._p(h.y + step) - this._p(h.y);
    else if (key === "ArrowLeft") dt = this._t(h.x - step) - this._t(h.x);
    else if (key === "ArrowRight") dt = this._t(h.x + step) - this._t(h.x);
    else return false;
    if (!Number.isFinite(dt) || !Number.isFinite(dp) || !dt && !dp) return false;
    this._pushUndo();
    this._moveBy(d, dt, dp);
    this._changed();
    return true;
  }
  // انتخابِ همهٔ ترسیم‌های قفل‌نشده (Ctrl+Aِ TV) — به multiSel می‌ریزد تا move/delete/styleِ گروهی کار کند.
  selectAll() {
    this.multiSel = /* @__PURE__ */ new Set();
    for (let i = 0; i < this.drawings.length; i++) {
      const d = this.drawings[i];
      if (d && !d.locked && d.visible !== false) this.multiSel.add(i);
    }
    if (this.multiSel.size <= 1) {
      this.selected = this.multiSel.size ? [...this.multiSel][0] : -1;
      this.multiSel = /* @__PURE__ */ new Set();
    } else this.selected = [...this.multiSel][0];
    this.render();
    this.onSelect && this.onSelect(this.selected);
  }
  removeAt(i) {
    if (i < 0 || i >= this.drawings.length) return;
    this._pushUndo();
    this.multiSel = /* @__PURE__ */ new Set();
    this.drawings.splice(i, 1);
    if (this.selected === i) this.selected = -1;
    else if (this.selected > i) this.selected--;
    this._changed();
    this.onSelect && this.onSelect(this.selected);
  }
  // حذفِ گروهیِ چند-انتخاب (Ctrl+کلیک) — splice نزولی تا ایندکس‌ها معتبر بمانند.
  removeSelected() {
    const idxs = [...this.multiSel];
    if (this.selected >= 0) idxs.push(this.selected);
    const uniq = [...new Set(idxs)].filter((i) => i >= 0 && i < this.drawings.length).sort((a, b) => b - a);
    if (!uniq.length) return;
    this._pushUndo();
    uniq.forEach((i) => this.drawings.splice(i, 1));
    this.multiSel = /* @__PURE__ */ new Set();
    this.selected = -1;
    this._changed();
    this.onSelect && this.onSelect(-1);
  }
  toggleVisible(i) {
    const d = this.drawings[i];
    if (!d) return;
    this._pushUndo();
    d.visible = d.visible === false;
    this._changed();
  }
  toggleLock(i) {
    const d = this.drawings[i];
    if (!d) return;
    this._pushUndo();
    d.locked = !d.locked;
    this._changed();
  }
  setStyle(i, st) {
    const d = this.drawings[i];
    if (!d) return;
    this._pushUndo();
    const grp = this.multiSel.size > 1 && this.multiSel.has(i) && !("text" in st);
    const targets = grp ? [...this.multiSel] : [i];
    targets.forEach((k) => {
      const dd = this.drawings[k];
      if (dd) Object.assign(dd, st);
    });
    this._changed();
  }
  setStayInMode(on) {
    this.stayInMode = !!on;
  }
  // «نمایش روی تایم‌فریم‌ها» (Visibility on intervalsِ TV) — کلاسِ tfِ جاری (minutes/hours/days/weeks/months)
  //   از BazaarNama ست می‌شود؛ ترسیمِ دارای tfVis[class]===false در این کلاس رندر/انتخاب نمی‌شود. #271
  setTfClass(cls) {
    if (this.tfClass === cls) return;
    this.tfClass = cls;
    this.render();
  }
  _tfHidden(d) {
    return !!(d && d.tfVis && this.tfClass && d.tfVis[this.tfClass] === false);
  }
  // فرمترِ زمان (tz-aware، از BazaarNama) — برای برچسبِ تاریخِ خطِ عمودی روی محورِ زمان (مثلِ TV). #281
  setTimeFmt(fn) {
    this.timeFmt = typeof fn === "function" ? fn : null;
  }
  lockAll(on) {
    this._pushUndo();
    this.drawings.forEach((d) => {
      d.locked = on;
    });
    this._changed();
  }
  hideAll(on) {
    this._pushUndo();
    this.drawings.forEach((d) => {
      d.visible = !on;
    });
    this._changed();
  }
  // آیا همهٔ ترسیم‌ها پنهان‌اند؟ (برای تیکِ منوی «پنهان‌کردنِ ترسیم‌ها»)
  allHidden() {
    return this.drawings.length > 0 && this.drawings.every((d) => d.visible === false);
  }
  // افزودنِ خطِ افقی در قیمتِ دلخواه (منوی راست‌کلیک — «افزودنِ خطِ افقی در …»)؛ ایندکسِ آن را برمی‌گرداند.
  addHLine(price, color) {
    if (price == null || !Number.isFinite(price)) return -1;
    this._pushUndo();
    this.drawings.push(this._applyDef({ type: "hline", p: price, color: color || this.color, width: 2 }));
    this._changed();
    return this.drawings.length - 1;
  }
  // #کلون: کپیِ عمیقِ آبجکت با آفستِ کوچک (≈۱۴px) تا کپی دیده شود؛ انتخاب روی کپیِ تازه
  clone(i) {
    const d = this.drawings[i];
    if (!d) return -1;
    this._pushUndo();
    const c = JSON.parse(JSON.stringify(d));
    c.locked = false;
    const h = this._handlePoints(d).find((p) => p.x != null && p.y != null);
    if (h) {
      const ot = this._t(h.x), op = this._p(h.y), nt = this._t(h.x + 14), np = this._p(h.y + 14);
      if (ot != null && op != null && nt != null && np != null) this._moveBy(c, nt - ot, np - op);
    }
    this.drawings.push(c);
    this.selected = this.drawings.length - 1;
    this._changed();
    this.onSelect && this.onSelect(this.selected);
    return this.selected;
  }
  // #کپی/چسباندن (Ctrl+C/Ctrl+V مثلِ TV) — copy یک کپیِ عمیقِ آبجکتِ انتخابی را برمی‌گرداند؛
  // paste یک نسخهٔ آفست‌دار (≈۱۴px) از آبجکتِ کلیپ‌بورد اضافه و انتخاب می‌کند (مثلِ clone ولی از کلیپ‌بورد).
  copy(i) {
    const d = this.drawings[i];
    return d ? JSON.parse(JSON.stringify(d)) : null;
  }
  paste(obj) {
    if (!obj || !obj.type) return -1;
    this._pushUndo();
    const c = JSON.parse(JSON.stringify(obj));
    c.locked = false;
    c.visible = true;
    const h = this._handlePoints(c).find((p) => p.x != null && p.y != null);
    if (h) {
      const ot = this._t(h.x), op = this._p(h.y), nt = this._t(h.x + 14), np = this._p(h.y + 14);
      if (ot != null && op != null && nt != null && np != null) this._moveBy(c, nt - ot, np - op);
    }
    this.drawings.push(c);
    this.selected = this.drawings.length - 1;
    this._changed();
    this.onSelect && this.onSelect(this.selected);
    return this.selected;
  }
  // ── ترتیبِ Z (آرایه به ترتیبِ رسم است؛ انتهای آرایه = روی همه) ──
  bringToFront(i) {
    if (i < 0 || i >= this.drawings.length) return;
    this._pushUndo();
    const [d] = this.drawings.splice(i, 1);
    this.drawings.push(d);
    this.selected = this.drawings.length - 1;
    this._changed();
    this.onSelect && this.onSelect(this.selected);
  }
  sendToBack(i) {
    if (i < 0 || i >= this.drawings.length) return;
    this._pushUndo();
    const [d] = this.drawings.splice(i, 1);
    this.drawings.unshift(d);
    this.selected = 0;
    this._changed();
    this.onSelect && this.onSelect(this.selected);
  }
  bringForward(i) {
    if (i < 0 || i >= this.drawings.length - 1) return;
    this._pushUndo();
    const d = this.drawings[i];
    this.drawings[i] = this.drawings[i + 1];
    this.drawings[i + 1] = d;
    if (this.selected === i) this.selected = i + 1;
    else if (this.selected === i + 1) this.selected = i;
    this._changed();
    this.onSelect && this.onSelect(this.selected);
  }
  // جابه‌جاییِ آزادِ ترتیبِ لایه (z-order) با کشیدن‌ورهاکردن در درختِ آبجکت — سبکِ TV. from را برداشته و پیشِ to می‌گذارد.
  move(from, to) {
    const n = this.drawings.length;
    if (from === to || from < 0 || from >= n || to < 0 || to >= n) return;
    this._pushUndo();
    const [d] = this.drawings.splice(from, 1);
    this.drawings.splice(to, 0, d);
    this.selected = to;
    this._changed();
    this.onSelect && this.onSelect(this.selected);
  }
  sendBackward(i) {
    if (i <= 0 || i >= this.drawings.length) return;
    this._pushUndo();
    const d = this.drawings[i];
    this.drawings[i] = this.drawings[i - 1];
    this.drawings[i - 1] = d;
    if (this.selected === i) this.selected = i - 1;
    else if (this.selected === i - 1) this.selected = i;
    this._changed();
    this.onSelect && this.onSelect(this.selected);
  }
  setOrder(o) {
    this.order = o;
    this.render();
  }
  setProfile(buckets) {
    this.profile = buckets;
    this.render();
  }
  setScriptPaint(s) {
    this.script = s;
    this.render();
  }
  setCandles(cs) {
    this.candles = cs;
  }
  setDigits(d) {
    if (Number.isFinite(d)) this.digits = d;
  }
  // دقتِ اعشارِ نمادِ فعال (برچسبِ ابزارِ اندازه‌گیری)
  setMagnet(on, mode) {
    this.magnet = on;
    if (mode) this.magnetMode = mode;
  }
  _snap(pt) {
    if (!this.magnet || !this.candles || !this.candles.length || pt.t == null) return pt;
    let best = null, bd = Infinity;
    for (const c of this.candles) {
      const dd = Math.abs(c.t - pt.t);
      if (dd < bd) {
        bd = dd;
        best = c;
      }
    }
    if (!best) return pt;
    const cand = [best.o, best.h, best.l, best.c];
    let bp = pt.p, bpd = Infinity;
    cand.forEach((v) => {
      const dd = Math.abs(v - pt.p);
      if (dd < bpd) {
        bpd = dd;
        bp = v;
      }
    });
    if (this.magnetMode === "weak" && pt.p && bpd / Math.abs(pt.p) > 15e-4) return pt;
    return { t: best.t, p: bp };
  }
  setSeries(s) {
    this.series = s;
    this.render();
  }
  // سبکِ پیش‌فرضِ per-toolِ TV: نگاشتِ { type: {color,width,lineStyle,fill,fillOpacity,fontSize,bold,italic} }.
  setToolDefaults(m) {
    this.toolDefaults = m && typeof m === "object" ? m : {};
  }
  // اعمالِ سبکِ پیش‌فرضِ نوع روی یک ترسیمِ نوساخته — فقط کلیدهای سبک را می‌ریزد (هندسه/متن دست‌نخورده)؛ اگر پیش‌فرضی نباشد no-op.
  _applyDef(d) {
    const def = d && d.type ? this.toolDefaults[d.type] : null;
    if (!def) return d;
    const out = { ...d };
    ["color", "width", "lineStyle", "fill", "fillOpacity", "fontSize", "bold", "italic", "bg", "bgOpacity", "border"].forEach((k) => {
      if (def[k] !== void 0) out[k] = def[k];
    });
    return out;
  }
  setTool(t, color) {
    this.tool = t;
    if (color) this.color = color;
    this.pending = null;
    this.tmp = null;
    this.twoClick = false;
    this.dragging = false;
    this.multiSel = /* @__PURE__ */ new Set();
    this.hover = -1;
    this.canvas.style.pointerEvents = t === "cursor" ? "none" : "auto";
    this.canvas.style.cursor = t === "cursor" || t === "select" ? "default" : "crosshair";
    if (t !== "select") {
      this.selected = -1;
      this.onSelect && this.onSelect(-1);
    }
  }
  // record=true وقتی کاربر صریحاً چیدمانی را لود می‌کند (باید undo شود)؛
  // پیش‌فرض false برای لودِ اولیه/بازیابیِ نماد که نباید در تاریخچه بیفتد.
  setDrawings(arr, record = false) {
    if (record && this.drawings.length) this._pushUndo();
    this.drawings = arr || [];
    this.selected = -1;
    this.render();
  }
  getDrawings() {
    return this.drawings;
  }
  clearLast() {
    this.drawings.pop();
    this._changed();
  }
  // #۹ افزودنِ برنامه‌ایِ یک ترسیم (مثلِ جعبهٔ لانگ/شورت از کلیک‌راست) + ثبت در undo/persist
  addDrawing(d) {
    if (!d || typeof d !== "object") return;
    this._pushUndo();
    this.drawings.push(d);
    this.selected = this.drawings.length - 1;
    this._changed();
    this.onSelect && this.onSelect(this.selected);
  }
  clearAll() {
    if (this.drawings.length) this._pushUndo();
    this.drawings = [];
    this.selected = -1;
    this.multiSel = /* @__PURE__ */ new Set();
    this._changed();
  }
  _changed() {
    this.render();
    this.onChange && this.onChange(this.drawings);
  }
  // فاصلهٔ زمانیِ یک بار (ثانیه) — میانهٔ چند فاصلهٔ آخر (مقاوم به گپ‌ها) برای اکستراپولیشن در فضای خالی.
  _barInterval() {
    const cs = this.candles;
    if (cs && cs.length >= 2) {
      const n = cs.length, diffs = [];
      for (let i = Math.max(1, n - 8); i < n; i++) {
        const d = cs[i].t - cs[i - 1].t;
        if (d > 0) diffs.push(d);
      }
      if (diffs.length) {
        diffs.sort((a, b) => a - b);
        return diffs[Math.floor(diffs.length / 2)];
      }
    }
    return null;
  }
  _x(t) {
    try {
      const ts = this.chart.timeScale();
      const x = ts.timeToCoordinate(t);
      if (x != null) return x;
      const cs = this.candles, iv = this._barInterval();
      if (!cs || !cs.length || !iv || !ts.logicalToCoordinate) return null;
      const lastIdx = cs.length - 1;
      let L;
      if (t > cs[lastIdx].t) L = lastIdx + (t - cs[lastIdx].t) / iv;
      else if (t < cs[0].t) L = 0 - (cs[0].t - t) / iv;
      else return null;
      const xx = ts.logicalToCoordinate(L);
      return xx != null && Number.isFinite(xx) ? xx : null;
    } catch (e) {
      return null;
    }
  }
  // دفاعی: زمانِ نامعتبر نباید حلقهٔ رندر را بشکند
  _y(p) {
    return this.series ? this.series.priceToCoordinate(p) : null;
  }
  // نقاطِ لنگرِ یک ترسیم در مختصاتِ صفحه — برای تستِ داخلِ مستطیلِ Marquee (هر نوع: pts / p0,p1 / hline p / vline t / متن t,p).
  _screenPts(d) {
    const out = [];
    const add = (t, p) => {
      const x = t != null ? this._x(t) : null;
      const y = p != null ? this._y(p) : null;
      if (x != null || y != null) out.push({ x, y });
    };
    if (Array.isArray(d.pts)) d.pts.forEach((q) => add(q.t, q.p));
    if (d.p0) add(d.p0.t, d.p0.p);
    if (d.p1) add(d.p1.t, d.p1.p);
    if (d.p != null && d.t == null) add(null, d.p);
    if (d.t != null && d.p == null) add(d.t, null);
    if (d.t != null && d.p != null && !d.p0 && !Array.isArray(d.pts)) add(d.t, d.p);
    return out;
  }
  // آیا لنگرِ ترسیم داخلِ مستطیلِ [rx0,ry0..rx1,ry1] است؟ (hline فقط y، vline فقط x را می‌سنجد)
  _inRect(d, rx0, ry0, rx1, ry1) {
    const xmin = Math.min(rx0, rx1), xmax = Math.max(rx0, rx1), ymin = Math.min(ry0, ry1), ymax = Math.max(ry0, ry1);
    return this._screenPts(d).some((q) => {
      const xok = q.x == null || q.x >= xmin && q.x <= xmax;
      const yok = q.y == null || q.y >= ymin && q.y <= ymax;
      return xok && yok;
    });
  }
  _t(x) {
    const ts = this.chart.timeScale();
    const t = ts.coordinateToTime(x);
    if (t != null) return t;
    try {
      const cs = this.candles, iv = this._barInterval();
      if (!cs || !cs.length || !iv || !ts.coordinateToLogical) return t;
      const L = ts.coordinateToLogical(x);
      if (L == null || !Number.isFinite(L)) return t;
      const lastIdx = cs.length - 1;
      return cs[lastIdx].t + Math.round(L - lastIdx) * iv;
    } catch (e) {
      return t;
    }
  }
  _p(y) {
    return this.series ? this.series.coordinateToPrice(y) : null;
  }
  // نقاطِ قابلِ‌درگِ هر آبجکت → [{x,y,set(t,p)}]
  _handlePoints(d) {
    if (isExt(d.type)) {
      const h = extHandles(d, this);
      if (h) return h;
    }
    if (d.type === "hline") {
      const y = this._y(d.p);
      return [{ x: 14, y, set: (t, p) => {
        d.p = p;
      } }];
    }
    if (d.type === "vline") {
      const x = this._x(d.t);
      return [{ x, y: 14, set: (t) => {
        d.t = t;
      } }];
    }
    if (d.type === "text") {
      return [{ x: this._x(d.t), y: this._y(d.p), set: (t, p) => {
        d.t = t;
        d.p = p;
      } }];
    }
    if (d.pts) return d.pts.map((pp, k) => ({ x: this._x(pp.t), y: this._y(pp.p), set: (t, p) => {
      d.pts[k] = { t, p };
    } }));
    const out = [];
    if (d.p0) out.push({ x: this._x(d.p0.t), y: this._y(d.p0.p), set: (t, p) => {
      d.p0 = { t, p };
    } });
    if (d.p1) out.push({ x: this._x(d.p1.t), y: this._y(d.p1.p), set: (t, p) => {
      d.p1 = { t, p };
    } });
    return out;
  }
  _hitHandle(d, x, y) {
    const hs = this._handlePoints(d);
    for (let i = 0; i < hs.length; i++) {
      const h = hs[i];
      if (h.x != null && h.y != null && Math.hypot(x - h.x, y - h.y) < 9) return i;
    }
    return -1;
  }
  _moveBy(d, dt, dp) {
    const mv = (pt) => ({ t: pt.t + dt, p: pt.p + dp });
    if (d.type === "hline") {
      d.p += dp;
      return;
    }
    if (d.type === "vline") {
      d.t += dt;
      return;
    }
    if (d.type === "text") {
      d.t += dt;
      d.p += dp;
      return;
    }
    if (d.pts) {
      d.pts = d.pts.map(mv);
      return;
    }
    if (d.p0) d.p0 = mv(d.p0);
    if (d.p1) d.p1 = mv(d.p1);
  }
  // ابزارهای دونقطه‌ایِ خطی که با Shift به زاویهٔ ۰/۴۵/۹۰ می‌چسبند (سبکِ TV).
  _isAngleTool(type) {
    return type === "trend" || type === "ray" || type === "extline" || type === "infoline" || type === "arrow";
  }
  // نقطهٔ دومِ p1 را در فضای پیکسل به نزدیک‌ترین مضربِ ۴۵° نسبت به p0 می‌چسباند و به زمان/قیمت برمی‌گرداند.
  _constrainAngle(p0, p1) {
    const x0 = this._x(p0.t), y0 = this._y(p0.p), x1 = this._x(p1.t), y1 = this._y(p1.p);
    if (x0 == null || y0 == null || x1 == null || y1 == null) return p1;
    const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy);
    if (dist < 1) return p1;
    const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const nt = this._t(x0 + dist * Math.cos(a)), np = this._p(y0 + dist * Math.sin(a));
    return { t: nt != null ? nt : p1.t, p: np != null ? np : p1.p };
  }
  // مربع/دایره: نقطهٔ دوم را چنان می‌چسباند که |عرض|=|ارتفاع| در پیکسل شود (مستطیل→مربع، بیضی→دایره) — سبکِ TV با Shift.
  _isSquareTool(type) {
    return type === "rect" || type === "rotrect" || type === "ellipse";
  }
  _constrainSquare(p0, p1) {
    const x0 = this._x(p0.t), y0 = this._y(p0.p), x1 = this._x(p1.t), y1 = this._y(p1.p);
    if (x0 == null || y0 == null || x1 == null || y1 == null) return p1;
    const dx = x1 - x0, dy = y1 - y0, s = Math.max(Math.abs(dx), Math.abs(dy));
    if (s < 1) return p1;
    const nt = this._t(x0 + (dx < 0 ? -s : s)), np = this._p(y0 + (dy < 0 ? -s : s));
    return { t: nt != null ? nt : p1.t, p: np != null ? np : p1.p };
  }
  // دیسپچرِ constrainِ Shift: خطوط ⇒ زاویه؛ اشکالِ جعبه‌ای ⇒ مربع/دایره؛ بقیه بدونِ تغییر.
  _constrainDraw(type, p0, p1) {
    if (this._isAngleTool(type)) return this._constrainAngle(p0, p1);
    if (this._isSquareTool(type)) return this._constrainSquare(p0, p1);
    return p1;
  }
  _bind() {
    const cv = this.canvas;
    const down = (e) => {
      if (!this.series) return;
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (this.tool === "cursor" || this.tool === "select") {
        if (e.shiftKey) {
          const mp = this._snap({ t: this._t(x), p: this._p(y) });
          if (mp.t != null && mp.p != null) {
            this.tmp = { type: "dprange", p0: mp, p1: mp, color: "#089981", width: 2 };
            this.dragging = true;
            this.didDrag = false;
            this.downXY = { x, y };
            this.measuring = true;
            return;
          }
        }
        if (this.order) {
          for (const k of ["entry", "sl", "tp"]) {
            const yy = this._y(this.order[k]);
            if (yy != null && Math.abs(yy - y) < 7) {
              this.dragOrder = k;
              return;
            }
          }
        }
        if (this.selected >= 0) {
          const sd = this.drawings[this.selected];
          if (sd && !sd.locked) {
            const hi = this._hitHandle(sd, x, y);
            if (hi >= 0) {
              this._pushUndo();
              this.dragHandle = { idx: this.selected, hi };
              return;
            }
          }
        }
        const hit = this._hit(x, y);
        if (this.tool === "select" && hit < 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
          this.marquee = { x0: x, y0: y, x1: x, y1: y };
          this.selected = -1;
          this.multiSel = /* @__PURE__ */ new Set();
          this.onSelect && this.onSelect(-1);
          this.render();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
          if (hit >= 0) {
            if (!this.multiSel.size && this.selected >= 0 && this.selected !== hit) this.multiSel.add(this.selected);
            if (this.multiSel.has(hit)) this.multiSel.delete(hit);
            else this.multiSel.add(hit);
            if (this.multiSel.size <= 1) {
              this.selected = this.multiSel.size ? [...this.multiSel][0] : -1;
              this.multiSel = /* @__PURE__ */ new Set();
            } else this.selected = hit;
            this.onSelect && this.onSelect(this.selected);
            this.render();
          }
          return;
        }
        const keepGroup = hit >= 0 && this.multiSel.size > 1 && this.multiSel.has(hit);
        if (!keepGroup) this.multiSel = /* @__PURE__ */ new Set();
        this.selected = hit;
        this.onSelect && this.onSelect(hit);
        this.render();
        if (hit >= 0 && this.drawings[hit] && !this.drawings[hit].locked) {
          const sp = this._snap({ t: this._t(x), p: this._p(y) });
          if (sp.t != null && sp.p != null) {
            this._pushUndo();
            let mi = hit;
            if (e.altKey) {
              const dup = JSON.parse(JSON.stringify(this.drawings[hit]));
              dup.locked = false;
              this.drawings.push(dup);
              mi = this.drawings.length - 1;
              this.onSelect && this.onSelect(mi);
              this.multiSel = /* @__PURE__ */ new Set();
            }
            this.selected = mi;
            this.dragMove = { idx: mi, last: sp };
          }
        }
        return;
      }
      let pt = this._snap({ t: this._t(x), p: this._p(y) });
      if (pt.t == null || pt.p == null) return;
      if (EXT_FREEHAND.includes(this.tool)) {
        this.freehand = { type: this.tool, pts: [pt], color: this.color };
        this.render();
        return;
      }
      const NEED = { channel: 3, pitchfork: 3, ...EXT_NEED };
      if (NEED[this.tool]) {
        if (!this.pending || this.pending.type !== this.tool) this.pending = { type: this.tool, pts: [pt], color: this.color };
        else this.pending.pts.push(pt);
        if (this.pending.pts.length >= NEED[this.tool]) {
          this._pushUndo();
          this.drawings.push(this._applyDef({ type: this.tool, pts: this.pending.pts.slice(), color: this.color, width: 2 }));
          this.pending = null;
          this._reset();
        } else this.render();
        return;
      }
      if (this.tool === "polyline" || this.tool === "path") {
        const tt = this.tool;
        if (!this.pending || this.pending.type !== tt) this.pending = { type: tt, pts: [pt], color: this.color };
        else this.pending.pts.push(pt);
        this.render();
        return;
      }
      if (this.tool === "hline") {
        this._pushUndo();
        this.drawings.push(this._applyDef({ type: "hline", p: pt.p, color: this.color, width: 2 }));
        this._reset();
        return;
      }
      if (this.tool === "vline") {
        this._pushUndo();
        this.drawings.push(this._applyDef({ type: "vline", t: pt.t, color: this.color, width: 2 }));
        this._reset();
        return;
      }
      if (this.tool === "text") {
        const txt = window.prompt("\u0645\u062A\u0646 (\u0628\u0631\u0627\u06CC \u062E\u0637\u0650 \u062C\u062F\u06CC\u062F \xAB\\n\xBB \u0628\u0646\u0648\u06CC\u0633\u06CC\u062F):");
        if (txt) {
          this._pushUndo();
          this.drawings.push(this._applyDef({ type: "text", t: pt.t, p: pt.p, text: txt, color: this.color }));
        }
        this._reset();
        return;
      }
      if (this.twoClick && this.tmp) {
        this.tmp.p1 = e.shiftKey ? this._constrainDraw(this.tmp.type, this.tmp.p0, pt) : pt;
        this._pushUndo();
        this.drawings.push(this._applyDef(this.tmp));
        this.tmp = null;
        this.twoClick = false;
        this.dragging = false;
        this.didDrag = false;
        this._reset();
        return;
      }
      const _clr = this.tool === "arrowup" ? "#089981" : this.tool === "arrowdown" ? "#f23645" : this.color;
      this.tmp = { type: this.tool, p0: pt, p1: pt, color: _clr, width: 2 };
      this.dragging = true;
      this.didDrag = false;
      this.downXY = { x, y };
    };
    let edgeRAF = null, edgeDir = 0, edgeX = 0, edgeY = 0;
    const edgeTick = () => {
      if (!edgeDir) {
        edgeRAF = null;
        return;
      }
      let ts;
      try {
        ts = this.chart.timeScale();
      } catch (e) {
        edgeRAF = null;
        return;
      }
      const lr = ts.getVisibleLogicalRange && ts.getVisibleLogicalRange();
      if (lr) {
        const span = Math.max(1, lr.to - lr.from);
        const step = Math.max(0.4, span * 0.01) * edgeDir;
        try {
          ts.setVisibleLogicalRange({ from: lr.from + step, to: lr.to + step });
        } catch (e) {
        }
      }
      const sp = this._snap({ t: this._t(edgeX), p: this._p(edgeY) });
      if (sp.t != null && sp.p != null) {
        if (this.dragging && this.tmp) this.tmp.p1 = sp;
        else if (this.twoClick && this.tmp) this.tmp.p1 = sp;
        else if (this.pending) this.pending.preview = sp;
      }
      this.render();
      edgeRAF = requestAnimationFrame(edgeTick);
    };
    const setEdgePan = (dir, x, y) => {
      edgeDir = dir;
      edgeX = x;
      edgeY = y;
      if (dir && !edgeRAF) edgeRAF = requestAnimationFrame(edgeTick);
      else if (!dir && edgeRAF) {
        cancelAnimationFrame(edgeRAF);
        edgeRAF = null;
      }
    };
    const stopEdgePan = () => setEdgePan(0, 0, 0);
    this._stopEdgePan = stopEdgePan;
    const move = (e) => {
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const _drawActive = this.dragging && this.tmp || this.twoClick && this.tmp || !!this.pending || !!this.dragHandle || !!this.dragMove;
      let _edir = 0;
      const EDGE = 40;
      if (_drawActive) {
        if (x < EDGE) _edir = -1;
        else if (x > r.width - EDGE) _edir = 1;
      }
      setEdgePan(_edir, x, y);
      if (this.freehand) {
        const sp2 = { t: this._t(x), p: this._p(y) };
        if (sp2.t != null && sp2.p != null) {
          const last = this.freehand.pts[this.freehand.pts.length - 1];
          const lp = last ? { x: this._x(last.t), y: this._y(last.p) } : null;
          if (!lp || Math.hypot(x - lp.x, y - lp.y) >= 3) {
            this.freehand.pts.push(sp2);
            this.render();
          }
        }
        return;
      }
      if (this.marquee) {
        this.marquee.x1 = x;
        this.marquee.y1 = y;
        this.render();
        return;
      }
      if (this.dragOrder && this.order) {
        const pr = this._p(y);
        if (pr != null) {
          this.order[this.dragOrder] = pr;
          this.render();
          this.onOrder && this.onOrder({ ...this.order });
        }
        return;
      }
      if (this.dragHandle) {
        const d = this.drawings[this.dragHandle.idx];
        const sp2 = this._snap({ t: this._t(x), p: this._p(y) });
        if (d && sp2.t != null && sp2.p != null) {
          this._handlePoints(d)[this.dragHandle.hi].set(sp2.t, sp2.p);
          this.render();
        }
        return;
      }
      if (this.dragMove) {
        const d = this.drawings[this.dragMove.idx];
        const sp2 = this._snap({ t: this._t(x), p: this._p(y) });
        if (d && sp2.t != null && sp2.p != null) {
          const dt = sp2.t - this.dragMove.last.t, dp = sp2.p - this.dragMove.last.p;
          if (this.multiSel.size > 1 && this.multiSel.has(this.dragMove.idx)) {
            this.multiSel.forEach((i) => {
              const dd = this.drawings[i];
              if (dd && !dd.locked) this._moveBy(dd, dt, dp);
            });
          } else {
            this._moveBy(d, dt, dp);
          }
          this.dragMove.last = sp2;
          this.render();
        }
        return;
      }
      if ((this.tool === "cursor" || this.tool === "select") && !this.pending) {
        const hv = this._hit(x, y);
        if (hv !== this.hover) {
          this.hover = hv;
          this.render();
        }
      }
      const sp = this._snap({ t: this._t(x), p: this._p(y) });
      if (this.tool === "cursor" && !this.dragging && !this.dragMove && !this.dragHandle && !this.dragOrder) {
        const over = this._interactiveAt(x, y);
        const want = over || e.shiftKey ? "auto" : "none";
        if (cv.style.pointerEvents !== want) cv.style.pointerEvents = want;
        cv.style.cursor = over ? "pointer" : "default";
      }
      if (this.tool === "select" && !this.dragging) {
        const sd = this.selected >= 0 ? this.drawings[this.selected] : null;
        const onH = sd && !sd.locked && this._hitHandle(sd, x, y) >= 0;
        const h = this._hit(x, y);
        cv.style.cursor = onH ? "crosshair" : h >= 0 ? "move" : "default";
        this.hover = h;
      }
      if (this.pending && sp.t != null && sp.p != null) {
        this.pending.preview = sp;
        this.render();
        return;
      }
      if (this.twoClick && this.tmp) {
        if (sp.t != null && sp.p != null) {
          this.tmp.p1 = e.shiftKey ? this._constrainDraw(this.tmp.type, this.tmp.p0, sp) : sp;
          this.render();
        }
        return;
      }
      if (!this.dragging || !this.tmp) return;
      if (sp.t != null && sp.p != null) {
        this.tmp.p1 = e.shiftKey ? this._constrainDraw(this.tmp.type, this.tmp.p0, sp) : sp;
        if (this.measuring) this.tmp.color = sp.p >= this.tmp.p0.p ? "#089981" : "#f23645";
        if (this.downXY && Math.hypot(x - this.downXY.x, y - this.downXY.y) > 4) this.didDrag = true;
        this.render();
      }
    };
    const up = () => {
      stopEdgePan();
      if (this.freehand) {
        const fh = this.freehand;
        this.freehand = null;
        if (fh.pts.length >= 2) {
          this._pushUndo();
          this.drawings.push(this._applyDef({ type: fh.type, pts: fh.pts, color: fh.color }));
          this.selected = this.drawings.length - 1;
          this._changed();
        }
        this.render();
        return;
      }
      if (this.marquee) {
        const m = this.marquee;
        this.marquee = null;
        if (Math.abs(m.x1 - m.x0) > 4 || Math.abs(m.y1 - m.y0) > 4) {
          const sel = /* @__PURE__ */ new Set();
          this.drawings.forEach((d, i) => {
            if (d && !d.locked && this._inRect(d, m.x0, m.y0, m.x1, m.y1)) sel.add(i);
          });
          if (sel.size <= 1) {
            this.selected = sel.size ? [...sel][0] : -1;
            this.multiSel = /* @__PURE__ */ new Set();
          } else {
            this.multiSel = sel;
            this.selected = [...sel][0];
          }
          this.onSelect && this.onSelect(this.selected);
        }
        this.render();
        return;
      }
      if (this.dragOrder) {
        this.dragOrder = null;
        return;
      }
      if (this.dragHandle) {
        this.dragHandle = null;
        this._changed();
        return;
      }
      if (this.dragMove) {
        this.dragMove = null;
        this._changed();
        return;
      }
      if (this.measuring) {
        this.measuring = false;
        this.dragging = false;
        this.tmp = null;
        this.didDrag = false;
        this.render();
        return;
      }
      if (this.tmp && this.dragging) {
        if (this.didDrag) {
          this._pushUndo();
          this.drawings.push(this._applyDef(this.tmp));
          this.tmp = null;
          this.dragging = false;
          this.didDrag = false;
          this._reset();
        } else {
          this.dragging = false;
          this.twoClick = true;
          this.render();
        }
      }
    };
    const key = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target && e.target.isContentEditable) return;
      if (e.key === "Enter" && this.pending && (this.pending.type === "polyline" || this.pending.type === "path")) {
        e.preventDefault();
        this._finishPoly && this._finishPoly();
        return;
      }
    };
    const finishPoly = () => {
      if (!this.pending || this.pending.type !== "polyline" && this.pending.type !== "path") return;
      const t = this.pending.type;
      const pts = this.pending.pts.slice();
      const L = pts.length;
      if (L >= 2 && pts[L - 1].t === pts[L - 2].t && pts[L - 1].p === pts[L - 2].p) pts.pop();
      if (pts.length >= 2) {
        this._pushUndo();
        this.drawings.push(this._applyDef({ type: t, pts, color: this.pending.color, width: 2 }));
      }
      this.pending = null;
      this._reset();
    };
    const dbl = (e) => {
      if (this.pending && (this.pending.type === "polyline" || this.pending.type === "path")) {
        finishPoly();
        return;
      }
      if (this.tool !== "cursor" && this.tool !== "select") return;
      try {
        const r = cv.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        const idx = this._hit(x, y);
        if (idx >= 0) {
          this.selected = idx;
          this.render();
          this.onSelect && this.onSelect(idx);
          this.onDblEdit && this.onDblEdit(idx);
        }
      } catch (err) {
      }
    };
    const wheel = (e) => {
      if (this.tool === "cursor" || this.tool === "select") return;
      let ts;
      try {
        ts = this.chart.timeScale();
      } catch (err) {
        return;
      }
      const lr = ts.getVisibleLogicalRange && ts.getVisibleLogicalRange();
      if (!lr) return;
      e.preventDefault();
      e.stopPropagation();
      const span = Math.max(1, lr.to - lr.from);
      const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      try {
        if (horizontal) {
          const raw = e.deltaX || e.deltaY;
          const shift = Math.sign(raw) * Math.max(1, span * 0.12);
          ts.setVisibleLogicalRange({ from: lr.from + shift, to: lr.to + shift });
        } else {
          const rect = cv.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const L = ts.coordinateToLogical ? ts.coordinateToLogical(x) : (lr.from + lr.to) / 2;
          const pivot = L == null || !Number.isFinite(L) ? (lr.from + lr.to) / 2 : L;
          const zoom = e.deltaY > 0 ? 1.1 : 0.9;
          const from = pivot - (pivot - lr.from) * zoom;
          const to = pivot + (lr.to - pivot) * zoom;
          if (to - from >= 2) ts.setVisibleLogicalRange({ from, to });
        }
        this.render();
      } catch (err) {
      }
    };
    this._finishPoly = finishPoly;
    cv.addEventListener("mousedown", down);
    cv.addEventListener("dblclick", dbl);
    cv.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("keydown", key);
    this._cleanup = () => {
      stopEdgePan();
      cv.removeEventListener("mousedown", down);
      cv.removeEventListener("dblclick", dbl);
      cv.removeEventListener("wheel", wheel);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("keydown", key);
    };
  }
  // #۱۱ آیا نقطهٔ (x,y) روی چیزی قابلِ‌تعامل است؟ (خطِ سفارش، دستگیرهٔ آبجکتِ انتخاب‌شده، یا بدنهٔ یک ترسیم)
  _interactiveAt(x, y) {
    if (this.order) {
      for (const k of ["entry", "sl", "tp"]) {
        const yy = this._y(this.order[k]);
        if (yy != null && Math.abs(yy - y) < 7) return true;
      }
    }
    if (this.selected >= 0) {
      const sd = this.drawings[this.selected];
      if (sd && !sd.locked && this._hitHandle(sd, x, y) >= 0) return true;
    }
    return this._hit(x, y) >= 0;
  }
  // hit-test: نزدیک‌ترین ترسیم به نقطهٔ کلیک (یا -1)
  _hit(x, y) {
    const near = 7;
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i];
      if (!d || d.visible === false) continue;
      if (this._tfHidden(d)) continue;
      if (isExt(d.type)) {
        if (extHit(d, x, y, this)) return i;
        continue;
      }
      if (d.type === "hline") {
        const yy = this._y(d.p);
        if (yy != null && Math.abs(yy - y) < near) return i;
        continue;
      }
      if (d.type === "vline") {
        const xx = this._x(d.t);
        if (xx != null && Math.abs(xx - x) < near) return i;
        continue;
      }
      if (d.type === "text") {
        const tx = this._x(d.t), ty = this._y(d.p);
        if (tx == null || ty == null) continue;
        const fs = Math.max(8, Math.min(64, d.fontSize || 12));
        const tlines = String(d.text || "").replace(/\\n/g, "\n").split("\n");
        const maxLen = tlines.reduce((a, s) => Math.max(a, s.length), 0);
        const lh = Math.round(fs * 1.3);
        const hw = Math.max(24, maxLen * fs * 0.4);
        if (x >= tx - hw && x <= tx + hw && y >= ty - fs - 4 && y <= ty + 5 + (tlines.length - 1) * lh) return i;
        continue;
      }
      if (Array.isArray(d.pts) && d.pts.length) {
        const P = d.pts.map((pt) => ({ x: this._x(pt.t), y: this._y(pt.p) })).filter((q) => q.x != null && q.y != null);
        const segHit = (a, bp) => {
          const A = x - a.x, B = y - a.y, C = bp.x - a.x, D = bp.y - a.y;
          const dot = A * C + B * D, len = C * C + D * D;
          const tt = len ? Math.max(0, Math.min(1, dot / len)) : 0;
          const px2 = a.x + tt * C, py = a.y + tt * D;
          return Math.hypot(x - px2, y - py) < near;
        };
        let hitPts = false;
        for (let k = 0; k < P.length && !hitPts; k++) {
          if (Math.hypot(x - P[k].x, y - P[k].y) < near + 3) hitPts = true;
          else if (k > 0 && segHit(P[k - 1], P[k])) hitPts = true;
        }
        if (!hitPts && d.type === "pitchfork" && P.length >= 3) {
          const mid = { x: (P[1].x + P[2].x) / 2, y: (P[1].y + P[2].y) / 2 };
          if (segHit(P[0], mid)) hitPts = true;
        }
        if (!hitPts && d.type === "channel" && P.length >= 3) {
          const q2 = { x: P[2].x + (P[1].x - P[0].x), y: P[2].y + (P[1].y - P[0].y) };
          if (segHit(P[2], q2)) hitPts = true;
        }
        if (hitPts) return i;
        continue;
      }
      const x0 = this._x(d.p0 && d.p0.t), y0 = this._y(d.p0 && d.p0.p), x1 = this._x(d.p1 && d.p1.t), y1 = this._y(d.p1 && d.p1.p);
      if (x0 == null || x1 == null) continue;
      if (d.type === "rect" || d.type === "fib" || d.type === "longshort" || d.type === "short") {
        if (x >= Math.min(x0, x1) - near && x <= Math.max(x0, x1) + near && y >= Math.min(y0, y1) - near && y <= Math.max(y0, y1) + near) return i;
      } else {
        const A = x - x0, B = y - y0, C = x1 - x0, D = y1 - y0;
        const dot = A * C + B * D, len = C * C + D * D;
        const t = len ? d.type === "ray" ? Math.max(0, dot / len) : Math.max(0, Math.min(1, dot / len)) : 0;
        const px2 = x0 + t * C, py = y0 + t * D;
        if (Math.hypot(x - px2, y - py) < near) return i;
      }
    }
    return -1;
  }
  _reset() {
    this.twoClick = false;
    this.didDrag = false;
    if (!this.stayInMode) {
      this.tool = "cursor";
      this.canvas.style.pointerEvents = "none";
      this.canvas.style.cursor = "default";
      this.onToolReset && this.onToolReset();
    }
    this._changed();
  }
  destroy() {
    this._cleanup && this._cleanup();
  }
  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.render();
  }
  _barWidth() {
    try {
      const o = this.chart.timeScale().options();
      if (o && o.barSpacing) return Math.max(2, o.barSpacing);
    } catch (e) {
    }
    return 6;
  }
  // رندرِ گرافیکِ نمااسکریپت روی کانواس (با مختصاتِ زندهٔ چارت؛ خودکار با پن/زوم به‌روز می‌شود)
  _paintScript(ctx, W, H) {
    const s = this.script;
    if (!s) return;
    const bw = this._barWidth();
    (s.bgs || []).forEach((g) => {
      ctx.fillStyle = g.color || "rgba(59,130,246,.10)";
      (g.bars || []).forEach((t) => {
        const x = this._x(t);
        if (x == null) return;
        ctx.fillRect(x - bw / 2, 0, Math.max(1, bw), H);
      });
    });
    (s.fills || []).forEach((f) => {
      const A = f.a || [], B = f.b || [];
      if (A.length < 2 || B.length < 2) return;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < A.length; i++) {
        const x = this._x(A[i].time), y = this._y(A[i].value);
        if (x == null || y == null) continue;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      for (let i = B.length - 1; i >= 0; i--) {
        const x = this._x(B[i].time), y = this._y(B[i].value);
        if (x == null || y == null) continue;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = f.color || "rgba(59,130,246,.12)";
      ctx.fill();
    });
    (s.boxes || []).forEach((b) => {
      const x1 = this._x(b.left), x2 = this._x(b.right), y1 = this._y(b.top), y2 = this._y(b.bottom);
      if (x1 == null || x2 == null || y1 == null || y2 == null) return;
      const X = Math.min(x1, x2), Y = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      ctx.fillStyle = b.bg || "rgba(59,130,246,.08)";
      ctx.fillRect(X, Y, w, h);
      ctx.strokeStyle = b.color || "#3b82f6";
      ctx.lineWidth = 1;
      ctx.strokeRect(X, Y, w, h);
    });
    (s.lines || []).forEach((l) => {
      const x1 = this._x(l.x1), x2 = this._x(l.x2), y1 = this._y(l.y1), y2 = this._y(l.y2);
      if (x1 == null || x2 == null || y1 == null || y2 == null) return;
      ctx.strokeStyle = l.color || "#3b82f6";
      ctx.lineWidth = l.width || 1;
      if (l.style === 2) ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    (s.barcolors || []).forEach((bc) => {
      if (bc.all) return;
      ctx.fillStyle = bc.color || "#f59e0b";
      (bc.bars || []).forEach((t) => {
        const x = this._x(t);
        if (x == null) return;
        ctx.beginPath();
        ctx.arc(x, H - 8, 2.5, 0, 7);
        ctx.fill();
      });
    });
  }
  render() {
    const ctx = this.ctx;
    if (!ctx) return;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (this.profile && this.profile.length) {
      const maxV = Math.max(...this.profile.map((b) => b.vol)) || 1;
      const maxW = Math.min(160, W * 0.18);
      this.profile.forEach((b) => {
        const y = this._y((b.lo + b.hi) / 2);
        if (y == null) return;
        const yh = this._y(b.hi), yl = this._y(b.lo);
        const h = yh != null && yl != null ? Math.max(2, Math.abs(yl - yh) - 1) : 4;
        const w = b.vol / maxV * maxW;
        ctx.fillStyle = b.poc ? "rgba(245,158,11,.55)" : b.va ? "rgba(59,130,246,.42)" : "rgba(59,130,246,.18)";
        ctx.fillRect(W - w, y - h / 2, w, h);
      });
    }
    if (this.script) this._paintScript(ctx, W, H);
    const _live = this.tmp || this.freehand || null;
    const all = _live ? [...this.drawings, _live] : this.drawings;
    all.forEach((d, i) => {
      if (d !== _live && this._tfHidden(d)) return;
      this._draw(ctx, d, i === this.selected || this.multiSel.has(i));
      if (i === this.selected || this.multiSel.has(i)) this._drawHandles(ctx, d);
      else if (d !== this.tmp && i === this.hover && d.visible !== false) this._drawHandles(ctx, d, 0.4);
    });
    if (this.marquee) {
      const m = this.marquee;
      const rx = Math.min(m.x0, m.x1), ry = Math.min(m.y0, m.y1), rw = Math.abs(m.x1 - m.x0), rh = Math.abs(m.y1 - m.y0);
      ctx.save();
      ctx.fillStyle = "rgba(59,130,246,.10)";
      ctx.strokeStyle = "rgba(59,130,246,.9)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }
    if (this.pending) {
      const pts = this.pending.preview ? [...this.pending.pts, this.pending.preview] : this.pending.pts;
      this._draw(ctx, { type: this.pending.type, pts, color: this.pending.color });
      ctx.fillStyle = this.pending.color;
      this.pending.pts.forEach((p) => {
        const x = this._x(p.t), y = this._y(p.p);
        if (x != null && y != null) {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, 7);
          ctx.fill();
        }
      });
    }
    if (this.order) this._drawOrder(ctx);
  }
  _drawOrder(ctx) {
    const W = this.canvas.width;
    const o = this.order;
    const yE = this._y(o.entry), yS = this._y(o.sl), yT = this._y(o.tp);
    ctx.font = "11px IRANYekanX, Ravagh, Vazirmatn, sans-serif";
    ctx.lineWidth = 1;
    const risk = Math.abs(o.entry - o.sl), reward = Math.abs(o.tp - o.entry);
    const rr = risk ? (reward / risk).toFixed(2) : "\u2014";
    if (yE != null && yT != null) {
      ctx.fillStyle = "rgba(34,197,94,.10)";
      ctx.fillRect(0, Math.min(yE, yT), W, Math.abs(yE - yT));
    }
    if (yE != null && yS != null) {
      ctx.fillStyle = "rgba(239,68,68,.10)";
      ctx.fillRect(0, Math.min(yE, yS), W, Math.abs(yE - yS));
    }
    const line = (y, col, label) => {
      if (y == null) return;
      ctx.strokeStyle = col;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.fillRect(4, y - 7, 14, 14);
      ctx.fillStyle = "#fff";
      ctx.fillText("\u21D5", 6, y + 4);
      ctx.fillStyle = col;
      ctx.fillText(label, 22, y - 3);
    };
    line(yT, "#22c55e", `\u0647\u062F\u0641 ${o.tp.toFixed(this.digits)}`);
    line(yE, "#3b82f6", `${o.side === "buy" ? "\u062E\u0631\u06CC\u062F" : "\u0641\u0631\u0648\u0634"} ${o.entry.toFixed(this.digits)}  R:R ${rr}`);
    line(yS, "#ef4444", `\u062D\u062F \u0636\u0631\u0631 ${o.sl.toFixed(this.digits)}`);
  }
  _drawHandles(ctx, d, alpha) {
    const hs = this._handlePoints(d);
    if (alpha != null) {
      ctx.save();
      ctx.globalAlpha = alpha;
    }
    hs.forEach((h) => {
      if (h.x == null || h.y == null) return;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = d.locked ? "#94a3b8" : "#2962FF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, alpha != null ? 4 : 5, 0, 7);
      ctx.fill();
      ctx.stroke();
    });
    if (alpha != null) ctx.restore();
  }
  _draw(ctx, d, sel = false) {
    if (d.visible === false) return;
    if (isExt(d.type)) {
      extDraw(ctx, d, this);
      return;
    }
    const W = this.canvas.width, H = this.canvas.height;
    ctx.lineWidth = d.width || 2;
    ctx.strokeStyle = d.color;
    ctx.fillStyle = d.color;
    ctx.font = "12px IRANYekanX, Ravagh, Vazirmatn, sans-serif";
    ctx.setLineDash(d.lineStyle === "dotted" ? [2, 3] : d.lineStyle === "dashed" || d.dashed ? [6, 4] : []);
    if (d.type === "channel" && d.pts) {
      const P = d.pts.map((p) => ({ x: this._x(p.t), y: this._y(p.p) }));
      if (P.some((p) => p.x == null || p.y == null) || P.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(P[0].x, P[0].y);
      ctx.lineTo(P[1].x, P[1].y);
      ctx.stroke();
      if (P.length >= 3) {
        const dx = P[1].x - P[0].x, dy = P[1].y - P[0].y;
        const ox = P[2].x - P[0].x, oy = P[2].y - P[0].y;
        ctx.beginPath();
        ctx.moveTo(P[0].x + ox, P[0].y + oy);
        ctx.lineTo(P[1].x + ox, P[1].y + oy);
        ctx.stroke();
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.moveTo(P[0].x, P[0].y);
        ctx.lineTo(P[1].x, P[1].y);
        ctx.lineTo(P[1].x + ox, P[1].y + oy);
        ctx.lineTo(P[0].x + ox, P[0].y + oy);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      return;
    }
    if (d.type === "pitchfork" && d.pts) {
      const P = d.pts.map((p) => ({ x: this._x(p.t), y: this._y(p.p) }));
      if (P.some((p) => p.x == null || p.y == null) || P.length < 2) return;
      if (P.length >= 3) {
        const mx = (P[1].x + P[2].x) / 2, my = (P[1].y + P[2].y) / 2;
        const dx = mx - P[0].x, dy = my - P[0].y;
        const k = 3;
        ctx.beginPath();
        ctx.moveTo(P[0].x, P[0].y);
        ctx.lineTo(P[0].x + dx * k, P[0].y + dy * k);
        ctx.stroke();
        [P[1], P[2]].forEach((pp) => {
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(pp.x, pp.y);
          ctx.lineTo(pp.x + dx * k, pp.y + dy * k);
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
      } else {
        ctx.beginPath();
        ctx.moveTo(P[0].x, P[0].y);
        ctx.lineTo(P[P.length - 1].x, P[P.length - 1].y);
        ctx.stroke();
      }
      return;
    }
    if (d.type === "fibext") {
      const xx0 = this._x(d.p0 && d.p0.t), xx1 = this._x(d.p1 && d.p1.t);
      if (xx0 == null || xx1 == null) return;
      const lv = [0, 0.618, 1, 1.272, 1.618, 2.618];
      const base = d.p0.p, diff = d.p1.p - d.p0.p;
      const xa = Math.min(xx0, xx1), xb = Math.max(xx0, xx1) + 30;
      lv.forEach((l) => {
        const pr = base + diff * l;
        const y = this._y(pr);
        if (y == null) return;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(xa, y);
        ctx.lineTo(xb, y);
        ctx.stroke();
        ctx.fillText(`${String(+l.toFixed(3))}  ${pr.toFixed(this.digits)}`, xa + 4, y - 2);
        ctx.globalAlpha = 1;
      });
      return;
    }
    if (d.type === "hline") {
      const y = this._y(d.p);
      if (y == null) return;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      const lbl = d.p.toFixed(this.digits);
      ctx.save();
      ctx.font = "11px sans-serif";
      const tw = ctx.measureText(lbl).width;
      const pad = 4, tagW = tw + pad * 2, tagH = 15;
      const tx = W - tagW - 2;
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.95;
      ctx.fillRect(tx, y - tagH / 2, tagW, tagH);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(lbl, tx + pad, y);
      ctx.restore();
      return;
    }
    if (d.type === "vline") {
      const x = this._x(d.t);
      if (x == null) return;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      if (this.timeFmt) {
        try {
          const lbl = this.timeFmt(d.t);
          if (lbl) {
            const s = String(lbl);
            ctx.save();
            ctx.font = "11px sans-serif";
            const tw = ctx.measureText(s).width;
            const pad = 4, tagW = tw + pad * 2, tagH = 15;
            let tx = x - tagW / 2;
            tx = Math.max(2, Math.min(tx, this.canvas.width - tagW - 2));
            const ty = H - tagH - 1;
            ctx.fillStyle = d.color;
            ctx.globalAlpha = 0.95;
            ctx.fillRect(tx, ty, tagW, tagH);
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#fff";
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            ctx.fillText(s, tx + pad, ty + tagH / 2);
            ctx.restore();
          }
        } catch (e) {
        }
      }
      return;
    }
    const x0 = this._x(d.p0?.t), y0 = this._y(d.p0?.p), x1 = this._x(d.p1?.t), y1 = this._y(d.p1?.p);
    if (d.type === "text") {
      const x = this._x(d.t), y = this._y(d.p);
      if (x == null || y == null) return;
      const fs = Math.max(8, Math.min(64, d.fontSize || 12));
      const italic = d.italic ? "italic " : "";
      const bold = d.bold ? "bold " : "";
      ctx.font = `${italic}${bold}${fs}px IRANYekanX, Ravagh, Vazirmatn, sans-serif`;
      const lines = String(d.text || "").replace(/\\n/g, "\n").split("\n");
      const lh = Math.round(fs * 1.3);
      if (d.bg || d.border) {
        let tw = 0;
        for (let li = 0; li < lines.length; li++) {
          const w = ctx.measureText(lines[li]).width;
          if (w > tw) tw = w;
        }
        const pad = 3;
        const rx = x - pad, ry = y - fs - pad + 2, rw = tw + pad * 2, rh = (lines.length - 1) * lh + fs + pad * 2;
        if (d.bg) {
          ctx.save();
          ctx.fillStyle = d.bg;
          ctx.globalAlpha = d.bgOpacity != null ? d.bgOpacity : 0.9;
          ctx.fillRect(rx, ry, rw, rh);
          ctx.restore();
        }
        if (d.border) {
          ctx.save();
          ctx.strokeStyle = d.border;
          ctx.lineWidth = 1;
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.restore();
        }
      }
      for (let li = 0; li < lines.length; li++) ctx.fillText(lines[li], x, y + li * lh);
      return;
    }
    if (x0 == null || y0 == null || x1 == null || y1 == null) return;
    if (d.type === "trend") {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (sel && d.p0 && d.p1) {
        const dp = d.p1.p - d.p0.p, pct = d.p0.p ? dp / d.p0.p * 100 : 0;
        const iv = this._barInterval(), bars = iv ? Math.round((d.p1.t - d.p0.t) / iv) : 0;
        const sg = dp >= 0 ? "+" : "\u2212";
        ctx.fillText(`${sg}${Math.abs(dp).toFixed(this.digits)} (${sg}${Math.abs(pct).toFixed(2)}%) \xB7 ${Math.abs(bars)} \u0628\u0627\u0631`, x1 + 8, y1 - 2);
      }
    } else if (d.type === "ray") {
      const dx = x1 - x0, dy = y1 - y0;
      const k = 4e3;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + dx * k, y0 + dy * k);
      ctx.stroke();
    } else if (d.type === "rect") {
      ctx.globalAlpha = d.fillOpacity != null ? d.fillOpacity : 0.18;
      ctx.fillStyle = d.fill || d.color;
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 1;
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    } else if (d.type === "fib") {
      const top = Math.max(d.p0.p, d.p1.p), bot = Math.min(d.p0.p, d.p1.p), rng = top - bot;
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
      const ys = FIB.map((lv) => this._y(top - rng * lv));
      FIB.forEach((lv, i) => {
        const y = ys[i];
        if (y == null) return;
        const col = FIB_COLORS[i] || d.color;
        if (i > 0 && ys[i - 1] != null) {
          ctx.globalAlpha = 0.08;
          ctx.fillStyle = col;
          ctx.fillRect(xa, Math.min(y, ys[i - 1]), xb - xa, Math.abs(y - ys[i - 1]));
          ctx.globalAlpha = 1;
        }
        const price = top - rng * lv;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(xa, y);
        ctx.lineTo(xb, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillText(`${String(+lv.toFixed(3))}  ${price.toFixed(this.digits)}`, xa + 4, y - 2);
      });
    } else if (d.type === "longshort") {
      const entry = d.p0.p, stop = d.p1.p, risk = entry - stop, target = entry + 2 * risk;
      const yE = this._y(entry), yS = this._y(stop), yT = this._y(target);
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1) + 40;
      const rwdPct = entry ? Math.abs(target - entry) / Math.abs(entry) * 100 : 0;
      const rskPct = entry ? Math.abs(stop - entry) / Math.abs(entry) * 100 : 0;
      if (yT != null && yE != null) {
        ctx.fillStyle = "rgba(34,197,94,.15)";
        ctx.fillRect(xa, Math.min(yT, yE), xb - xa, Math.abs(yE - yT));
      }
      if (yS != null && yE != null) {
        ctx.fillStyle = "rgba(239,68,68,.15)";
        ctx.fillRect(xa, Math.min(yS, yE), xb - xa, Math.abs(yE - yS));
      }
      ctx.fillStyle = d.color;
      ctx.strokeStyle = "#22c55e";
      if (yT != null) {
        ctx.beginPath();
        ctx.moveTo(xa, yT);
        ctx.lineTo(xb, yT);
        ctx.stroke();
        ctx.fillText(`\u0647\u062F\u0641 2R  ${target.toFixed(this.digits)} (${rwdPct.toFixed(2)}%)`, xa + 4, yT - 2);
      }
      ctx.strokeStyle = "#94a3b8";
      if (yE != null) {
        ctx.beginPath();
        ctx.moveTo(xa, yE);
        ctx.lineTo(xb, yE);
        ctx.stroke();
        ctx.fillText(`\u0648\u0631\u0648\u062F  ${entry.toFixed(this.digits)}`, xa + 4, yE - 2);
      }
      ctx.strokeStyle = "#ef4444";
      if (yS != null) {
        ctx.beginPath();
        ctx.moveTo(xa, yS);
        ctx.lineTo(xb, yS);
        ctx.stroke();
        ctx.fillText(`\u062D\u062F \u0636\u0631\u0631  ${stop.toFixed(this.digits)} (${rskPct.toFixed(2)}%)`, xa + 4, yS - 2);
      }
    } else if (d.type === "short") {
      const entry = d.p0.p, stop = d.p1.p, risk = stop - entry, target = entry - 2 * risk;
      const yE = this._y(entry), yS = this._y(stop), yT = this._y(target);
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1) + 40;
      const rwdPct = entry ? Math.abs(target - entry) / Math.abs(entry) * 100 : 0;
      const rskPct = entry ? Math.abs(stop - entry) / Math.abs(entry) * 100 : 0;
      if (yT != null && yE != null) {
        ctx.fillStyle = "rgba(34,197,94,.15)";
        ctx.fillRect(xa, Math.min(yT, yE), xb - xa, Math.abs(yE - yT));
      }
      if (yS != null && yE != null) {
        ctx.fillStyle = "rgba(239,68,68,.15)";
        ctx.fillRect(xa, Math.min(yS, yE), xb - xa, Math.abs(yE - yS));
      }
      ctx.fillStyle = d.color;
      ctx.strokeStyle = "#22c55e";
      if (yT != null) {
        ctx.beginPath();
        ctx.moveTo(xa, yT);
        ctx.lineTo(xb, yT);
        ctx.stroke();
        ctx.fillText(`\u0647\u062F\u0641 2R  ${target.toFixed(this.digits)} (${rwdPct.toFixed(2)}%)`, xa + 4, yT - 2);
      }
      ctx.strokeStyle = "#94a3b8";
      if (yE != null) {
        ctx.beginPath();
        ctx.moveTo(xa, yE);
        ctx.lineTo(xb, yE);
        ctx.stroke();
        ctx.fillText(`\u0648\u0631\u0648\u062F  ${entry.toFixed(this.digits)}`, xa + 4, yE - 2);
      }
      ctx.strokeStyle = "#ef4444";
      if (yS != null) {
        ctx.beginPath();
        ctx.moveTo(xa, yS);
        ctx.lineTo(xb, yS);
        ctx.stroke();
        ctx.fillText(`\u062D\u062F \u0636\u0631\u0631  ${stop.toFixed(this.digits)} (${rskPct.toFixed(2)}%)`, xa + 4, yS - 2);
      }
    }
  }
};
export {
  DrawingLayer
};
