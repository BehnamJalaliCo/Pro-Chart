// بازارنما — لایهٔ ترسیمِ روی چارت (Canvas overlay، مختصاتِ chart-space).
// ابزارها: trend, ray, hline, vline, rect, fib, longshort, text.
// نقاط بر حسبِ {t (unix), p (price)} ذخیره می‌شوند تا با zoom/pan ثابت بمانند.

const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export class DrawingLayer {
  constructor(canvas, chart) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.chart = chart;
    this.series = null;
    this.tool = 'cursor';
    this.color = '#3b82f6';
    this.drawings = [];
    this.tmp = null;      // در حالِ ترسیم
    this.dragging = false;
    this.onChange = null;
    this.profile = null;  // Volume Profile buckets
    this.script = null;   // گرافیکِ نمااسکریپت (fill/bgcolor/barcolor/line/box)
    this.selected = -1;   // ایندکسِ ترسیمِ انتخاب‌شده
    this.candles = null;  // برای مگنت (snap به OHLC)
    this.magnet = false;
    this.pending = null;  // ابزارِ چندنقطه‌ایِ در حالِ ساخت
    this.order = null;    // {side, entry, sl, tp} — خطوطِ سفارشِ قابلِ‌درگ
    this.onOrder = null;  // callback هنگامِ درگِ خطوطِ سفارش
    this.dragOrder = null;
    // ── ویرایشِ آبجکت (فاز ۳) ──
    this.dragHandle = null;   // {idx, hi} — درگِ یک handle
    this.dragMove = null;     // {idx, last:{t,p}} — جابه‌جاییِ کلِ آبجکت
    this.hover = -1;          // آبجکتِ زیرِ ماوس (برای cursor)
    this.onSelect = null;     // callback هنگامِ تغییرِ انتخاب
    this.stayInMode = false;  // ماندن در حالتِ ترسیم پس از کشیدن
    this._undo = [];          // پشتهٔ undo (snapshotها)
    this._redo = [];
    this._bind();
  }

  // برچسبِ فارسیِ نوعِ ترسیم (برای Object Tree)
  static label(type) {
    return ({ trend: 'خطِ روند', ray: 'پرتو', hline: 'خطِ افقی', vline: 'خطِ عمودی', rect: 'مستطیل', fib: 'فیبوناچی', fibext: 'فیبوی گسترشی', longshort: 'موقعیتِ لانگ/شورت', text: 'متن', channel: 'کانال', pitchfork: 'چنگال' }[type] || type);
  }
  // snapshotِ عمیق برای undo/redo
  _snapshot() { return JSON.parse(JSON.stringify(this.drawings)); }
  _pushUndo() { this._undo.push(this._snapshot()); if (this._undo.length > 100) this._undo.shift(); this._redo = []; }
  undo() { if (!this._undo.length) return; this._redo.push(this._snapshot()); this.drawings = this._undo.pop(); this.selected = -1; this._changed(); this.onSelect && this.onSelect(-1); }
  redo() { if (!this._redo.length) return; this._undo.push(this._snapshot()); this.drawings = this._redo.pop(); this.selected = -1; this._changed(); this.onSelect && this.onSelect(-1); }
  canUndo() { return this._undo.length > 0; }
  canRedo() { return this._redo.length > 0; }

  // ── API برای Object Tree / نوارِ استایل ──
  selectAt(i) { this.selected = (i >= 0 && i < this.drawings.length) ? i : -1; this.render(); this.onSelect && this.onSelect(this.selected); }
  getSelected() { return this.selected >= 0 ? this.drawings[this.selected] : null; }
  removeAt(i) { if (i < 0 || i >= this.drawings.length) return; this._pushUndo(); this.drawings.splice(i, 1); if (this.selected === i) this.selected = -1; else if (this.selected > i) this.selected--; this._changed(); this.onSelect && this.onSelect(this.selected); }
  toggleVisible(i) { const d = this.drawings[i]; if (!d) return; this._pushUndo(); d.visible = d.visible === false; this._changed(); }
  toggleLock(i) { const d = this.drawings[i]; if (!d) return; this._pushUndo(); d.locked = !d.locked; this._changed(); }
  setStyle(i, st) { const d = this.drawings[i]; if (!d) return; this._pushUndo(); Object.assign(d, st); this._changed(); }
  setStayInMode(on) { this.stayInMode = !!on; }
  lockAll(on) { this._pushUndo(); this.drawings.forEach((d) => { d.locked = on; }); this._changed(); }
  hideAll(on) { this._pushUndo(); this.drawings.forEach((d) => { d.visible = !on; }); this._changed(); }

  setOrder(o) { this.order = o; this.render(); }

  setProfile(buckets) { this.profile = buckets; this.render(); }
  setScriptPaint(s) { this.script = s; this.render(); }
  setCandles(cs) { this.candles = cs; }
  setMagnet(on) { this.magnet = on; }

  _snap(pt) {
    if (!this.magnet || !this.candles || !this.candles.length || pt.t == null) return pt;
    // نزدیک‌ترین کندل به زمان، snap قیمت به نزدیک‌ترین O/H/L/C
    let best = null, bd = Infinity;
    for (const c of this.candles) { const dd = Math.abs(c.t - pt.t); if (dd < bd) { bd = dd; best = c; } }
    if (!best) return pt;
    const cand = [best.o, best.h, best.l, best.c];
    let bp = pt.p, bpd = Infinity;
    cand.forEach((v) => { const dd = Math.abs(v - pt.p); if (dd < bpd) { bpd = dd; bp = v; } });
    return { t: best.t, p: bp };
  }

  setSeries(s) { this.series = s; this.render(); }
  setTool(t, color) { this.tool = t; if (color) this.color = color; this.canvas.style.pointerEvents = t === 'cursor' ? 'none' : 'auto'; this.canvas.style.cursor = (t === 'cursor' || t === 'select') ? 'default' : 'crosshair'; if (t !== 'select') { this.selected = -1; this.onSelect && this.onSelect(-1); } }
  setDrawings(arr) { this.drawings = arr || []; this.render(); }
  getDrawings() { return this.drawings; }
  clearLast() { this.drawings.pop(); this._changed(); }
  clearAll() { this.drawings = []; this._changed(); }
  _changed() { this.render(); this.onChange && this.onChange(this.drawings); }

  _x(t) { const c = this.chart.timeScale().timeToCoordinate(t); return c; }
  _y(p) { return this.series ? this.series.priceToCoordinate(p) : null; }
  _t(x) { return this.chart.timeScale().coordinateToTime(x); }
  _p(y) { return this.series ? this.series.coordinateToPrice(y) : null; }

  // نقاطِ قابلِ‌درگِ هر آبجکت → [{x,y,set(t,p)}]
  _handlePoints(d) {
    if (d.type === 'hline') { const y = this._y(d.p); return [{ x: 14, y, set: (t, p) => { d.p = p; } }]; }
    if (d.type === 'vline') { const x = this._x(d.t); return [{ x, y: 14, set: (t) => { d.t = t; } }]; }
    if (d.type === 'text') { return [{ x: this._x(d.t), y: this._y(d.p), set: (t, p) => { d.t = t; d.p = p; } }]; }
    if (d.pts) return d.pts.map((pp, k) => ({ x: this._x(pp.t), y: this._y(pp.p), set: (t, p) => { d.pts[k] = { t, p }; } }));
    const out = [];
    if (d.p0) out.push({ x: this._x(d.p0.t), y: this._y(d.p0.p), set: (t, p) => { d.p0 = { t, p }; } });
    if (d.p1) out.push({ x: this._x(d.p1.t), y: this._y(d.p1.p), set: (t, p) => { d.p1 = { t, p }; } });
    return out;
  }
  _hitHandle(d, x, y) { const hs = this._handlePoints(d); for (let i = 0; i < hs.length; i++) { const h = hs[i]; if (h.x != null && h.y != null && Math.hypot(x - h.x, y - h.y) < 9) return i; } return -1; }
  _moveBy(d, dt, dp) {
    const mv = (pt) => ({ t: pt.t + dt, p: pt.p + dp });
    if (d.type === 'hline') { d.p += dp; return; }
    if (d.type === 'vline') { d.t += dt; return; }
    if (d.type === 'text') { d.t += dt; d.p += dp; return; }
    if (d.pts) { d.pts = d.pts.map(mv); return; }
    if (d.p0) d.p0 = mv(d.p0); if (d.p1) d.p1 = mv(d.p1);
  }

  _bind() {
    const cv = this.canvas;
    const down = (e) => {
      if (!this.series) return;
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (this.tool === 'cursor' || this.tool === 'select') {
        // درگِ خطوطِ سفارش (entry/sl/tp)
        if (this.order) { for (const k of ['entry', 'sl', 'tp']) { const yy = this._y(this.order[k]); if (yy != null && Math.abs(yy - y) < 7) { this.dragOrder = k; return; } } }
        // ۱) اگر آبجکتی انتخاب شده، روی handleهایش کلیک شده؟ → درگِ handle
        if (this.selected >= 0) {
          const sd = this.drawings[this.selected];
          if (sd && !sd.locked) { const hi = this._hitHandle(sd, x, y); if (hi >= 0) { this._pushUndo(); this.dragHandle = { idx: this.selected, hi }; return; } }
        }
        // ۲) انتخابِ آبجکت زیرِ کلیک
        const hit = this._hit(x, y);
        this.selected = hit; this.onSelect && this.onSelect(hit); this.render();
        // ۳) اگر روی بدنهٔ آبجکتِ قفل‌نشده کلیک شد → جابه‌جاییِ کلِ آبجکت
        if (hit >= 0 && !this.drawings[hit].locked) { const sp = this._snap({ t: this._t(x), p: this._p(y) }); if (sp.t != null && sp.p != null) { this._pushUndo(); this.dragMove = { idx: hit, last: sp }; } }
        return;
      }
      let pt = this._snap({ t: this._t(x), p: this._p(y) });
      if (pt.t == null || pt.p == null) return;
      const NEED = { channel: 3, pitchfork: 3 };
      if (NEED[this.tool]) {
        if (!this.pending || this.pending.type !== this.tool) this.pending = { type: this.tool, pts: [pt], color: this.color };
        else this.pending.pts.push(pt);
        if (this.pending.pts.length >= NEED[this.tool]) { this._pushUndo(); this.drawings.push({ type: this.tool, pts: this.pending.pts.slice(), color: this.color, width: 1.5 }); this.pending = null; this._reset(); }
        else this.render();
        return;
      }
      if (this.tool === 'hline') { this._pushUndo(); this.drawings.push({ type: 'hline', p: pt.p, color: this.color, width: 1.5 }); this._reset(); return; }
      if (this.tool === 'vline') { this._pushUndo(); this.drawings.push({ type: 'vline', t: pt.t, color: this.color, width: 1.5 }); this._reset(); return; }
      if (this.tool === 'text') { const txt = window.prompt('متن:'); if (txt) { this._pushUndo(); this.drawings.push({ type: 'text', t: pt.t, p: pt.p, text: txt, color: this.color }); } this._reset(); return; }
      this.tmp = { type: this.tool, p0: pt, p1: pt, color: this.color, width: 1.5 };
      this.dragging = true;
    };
    const move = (e) => {
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (this.dragOrder && this.order) { const pr = this._p(y); if (pr != null) { this.order[this.dragOrder] = pr; this.render(); this.onOrder && this.onOrder({ ...this.order }); } return; }
      // درگِ handle
      if (this.dragHandle) { const d = this.drawings[this.dragHandle.idx]; const sp = this._snap({ t: this._t(x), p: this._p(y) }); if (d && sp.t != null && sp.p != null) { this._handlePoints(d)[this.dragHandle.hi].set(sp.t, sp.p); this.render(); } return; }
      // جابه‌جاییِ کلِ آبجکت
      if (this.dragMove) { const d = this.drawings[this.dragMove.idx]; const sp = this._snap({ t: this._t(x), p: this._p(y) }); if (d && sp.t != null && sp.p != null) { this._moveBy(d, sp.t - this.dragMove.last.t, sp.p - this.dragMove.last.p); this.dragMove.last = sp; this.render(); } return; }
      const sp = this._snap({ t: this._t(x), p: this._p(y) });
      // hover برای cursor (تغییرِ نشانگر)
      if (this.tool === 'select' && !this.dragging) { const sd = this.selected >= 0 ? this.drawings[this.selected] : null; const onH = sd && !sd.locked && this._hitHandle(sd, x, y) >= 0; const h = this._hit(x, y); cv.style.cursor = onH ? 'crosshair' : (h >= 0 ? 'move' : 'default'); this.hover = h; }
      if (this.pending && sp.t != null && sp.p != null) { this.pending.preview = sp; this.render(); return; }
      if (!this.dragging || !this.tmp) return;
      if (sp.t != null && sp.p != null) { this.tmp.p1 = sp; this.render(); }
    };
    const up = () => {
      if (this.dragOrder) { this.dragOrder = null; return; }
      if (this.dragHandle) { this.dragHandle = null; this._changed(); return; }
      if (this.dragMove) { this.dragMove = null; this._changed(); return; }
      if (this.tmp) { this.drawings.push(this.tmp); this.tmp = null; this.dragging = false; this._reset(); }
    };
    const key = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected >= 0) { this.removeAt(this.selected); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); this.redo(); return; }
      if (e.key === 'Escape') { this.selected = -1; this.pending = null; this.render(); this.onSelect && this.onSelect(-1); }
    };
    cv.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('keydown', key);
    this._cleanup = () => { cv.removeEventListener('mousedown', down); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('keydown', key); };
  }

  // hit-test: نزدیک‌ترین ترسیم به نقطهٔ کلیک (یا -1)
  _hit(x, y) {
    const near = 7;
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i];
      if (d.type === 'hline') { const yy = this._y(d.p); if (yy != null && Math.abs(yy - y) < near) return i; continue; }
      if (d.type === 'vline') { const xx = this._x(d.t); if (xx != null && Math.abs(xx - x) < near) return i; continue; }
      const x0 = this._x(d.p0 && d.p0.t), y0 = this._y(d.p0 && d.p0.p), x1 = this._x(d.p1 && d.p1.t), y1 = this._y(d.p1 && d.p1.p);
      if (x0 == null || x1 == null) continue;
      if (d.type === 'rect' || d.type === 'fib' || d.type === 'longshort') {
        if (x >= Math.min(x0, x1) - near && x <= Math.max(x0, x1) + near && y >= Math.min(y0, y1) - near && y <= Math.max(y0, y1) + near) return i;
      } else { // خط: فاصله تا پاره‌خط
        const A = x - x0, B = y - y0, C = x1 - x0, D = y1 - y0; const dot = A * C + B * D, len = C * C + D * D; const t = len ? Math.max(0, Math.min(1, dot / len)) : 0;
        const px = x0 + t * C, py = y0 + t * D; if (Math.hypot(x - px, y - py) < near) return i;
      }
    }
    return -1;
  }

  _reset() { if (!this.stayInMode) { this.tool = 'cursor'; this.canvas.style.pointerEvents = 'none'; this.canvas.style.cursor = 'default'; } this._changed(); }
  destroy() { this._cleanup && this._cleanup(); }

  resize(w, h) { this.canvas.width = w; this.canvas.height = h; this.render(); }

  _barWidth() { try { const o = this.chart.timeScale().options(); if (o && o.barSpacing) return Math.max(2, o.barSpacing); } catch (e) { /* */ } return 6; }

  // رندرِ گرافیکِ نمااسکریپت روی کانواس (با مختصاتِ زندهٔ چارت؛ خودکار با پن/زوم به‌روز می‌شود)
  _paintScript(ctx, W, H) {
    const s = this.script; if (!s) return;
    const bw = this._barWidth();
    // bgcolor — نوارِ عمودیِ تمام‌ارتفاع روی کندل‌های شرط
    (s.bgs || []).forEach((g) => { ctx.fillStyle = g.color || 'rgba(59,130,246,.10)'; (g.bars || []).forEach((t) => { const x = this._x(t); if (x == null) return; ctx.fillRect(x - bw / 2, 0, Math.max(1, bw), H); }); });
    // fill — ناحیهٔ پُرشده بینِ دو سری
    (s.fills || []).forEach((f) => {
      const A = f.a || [], B = f.b || []; if (A.length < 2 || B.length < 2) return;
      ctx.beginPath(); let started = false;
      for (let i = 0; i < A.length; i++) { const x = this._x(A[i].time), y = this._y(A[i].value); if (x == null || y == null) continue; if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); }
      for (let i = B.length - 1; i >= 0; i--) { const x = this._x(B[i].time), y = this._y(B[i].value); if (x == null || y == null) continue; ctx.lineTo(x, y); }
      ctx.closePath(); ctx.fillStyle = f.color || 'rgba(59,130,246,.12)'; ctx.fill();
    });
    // box.new
    (s.boxes || []).forEach((b) => { const x1 = this._x(b.left), x2 = this._x(b.right), y1 = this._y(b.top), y2 = this._y(b.bottom); if (x1 == null || x2 == null || y1 == null || y2 == null) return; const X = Math.min(x1, x2), Y = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1); ctx.fillStyle = b.bg || 'rgba(59,130,246,.08)'; ctx.fillRect(X, Y, w, h); ctx.strokeStyle = b.color || '#3b82f6'; ctx.lineWidth = 1; ctx.strokeRect(X, Y, w, h); });
    // line.new
    (s.lines || []).forEach((l) => { const x1 = this._x(l.x1), x2 = this._x(l.x2), y1 = this._y(l.y1), y2 = this._y(l.y2); if (x1 == null || x2 == null || y1 == null || y2 == null) return; ctx.strokeStyle = l.color || '#3b82f6'; ctx.lineWidth = l.width || 1; if (l.style === 2) ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]); });
    // barcolor — نقطهٔ رنگیِ کوچک زیرِ کندل‌های شرط
    (s.barcolors || []).forEach((bc) => { if (bc.all) return; ctx.fillStyle = bc.color || '#f59e0b'; (bc.bars || []).forEach((t) => { const x = this._x(t); if (x == null) return; ctx.beginPath(); ctx.arc(x, H - 8, 2.5, 0, 7); ctx.fill(); }); });
  }

  render() {
    const ctx = this.ctx; if (!ctx) return;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    // Volume Profile (نوارهای افقیِ سمتِ راست)
    if (this.profile && this.profile.length) {
      const maxV = Math.max(...this.profile.map((b) => b.vol)) || 1;
      const maxW = Math.min(160, W * 0.18);
      this.profile.forEach((b) => {
        const y = this._y((b.lo + b.hi) / 2); if (y == null) return;
        const yh = this._y(b.hi), yl = this._y(b.lo); const h = (yh != null && yl != null) ? Math.max(2, Math.abs(yl - yh) - 1) : 4;
        const w = (b.vol / maxV) * maxW;
        ctx.fillStyle = b.poc ? 'rgba(245,158,11,.5)' : 'rgba(59,130,246,.28)';
        ctx.fillRect(W - w, y - h / 2, w, h);
      });
    }
    if (this.script) this._paintScript(ctx, W, H);
    const all = this.tmp ? [...this.drawings, this.tmp] : this.drawings;
    all.forEach((d, i) => { this._draw(ctx, d); if (i === this.selected) this._drawHandles(ctx, d); });
    if (this.pending) {
      const pts = this.pending.preview ? [...this.pending.pts, this.pending.preview] : this.pending.pts;
      this._draw(ctx, { type: this.pending.type, pts, color: this.pending.color });
      ctx.fillStyle = this.pending.color;
      this.pending.pts.forEach((p) => { const x = this._x(p.t), y = this._y(p.p); if (x != null && y != null) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); } });
    }
    if (this.order) this._drawOrder(ctx);
  }

  _drawOrder(ctx) {
    const W = this.canvas.width;
    const o = this.order;
    const yE = this._y(o.entry), yS = this._y(o.sl), yT = this._y(o.tp);
    ctx.font = '11px Vazirmatn, sans-serif'; ctx.lineWidth = 1;
    const risk = Math.abs(o.entry - o.sl), reward = Math.abs(o.tp - o.entry);
    const rr = risk ? (reward / risk).toFixed(2) : '—';
    // نواحی
    if (yE != null && yT != null) { ctx.fillStyle = 'rgba(34,197,94,.10)'; ctx.fillRect(0, Math.min(yE, yT), W, Math.abs(yE - yT)); }
    if (yE != null && yS != null) { ctx.fillStyle = 'rgba(239,68,68,.10)'; ctx.fillRect(0, Math.min(yE, yS), W, Math.abs(yE - yS)); }
    const line = (y, col, label) => { if (y == null) return; ctx.strokeStyle = col; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = col; ctx.fillRect(4, y - 7, 14, 14); ctx.fillStyle = '#fff'; ctx.fillText('⇕', 6, y + 4); ctx.fillStyle = col; ctx.fillText(label, 22, y - 3); };
    line(yT, '#22c55e', `هدف ${o.tp.toFixed(5)}`);
    line(yE, '#3b82f6', `${o.side === 'buy' ? 'خرید' : 'فروش'} ${o.entry.toFixed(5)}  R:R ${rr}`);
    line(yS, '#ef4444', `حد ضرر ${o.sl.toFixed(5)}`);
  }

  _drawHandles(ctx, d) {
    const hs = this._handlePoints(d);
    hs.forEach((h) => { if (h.x == null || h.y == null) return; ctx.fillStyle = '#fff'; ctx.strokeStyle = d.locked ? '#94a3b8' : '#2962FF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y, 5, 0, 7); ctx.fill(); ctx.stroke(); });
  }

  _draw(ctx, d) {
    if (d.visible === false) return;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.lineWidth = d.width || 1.5; ctx.strokeStyle = d.color; ctx.fillStyle = d.color; ctx.font = '12px Vazirmatn, sans-serif';
    ctx.setLineDash(d.dashed ? [6, 4] : []);
    // ابزارهای چندنقطه‌ای
    if (d.type === 'channel' && d.pts) {
      const P = d.pts.map((p) => ({ x: this._x(p.t), y: this._y(p.p) }));
      if (P.some((p) => p.x == null || p.y == null) || P.length < 2) return;
      ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); ctx.lineTo(P[1].x, P[1].y); ctx.stroke();
      if (P.length >= 3) { const dx = P[1].x - P[0].x, dy = P[1].y - P[0].y; const ox = P[2].x - P[0].x, oy = P[2].y - P[0].y;
        ctx.beginPath(); ctx.moveTo(P[0].x + ox, P[0].y + oy); ctx.lineTo(P[1].x + ox, P[1].y + oy); ctx.stroke();
        ctx.globalAlpha = 0.08; ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); ctx.lineTo(P[1].x, P[1].y); ctx.lineTo(P[1].x + ox, P[1].y + oy); ctx.lineTo(P[0].x + ox, P[0].y + oy); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
      return;
    }
    if (d.type === 'pitchfork' && d.pts) {
      const P = d.pts.map((p) => ({ x: this._x(p.t), y: this._y(p.p) }));
      if (P.some((p) => p.x == null || p.y == null) || P.length < 2) return;
      if (P.length >= 3) { const mx = (P[1].x + P[2].x) / 2, my = (P[1].y + P[2].y) / 2;
        const dx = mx - P[0].x, dy = my - P[0].y; const k = 3;
        ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); ctx.lineTo(P[0].x + dx * k, P[0].y + dy * k); ctx.stroke(); // مدین
        [P[1], P[2]].forEach((pp) => { ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(pp.x, pp.y); ctx.lineTo(pp.x + dx * k, pp.y + dy * k); ctx.stroke(); ctx.globalAlpha = 1; });
      } else { ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); ctx.lineTo(P[P.length - 1].x, P[P.length - 1].y); ctx.stroke(); }
      return;
    }
    if (d.type === 'fibext') {
      const xx0 = this._x(d.p0 && d.p0.t), xx1 = this._x(d.p1 && d.p1.t);
      if (xx0 == null || xx1 == null) return;
      const lv = [0, 0.618, 1, 1.272, 1.618, 2.618]; const base = d.p0.p, diff = d.p1.p - d.p0.p;
      const xa = Math.min(xx0, xx1), xb = Math.max(xx0, xx1) + 30;
      lv.forEach((l) => { const pr = base + diff * l; const y = this._y(pr); if (y == null) return; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); ctx.fillText(`${(l * 100).toFixed(1)}%  ${pr.toFixed(5)}`, xa + 4, y - 2); ctx.globalAlpha = 1; });
      return;
    }
    if (d.type === 'hline') { const y = this._y(d.p); if (y == null) return; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.fillText(d.p.toFixed(5), 4, y - 3); return; }
    if (d.type === 'vline') { const x = this._x(d.t); if (x == null) return; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); return; }
    const x0 = this._x(d.p0?.t), y0 = this._y(d.p0?.p), x1 = this._x(d.p1?.t), y1 = this._y(d.p1?.p);
    if (d.type === 'text') { const x = this._x(d.t), y = this._y(d.p); if (x == null || y == null) return; ctx.fillText(d.text, x, y); return; }
    if (x0 == null || y0 == null || x1 == null || y1 == null) return;
    if (d.type === 'trend') { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    else if (d.type === 'ray') { const dx = x1 - x0, dy = y1 - y0; const k = 4000; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + dx * k, y0 + dy * k); ctx.stroke(); }
    else if (d.type === 'rect') { ctx.globalAlpha = 0.12; ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); ctx.globalAlpha = 1; ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); }
    else if (d.type === 'fib') {
      const top = Math.max(d.p0.p, d.p1.p), bot = Math.min(d.p0.p, d.p1.p), rng = top - bot;
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
      FIB.forEach((lv) => { const price = top - rng * lv; const y = this._y(price); if (y == null) return; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); ctx.fillText(`${(lv * 100).toFixed(1)}%  ${price.toFixed(5)}`, xa + 4, y - 2); ctx.globalAlpha = 1; });
    }
    else if (d.type === 'longshort') {
      const entry = d.p0.p, stop = d.p1.p, risk = entry - stop, target = entry + 2 * risk;
      const yE = this._y(entry), yS = this._y(stop), yT = this._y(target);
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1) + 40;
      if (yT != null && yE != null) { ctx.fillStyle = 'rgba(34,197,94,.15)'; ctx.fillRect(xa, Math.min(yT, yE), xb - xa, Math.abs(yE - yT)); }
      if (yS != null && yE != null) { ctx.fillStyle = 'rgba(239,68,68,.15)'; ctx.fillRect(xa, Math.min(yS, yE), xb - xa, Math.abs(yE - yS)); }
      ctx.fillStyle = d.color; ctx.strokeStyle = '#22c55e'; if (yT != null) { ctx.beginPath(); ctx.moveTo(xa, yT); ctx.lineTo(xb, yT); ctx.stroke(); ctx.fillText('هدف 2R', xa + 4, yT - 2); }
      ctx.strokeStyle = '#94a3b8'; if (yE != null) { ctx.beginPath(); ctx.moveTo(xa, yE); ctx.lineTo(xb, yE); ctx.stroke(); ctx.fillText('ورود', xa + 4, yE - 2); }
      ctx.strokeStyle = '#ef4444'; if (yS != null) { ctx.beginPath(); ctx.moveTo(xa, yS); ctx.lineTo(xb, yS); ctx.stroke(); ctx.fillText('حد ضرر', xa + 4, yS - 2); }
    }
  }
}
