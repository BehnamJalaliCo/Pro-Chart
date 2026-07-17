// ─────────────────────────────────────────────────────────────────────────────
// AlertsPanel.jsx — سازندهٔ پیشرفتهٔ آلارم + فهرستِ آلارم‌ها (فصل ۷ از PRO_CHART_BUILD_SPEC)
//
// ماژولِ drop-in و خودبسنده برای تبِ «آلارم» در پنلِ راستِ بازارنما.
// همتراز با TradingView: منبعِ شرط (قیمت / اندیکاتور / ترسیم) × عملگرها
// (تقاطع / بزرگ‌تر / کوچک‌تر / ورود-به-کانال / حرکت) × مقدار یا منبعِ دوم ×
// تریگر (یک‌بار / هربار + کول‌داون) × انقضا × قالبِ پیام با {symbol}{price} ×
// کانال‌های تحویل (پاپ‌آپ/تلگرام) + فهرستِ تمیزِ آلارم‌های ذخیره‌شده با
// روشن/خاموش، ویرایش و حذف.
//
// قواعد:
//  • فقط api.* برای ماندگاری؛ اگر فیلدی سمتِ سرور پشتیبانی نشود graceful است
//    (همه در condition JSON ذخیره می‌شود؛ سرورِ فعلی هر کلیدِ ناشناخته را نگه می‌دارد).
//  • سازگاریِ کاملِ پس‌رو: condition همان type/op/value/trigger/telegram/message/expiry
//    قبلی را تولید می‌کند و فیلدهای جدید فقط افزوده می‌شوند.
//  • هیچ رنگِ هاردکدی بیرون از TH؛ RTL برای متن، dir="ltr" برای اعداد/تیکرها.
//
// Props: { symbol, price, TH, indicators }
//   symbol      : string  — نمادِ جاری (مثلِ EURUSD)
//   price       : number  — قیمتِ زندهٔ جاری (برای پیش‌نمایشِ فاصله)
//   TH          : object  — توکن‌های تم
//   indicators  : array   — اندیکاتورهای فعالِ روی چارت [{ id, key, inputs, color }]
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Bell, BellOff, Plus, X, Pencil, Check, Send, MessageSquare, Clock, Repeat, ChevronDown,
  Mail, Smartphone, Volume2, Webhook, MessageCircle, History, ListChecks } from './tvIcons';
import { api } from '../api/client';
import { REGISTRY } from './indicators';
import { priceDigits } from './symbolMeta';

