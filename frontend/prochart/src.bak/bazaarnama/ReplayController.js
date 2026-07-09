// ReplayController.js — کنترلرِ تمیزِ «بازپخشِ تاریخی» (فصل ۹.۲ اسپک)
// ─────────────────────────────────────────────────────────────────────────────
// این کنترلر کاملاً additive و مستقل از React است؛ هیچ فایلِ مشترکی را تغییر
// نمی‌دهد. منطقِ بازپخش (snapshot، cursor، play/pause/step/speed، slice، seek)
// را کپسوله می‌کند تا BazaarNama بتواند state موجودِ replayِ خود را با آن بِراند.
//
// طراحی: «headless» — کنترلر چیزی روی چارت رسم نمی‌کند. به‌جای آن:
//   • candles را تا یک cursor برش می‌زند (slice) و از callbackها استفاده می‌کند:
//       onSlice(slice)  → هر بار که برشِ کامل بازساخته شد (enter/seek/step-back)
//       onStep(candle, slice, idx) → هنگامِ یک گامِ رو به جلو (برای series.update روان)
//       onChange(state) → هر تغییرِ وضعیت (playing/idx/speed) برای sync با React
//   • تایمرِ play را خودش با setInterval مدیریت می‌کند (delay از سرعت).
//
// شکلِ کندل: { t, o, h, l, c, v }  (t = ثانیهٔ یونیکس)
// نردبانِ سرعت مطابقِ اسپک (۹ گام، سبکِ TradingView):
export const SPEED_LADDER = [0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 30];
const BASE_MS = 1600; // مبنای فاصلهٔ گام در سرعتِ ۱×
const MIN_BARS = 30;  // حداقل کندل برای ورود به بازپخش

// delay (ms) را از سرعت می‌سازد و در بازهٔ امن clamp می‌کند.
export function speedToDelay(speed) {
  const s = speed > 0 ? speed : 1;
  return Math.min(4000, Math.max(16, BASE_MS / s));
}

// جستجوی دودویی برای نزدیک‌ترین کندل با زمانِ ≥ t (برای jump-to-date / seek).
export function indexForTime(full, t) {
  if (!full || !full.length) return 0;
  let lo = 0, hi = full.length - 1;
  if (t <= full[0].t) return 0;
  if (t >= full[hi].t) return hi;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (full[mid].t < t) lo = mid + 1; else hi = mid;
  }
  // نزدیک‌ترین از بینِ lo و lo-1
  if (lo > 0 && Math.abs(full[lo - 1].t - t) <= Math.abs(full[lo].t - t)) return lo - 1;
  return lo;
}

export class ReplayController {
  constructor(opts = {}) {
    this.full = [];          // snapshotِ کاملِ کندل‌ها
    this.idx = 0;            // مکان‌نمای فعلی (آخرین کندلِ آشکارشده)
    this.playing = false;
    this.speed = opts.speed && SPEED_LADDER.includes(opts.speed) ? opts.speed : 1;
    this._timer = null;
    this.onSlice = opts.onSlice || null;   // (slice) => void
    this.onStep = opts.onStep || null;     // (candle, slice, idx) => void
    this.onChange = opts.onChange || null; // (state) => void
    this.onEnd = opts.onEnd || null;       // () => void — وقتی به انتها رسید
  }

  // آیا با این تعداد کندل می‌توان وارد بازپخش شد؟
  static canEnter(candles) { return !!candles && candles.length >= MIN_BARS; }
  get isOn() { return this.full.length > 0; }

  _emitChange() {
    this.onChange && this.onChange({
      on: this.isOn, playing: this.playing, speed: this.speed,
      idx: this.idx, length: this.full.length,
    });
  }

  // ورود: snapshot گرفته می‌شود و cursor تعیین می‌گردد.
  // startIndex: اگر داده شود همان؛ وگرنه startPct (پیش‌فرض ۰٫۵۵ مطابقِ کدِ فعلی).
  enter(candles, opts = {}) {
    const full = (candles || []).slice();
    if (full.length < MIN_BARS) return false;
    let start;
    if (Number.isInteger(opts.startIndex)) start = opts.startIndex;
    else if (Number.isFinite(opts.startTime)) start = indexForTime(full, opts.startTime);
    else start = Math.floor(full.length * (opts.startPct ?? 0.55));
    this.full = full;
    this.idx = this._clamp(start);
    this.playing = false;
    this._stopTimer();
    this._emitSlice();
    this._emitChange();
    return true;
  }

  _clamp(i) { return Math.max(0, Math.min(this.full.length - 1, i)); }

  // برشِ کندل‌ها تا مکان‌نمای فعلی (شاملِ خودِ idx).
  slice() { return this.full.slice(0, this.idx + 1); }

  _emitSlice() { this.onSlice && this.onSlice(this.slice()); }

  // یک گام رو به جلو. اگر به انتها رسید pause + onEnd.
  step() {
    if (!this.isOn) return false;
    if (this.idx >= this.full.length - 1) { this.pause(); this.onEnd && this.onEnd(); return false; }
    this.idx += 1;
    const c = this.full[this.idx];
    // برای روانی، به‌جای بازساختِ کاملِ سری، فقط کندلِ جدید را به مصرف‌کننده می‌دهیم.
    if (this.onStep) this.onStep(c, this.slice(), this.idx);
    else this._emitSlice();
    this._emitChange();
    return true;
  }

  // یک گام به عقب (re-watch). نیاز به بازساختِ کاملِ برش دارد.
  stepBack() {
    if (!this.isOn || this.idx <= 0) return false;
    this.idx -= 1;
    this._emitSlice();
    this._emitChange();
    return true;
  }

  // پرش به ایندکس/زمانِ دلخواه (jump-to-date یا seek با کلیک).
  seek({ index, time } = {}) {
    if (!this.isOn) return false;
    let target = this.idx;
    if (Number.isInteger(index)) target = index;
    else if (Number.isFinite(time)) target = indexForTime(this.full, time);
    this.idx = this._clamp(target);
    this._emitSlice();
    this._emitChange();
    return true;
  }

  play() {
    if (!this.isOn || this.playing) return;
    if (this.idx >= this.full.length - 1) return; // چیزی برای پخش نمانده
    this.playing = true;
    this._startTimer();
    this._emitChange();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this._stopTimer();
    this._emitChange();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  setSpeed(speed) {
    this.speed = SPEED_LADDER.includes(speed) ? speed : this.speed;
    if (this.playing) { this._stopTimer(); this._startTimer(); } // اعمالِ فوریِ سرعتِ جدید
    this._emitChange();
  }

  // خروج: snapshot پاک و تایمر متوقف می‌شود. (بازگرداندنِ دیتای زنده وظیفهٔ caller است.)
  exit() {
    this._stopTimer();
    this.full = [];
    this.idx = 0;
    this.playing = false;
    this._emitChange();
  }

  _startTimer() {
    this._stopTimer();
    this._timer = setInterval(() => {
      if (!this.step()) this._stopTimer(); // step خودش در انتها pause می‌کند
    }, speedToDelay(this.speed));
  }

  _stopTimer() { if (this._timer) { clearInterval(this._timer); this._timer = null; } }

  // برای پاک‌سازیِ امن هنگامِ unmount.
  destroy() { this._stopTimer(); this.onSlice = this.onStep = this.onChange = this.onEnd = null; }
}

export default ReplayController;
