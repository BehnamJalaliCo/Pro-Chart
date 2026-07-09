// بازارنما — لایهٔ ترسیمِ روی چارت (Canvas overlay، مختصاتِ chart-space).
// ابزارها: trend, ray, hline, vline, rect, fib, longshort, text.
// نقاط بر حسبِ {t (unix), p (price)} ذخیره می‌شوند تا با zoom/pan ثابت بمانند.

// افزونهٔ فصل ۴ (PRO_CHART_BUILD_SPEC): ۳۹ ابزارِ ترسیمِ جدید، drop-in.
import { EXT_NEED, EXT_LABELS, isExt, extDraw, extHit, extHandles } from './drawtools_ext';

const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2.618]; // شاملِ سطوحِ گسترشی (مثلِ TradingView)

export class DrawingLayer {
  constructor(canvas, chart) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.chart = chart;
    this.series = null;
    this.tool = 'cursor';
    this.color = '#3b82f6';
    this.width = 1.5; // ضخامتِ پیش‌فرضِ ترسیم‌های جدید
    this.dashed = false; // سبکِ خطِ پیش‌فرضِ ترسیم‌های جدید (خط‌چین/توپر)
    this.lineStyle = 0;  // سبکِ سه‌حالتهٔ ترسیم‌های جدید (0 توپر / 2 خط‌چین / 1 نقطه‌ای)
    this.drawings = [];
    this.hiddenAll = false; // توگلِ سراسریِ چشم (نمایش/پنهانِ همهٔ ترسیم‌ها)
    this.priceDigits = 5;   // دقتِ اعشارِ برچسب‌های قیمتِ ترسیم‌ها (از نماد ست می‌شود)
    this.lockedAll = false; // توگلِ سراسریِ قفل (همهٔ ترسیم‌ها غیرقابلِ‌ویرایش، بدونِ تخریبِ lockedِ per-object)
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
    return ({ trend: 'خطِ روند', ray: 'پرتو', hline: 'خطِ افقی', vline: 'خطِ عمودی', rect: 'مستطیل', fib: 'فیبوناچی', fibext: 'فیبوی گسترشی', longshort: 'موقعیتِ لانگ/شورت', text: 'متن', channel: 'کانال', pitchfork: 'چنگال' }[type] || EXT_LABELS[type] || type);
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
  // توگلِ سراسریِ قفل — بدونِ تغییرِ lockedِ per-object (مثلِ قفلِ نوارِ ابزارِ TradingView)
  setLockedAll(on) { this.lockedAll = !!on; this.render(); }
  _isLocked(d) { return this.lockedAll || !!(d && d.locked); }
  hideAll(on) { this._pushUndo(); this.drawings.forEach((d) => { d.visible = !on; }); this._changed(); }
  // توگلِ سراسریِ نمایش/پنهانِ همهٔ ترسیم‌ها بدونِ تغییرِ visibleِ per-object (مثلِ چشمِ نوارِ ابزارِ TradingView)
  setHiddenAll(on) { this.hiddenAll = !!on; this.render(); }
  // جابه‌جاییِ ترتیبِ لایه (z-order) — ایندکسِ بزرگ‌تر = روی‌تر (آخرین رسم). مثلِ Object Tree تریدینگ‌ویو.
  reorder(from, to) {
    const n = this.drawings.length;
    if (from < 0 || from >= n) return;
    to = Math.max(0, Math.min(n - 1, to));
    if (from === to) return;
    this._pushUndo();
    const [it] = this.drawings.splice(from, 1);
    this.drawings.splice(to, 0, it);
    if (this.selected === from) this.selected = to;
    else if (from < this.selected && to >= this.selected) this.selected--;
    else if (from > this.selected && to <= this.selected) this.selected++;
    this._changed(); this.onSelect && this.onSelect(this.selected);
  }
  bringToFront(i) { this.reorder(i, this.drawings.length - 1); }
  sendToBack(i) { this.reorder(i, 0); }
  // تکثیرِ آبجکتِ انتخاب‌شده (Ctrl+D) — کپیِ عمیق، انتخابِ کپیِ جدید
  cloneSelected() {
    if (this.selected < 0 || this.selected >= this.drawings.length) return;
    this._pushUndo();
    const copy = JSON.parse(JSON.stringify(this.drawings[this.selected]));
    // آفستِ کوچکِ فضای‌صفحه (~۲۴px) تا کپی دقیقاً روی اصل نیفتد و دیده شود (مثلِ Duplicateِ TradingView)
    try {
      const a = copy.pts ? copy.pts[0] : (copy.p0 || { t: copy.t, p: copy.p });
      let dt = 0, dp = 0;
      if (a && a.p != null) { const y = this._y(a.p); const np = y != null ? this._p(y + 24) : null; if (np != null) dp = np - a.p; }
      if (a && a.t != null) { const x = this._x(a.t); const nt = x != null ? this._t(x + 24) : null; if (nt != null) dt = nt - a.t; }
      if (dt || dp) this._moveBy(copy, dt, dp);
    } catch (e) { /* آفست اختیاری است */ }
    this.drawings.push(copy);
    this.selected = this.drawings.length - 1;
    this._changed(); this.onSelect && this.onSelect(this.selected);
  }