// نمایشِ قیمت با دقتِ درستِ نماد + جداکنندهٔ هزارگان (هم‌راستا با بقیهٔ اپ و TradingView).
const fmtHeadPrice = (sym, v) => {
  if (v == null || !Number.isFinite(Number(v))) return v;
  const d = priceDigits(sym, Number(v));
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

// ── واژگانِ منبع/عملگر ───────────────────────────────────────────────────────
const SOURCES = [
  { id: 'price', label: 'قیمتِ نماد' },
  { id: 'indicator', label: 'اندیکاتور' },
  { id: 'drawing', label: 'خطِ ترسیم‌شده' },
  { id: 'watchlist', label: 'کلِ واچ‌لیست' },
];

// فراوانیِ تریگر — همتراز با TradingView (Only Once / Once Per Bar / Once Per Bar Close / Per Minute).
//  trigger (پس‌رو): once | recurring؛ frequency (جدید) دانه‌بندیِ دقیق را نگه می‌دارد.
const FREQS = [
  { id: 'once', label: 'فقط یک‌بار', trigger: 'once' },
  { id: 'per_bar', label: 'هر کندل', trigger: 'recurring' },
  { id: 'per_bar_close', label: 'هر بستهٔ کندل', trigger: 'recurring' },
  { id: 'per_minute', label: 'هر دقیقه', trigger: 'recurring' },
  { id: 'cooldown', label: 'هربار (با کول‌داون)', trigger: 'recurring' },
];

// عملگرها با برچسبِ فارسی، نوعِ عملوندِ راست و آیا مقدارِ درصدی است.
//  rhs: 'value' → یک مقدار | 'channel' → دو مقدار lo/hi | 'source' هم مجاز است (منبعِ دوم)
const OPS = [
  { id: 'cross', label: 'تقاطع (هر دو جهت)', rhs: 'value' },
  { id: 'cross_up', label: 'تقاطعِ صعودی از', rhs: 'value' },
  { id: 'cross_down', label: 'تقاطعِ نزولی از', rhs: 'value' },
  { id: 'above', label: 'بزرگ‌تر از', rhs: 'value' },
  { id: 'below', label: 'کوچک‌تر از', rhs: 'value' },
  { id: 'enter_channel', label: 'ورود به کانال', rhs: 'channel' },
  { id: 'exit_channel', label: 'خروج از کانال', rhs: 'channel' },
  // ترتیبِ کانونیِ TradingView: «حرکتِ درصدی» پیش از «حرکتِ مقداری» (Moving Up % / Down % → Moving Up / Down). #260
  //   فقط ترتیبِ نمایشِ dropdown است؛ idها و نگاشتِ سروری دست‌نخورده ⇒ بی‌خطر برای شلیکِ آلارم. [[prochart-alert-ops-alignment]]
  { id: 'pct_up', label: 'صعودِ ٪', rhs: 'value', pct: true },
  { id: 'pct_down', label: 'نزولِ ٪', rhs: 'value', pct: true },
  { id: 'move_up_value', label: 'صعود به اندازهٔ (مقدار)', rhs: 'value' },
  { id: 'move_down_value', label: 'نزول به اندازهٔ (مقدار)', rhs: 'value' },
];

const OP_SHORT = OPS.reduce((m, o) => { m[o.id] = o.label; return m; }, {});

// برچسبِ کوتاه برای ساختِ نامِ خودکار.
const OP_NAME = {
  cross: 'تقاطعِ', cross_up: 'تقاطعِ صعودی از', cross_down: 'تقاطعِ نزولی از',
  above: 'بالای', below: 'پایینِ', enter_channel: 'ورود به کانالِ', exit_channel: 'خروج از کانالِ',
  move_up_value: 'صعودِ', move_down_value: 'نزولِ', pct_up: 'صعودِ ٪', pct_down: 'نزولِ ٪',
};

// خروجی‌های قابل‌انتخابِ هر اندیکاتور (برای منبعِ اندیکاتور).
// از شکلِ calc() اندیکاتور استنتاج می‌شود؛ پیش‌فرض «خط».
function indicatorFields(key) {
  const def = REGISTRY[key];
  if (!def) return [{ id: 'line', label: 'مقدار' }];
  if (key === 'macd') return [{ id: 'macd', label: 'خطِ MACD' }, { id: 'signal', label: 'سیگنال' }, { id: 'hist', label: 'هیستوگرام' }];
  if (key === 'bb') return [{ id: 'upper', label: 'باندِ بالا' }, { id: 'basis', label: 'میانه' }, { id: 'lower', label: 'باندِ پایین' }];
  if (key === 'stoch' || key === 'stochrsi') return [{ id: 'line', label: '%K' }, { id: 'signal', label: '%D' }];
  return [{ id: 'line', label: 'مقدار' }];
}

const DEFAULT_TF = 'H1';

// فلَشِ سبز/قرمزِ جهت‌دار روی هر تیک (حسِ زنده‌بودنِ TV) — از کلاس‌های سراسریِ
// .flash-up/.flash-down (index.css) استفاده می‌کند. برای ری‌استارتِ انیمیشن روی هر
// تغییر، عنصرِ خروجی با key نو ری‌مونت می‌شود؛ رنگِ متن هم با جهتِ تیک هم‌گام می‌شود.
function FlashNum({ value, TH, className = '', style, dir = 'ltr', children }) {
  const prev = useRef(value);
  const [st, setSt] = useState({ cls: '', dir: 0, n: 0 });
  useEffect(() => {
    if (value != null && prev.current != null && value !== prev.current) {
      const up = value > prev.current;
      setSt((s) => ({ cls: up ? 'flash-up' : 'flash-down', dir: up ? 1 : -1, n: s.n + 1 }));
    }
    prev.current = value;
  }, [value]);
  const col = st.dir > 0 ? (TH && TH.up) : st.dir < 0 ? (TH && TH.down) : undefined;
  return (
    <span key={st.n} dir={dir} className={`${className} ${st.cls} rounded-sm px-0.5 tabular-nums transition-colors`} style={{ color: col, ...style }}>
      {children}
    </span>
  );
}

// زمانِ نسبیِ فارسی برای لاگِ آلارم.
function timeAgo(ts) {
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'همین حالا';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} دقیقه پیش`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ساعت پیش`;
  const d = Math.round(h / 24);
  return `${d} روز پیش`;
}

// مقادیرِ اولیهٔ فرم.
const blankForm = (symbol, price) => ({
  id: null,                 // پُر می‌شود هنگامِ ویرایش
  source: 'price',
  price_field: 'mid',
  indId: '',                // id اندیکاتورِ فعالِ انتخاب‌شده
  indField: 'line',
  op: 'cross',                 // پیش‌فرضِ «تقاطع (هر دو جهت)» مثلِ دیفالتِ TradingView
  // پیش‌پُرکردنِ «مقدار» با قیمتِ جاری مثلِ دیالوگِ Create Alertِ TV (کاربر سپس تنظیم می‌کند). #294
  // بدونِ جداکنندهٔ هزارگان (toFixed، نه toLocaleString) تا Number() هنگامِ ثبت NaN نشود.
  value: (price != null && Number.isFinite(Number(price))) ? Number(price).toFixed(priceDigits(symbol, Number(price))) : '',
  and2: false, op2: 'below', value2: '', // شرطِ دومِ AND (آلارمِ چندشرطی)
  lo: '', hi: '',
  trigger: 'once',             // پس‌رو — از freq مشتق می‌شود
  freq: 'once',                // پیش‌فرضِ «فقط یک‌بار» مثلِ TradingView (نه recurring؛ ضدِ اسپم و وفادار به دیفالتِ TV)
  cooldownMin: 60,
  expiryH: '',
  name: '',                    // نامِ سفارشیِ آلارم (خالی → autoName)
  message: '',
  // کانال‌های تحویل (همتراز با TV: popup/push/email/sms/sound/telegram/webhook)
  popup: true,
  telegram: false,
  push: false,
  email: false,
  sms: false,
  sound: false,
  webhook: '',
});

