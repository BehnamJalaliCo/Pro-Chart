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
import { Bell, BellOff, Plus, X, Pencil, Check, Send, MessageSquare, Clock, Repeat, ChevronDown } from 'lucide-react';
import { api } from '../api/client';
import { REGISTRY } from './indicators';

// ── واژگانِ منبع/عملگر ───────────────────────────────────────────────────────
const SOURCES = [
  { id: 'price', label: 'قیمتِ نماد' },
  { id: 'indicator', label: 'اندیکاتور' },
  { id: 'drawing', label: 'خطِ ترسیم‌شده' },
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
  { id: 'move_up_value', label: 'صعود به اندازهٔ (مقدار)', rhs: 'value' },
  { id: 'move_down_value', label: 'نزول به اندازهٔ (مقدار)', rhs: 'value' },
  { id: 'pct_up', label: 'صعودِ ٪', rhs: 'value', pct: true },
  { id: 'pct_down', label: 'نزولِ ٪', rhs: 'value', pct: true },
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

// مقادیرِ اولیهٔ فرم.
const blankForm = (symbol) => ({
  id: null,                 // پُر می‌شود هنگامِ ویرایش
  source: 'price',
  price_field: 'mid',
  indId: '',                // id اندیکاتورِ فعالِ انتخاب‌شده
  indField: 'line',
  op: 'cross_up',
  value: '',
  lo: '', hi: '',
  trigger: 'recurring',
  cooldownMin: 60,
  expiryH: '',
  message: '',
  popup: true,
  telegram: false,
});

// ── کامپوننتِ اصلی ───────────────────────────────────────────────────────────
export default function AlertsPanel({ symbol, price, TH, indicators = [] }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(() => blankForm(symbol));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const mounted = useRef(true);

  const set = useCallback((patch) => setForm((f) => ({ ...f, ...patch })), []);

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
    const sign = diff >= 0 ? '+' : '−';
    return { now: price, target: v, pips: Math.abs(pips), sign };
  }, [form.source, form.value, price, isPct, isChannel, symbol]);

  // ── ساختِ نامِ خودکار ──────────────────────────────────────────────────────
  const autoName = useCallback(() => {
    const src = form.source === 'indicator'
      ? (REGISTRY[(indicators.find((i) => i.id === form.indId) || {}).key]?.label || 'اندیکاتور')
      : form.source === 'drawing' ? 'خطِ ترسیم' : symbol;
    const opl = OP_NAME[form.op] || OP_SHORT[form.op] || '';
    if (isChannel) return `${src} ${opl}[${form.lo}، ${form.hi}]`;
    return `${src} ${opl} ${form.value}`.trim();
  }, [form, indicators, symbol, isChannel]);

  // ── ساختِ شیِ condition (سازگارِ پس‌رو + فیلدهای جدید) ───────────────────────
  const buildCondition = useCallback(() => {
    const cond = {
      type: 'price',                 // پس‌رو — سرورِ فعلی این را می‌خواند
      source: form.source,           // جدید: price | indicator | drawing
      op: form.op,
      trigger: form.trigger,
      telegram: !!form.telegram,
      in_app: true,
      popup: !!form.popup,
    };
    // عملوندِ راست
    if (isChannel) { cond.lo = Number(form.lo); cond.hi = Number(form.hi); cond.value = Number(form.lo); }
    else { cond.value = Number(form.value); }
    // منبع
    if (form.source === 'price') { cond.price_field = form.price_field; }
    else if (form.source === 'indicator') {
      const it = indicators.find((i) => i.id === form.indId);
      if (it) cond.indicator = { id: it.key, params: it.inputs || {}, field: form.indField };
    } else if (form.source === 'drawing') {
      cond.line = { note: 'انتخاب از منوی ترسیم' }; // geometry سمتِ چارت پر می‌شود
    }
    // تریگر/کول‌داون
    if (form.trigger === 'recurring') cond.cooldown_s = Math.max(0, Math.round(Number(form.cooldownMin) || 60) * 60);
    // انقضا
    if (form.expiryH) cond.expiry = new Date(Date.now() + Number(form.expiryH) * 3600 * 1000).toISOString();
    // پیام
    if (form.message) cond.message = form.message;
    return cond;
  }, [form, indicators, isChannel]);

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
    const payload = { symbol, tf: DEFAULT_TF, name: autoName(), condition };
    try {
      if (form.id) {
        // ویرایش: اگر endpoint اختصاصی نبود، حذف+ساختِ دوباره (graceful).
        if (typeof api.bnAlertUpdate === 'function') { await api.bnAlertUpdate(form.id, payload); }
        else { try { await api.bnAlertDelete(form.id); } catch (e) {} await api.bnAlertCreate(payload); }
      } else {
        await api.bnAlertCreate(payload);
      }
      setForm(blankForm(symbol));
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
      lo: c.lo ?? '', hi: c.hi ?? '',
      trigger: c.trigger || 'recurring',
      cooldownMin: c.cooldown_s ? Math.round(c.cooldown_s / 60) : 60,
      expiryH: c.expiry ? Math.max(0, Math.round((new Date(c.expiry).getTime() - Date.now()) / 3600000)) : '',
      message: c.message || '',
      popup: c.popup !== false,
      telegram: !!c.telegram,
    });
    setShowAdvanced(true);
  }, []);

  const cancelEdit = useCallback(() => setForm(blankForm(symbol)), [symbol]);

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
          <div className="text-[10px] opacity-50">
            {form.id ? 'ویرایشِ آلارم' : 'سازندهٔ آلارم'} — <span dir="ltr">{symbol} · {DEFAULT_TF}</span>
          </div>
          {form.id && (
            <button onClick={cancelEdit} className="text-[10px] opacity-60 hover:opacity-100 transition-opacity">انصراف</button>
          )}
        </div>

        {/* منبع */}
        <div className="flex gap-1">
          <select value={form.source} onChange={(e) => set({ source: e.target.value })} title="منبعِ شرط" className={`${inputCls} flex-1`} style={selStyle}>
            {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {form.source === 'price' && (
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
            <input value={form.value} onChange={(e) => set({ value: e.target.value })} placeholder={isPct ? '٪' : 'مقدار'} dir="ltr" className={`${inputCls} w-20`} style={inputStyle} />
          )}
        </div>

        {/* پیش‌نمایشِ فاصله */}
        {distancePreview && (
          <div className="text-[9px] opacity-60 px-1 tabular-nums" dir="ltr">
            {symbol} → {distancePreview.target} · اکنون {distancePreview.now} ({distancePreview.sign}{distancePreview.pips.toFixed(1)} pips)
          </div>
        )}

        {/* تریگر + کول‌داون */}
        <div className="flex gap-1">
          <select value={form.trigger} onChange={(e) => set({ trigger: e.target.value })} title="تریگر" className={`${inputCls} flex-1`} style={selStyle}>
            <option value="recurring">هربار (با کول‌داون)</option>
            <option value="once">فقط یک‌بار</option>
          </select>
          {form.trigger === 'recurring' && (
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
          <input value={form.expiryH} onChange={(e) => set({ expiryH: e.target.value })} placeholder="انقضا (ساعت) — خالی = بدونِ انقضا" dir="ltr" className={`${inputCls} flex-1`} style={inputStyle} />
        </div>

        {/* تنظیماتِ بیشتر — پیام + تحویل */}
        <button onClick={() => setShowAdvanced((v) => !v)} className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100 transition-opacity">
          <ChevronDown size={11} className="transition-transform" style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none' }} />
          پیام و تحویل
        </button>
        {showAdvanced && (
          <div className="space-y-1.5 pt-0.5">
            <input value={form.message} onChange={(e) => set({ message: e.target.value })} placeholder="پیامِ سفارشی (متغیرها: {symbol} {price} {value} {tf})" className={`${inputCls} w-full`} style={inputStyle} />
            {/* پالتِ متغیرها */}
            <div className="flex gap-1 flex-wrap">
              {['{symbol}', '{price}', '{value}', '{tf}'].map((ph) => (
                <button key={ph} onClick={() => set({ message: (form.message || '') + ph })} className="text-[9px] rounded-md px-1.5 py-0.5 transition-colors" style={{ background: TH.chipBg, color: TH.text }} dir="ltr"
                  onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>{ph}</button>
              ))}
            </div>
            {/* کانال‌های تحویل */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={form.popup} onChange={(e) => set({ popup: e.target.checked })} />
                <MessageSquare size={11} className="opacity-60" /> پاپ‌آپ
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={form.telegram} onChange={(e) => set({ telegram: e.target.checked })} />
                <Send size={11} className="opacity-60" /> تلگرام
              </label>
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

      {/* ───────────────── فهرستِ آلارم‌ها ───────────────── */}
      {list.length === 0 ? (
        <div className="text-[10px] opacity-40 text-center py-8">هنوز آلارمی ساخته نشده.</div>
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
      )}
    </div>
  );
}