  setOrder(o) { this.order = o; this.render(); }

  setProfile(buckets) { this.profile = buckets; this.render(); }
  setScriptPaint(s) { this.script = s; this.render(); }
  setCandles(cs) { this.candles = cs; }
  // مگنتِ سه‌حالته مثلِ TradingView: 'off' | 'weak' | 'strong' (سازگاری: true=strong, false=off)
  setMagnet(mode) { this.magnet = mode === true ? 'strong' : (mode || 'off'); }
  setPriceDigits(n) { const v = Number(n); if (Number.isFinite(v) && v >= 0 && v <= 10) { this.priceDigits = v; this.render(); } }

  _snap(pt) {
    const m = this.magnet;
    if (!m || m === 'off' || !this.candles || !this.candles.length || pt.t == null) return pt;
    // نزدیک‌ترین کندل به زمان
    let best = null, bd = Infinity;
    for (const c of this.candles) { const dd = Math.abs(c.t - pt.t); if (dd < bd) { bd = dd; best = c; } }
    if (!best) return pt;
    // نزدیک‌ترین O/H/L/C به قیمت
    const cand = [best.o, best.h, best.l, best.c];
    let bp = pt.p, bpd = Infinity;
    cand.forEach((v) => { const dd = Math.abs(v - pt.p); if (dd < bpd) { bpd = dd; bp = v; } });
    // مگنتِ ضعیف: قیمت فقط وقتی snap می‌شود که از نظرِ پیکسلی به O/H/L/C نزدیک باشد (~۸px)
    if (m === 'weak') {
      const yTarget = this._y(bp), yCur = this._y(pt.p);
      if (yTarget == null || yCur == null || Math.abs(yTarget - yCur) > 8) return { t: best.t, p: pt.p };
    }
    return { t: best.t, p: bp };
  }

  setSeries(s) { this.series = s; this.render(); }
  setWidth(w) { const n = Number(w); if (Number.isFinite(n) && n > 0) this.width = n; }
  setDashed(on) { this.dashed = !!on; }
  setLineStyle(n) { const v = Number(n); this.lineStyle = (v === 1 || v === 2) ? v : 0; this.dashed = this.lineStyle === 2; }
  setTool(t, color) { this.tool = t; if (color) this.color = color; this.canvas.style.pointerEvents = t === 'cursor' ? 'none' : 'auto'; this.canvas.style.cursor = (t === 'cursor' || t === 'select') ? 'default' : 'crosshair'; if (t !== 'select') { this.selected = -1; this.onSelect && this.onSelect(-1); } }
  setDrawings(arr) { this.drawings = arr || []; this.render(); }
  getDrawings() { return this.drawings; }
  clearLast() { this.drawings.pop(); this._changed(); }