// صفِ ماژولیِ «افزودنِ آلارم روی اندیکاتور» از منوی «...»ِ لجندِ چارت (سبکِ TradingView).
// چون پنلِ آلارم ممکن است هنگامِ کلیک بسته/unmount باشد، درخواست در یک متغیرِ ماژولی صف می‌شود
// (که از remount جان‌سالم به‌در می‌برد) و یک رویداد برای نمونهٔ mount‌شده پخش می‌شود. مصرف یک‌باره است.
let _pendingIndAlert = null;
export function queueIndicatorAlert(indId) {
  _pendingIndAlert = { indId };
  try { window.dispatchEvent(new CustomEvent('bn:indAlertQueued')); } catch (e) { /* noop */ }
}

// صفِ «پیش‌پُرکردنِ آلارمِ قیمت» — برای «افزودنِ آلارم روی خط/در قیمت» تا فرمِ AlertsPanel با value/op پُر شود. #277
// (فرمِ AlertsPanel داخلی است و alFormِ صفحه را نمی‌خواند؛ این پل، پیش‌پُرکردن را واقعی می‌کند.)
let _pendingSeedAlert = null;
export function queueSeedAlert(seed) {
  _pendingSeedAlert = seed || null;
  try { window.dispatchEvent(new CustomEvent('bn:seedAlert')); } catch (e) { /* noop */ }
}

