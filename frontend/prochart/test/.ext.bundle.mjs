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
var EXT_TOOLS = [
  // خطوط
  { id: "extline", label: "\u062E\u0637\u0650 \u0627\u0645\u062A\u062F\u0627\u062F\u200C\u06CC\u0627\u0641\u062A\u0647", icon: "Slash", points: 2 },
  { id: "infoline", label: "\u062E\u0637\u0650 \u0627\u0637\u0644\u0627\u0639\u0627\u062A\u06CC (\u0394\u0642\u06CC\u0645\u062A/\u062F\u0631\u0635\u062F/\u0628\u0627\u0631/\u0632\u0627\u0648\u06CC\u0647)", icon: "Ruler", points: 2 },
  { id: "angle", label: "\u0632\u0627\u0648\u06CC\u0647\u0654 \u0631\u0648\u0646\u062F", icon: "TrendingUp", points: 2 },
  { id: "hray", label: "\u067E\u0631\u062A\u0648\u0650 \u0627\u0641\u0642\u06CC", icon: "ArrowUpRight", points: 2 },
  { id: "crossline", label: "\u062E\u0637\u0650 \u0635\u0644\u06CC\u0628\u06CC", icon: "Crosshair", points: 2 },
  // کانال‌ها و چنگال‌ها
  { id: "regchannel", label: "\u06A9\u0627\u0646\u0627\u0644\u0650 \u0631\u06AF\u0631\u0633\u06CC\u0648\u0646", icon: "Move", points: 2 },
  { id: "flatchannel", label: "\u06A9\u0627\u0646\u0627\u0644\u0650 \u0633\u0642\u0641/\u06A9\u0641\u0650 \u0635\u0627\u0641 (\u06F3\u0646\u0642\u0637\u0647)", icon: "Move", points: 3 },
  { id: "disjointchannel", label: "\u06A9\u0627\u0646\u0627\u0644\u0650 \u0646\u0627\u067E\u06CC\u0648\u0633\u062A\u0647 (\u06F4\u0646\u0642\u0637\u0647)", icon: "Move", points: 4 },
  { id: "schiff", label: "\u0686\u0646\u06AF\u0627\u0644\u0650 \u0634\u06CC\u0641 (\u06F3\u0646\u0642\u0637\u0647)", icon: "GitBranch", points: 3 },
  { id: "modschiff", label: "\u0686\u0646\u06AF\u0627\u0644\u0650 \u0634\u06CC\u0641\u0650 \u0627\u0635\u0644\u0627\u062D\u200C\u0634\u062F\u0647 (\u06F3\u0646\u0642\u0637\u0647)", icon: "GitBranch", points: 3 },
  { id: "insidepitchfork", label: "\u0686\u0646\u06AF\u0627\u0644\u0650 \u062F\u0627\u062E\u0644\u06CC (\u06F3\u0646\u0642\u0637\u0647)", icon: "GitBranch", points: 3 },
  { id: "pitchfan", label: "\u067E\u06CC\u0686\u200C\u0641\u0646\u0650 \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC (\u06F3\u0646\u0642\u0637\u0647)", icon: "GitBranch", points: 3 },
  // فیبوناچی
  { id: "fib3", label: "\u0641\u06CC\u0628\u0648\u06CC \u06AF\u0633\u062A\u0631\u0634\u06CC\u0650 \u06F3\u0646\u0642\u0637\u0647 (A\u2192B\u2192C)", icon: "Spline", points: 3 },
  { id: "fibfan", label: "\u0628\u0627\u062F\u0628\u0632\u0646\u0650 \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC", icon: "GitBranch", points: 2 },
  { id: "fibtime", label: "\u0646\u0627\u062D\u06CC\u0647\u0654 \u0632\u0645\u0627\u0646\u06CC\u0650 \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC", icon: "Slash", points: 2 },
  { id: "fibtimeext", label: "\u0641\u06CC\u0628\u0648\u06CC \u0632\u0645\u0627\u0646\u06CC\u0650 \u0631\u0648\u0646\u062F\u06CC (\u06F3\u0646\u0642\u0637\u0647)", icon: "Slash", points: 3 },
  { id: "fibchannel", label: "\u06A9\u0627\u0646\u0627\u0644\u0650 \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC (\u06F3\u0646\u0642\u0637\u0647)", icon: "Move", points: 3 },
  { id: "fibcircles", label: "\u062F\u0627\u06CC\u0631\u0647\u200C\u0647\u0627\u06CC \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC", icon: "Crosshair", points: 2 },
  { id: "fibarcs", label: "\u06A9\u0645\u0627\u0646\u200C\u0647\u0627\u06CC \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC", icon: "Spline", points: 2 },
  { id: "fibspiral", label: "\u0645\u0627\u0631\u067E\u06CC\u0686\u0650 \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC", icon: "Spline", points: 2 },
  { id: "fibwedge", label: "\u06AF\u064F\u0648\u0650\u0647\u0654 \u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC (\u06F3\u0646\u0642\u0637\u0647)", icon: "Spline", points: 3 },
  // گان
  { id: "gannbox", label: "\u062C\u0639\u0628\u0647\u0654 \u06AF\u0627\u0646", icon: "Square", points: 2 },
  { id: "gannfan", label: "\u0628\u0627\u062F\u0628\u0632\u0646\u0650 \u06AF\u0627\u0646", icon: "GitBranch", points: 2 },
  { id: "gannsquare", label: "\u0645\u0631\u0628\u0639\u0650 \u06AF\u0627\u0646", icon: "Square", points: 2 },
  { id: "gannfixed", label: "\u0645\u0631\u0628\u0639\u0650 \u062B\u0627\u0628\u062A\u0650 \u06AF\u0627\u0646", icon: "Square", points: 2 },
  // الگوها
  { id: "xabcd", label: "\u0627\u0644\u06AF\u0648\u06CC XABCD (\u06F5\u0646\u0642\u0637\u0647)", icon: "Spline", points: 5 },
  { id: "abcd", label: "\u0627\u0644\u06AF\u0648\u06CC ABCD (\u06F4\u0646\u0642\u0637\u0647)", icon: "Spline", points: 4 },
  { id: "cypher", label: "\u0627\u0644\u06AF\u0648\u06CC \u0633\u0627\u06CC\u0641\u0631 (\u06F5\u0646\u0642\u0637\u0647)", icon: "Spline", points: 5 },
  { id: "tripattern", label: "\u0645\u062B\u0644\u062B\u0650 \u0627\u0644\u06AF\u0648 (\u06F3\u0646\u0642\u0637\u0647)", icon: "TrendingUp", points: 3 },
  { id: "hns", label: "\u0633\u0631 \u0648 \u0634\u0627\u0646\u0647 (\u06F5\u0646\u0642\u0637\u0647)", icon: "Activity", points: 5 },
  { id: "ell_impulse", label: "\u0645\u0648\u062C\u0650 \u0627\u06CC\u0645\u067E\u0627\u0644\u0633\u0650 \u0627\u0644\u06CC\u0648\u062A (\u06F6\u0646\u0642\u0637\u0647)", icon: "Activity", points: 6 },
  { id: "ell_abc", label: "\u0645\u0648\u062C\u0650 \u0627\u0635\u0644\u0627\u062D\u06CC\u0650 \u0627\u0644\u06CC\u0648\u062A (\u06F4\u0646\u0642\u0637\u0647)", icon: "Activity", points: 4 },
  { id: "ell_triangle", label: "\u0645\u062B\u0644\u062B\u0650 \u0627\u0644\u06CC\u0648\u062A (ABCDE\u060C \u06F6\u0646\u0642\u0637\u0647)", icon: "Activity", points: 6 },
  { id: "ell_wxy", label: "\u062A\u0631\u06A9\u06CC\u0628\u0650 \u062F\u0648\u06AF\u0627\u0646\u0647\u0654 \u0627\u0644\u06CC\u0648\u062A (WXY\u060C \u06F4\u0646\u0642\u0637\u0647)", icon: "Activity", points: 4 },
  { id: "ell_wxyxz", label: "\u062A\u0631\u06A9\u06CC\u0628\u0650 \u0633\u0647\u200C\u06AF\u0627\u0646\u0647\u0654 \u0627\u0644\u06CC\u0648\u062A (WXYXZ\u060C \u06F6\u0646\u0642\u0637\u0647)", icon: "Activity", points: 6 },
  { id: "threedrives", label: "\u0627\u0644\u06AF\u0648\u06CC \u0633\u0647\u200C\u062D\u0631\u06A9\u062A (\u06F7\u0646\u0642\u0637\u0647)", icon: "Spline", points: 7 },
  { id: "cyclic", label: "\u062E\u0637\u0648\u0637\u0650 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC", icon: "Slash", points: 2 },
  { id: "timecycles", label: "\u0686\u0631\u062E\u0647\u200C\u0647\u0627\u06CC \u0632\u0645\u0627\u0646\u06CC", icon: "Crosshair", points: 2 },
  { id: "sine", label: "\u062E\u0637\u0650 \u0633\u06CC\u0646\u0648\u0633\u06CC", icon: "Activity", points: 2 },
  // پروجکشن و اندازه‌گیری
  { id: "pricerange", label: "\u0628\u0627\u0632\u0647\u0654 \u0642\u06CC\u0645\u062A", icon: "Ruler", points: 2 },
  { id: "daterange", label: "\u0628\u0627\u0632\u0647\u0654 \u0632\u0645\u0627\u0646", icon: "Ruler", points: 2 },
  { id: "dprange", label: "\u0628\u0627\u0632\u0647\u0654 \u0642\u06CC\u0645\u062A \u0648 \u0632\u0645\u0627\u0646", icon: "Square", points: 2 },
  { id: "forecast", label: "\u067E\u06CC\u0634\u200C\u0628\u06CC\u0646\u06CC", icon: "TrendingUp", points: 2 },
  { id: "projection", label: "\u067E\u0631\u0648\u062C\u06A9\u0634\u0646 (\u06F3\u0646\u0642\u0637\u0647)", icon: "TrendingUp", points: 3 },
  { id: "ruler", label: "\u062E\u0637\u200C\u06A9\u0634 (\u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC\u0650 \u0633\u0631\u06CC\u0639)", icon: "Ruler", points: 2 },
  // اشکال
  { id: "circle", label: "\u062F\u0627\u06CC\u0631\u0647", icon: "Crosshair", points: 2 },
  { id: "ellipse", label: "\u0628\u06CC\u0636\u06CC", icon: "Crosshair", points: 2 },
  { id: "triangle", label: "\u0645\u062B\u0644\u062B", icon: "TrendingUp", points: 3 },
  { id: "rotrect", label: "\u0645\u0633\u062A\u0637\u06CC\u0644\u0650 \u0686\u0631\u062E\u06CC\u062F\u0647 (\u06F3\u0646\u0642\u0637\u0647)", icon: "Square", points: 3 },
  { id: "arrow", label: "\u067E\u06CC\u06A9\u0627\u0646", icon: "ArrowUpRight", points: 2 },
  { id: "brush", label: "\u0642\u0644\u0645\u200C\u0645\u0648\u06CC \u0622\u0632\u0627\u062F", icon: "Pencil", points: -1 },
  { id: "highlighter", label: "\u0647\u0627\u06CC\u200C\u0644\u0627\u06CC\u062A\u0631", icon: "Pencil", points: -1 },
  // یادداشت‌ها
  { id: "callout", label: "\u06A9\u0627\u0644\u200C\u0627\u0648\u062A (\u062D\u0628\u0627\u0628 + \u062E\u0637\u0650 \u0631\u0627\u0647\u0646\u0645\u0627)", icon: "Type", points: 2 },
  { id: "pricelabel", label: "\u0628\u0631\u0686\u0633\u0628\u0650 \u0642\u06CC\u0645\u062A", icon: "Type", points: 2 },
  { id: "note", label: "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A", icon: "Type", points: 2 },
  { id: "arrowdir", label: "\u067E\u06CC\u06A9\u0627\u0646\u0650 \u062C\u0647\u062A\u200C\u062F\u0627\u0631", icon: "ArrowUpRight", points: 2 }
];
export {
  EXT_DRAG2,
  EXT_FREEHAND,
  EXT_LABELS,
  EXT_NEED,
  EXT_REGISTRY,
  EXT_TOOLS,
  extApi,
  extDraw,
  extHandles,
  extHit,
  isExt
};