  // #۹ افزودنِ برنامه‌ایِ یک ترسیم (مثلِ جعبهٔ لانگ/شورت از کلیک‌راست) + ثبت در undo/persist
  addDrawing(d) { if (!d || typeof d !== 'object') return; this._pushUndo(); this.drawings.push(d); this.selected = this.drawings.length - 1; this._changed(); this.onSelect && this.onSelect(this.selected); }
  clearAll() { this.drawings = []; this._changed(); }
  _changed() { this.render(); this.onChange && this.onChange(this.drawings); }

  _x(t) { const c = this.chart.timeScale().timeToCoordinate(t); return c; }
  _y(p) { return this.series ? this.series.priceToCoordinate(p) : null; }
  _t(x) { return this.chart.timeScale().coordinateToTime(x); }
  _p(y) { return this.series ? this.series.coordinateToPrice(y) : null; }

  // نقاطِ قابلِ‌درگِ هر آبجکت → [{x,y,set(t,p)}]
  _handlePoints(d) {
    if (isExt(d.type)) { const h = extHandles(d, this); if (h) return h; }
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
          if (sd && !this._isLocked(sd)) { const hi = this._hitHandle(sd, x, y); if (hi >= 0) { this._pushUndo(); this.dragHandle = { idx: this.selected, hi }; return; } }
        }
        // ۲) انتخابِ آبجکت زیرِ کلیک
        const hit = this._hit(x, y);
        this.selected = hit; this.onSelect && this.onSelect(hit); this.render();
        // ۳) اگر روی بدنهٔ آبجکتِ قفل‌نشده کلیک شد → جابه‌جاییِ کلِ آبجکت
        if (hit >= 0 && !this._isLocked(this.drawings[hit])) { const sp = this._snap({ t: this._t(x), p: this._p(y) }); if (sp.t != null && sp.p != null) { this._pushUndo(); this.dragMove = { idx: hit, last: sp, start: sp, startX: x, startY: y }; } }
        return;
      }
      let pt = this._snap({ t: this._t(x), p: this._p(y) });
      if (pt.t == null || pt.p == null) return;
      const NEED = { channel: 3, pitchfork: 3, ...EXT_NEED };
      if (NEED[this.tool]) {
        if (!this.pending || this.pending.type !== this.tool) this.pending = { type: this.tool, pts: [pt], color: this.color };
        else this.pending.pts.push(pt);
        if (this.pending.pts.length >= NEED[this.tool]) { this._pushUndo(); this.drawings.push({ type: this.tool, pts: this.pending.pts.slice(), color: this.color, width: this.width, dashed: this.dashed }); this.pending = null; this._reset(); }
        else this.render();
        return;
      }
      if (this.tool === 'hline') { this._pushUndo(); this.drawings.push({ type: 'hline', p: pt.p, color: this.color, width: this.width, dashed: this.dashed, lineStyle: this.lineStyle }); this._reset(); return; }
      if (this.tool === 'vline') { this._pushUndo(); this.drawings.push({ type: 'vline', t: pt.t, color: this.color, width: this.width, dashed: this.dashed, lineStyle: this.lineStyle }); this._reset(); return; }
      if (this.tool === 'text') { const txt = window.prompt('متن:'); if (txt) { this._pushUndo(); this.drawings.push({ type: 'text', t: pt.t, p: pt.p, text: txt, color: this.color }); } this._reset(); return; }
      this.tmp = { type: this.tool, p0: pt, p1: pt, color: this.color, width: this.width, dashed: this.dashed, lineStyle: this.lineStyle };
      this.dragging = true;
    };
    const move = (e) => {
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (this.dragOrder && this.order) { const pr = this._p(y); if (pr != null) { this.order[this.dragOrder] = pr; this.render(); this.onOrder && this.onOrder({ ...this.order }); } return; }
      // درگِ handle
      if (this.dragHandle) { const d = this.drawings[this.dragHandle.idx]; const sp = this._snap({ t: this._t(x), p: this._p(y) }); if (d && sp.t != null && sp.p != null) { this._handlePoints(d)[this.dragHandle.hi].set(sp.t, sp.p); this.render(); } return; }
      // جابه‌جاییِ کلِ آبجکت
      if (this.dragMove) { const d = this.drawings[this.dragMove.idx]; let sp = this._snap({ t: this._t(x), p: this._p(y) }); if (d && sp.t != null && sp.p != null) { const dm = this.dragMove; if (e.shiftKey && dm.start) { if (Math.abs(x - dm.startX) >= Math.abs(y - dm.startY)) sp = { t: sp.t, p: dm.start.p }; else sp = { t: dm.start.t, p: sp.p }; } this._moveBy(d, sp.t - dm.last.t, sp.p - dm.last.p); dm.last = sp; this.render(); } return; }
      const sp = this._snap({ t: this._t(x), p: this._p(y) });
      // #۱۱ در حالتِ cursor هم ترسیم‌ها قابلِ ویرایش‌اند: وقتی کرسر روی یک ترسیم/دستگیره/خطِ سفارش
      // است، لایهٔ ترسیم را موقتاً فعال می‌کنیم تا کلیک=انتخاب/ویرایش؛ در فضای خالی غیرفعال تا چارت
      // اسکرول/زوم کند. (move روی window است، پس حتی با pointerEvents=none هم اجرا می‌شود.)
      if (this.tool === 'cursor' && !this.dragging && !this.dragMove && !this.dragHandle && !this.dragOrder) {
        const over = this._interactiveAt(x, y);
        const want = over ? 'auto' : 'none';
        if (cv.style.pointerEvents !== want) cv.style.pointerEvents = want;
        cv.style.cursor = over ? 'pointer' : 'default';
      }
      // hover برای cursor (تغییرِ نشانگر)
      if (this.tool === 'select' && !this.dragging) { const sd = this.selected >= 0 ? this.drawings[this.selected] : null; const onH = sd && !this._isLocked(sd) && this._hitHandle(sd, x, y) >= 0; const h = this._hit(x, y); cv.style.cursor = onH ? 'crosshair' : (h >= 0 ? 'move' : 'default'); this.hover = h; }
      if (this.pending && sp.t != null && sp.p != null) { this.pending.preview = sp; this.render(); return; }
      if (!this.dragging || !this.tmp) return;
      if (sp.t != null && sp.p != null) {
        let np = sp;
        // قفل‌های Shift مثلِ TradingView: خط/پرتو → زاویهٔ ۴۵درجه؛ مستطیل → مربع
        if (e.shiftKey && (this.tool === 'trend' || this.tool === 'ray')) {
          const x0 = this._x(this.tmp.p0.t), y0 = this._y(this.tmp.p0.p);
          if (x0 != null && y0 != null) {
            const dx = x - x0, dy = y - y0, len = Math.hypot(dx, dy);
            const snap = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
            const nt = this._t(x0 + len * Math.cos(snap)), npp = this._p(y0 + len * Math.sin(snap));
            if (nt != null && npp != null) np = { t: nt, p: npp };
          }
        } else if (e.shiftKey && this.tool === 'rect') {
          const x0 = this._x(this.tmp.p0.t), y0 = this._y(this.tmp.p0.p);
          if (x0 != null && y0 != null) {
            const dx = x - x0, dy = y - y0, s = Math.max(Math.abs(dx), Math.abs(dy));
            const nt = this._t(x0 + Math.sign(dx || 1) * s), npp = this._p(y0 + Math.sign(dy || 1) * s);
            if (nt != null && npp != null) np = { t: nt, p: npp };
          }
        }
        this.tmp.p1 = np; this.render();
      }
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
    // دابل‌کلیک روی ترسیمِ متنی → ویرایشِ متن (text/callout/note/pricelabel) — مثلِ TradingView
    const dbl = (e) => {
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const i = this._hit(x, y); if (i < 0) return;
      const d = this.drawings[i]; if (!d || this._isLocked(d)) return;
      const TEXTY = { text: 1, callout: 1, note: 1, pricelabel: 1 };
      if (!TEXTY[d.type]) return;
      const txt = window.prompt('متن:', d.text || '');
      if (txt != null) { this._pushUndo(); d.text = txt; this.selected = i; this._changed(); this.onSelect && this.onSelect(i); }
    };
    cv.addEventListener('mousedown', down);
    cv.addEventListener('dblclick', dbl);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('keydown', key);
    this._cleanup = () => { cv.removeEventListener('mousedown', down); cv.removeEventListener('dblclick', dbl); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('keydown', key); };
  }

  // #۱۱ آیا نقطهٔ (x,y) روی چیزی قابلِ‌تعامل است؟ (خطِ سفارش، دستگیرهٔ آبجکتِ انتخاب‌شده، یا بدنهٔ یک ترسیم)
  _interactiveAt(x, y) {
    if (this.order) { for (const k of ['entry', 'sl', 'tp']) { const yy = this._y(this.order[k]); if (yy != null && Math.abs(yy - y) < 7) return true; } }
    if (this.selected >= 0) { const sd = this.drawings[this.selected]; if (sd && !this._isLocked(sd) && this._hitHandle(sd, x, y) >= 0) return true; }
    return this._hit(x, y) >= 0;
  }

  // hit-test: نزدیک‌ترین ترسیم به نقطهٔ کلیک (یا -1)
  _hit(x, y) {
    const near = 7;
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i];
      if (isExt(d.type)) { if (extHit(d, x, y, this)) return i; continue; }
      if (d.type === 'hline') { const yy = this._y(d.p); if (yy != null && Math.abs(yy - y) < near) return i; continue; }
      if (d.type === 'vline') { const xx = this._x(d.t); if (xx != null && Math.abs(xx - x) < near) return i; continue; }
      if (d.type === 'text') { const xx = this._x(d.t), yy = this._y(d.p); if (xx == null || yy == null) continue; const fs = d.fontSize || 14; const w = (d.text ? d.text.length * fs * 0.55 : 20); if (x >= xx - near && x <= xx + w + near && y >= yy - fs - 2 && y <= yy + near) return i; continue; }
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

  _reset() { if (!this.stayInMode) { this.tool = 'cursor'; this.canvas.style.pointerEvents = 'none'; this.canvas.style.cursor = 'default'; this.onToolReset && this.onToolReset(); } this._changed(); }
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
        const hasSplit = (b.volUp != null || b.volDn != null) && b.vol > 0;
        if (hasSplit) {
          // تفکیکِ حجمِ صعودی/نزولی (مثلِ TradingView) — سبز = خریدار، قرمز = فروشنده
          const wUp = ((b.volUp || 0) / b.vol) * w;
          const wDn = w - wUp;
          const aVA = b.va ? 0.5 : 0.28, aPOC = b.poc ? 0.7 : aVA;
          ctx.fillStyle = `rgba(38,166,154,${aPOC})`; ctx.fillRect(W - w, y - h / 2, wUp, h);
          ctx.fillStyle = `rgba(239,83,80,${aPOC})`; ctx.fillRect(W - w + wUp, y - h / 2, wDn, h);
        } else {
          ctx.fillStyle = b.poc ? 'rgba(245,158,11,.55)' : (b.va ? 'rgba(59,130,246,.42)' : 'rgba(59,130,246,.18)');
          ctx.fillRect(W - w, y - h / 2, w, h);
        }
        // خطِ POC — نشانگرِ قیمتِ بیشترین حجم
        if (b.poc) { ctx.strokeStyle = 'rgba(245,158,11,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(W - maxW, y); ctx.lineTo(W, y); ctx.stroke(); }
      });
      // برچسب‌های POC / VAH / VAL (مثلِ TradingView) — در save/restore تا وضعیتِ متنِ کانواس نشت نکند
      ctx.save();
      ctx.font = '10px Vazirmatn, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      const poc = this.profile.find((b) => b.poc);
      const vaB = this.profile.filter((b) => b.va);
      const vah = vaB.length ? vaB.reduce((a, b) => (b.hi > a.hi ? b : a)) : null;
      const val = vaB.length ? vaB.reduce((a, b) => (b.lo < a.lo ? b : a)) : null;
      const tag = (b, price, txt, color) => { const y = this._y(price); if (y == null) return; ctx.fillStyle = color; ctx.fillText(txt, W - maxW - 30, y); };
      if (poc) tag(poc, (poc.lo + poc.hi) / 2, 'POC', 'rgba(245,158,11,.95)');
      if (vah && !vah.poc) tag(vah, vah.hi, 'VAH', 'rgba(59,130,246,.9)');
      if (val && !val.poc) tag(val, val.lo, 'VAL', 'rgba(59,130,246,.9)');
      ctx.restore();
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
    line(yT, '#22c55e', `هدف ${o.tp.toFixed(this.priceDigits)}`);
    line(yE, '#3b82f6', `${o.side === 'buy' ? 'خرید' : 'فروش'} ${o.entry.toFixed(this.priceDigits)}  R:R ${rr}`);
    line(yS, '#ef4444', `حد ضرر ${o.sl.toFixed(this.priceDigits)}`);
  }

  _drawHandles(ctx, d) {
    const hs = this._handlePoints(d);
    hs.forEach((h) => { if (h.x == null || h.y == null) return; ctx.fillStyle = '#fff'; ctx.strokeStyle = d.locked ? '#94a3b8' : '#2962FF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y, 5, 0, 7); ctx.fill(); ctx.stroke(); });
  }

  // برچسبِ اطلاعاتِ خطِ روند/پرتو (Δقیمت + درصد + تعدادِ کندل + زاویه) — فقط هنگامِ انتخاب، مثلِ TradingView
  _drawLineInfo(ctx, x0, y0, x1, y1, d) {
    if ((this.drawings[this.selected] !== d && this.tmp !== d) || !d.p0 || !d.p1) return; // هنگامِ انتخاب یا کشیدنِ زنده
    const dp = d.p1.p - d.p0.p; const pct = d.p0.p ? (dp / d.p0.p) * 100 : 0;
    const bars = Math.round(Math.abs(x1 - x0) / this._barWidth());
    const angle = Math.round(Math.atan2(-(y1 - y0), (x1 - x0)) * 180 / Math.PI);
    const label = `${dp >= 0 ? '+' : ''}${dp.toFixed(this.priceDigits)}  ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%  ${bars} کندل  ${angle}°`;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    ctx.save(); ctx.font = '11px Vazirmatn, sans-serif'; ctx.textAlign = 'left';
    const w = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(20,24,33,.85)'; ctx.fillRect(mx + 6, my - 16, w, 15);
    ctx.fillStyle = d.color || '#fff'; ctx.fillText(label, mx + 10, my - 5);
    ctx.restore();
  }

  // برچسبِ اطلاعاتِ مستطیل (دامنهٔ قیمت + درصد + تعدادِ کندل) — فقط هنگامِ انتخاب، مثلِ TradingView
  _drawRectInfo(ctx, x0, y0, x1, y1, d) {
    if ((this.drawings[this.selected] !== d && this.tmp !== d) || !d.p0 || !d.p1) return; // هنگامِ انتخاب یا کشیدنِ زنده
    const hi = Math.max(d.p0.p, d.p1.p), lo = Math.min(d.p0.p, d.p1.p);
    const rng = hi - lo; const pct = lo ? (rng / lo) * 100 : 0;
    const bars = Math.round(Math.abs(x1 - x0) / this._barWidth());
    const label = `${rng.toFixed(this.priceDigits)}  ${pct.toFixed(2)}%  ${bars} کندل`;
    const mx = Math.min(x0, x1), my = Math.min(y0, y1);
    ctx.save(); ctx.font = '11px Vazirmatn, sans-serif'; ctx.textAlign = 'left';
    const w = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(20,24,33,.85)'; ctx.fillRect(mx, my - 16, w, 15);
    ctx.fillStyle = d.color || '#fff'; ctx.fillText(label, mx + 4, my - 5);
    ctx.restore();
  }

  _draw(ctx, d) {
    if (this.hiddenAll || d.visible === false) return; // توگلِ سراسریِ چشم + مخفیِ per-object (پیش از dispatchِ ext)
    if (isExt(d.type)) { extDraw(ctx, d, this); return; }
    const W = this.canvas.width, H = this.canvas.height;
    ctx.lineWidth = d.width || 1.5; ctx.strokeStyle = d.color; ctx.fillStyle = d.color; ctx.font = '12px Vazirmatn, sans-serif';
    const _ls = d.lineStyle != null ? d.lineStyle : (d.dashed ? 2 : 0); // 0 توپر / 2 خط‌چین / 1 نقطه‌ای
    ctx.setLineDash(_ls === 2 ? [6, 4] : _ls === 1 ? [2, 3] : []);
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
      lv.forEach((l) => { const pr = base + diff * l; const y = this._y(pr); if (y == null) return; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); ctx.fillText(`${(l * 100).toFixed(1)}%  ${pr.toFixed(this.priceDigits)}`, xa + 4, y - 2); ctx.globalAlpha = 1; });
      return;
    }
    if (d.type === 'hline') {
      const y = this._y(d.p); if (y == null) return;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      // برچسبِ قیمت به‌صورتِ پیلِ رنگی (مثلِ TradingView) — هماهنگ با برچسبِ vline
      const label = d.p.toFixed(this.priceDigits);
      ctx.save(); ctx.font = '11px Vazirmatn, sans-serif'; ctx.textAlign = 'left';
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = d.color || '#3b82f6'; ctx.fillRect(2, y - 8, tw, 15);
      ctx.fillStyle = '#fff'; ctx.fillText(label, 6, y + 3);
      ctx.restore();
      return;
    }
    if (d.type === 'vline') {
      const x = this._x(d.t); if (x == null) return;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      // برچسبِ تاریخ/زمان پایینِ خط (روی محورِ زمان) — مثلِ TradingView
      try {
        const dt = new Date(d.t * 1000);
        const label = dt.toLocaleDateString('fa-IR', { month: '2-digit', day: '2-digit' }) + ' ' + dt.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        ctx.save(); ctx.font = '10px Vazirmatn, sans-serif'; ctx.textAlign = 'center';
        const tw = ctx.measureText(label).width + 8;
        ctx.fillStyle = d.color || '#3b82f6'; ctx.fillRect(x - tw / 2, H - 16, tw, 14);
        ctx.fillStyle = '#fff'; ctx.fillText(label, x, H - 6);
        ctx.restore();
      } catch (e) { /* */ }
      return;
    }
    const x0 = this._x(d.p0?.t), y0 = this._y(d.p0?.p), x1 = this._x(d.p1?.t), y1 = this._y(d.p1?.p);
    if (d.type === 'text') { const x = this._x(d.t), y = this._y(d.p); if (x == null || y == null) return; const fs = d.fontSize || 14; ctx.save(); ctx.font = `${d.italic ? 'italic ' : ''}${d.bold ? 'bold ' : ''}${fs}px Vazirmatn, sans-serif`; if (d.textBg) { const tw = ctx.measureText(d.text || '').width; ctx.fillStyle = 'rgba(20,24,33,.85)'; ctx.fillRect(x - 3, y - fs, tw + 6, fs + 6); } ctx.fillStyle = d.color; ctx.fillText(d.text, x, y); ctx.restore(); return; }
    if (x0 == null || y0 == null || x1 == null || y1 == null) return;
    if (d.type === 'trend') {
      const dx = x1 - x0, dy = y1 - y0, k = 4000;
      const sx = d.extendLeft ? x0 - dx * k : x0, sy = d.extendLeft ? y0 - dy * k : y0;
      const ex = d.extendRight ? x1 + dx * k : x1, ey = d.extendRight ? y1 + dy * k : y1;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      // پیکانِ انتها (مثلِ TradingView) — فقط وقتی به راست امتداد نیافته
      if (d.arrowEnd && !d.extendRight) {
        const ang = Math.atan2(y1 - y0, x1 - x0), ah = 9;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - ah * Math.cos(ang - Math.PI / 6), y1 - ah * Math.sin(ang - Math.PI / 6)); ctx.moveTo(x1, y1); ctx.lineTo(x1 - ah * Math.cos(ang + Math.PI / 6), y1 - ah * Math.sin(ang + Math.PI / 6)); ctx.stroke();
      }
      this._drawLineInfo(ctx, x0, y0, x1, y1, d);
    }
    else if (d.type === 'ray') { const dx = x1 - x0, dy = y1 - y0; const k = 4000; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + dx * k, y0 + dy * k); ctx.stroke(); this._drawLineInfo(ctx, x0, y0, x1, y1, d); }
    else if (d.type === 'rect') { if (!d.noFill) { ctx.globalAlpha = 0.12; ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); ctx.globalAlpha = 1; } ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); this._drawRectInfo(ctx, x0, y0, x1, y1, d); }
    else if (d.type === 'fib') {
      const top = Math.max(d.p0.p, d.p1.p), bot = Math.min(d.p0.p, d.p1.p), rng = top - bot;
      const xa = Math.min(x0, x1), xb = W; // امتداد به راست تا لبهٔ دید (مثلِ TradingView)
      const lvlPrice = (lv) => d.reverse ? (bot + rng * lv) : (top - rng * lv); // معکوس: ۰٪ و ۱۰۰٪ جابه‌جا
      const ys = FIB.map((lv) => this._y(lvlPrice(lv)));
      // نوارهای رنگیِ کم‌رنگ بینِ سطوحِ متوالی (زون‌های فیبو مثلِ TradingView)
      for (let k = 0; k < FIB.length - 1; k++) {
        const ya = ys[k], yb = ys[k + 1]; if (ya == null || yb == null) continue;
        ctx.save(); ctx.globalAlpha = 0.06; ctx.fillStyle = d.color || '#3b82f6'; ctx.fillRect(xa, Math.min(ya, yb), xb - xa, Math.abs(yb - ya)); ctx.restore();
      }
      FIB.forEach((lv, k) => { const price = lvlPrice(lv); const y = ys[k]; if (y == null) return; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); ctx.fillText(`${(lv * 100).toFixed(1)}%  ${price.toFixed(this.priceDigits)}`, xa + 4, y - 2); ctx.globalAlpha = 1; });
      // خطِ اتصالِ موربِ بینِ دو نقطهٔ لنگر (مثلِ TradingView)
      ctx.save(); ctx.globalAlpha = 0.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
    }
    else if (d.type === 'longshort') {
      const entry = d.p0.p, stop = d.p1.p, risk = entry - stop, target = entry + 2 * risk;
      const yE = this._y(entry), yS = this._y(stop), yT = this._y(target);
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1) + 40;
      const riskPct = entry ? Math.abs(risk / entry) * 100 : 0;   // درصدِ ریسک از قیمتِ ورود
      const rewPct = entry ? Math.abs((target - entry) / entry) * 100 : 0; // درصدِ سود
      if (yT != null && yE != null) { ctx.fillStyle = 'rgba(34,197,94,.15)'; ctx.fillRect(xa, Math.min(yT, yE), xb - xa, Math.abs(yE - yT)); }
      if (yS != null && yE != null) { ctx.fillStyle = 'rgba(239,68,68,.15)'; ctx.fillRect(xa, Math.min(yS, yE), xb - xa, Math.abs(yE - yS)); }
      ctx.fillStyle = d.color; ctx.strokeStyle = '#22c55e'; if (yT != null) { ctx.beginPath(); ctx.moveTo(xa, yT); ctx.lineTo(xb, yT); ctx.stroke(); ctx.fillText(`هدف ${target.toFixed(this.priceDigits)}  +${rewPct.toFixed(2)}%`, xa + 4, yT - 2); }
      ctx.strokeStyle = '#94a3b8'; if (yE != null) { ctx.beginPath(); ctx.moveTo(xa, yE); ctx.lineTo(xb, yE); ctx.stroke(); ctx.fillText(`ورود ${entry.toFixed(this.priceDigits)}  ⚖ R:R 2.0`, xa + 4, yE - 2); }
      ctx.strokeStyle = '#ef4444'; if (yS != null) { ctx.beginPath(); ctx.moveTo(xa, yS); ctx.lineTo(xb, yS); ctx.stroke(); ctx.fillText(`حد ضرر ${stop.toFixed(this.priceDigits)}  −${riskPct.toFixed(2)}%`, xa + 4, yS - 2); }
    }
  }
}