// ── کامپوننتِ اصلی ───────────────────────────────────────────────────────────
export default function AlertsPanel({ symbol, price, TH, indicators = [] }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(() => blankForm(symbol, price));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tab, setTab] = useState('alerts'); // 'alerts' | 'log' — تبِ فهرست/لاگ
  const mounted = useRef(true);

  const set = useCallback((patch) => setForm((f) => ({ ...f, ...patch })), []);

  // مصرفِ صفِ «افزودنِ آلارم روی اندیکاتور» — روی mount (حالتِ تبِ‌بسته) و روی رویداد (حالتِ تبِ‌باز).
  // بلافاصله پاک می‌شود تا با remount دوباره اعمال نشود.
  const applyPendingIndAlert = useCallback(() => {
    if (!_pendingIndAlert) return;
    const { indId } = _pendingIndAlert;
    _pendingIndAlert = null;
    setForm((f) => ({ ...f, id: null, source: 'indicator', indId: indId || '', indField: 'line' }));
    setTab('alerts');
  }, []);
  useEffect(() => {
    applyPendingIndAlert();
    const h = () => applyPendingIndAlert();
    window.addEventListener('bn:indAlertQueued', h);
    return () => window.removeEventListener('bn:indAlertQueued', h);
  }, [applyPendingIndAlert]);

  // مصرفِ صفِ «پیش‌پُرکردنِ آلارمِ قیمت» (از «افزودنِ آلارم روی خط/در قیمت») — value/op را در فرم می‌گذارد. #277
  const applyPendingSeedAlert = useCallback(() => {
    if (!_pendingSeedAlert) return;
    const seed = _pendingSeedAlert;
    _pendingSeedAlert = null;
    setForm((f) => ({ ...f, id: null, source: 'price', op: seed.op || f.op, value: (seed.value != null ? String(seed.value) : f.value), line: (seed.line && Number.isFinite(seed.line.t1)) ? seed.line : null }));
    setTab('alerts');
  }, []);
  useEffect(() => {
    applyPendingSeedAlert();
    const h = () => applyPendingSeedAlert();
    window.addEventListener('bn:seedAlert', h);
    return () => window.removeEventListener('bn:seedAlert', h);
  }, [applyPendingSeedAlert]);

  const freqMeta = useMemo(() => FREQS.find((f) => f.id === form.freq) || FREQS[4], [form.freq]);
  const opMeta = useMemo(() => OPS.find((o) => o.id === form.op) || OPS[0], [form.op]);
  const isPct = !!opMeta.pct;
  const isChannel = opMeta.rhs === 'channel';

  // ── بارگذاری/تازه‌سازیِ فهرست ───────────────────────────────────────────────
  const reload = useCallback(async () => {
    try { const r = await api.bnAlerts(); if (mounted.current) setList(Array.isArray(r) ? r : (r && r.items) || []); }
    catch (e) { /* graceful — فهرستِ خالی */ }
  }, []);

  useEffect(() => {
    mounted.current = true;
    reload();
    const id = setInterval(reload, 30000); // هم‌تراز با polling موجود (۳۰ ثانیه)
    return () => { mounted.current = false; clearInterval(id); };
  }, [reload]);

  // وقتی نماد عوض شد و در حالِ ویرایش نبودیم، نمادِ پیش‌فرضِ فرم به‌روز می‌شود.
  useEffect(() => { if (!form.id) setForm((f) => ({ ...f })); }, [symbol]); // eslint-disable-line

  // ── پیش‌نمایشِ فاصله تا آستانه ──────────────────────────────────────────────
  const distancePreview = useMemo(() => {
    if (form.source !== 'price' || !price) return null;
    const v = Number(form.value);
    if (!v || Number.isNaN(v) || isPct || isChannel) return null;
    const diff = v - price;
    const pips = symbol && /JPY/i.test(symbol) ? diff * 100 : diff * 10000;
    const pct = price ? (diff / price) * 100 : 0;
    const sign = diff >= 0 ? '+' : '−';
    // «pips» فقط برای جفت‌ارزهای فارکس معنا دارد (۶ حرف، بدونِ فلز)؛ برای کریپتو/شاخص/فلز → درصد.
    const isFxPair = /^[A-Z]{6}$/.test(symbol || '') && !/XA[UG]/.test(symbol || '');
    return { now: price, target: v, pips: Math.abs(pips), pct: Math.abs(pct), sign, isFxPair };
  }, [form.source, form.value, price, isPct, isChannel, symbol]);

  // ── ساختِ نامِ خودکار ──────────────────────────────────────────────────────
  const autoName = useCallback(() => {
    const src = form.source === 'indicator'
      ? (REGISTRY[(indicators.find((i) => i.id === form.indId) || {}).key]?.label || 'اندیکاتور')
      : form.source === 'drawing' ? 'خطِ ترسیم'
      : form.source === 'watchlist' ? 'واچ‌لیست' : symbol;
    const opl = OP_NAME[form.op] || OP_SHORT[form.op] || '';
    if (isChannel) return `${src} ${opl}[${form.lo}، ${form.hi}]`;
    return `${src} ${opl} ${form.value}`.trim();
  }, [form, indicators, symbol, isChannel]);

  // ── ساختِ شیِ condition (سازگارِ پس‌رو + فیلدهای جدید) ───────────────────────
  const buildCondition = useCallback(() => {
    const cond = {
      type: 'price',                 // پس‌رو — سرورِ فعلی این را می‌خواند
      source: form.source,           // جدید: price | indicator | drawing | watchlist
      op: form.op,
      trigger: freqMeta.trigger,     // پس‌رو: once | recurring
      frequency: form.freq,          // جدید: دانه‌بندیِ TV (per_bar/per_bar_close/…)
      telegram: !!form.telegram,
      in_app: true,
      popup: !!form.popup,
      // کانال‌های تحویلِ افزوده (graceful — سرور کلیدهای ناشناخته را نگه می‌دارد)
      push: !!form.push,
      email: !!form.email,
      sms: !!form.sms,
      sound: !!form.sound,
    };
    if (form.webhook && form.webhook.trim()) cond.webhook = form.webhook.trim();
    if (form.source === 'watchlist') cond.scope = 'watchlist';
    // عملوندِ راست
    if (isChannel) { cond.lo = Number(form.lo); cond.hi = Number(form.hi); cond.value = Number(form.lo); }
    else { cond.value = Number(form.value); }
    // آلارمِ خطِ شیب‌دار (Trend-Line): لنگرهای (t,p) → سرور سطحِ متحرک را محاسبه می‌کند. #سرور:_line_level
    if (form.line && Number.isFinite(form.line.t1) && Number.isFinite(form.line.t2)) cond.line = form.line;
    // آلارمِ چندشرطی (AND): شرطِ دوم
    if (!isChannel && form.and2 && form.value2 !== '') {
      cond.conditions = [{ op: form.op, value: Number(form.value) }, { op: form.op2, value: Number(form.value2) }];
    }
    // منبع
    if (form.source === 'price' || form.source === 'watchlist') { cond.price_field = form.price_field; }
    else if (form.source === 'indicator') {
      const it = indicators.find((i) => i.id === form.indId);
      if (it) cond.indicator = { id: it.key, params: it.inputs || {}, field: form.indField };
    } else if (form.source === 'drawing') {
      cond.line = { note: 'انتخاب از منوی ترسیم' }; // geometry سمتِ چارت پر می‌شود
    }
    // تریگر/کول‌داون — کول‌داون فقط در حالتِ «هربار با کول‌داون»
    if (form.freq === 'cooldown') cond.cooldown_s = Math.max(0, Math.round(Number(form.cooldownMin) || 60) * 60);
    // انقضا
    if (form.expiryH) cond.expiry = new Date(Date.now() + Number(form.expiryH) * 3600 * 1000).toISOString();
    // پیام
    if (form.message) cond.message = form.message;
    return cond;
  }, [form, indicators, isChannel, freqMeta]);

  // ── اعتبارسنجیِ کمینهٔ فرم ──────────────────────────────────────────────────
  const valid = useMemo(() => {
    if (isChannel) return form.lo !== '' && form.hi !== '';
    if (form.source === 'indicator' && !form.indId) return false;
    return form.value !== '';
  }, [form, isChannel]);

  // ── ذخیره (ساخت یا ویرایش) ──────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!valid || busy) return;
    setBusy(true); setErr('');
    const condition = buildCondition();
    const payload = { symbol, tf: DEFAULT_TF, name: (form.name && form.name.trim()) || autoName(), condition };
    try {
      if (form.id) {
        // ویرایش: اگر endpoint اختصاصی نبود، حذف+ساختِ دوباره (graceful).
        if (typeof api.bnAlertUpdate === 'function') { await api.bnAlertUpdate(form.id, payload); }
        else { try { await api.bnAlertDelete(form.id); } catch (e) {} await api.bnAlertCreate(payload); }
      } else {
        await api.bnAlertCreate(payload);
      }
      setForm(blankForm(symbol, price));
      await reload();
    } catch (e) {
      setErr('ذخیرهٔ آلارم ناموفق بود.');
    } finally { if (mounted.current) setBusy(false); }
  }, [valid, busy, buildCondition, symbol, autoName, form.id, reload]);

  // ── حذف ─────────────────────────────────────────────────────────────────────
  const remove = useCallback(async (id) => {
    setList((l) => l.filter((x) => x.id !== id)); // optimistic
    try { await api.bnAlertDelete(id); } catch (e) { reload(); }
  }, [reload]);

  // ── روشن/خاموش (active) ─────────────────────────────────────────────────────
  const toggle = useCallback(async (a) => {
    const next = !a.active;
    setList((l) => l.map((x) => (x.id === a.id ? { ...x, active: next } : x))); // optimistic
    try {
      if (typeof api.bnAlertUpdate === 'function') await api.bnAlertUpdate(a.id, { active: next });
      else { /* بدون endpoint — فقط محلی؛ هنگامِ reload به وضعِ سرور بازمی‌گردد */ }
    } catch (e) { reload(); }
  }, [reload]);

  // ── ویرایش: condition را به فرم برمی‌گرداند ─────────────────────────────────
  const edit = useCallback((a) => {
    const c = a.condition || {};
    const op = c.op || 'cross_up';
    const meta = OPS.find((o) => o.id === op) || OPS[0];
    setForm({
      id: a.id,
      source: c.source || 'price',
      price_field: c.price_field || 'mid',
      indId: '', // اندیکاتورِ زندهٔ متناظر ممکن است موجود نباشد؛ کاربر دوباره انتخاب کند
      indField: (c.indicator && c.indicator.field) || 'line',
      op,
      value: meta.rhs === 'channel' ? (c.lo ?? '') : (c.value ?? ''),
      line: (c.line && Number.isFinite(c.line.t1)) ? c.line : null,  // آلارمِ خطِ شیب‌دار — حفظ در ویرایش
      and2: Array.isArray(c.conditions) && c.conditions.length > 1,
      op2: (Array.isArray(c.conditions) && c.conditions[1] && c.conditions[1].op) || 'below',
      value2: (Array.isArray(c.conditions) && c.conditions[1] && c.conditions[1].value != null) ? c.conditions[1].value : '',
      lo: c.lo ?? '', hi: c.hi ?? '',
      trigger: c.trigger || 'recurring',
      // پس‌رو: اگر frequency ذخیره نشده باشد از trigger مشتق کن.
      freq: c.frequency || (c.trigger === 'once' ? 'once' : 'cooldown'),
      cooldownMin: c.cooldown_s ? Math.round(c.cooldown_s / 60) : 60,
      expiryH: c.expiry ? Math.max(0, Math.round((new Date(c.expiry).getTime() - Date.now()) / 3600000)) : '',
      name: a.name || '',
      message: c.message || '',
      popup: c.popup !== false,
      telegram: !!c.telegram,
      push: !!c.push,
      email: !!c.email,
      sms: !!c.sms,
      sound: !!c.sound,
      webhook: c.webhook || '',
    });
    setShowAdvanced(true);
  }, []);

  const cancelEdit = useCallback(() => setForm(blankForm(symbol, price)), [symbol, price]);

  // ── لاگِ آلارم — تاریخچهٔ رخدادها از فیلدِ last_triggered_at (نزولی) ─────────
  const logEntries = useMemo(() => (
    list
      .filter((a) => a.last_triggered_at)
      .sort((a, b) => new Date(b.last_triggered_at) - new Date(a.last_triggered_at))
  ), [list]);

  // اندیکاتورهای فعالِ قابل‌انتخاب.
  const liveInds = useMemo(() => indicators.filter((i) => REGISTRY[i.key]), [indicators]);
  const selInd = useMemo(() => liveInds.find((i) => i.id === form.indId), [liveInds, form.indId]);

  // ── استایل‌های مشترک (همتراز با تبِ آلارمِ موجود) ───────────────────────────
  const inputCls = 'rounded-md px-2 h-[26px] outline-none transition-colors min-w-0';
  const inputStyle = { background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` };
  const selStyle = { background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` };

  return (
    <div className="p-2 text-xs" dir="rtl" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {/* ───────────────── سازندهٔ آلارم ───────────────── */}
      <div className="rounded-md border p-2 mb-2 space-y-1.5" style={{ borderColor: TH.border, background: TH.subtle }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] opacity-50 truncate">
              {form.id ? 'ویرایشِ آلارم' : 'سازندهٔ آلارم'} — <span dir="ltr">{symbol} · {DEFAULT_TF}</span>
            </span>
            {price != null && Number.isFinite(Number(price)) && (
              <FlashNum value={price} TH={TH} className="text-[10px] font-medium" style={{ color: TH.textStrong }}>{fmtHeadPrice(symbol, price)}</FlashNum>
            )}
          </div>
          {form.id && (
            <button onClick={cancelEdit} className="text-[10px] opacity-60 hover:opacity-100 transition-opacity shrink-0">انصراف</button>
          )}
        </div>

        {/* منبع */}
        <div className="flex gap-1">
          <select value={form.source} onChange={(e) => set({ source: e.target.value })} title="منبعِ شرط" className={`${inputCls} flex-1`} style={selStyle}>
            {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {(form.source === 'price' || form.source === 'watchlist') && (
            <select value={form.price_field} onChange={(e) => set({ price_field: e.target.value })} title="فیلدِ قیمت" className={`${inputCls} w-20`} style={selStyle}>
              <option value="mid">میانه</option><option value="bid">خرید</option><option value="ask">فروش</option>
              <option value="close">بسته</option><option value="high">بیشینه</option><option value="low">کمینه</option>
            </select>
          )}
        </div>

        {/* انتخابِ اندیکاتورِ فعال */}
        {form.source === 'indicator' && (
          <div className="flex gap-1">
            <select value={form.indId} onChange={(e) => set({ indId: e.target.value, indField: 'line' })} className={`${inputCls} flex-1`} style={selStyle}>
              <option value="">— اندیکاتورِ روی چارت —</option>
              {liveInds.map((i) => <option key={i.id} value={i.id}>{REGISTRY[i.key].label}</option>)}
            </select>
            {selInd && (
              <select value={form.indField} onChange={(e) => set({ indField: e.target.value })} title="خروجی" className={`${inputCls} w-24`} style={selStyle}>
                {indicatorFields(selInd.key).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            )}
            {liveInds.length === 0 && <span className="text-[9px] opacity-50 self-center">ابتدا یک اندیکاتور به چارت بیفزایید</span>}
          </div>
        )}

        {form.source === 'drawing' && (
          <div className="text-[9px] opacity-50 rounded px-2 py-1" style={{ background: TH.subtle }}>
            از منوی راست‌کلیکِ یک خطِ ترسیم‌شده «آلارم روی این خط» را انتخاب کنید؛ آستانه متحرک می‌شود.
          </div>
        )}

        {form.source === 'watchlist' && (
          <div className="flex items-center gap-1 text-[9px] opacity-50 rounded px-2 py-1" style={{ background: TH.subtle }}>
            <ListChecks size={11} className="shrink-0" />
            همین شرط روی همهٔ نمادهای واچ‌لیست اعمال می‌شود؛ برای هر نماد جداگانه اعلان می‌گیرید.
          </div>
        )}

        {/* عملگر + عملوند */}
        <div className="flex gap-1">
          <select value={form.op} onChange={(e) => set({ op: e.target.value })} title="شرط" className={`${inputCls} flex-1`} style={selStyle}>
            {OPS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {isChannel ? (
            <>
              <input value={form.lo} onChange={(e) => set({ lo: e.target.value })} placeholder="کف" dir="ltr" className={`${inputCls} w-14`} style={inputStyle} />
              <input value={form.hi} onChange={(e) => set({ hi: e.target.value })} placeholder="سقف" dir="ltr" className={`${inputCls} w-14`} style={inputStyle} />
            </>
          ) : (
            <input value={form.value} onChange={(e) => set({ value: e.target.value, line: null })} placeholder={isPct ? '٪' : 'مقدار'} dir="ltr" className={`${inputCls} w-20`} style={inputStyle} />
          )}
        </div>

        {/* آلارمِ چندشرطی — شرطِ دومِ AND */}
        {!isChannel && (
          <div className="flex items-center gap-1">
            <label className="flex items-center gap-1 text-[10px] opacity-70 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={form.and2} onChange={(e) => set({ and2: e.target.checked })} /> و…
            </label>
            {form.and2 && (
              <>
                <select value={form.op2} onChange={(e) => set({ op2: e.target.value })} className={`${inputCls} flex-1`} style={selStyle}>
                  {OPS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <input value={form.value2} onChange={(e) => set({ value2: e.target.value })} placeholder="مقدار" dir="ltr" className={`${inputCls} w-20`} style={inputStyle} />
              </>
            )}
          </div>
        )}

        {/* پیش‌نمایشِ فاصله */}
        {distancePreview && (
          <div className="text-[9px] opacity-60 px-1 tabular-nums flex items-center gap-1" dir="ltr">
            <span>{symbol} → {distancePreview.target} · اکنون</span>
            <FlashNum value={distancePreview.now} TH={TH}>{distancePreview.now}</FlashNum>
            <span>({distancePreview.sign}{distancePreview.isFxPair ? `${distancePreview.pips.toFixed(1)} pips` : `${distancePreview.pct.toFixed(2)}٪`})</span>
          </div>
        )}

        {/* فراوانیِ تریگر + کول‌داون */}
        <div className="flex gap-1">
          <select value={form.freq} onChange={(e) => set({ freq: e.target.value })} title="فراوانی" className={`${inputCls} flex-1`} style={selStyle}>
            {FREQS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          {form.freq === 'cooldown' && (
            <div className="flex items-center gap-1 rounded-md px-2 h-[26px]" style={{ background: TH.chipBg, border: `1px solid ${TH.border}` }}>
              <Repeat size={11} className="opacity-50" />
              <input value={form.cooldownMin} onChange={(e) => set({ cooldownMin: e.target.value })} title="کول‌داون (دقیقه)" dir="ltr" className="w-10 bg-transparent outline-none tabular-nums" />
              <span className="opacity-50 text-[9px]">دقیقه</span>
            </div>
          )}
        </div>

        {/* انقضا */}
        <div className="flex gap-1 items-center">
          <Clock size={11} className="opacity-50" />
          {/* dir=rtl تا placeholderِ فارسی درست از راست شروع شود (با dir=ltr صدرِ «انقضا» بریده و «قضا» دیده می‌شد). */}
          <input value={form.expiryH} onChange={(e) => set({ expiryH: e.target.value })} inputMode="numeric" placeholder="انقضا (ساعت) — خالی = بدونِ انقضا" dir="rtl" className={`${inputCls} flex-1`} style={inputStyle} />
        </div>

        {/* تنظیماتِ بیشتر — پیام + تحویل */}
        <button onClick={() => setShowAdvanced((v) => !v)} className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100 transition-opacity">
          <ChevronDown size={11} className="transition-transform" style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none' }} />
          پیام و تحویل
        </button>
        {showAdvanced && (
          <div className="space-y-1.5 pt-0.5">
            {/* نامِ آلارم — همتراز با فیلدِ Alert name در TV؛ خالی → نامِ خودکار */}
            <div className="text-[9px] opacity-50">نامِ آلارم</div>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={autoName() || 'نامِ آلارم (خالی = خودکار)'} className={`${inputCls} w-full`} style={inputStyle} />
            <div className="text-[9px] opacity-50 pt-0.5">پیام</div>
            {/* پیام چندخطی مثلِ textareaِ پیامِ آلارمِ TV (به‌جای تک‌خطی) — متغیرها می‌توانند در چند خط بیایند؛ قابلِ تغییرِ ارتفاع. */}
            <textarea value={form.message} onChange={(e) => set({ message: e.target.value })} placeholder="پیامِ سفارشی (روی متغیرها بزنید)" rows={2} className="rounded-md px-2 py-1 outline-none transition-colors min-w-0 w-full resize-y leading-snug" style={inputStyle} />
            {/* پالتِ متغیرها — همتراز با placeholderهای TV، منهای {{exchange}}: Pro-Chart عمداً مفهومِ صرافی ندارد (قانونِ بدونِ‌بروکر) و نمادها پیشوندِ صرافی ندارند، پس این متغیر به هیچ resolve می‌شد. */}
            <div className="flex gap-1 flex-wrap">
              {['{{ticker}}', '{{close}}', '{{open}}', '{{high}}', '{{low}}', '{{volume}}', '{{interval}}', '{{time}}', '{{timenow}}', '{{plot_0}}'].map((ph) => (
                <button key={ph} onClick={() => set({ message: (form.message || '') + ph })} className="text-[9px] rounded-md px-1.5 py-0.5 transition-colors" style={{ background: TH.chipBg, color: TH.text }} dir="ltr"
                  onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>{ph}</button>
              ))}
            </div>
            {/* کانال‌های تحویل — popup/push/email/sms/sound/telegram/webhook */}
            <div className="text-[9px] opacity-50 pt-0.5">کانال‌های تحویل</div>
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={form.popup} onChange={(e) => set({ popup: e.target.checked })} />
                <MessageSquare size={11} className="opacity-60" /> پاپ‌آپ
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={form.push} onChange={(e) => set({ push: e.target.checked })} />
                <Smartphone size={11} className="opacity-60" /> پوش
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={form.sound} onChange={(e) => set({ sound: e.target.checked })} />
                <Volume2 size={11} className="opacity-60" /> صدا
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={form.email} onChange={(e) => set({ email: e.target.checked })} />
                <Mail size={11} className="opacity-60" /> ایمیل
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={form.sms} onChange={(e) => set({ sms: e.target.checked })} />
                <MessageCircle size={11} className="opacity-60" /> پیامک
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={form.telegram} onChange={(e) => set({ telegram: e.target.checked })} />
                <Send size={11} className="opacity-60" /> تلگرام
              </label>
            </div>
            {/* وبهوک */}
            <div className="flex gap-1 items-center">
              <Webhook size={11} className="opacity-50 shrink-0" />
              <input value={form.webhook} onChange={(e) => set({ webhook: e.target.value })} placeholder="آدرسِ وبهوک (اختیاری) — https://…" dir="ltr" className={`${inputCls} flex-1`} style={inputStyle} />
            </div>
          </div>
        )}

        {err && <div className="text-[10px]" style={{ color: TH.down }}>{err}</div>}

        {/* دکمهٔ ذخیره */}
        <div className="flex items-center justify-end">
          <button
            onClick={save}
            disabled={!valid || busy}
            className="px-3 h-[26px] rounded-md text-white flex items-center gap-1 transition-opacity disabled:opacity-40"
            style={{ background: TH.accent }}
          >
            {form.id ? <Check size={12} /> : <Plus size={12} />}
            {form.id ? 'ذخیرهٔ تغییرات' : 'ساختِ آلارم'}
          </button>
        </div>
      </div>

      {/* ───────────────── تب‌های فهرست/لاگ ───────────────── */}
      <div className="flex items-center gap-1 mb-1.5">
        <button onClick={() => setTab('alerts')} className="flex items-center gap-1 text-[10px] rounded-md px-2 h-[24px] transition-colors"
          style={{ background: tab === 'alerts' ? TH.chipBg : 'transparent', color: tab === 'alerts' ? TH.textStrong : TH.text, opacity: tab === 'alerts' ? 1 : 0.6 }}>
          <ListChecks size={11} /> آلارم‌ها {list.length > 0 && <span className="opacity-60">({list.length})</span>}
        </button>
        <button onClick={() => setTab('log')} className="flex items-center gap-1 text-[10px] rounded-md px-2 h-[24px] transition-colors"
          style={{ background: tab === 'log' ? TH.chipBg : 'transparent', color: tab === 'log' ? TH.textStrong : TH.text, opacity: tab === 'log' ? 1 : 0.6 }}>
          <History size={11} /> لاگ {logEntries.length > 0 && <span className="opacity-60">({logEntries.length})</span>}
        </button>
      </div>

      {/* ───────────────── لاگِ آلارم ───────────────── */}
      {tab === 'log' ? (
        logEntries.length === 0 ? (
          <div className="text-[10px] opacity-40 text-center py-8">هنوز آلارمی رخ نداده.</div>
        ) : (
          <div>
            {logEntries.map((a) => {
              const c = a.condition || {};
              return (
                <div key={`log-${a.id}-${a.last_triggered_at}`} className="flex items-center justify-between px-1 -mx-1 rounded-md py-1.5 border-b" style={{ borderColor: TH.border }}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Bell size={12} style={{ color: TH.up }} className="shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate" title={a.name}>{a.name}</div>
                      <div className="flex items-center gap-1 text-[9px] opacity-50" dir="ltr">
                        <span>{a.symbol || symbol}</span>
                        <span>·</span>
                        <span>{OP_SHORT[c.op] || c.op}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] opacity-50 shrink-0 tabular-nums">{timeAgo(a.last_triggered_at)}</span>
                </div>
              );
            })}
          </div>
        )
      ) : (
      /* ───────────────── فهرستِ آلارم‌ها ───────────────── */
      list.length === 0 ? (
        <div className="text-[11px] opacity-45 text-center leading-relaxed py-8 px-4">
          {/* پیامِ خالیِ توصیفیِ سبکِ TV («Alerts notify you instantly when your conditions are met. Create one to get started.») */}
          آلارم‌ها به‌محضِ برآورده‌شدنِ شرط‌ها فوری به شما خبر می‌دهند.<br />برای شروع، بالا یک آلارم بسازید.
        </div>
      ) : (
        <div>
          <div className="text-[10px] opacity-50 mb-1 px-0.5">آلارم‌های ذخیره‌شده ({list.length})</div>
          {list.map((a) => {
            const fired = a.last_triggered_at && (Date.now() - new Date(a.last_triggered_at).getTime()) < 86400000;
            const off = a.active === false;
            const c = a.condition || {};
            const expired = c.expiry && new Date(c.expiry).getTime() < Date.now();
            return (
              <div key={a.id} className="flex items-center justify-between px-1 -mx-1 rounded-md py-1.5 border-b group transition-colors" style={{ borderColor: TH.border, opacity: off ? 0.55 : 1 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <div className="flex items-center gap-1.5 min-w-0">
                  {/* روشن/خاموش */}
                  <button onClick={() => toggle(a)} title={off ? 'فعال‌سازی' : 'غیرفعال‌سازی'} className="shrink-0 transition-colors">
                    {off
                      ? <BellOff size={13} className="opacity-50 hover:opacity-90" />
                      : <Bell size={13} style={{ color: fired ? TH.up : TH.accent }} />}
                  </button>
                  <div className="min-w-0">
                    <div className="truncate" title={a.name}>{a.name}</div>
                    <div className="flex items-center gap-1 text-[9px] opacity-50" dir="ltr">
                      <span>{a.symbol || symbol}</span>
                      <span>·</span>
                      <span>{OP_SHORT[c.op] || c.op}</span>
                      {c.trigger === 'once' && <span className="opacity-70">· یک‌بار</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {fired && <span className="text-[9px] rounded px-1" style={{ color: TH.up, background: `${TH.up}1a` }}>رخ داد</span>}
                  {expired && <span className="text-[9px] rounded px-1 opacity-60" style={{ background: TH.subtle }}>منقضی</span>}
                  <Pencil size={11} className="opacity-0 group-hover:opacity-50 hover:!opacity-90 cursor-pointer transition-opacity" onClick={() => edit(a)} title="ویرایش" />
                  <X size={12} className="opacity-40 hover:opacity-90 cursor-pointer transition-opacity" style={{ color: TH.down }} onClick={() => remove(a.id)} title="حذف" />
                </div>
              </div>
            );
          })}
        </div>
      )
      )}
    </div>
  );
}
