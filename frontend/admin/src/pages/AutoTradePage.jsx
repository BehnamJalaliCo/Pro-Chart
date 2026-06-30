import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eaAPI } from '../api/client';
import { useNotificationStore } from '../store';
import {
  Bot, Power, Save, AlertTriangle, Shield, TrendingUp, Layers, Percent,
  Loader2, Info, Wifi, WifiOff, CheckCircle2, XCircle, Wallet, Activity,
  CircleSlash, ArrowUpRight, ArrowDownRight, LogIn, LogOut,
} from 'lucide-react';

const money = (v, c = '') => `${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${c ? ' ' + c : ''}`;

function NumField({ label, hint, value, onChange, step = 0.1, min, max, suffix }) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1">{label}{hint && <span className="text-text-muted/70"> · {hint}</span>}</label>
      <div className="flex items-center gap-2">
        <input type="number" value={value} step={step} min={min} max={max}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className="w-full" />
        {suffix && <span className="text-xs text-text-muted shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full bg-surface-elevated rounded-lg px-3 py-2.5 text-right">
      <div>
        <div className="text-sm text-text-primary">{label}</div>
        {hint && <div className="text-[11px] text-text-muted">{hint}</div>}
      </div>
      <span className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${checked ? 'bg-brand-green' : 'bg-surface-border'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-0.5' : 'right-0.5'}`} />
      </span>
    </button>
  );
}

function AcctCard({ icon: Icon, label, value, tone = 'blue' }) {
  const t = { blue: 'text-brand-blue bg-brand-blue/10', green: 'text-brand-green bg-brand-green/10', red: 'text-brand-red bg-brand-red/10', amber: 'text-amber-500 bg-amber-500/10' }[tone];
  return (
    <div className="card flex items-center gap-3 py-3.5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${t}`}><Icon size={18} /></div>
      <div className="min-w-0"><div className="text-base font-bold text-text-primary leading-none truncate" dir="ltr">{value}</div><div className="text-xs text-text-muted mt-1">{label}</div></div>
    </div>
  );
}

function StatusLight({ tone, big = false }) {
  const c = { green: 'bg-brand-green', amber: 'bg-amber-500', red: 'bg-brand-red' }[tone] || 'bg-text-muted';
  const blink = tone === 'green' || tone === 'amber';
  const sz = big ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <span className={`relative inline-flex ${sz} shrink-0`}>
      {blink && <span className={`absolute inline-flex w-full h-full rounded-full ${c} opacity-70 animate-ping`} />}
      <span className={`relative inline-flex ${sz} rounded-full ${c} ${big ? 'ring-4 ring-current/10' : ''}`} />
    </span>
  );
}

export default function AutoTradePage() {
  const notify = useNotificationStore();
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['ea-config'], queryFn: () => eaAPI.getConfig().then(r => r.data) });
  const { data: st } = useQuery({ queryKey: ['ea-status'], queryFn: () => eaAPI.getStatus().then(r => r.data), refetchInterval: 5000 });
  const { data: acct, refetch: refetchAcct } = useQuery({ queryKey: ['ea-account'], queryFn: () => eaAPI.getAccount().then(r => r.data), refetchInterval: 10000 });

  const [acctForm, setAcctForm] = useState({ server: '', login: '', password: '' });
  const [acctBusy, setAcctBusy] = useState(false);
  const setAf = (k, v) => setAcctForm((f) => ({ ...f, [k]: v }));
  const doLogin = async () => {
    if (!acctForm.server || !acctForm.login || !acctForm.password) { notify.error('سرور، شماره حساب و رمز را وارد کنید'); return; }
    setAcctBusy(true);
    try { await eaAPI.setAccount(acctForm); setAcctForm({ server: '', login: '', password: '' }); notify.success('حساب ثبت شد؛ تا چند لحظه متاتریدر با حسابِ جدید لاگین می‌کند.'); refetchAcct(); }
    catch (e) { notify.error(e?.response?.data?.detail || 'خطا'); } finally { setAcctBusy(false); }
  };
  const doLogout = async () => {
    if (!window.confirm('از حسابِ متاتریدر خارج می‌شوید؟')) return;
    setAcctBusy(true);
    try { await eaAPI.logoutAccount(); notify.success('از حساب خارج شد.'); refetchAcct(); }
    catch { notify.error('خطا'); } finally { setAcctBusy(false); }
  };

  useEffect(() => { if (data && !cfg) setCfg(data); }, [data]); // eslint-disable-line
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const save = async (override) => {
    setSaving(true);
    try { const { data: u } = await eaAPI.setConfig(override || cfg); setCfg(u); notify.success('ذخیره شد'); }
    catch (e) { notify.error(e?.response?.data?.detail || 'خطا'); } finally { setSaving(false); }
  };
  const toggleMaster = async () => { const next = !cfg.enabled; setCfg((c) => ({ ...c, enabled: next })); await save({ ...cfg, enabled: next }); };
  const closeAll = async () => {
    if (!window.confirm('همهٔ معاملاتِ اتو-ترید بسته شوند؟')) return;
    try { await eaAPI.closeAll(); notify.success('فرمانِ بستنِ همه ارسال شد'); } catch { notify.error('خطا'); }
  };

  if (isLoading || !cfg) return <div className="p-10 text-center text-text-muted">در حال بارگذاری…</div>;

  const cur = st?.currency || '';
  const conn = st?.connected;
  const positions = st?.positions || [];

  // وضعیتِ اتصال
  let banner;
  if (!st?.ea_running) banner = { tone: 'red', icon: WifiOff, title: 'EA متصل نیست', desc: 'CoineProAutoTrader را روی یک چارتِ متاتریدر بکش (راهنمای پایین).' };
  else if (!conn) banner = { tone: 'red', icon: WifiOff, title: 'اتصال قطع شد', desc: `آخرین ارتباط ${st?.last_seen_age ?? '—'} ثانیه پیش — متاتریدر را بررسی کن.` };
  else if (!st?.mt5_connected) banner = { tone: 'amber', icon: AlertTriangle, title: 'متاتریدر به بروکر وصل نیست', desc: 'اتصالِ اینترنت/حسابِ متاتریدر را چک کن.' };
  else if (!st?.trade_allowed) banner = { tone: 'amber', icon: AlertTriangle, title: 'AutoTrading خاموش است', desc: 'دکمهٔ AutoTrading را در متاتریدر روشن کن (وگرنه معامله باز نمی‌شود).' };
  else banner = { tone: 'green', icon: Wifi, title: 'متصل به متاتریدر ✓', desc: `حساب ${st?.account} · ${st?.broker}` };
  const bTone = { red: 'bg-brand-red/10 border-brand-red/30 text-brand-red', amber: 'bg-amber-500/10 border-amber-500/30 text-amber-500', green: 'bg-brand-green/10 border-brand-green/30 text-brand-green' }[banner.tone];

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center"><Bot size={22} /></div>
        <div><h1 className="text-xl font-bold text-text-primary">اتو-ترید</h1><p className="text-sm text-text-muted">اجرای خودکارِ سیگنال‌های کانال روی متاتریدرِ سرور</p></div>
      </div>

      {/* نوارِ وضعیتِ اصلی با نورِ چشمک‌زن */}
      {(() => {
        const ready = st?.connected && st?.trade_allowed;
        const tone = !cfg.enabled ? 'red' : (ready ? 'green' : 'amber');
        const title = !cfg.enabled ? 'خاموش' : (ready ? 'روشن — در حال ترید' : 'روشن — منتظرِ آماده‌سازی');
        let gate = 'AutoTrading آماده نیست.';
        if (cfg.enabled && st?.connected && !st?.trade_allowed) {
          if (st?.acct_trade === false) gate = 'حسابِ متاتریدر اجازهٔ ترید ندارد (احتمالاً با رمزِ investor / read-only وارد شده‌اید).';
          else if (st?.acct_expert === false) gate = 'بروکر اجازهٔ اجرای EA روی این حساب را نداده است.';
          else if (st?.term_algo === false) gate = 'دکمهٔ «Algo Trading» در متاتریدر خاموش است — روشنش کنید (Ctrl+E).';
          else if (st?.ea_algo === false) gate = 'تیکِ الگو روی خودِ EA خاموش است — EA را یک‌بار دوباره روی چارت بیندازید.';
        }
        const desc = !cfg.enabled
          ? 'اتو-ترید غیرفعال است؛ هیچ معامله‌ای باز نمی‌شود.'
          : (ready ? 'سیگنال‌های کانال خودکار روی حساب اجرا می‌شوند.'
                   : (!st?.connected ? 'EA متصل نیست — منتظرِ اتصالِ متاتریدر.' : gate));
        const bg = { red: 'bg-brand-red/10 border-brand-red/30', amber: 'bg-amber-500/10 border-amber-500/30', green: 'bg-brand-green/10 border-brand-green/30' }[tone];
        const txt = { red: 'text-brand-red', amber: 'text-amber-500', green: 'text-brand-green' }[tone];
        return (
          <div className={`rounded-2xl border-2 px-5 py-4 flex items-center gap-4 ${bg}`}>
            <StatusLight tone={tone} big />
            <div className="min-w-0 flex-1">
              <div className={`text-lg font-bold ${txt}`}>{title}</div>
              <div className="text-xs text-text-muted mt-0.5">{desc}</div>
            </div>
            <button onClick={toggleMaster} disabled={saving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold shrink-0 ${cfg.enabled ? 'bg-brand-red text-white' : 'bg-brand-green text-white'}`}>
              <Power size={18} /> {cfg.enabled ? 'خاموش کن' : 'روشن کن'}
            </button>
          </div>
        );
      })()}

      {/* connection banner */}
      <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${bTone}`}>
        <banner.icon size={22} className="shrink-0" />
        <div className="min-w-0 flex-1"><div className="font-bold text-sm">{banner.title}</div><div className="text-xs opacity-90 truncate" dir="auto">{banner.desc}</div></div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="flex items-center gap-1">{st?.mt5_connected ? <CheckCircle2 size={14} /> : <XCircle size={14} />} بروکر</span>
          <span className="flex items-center gap-1">{st?.trade_allowed ? <CheckCircle2 size={14} /> : <XCircle size={14} />} اتو</span>
        </div>
      </div>

      {/* account overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AcctCard icon={Wallet} label={`موجودی ${cur}`} value={money(st?.balance)} tone="blue" />
        <AcctCard icon={Activity} label={`اکوییتی ${cur}`} value={money(st?.equity)} tone="blue" />
        <AcctCard icon={Shield} label={`مارجینِ آزاد ${cur}`} value={money(st?.free_margin)} tone="amber" />
        <AcctCard icon={(st?.floating_pnl ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight}
          label="سود/زیانِ شناور" value={money(st?.floating_pnl, cur)} tone={(st?.floating_pnl ?? 0) >= 0 ? 'green' : 'red'} />
      </div>

      {/* حسابِ معاملاتی — ورود/خروج */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Wallet size={16} /> حسابِ معاملاتی</h2>
          {(acct?.configured || st?.mt5_connected) && (
            <button onClick={doLogout} disabled={acctBusy}
              className="btn-danger text-xs flex items-center gap-1.5"><LogOut size={14} /> خروج از حساب</button>
          )}
        </div>
        {(acct?.configured || st?.mt5_connected) ? (
          <div className="bg-surface-elevated rounded-lg px-3 py-2.5 flex items-center gap-3 mb-3">
            <StatusLight tone={st?.mt5_connected ? 'green' : 'amber'} />
            <div className="min-w-0 flex-1 text-sm" dir="ltr">
              <span className="font-bold text-text-primary">{acct?.login_masked || st?.account || '—'}</span>
              <span className="text-text-muted"> · {acct?.server || st?.broker || ''}</span>
            </div>
            <span className="text-xs text-text-muted shrink-0">{st?.mt5_connected ? `متصل · ${st?.broker || ''}` : 'در حالِ اتصال…'}</span>
          </div>
        ) : (
          <p className="text-xs text-text-muted mb-3">حسابی متصل نیست. برای ورود، مشخصاتِ زیر را وارد کنید.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input className="w-full" dir="ltr" placeholder="Server (مثلاً OneRoyal-Live)" value={acctForm.server} onChange={(e) => setAf('server', e.target.value)} />
          <input className="w-full" dir="ltr" placeholder="شماره حساب (Login)" value={acctForm.login} onChange={(e) => setAf('login', e.target.value)} />
          <input className="w-full" dir="ltr" type="password" placeholder="رمزِ معاملاتی (master)" value={acctForm.password} onChange={(e) => setAf('password', e.target.value)} />
        </div>
        <button onClick={doLogin} disabled={acctBusy}
          className="btn-primary text-sm flex items-center gap-1.5 mt-3 w-full sm:w-auto justify-center">
          {acctBusy ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />} ورود به حساب
        </button>
        <p className="text-[11px] text-text-muted mt-2">⚠️ حتماً رمزِ معاملاتی (master) را وارد کنید، نه investor — وگرنه ترید باز نمی‌شود.</p>
      </div>

      {/* open trades */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><TrendingUp size={16} /> معاملاتِ بازِ اتو-ترید <span className="text-text-muted">({positions.length.toLocaleString('fa-IR')})</span></h2>
          {positions.length > 0 && (
            <button onClick={closeAll} className="btn-danger text-xs flex items-center gap-1.5"><CircleSlash size={14} /> بستنِ همه</button>
          )}
        </div>
        {positions.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-muted text-sm">معاملهٔ بازی نیست.</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-text-secondary border-b border-surface-border">
              <th className="px-4 py-2 text-right font-medium">نماد</th>
              <th className="px-4 py-2 text-right font-medium">جهت</th>
              <th className="px-4 py-2 text-right font-medium">حجم</th>
              <th className="px-4 py-2 text-left font-medium">سود/زیان</th>
            </tr></thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={i} className="border-b border-surface-border/50">
                  <td className="px-4 py-2.5 font-medium text-text-primary" dir="ltr">{p.symbol}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${p.direction === 'BUY' ? 'badge-green' : 'badge-red'}`}>{p.direction === 'BUY' ? 'خرید' : 'فروش'}</span></td>
                  <td className="px-4 py-2.5 text-text-secondary" dir="ltr">{p.lots}</td>
                  <td className={`px-4 py-2.5 text-left font-bold ${p.profit >= 0 ? 'text-brand-green' : 'text-brand-red'}`} dir="ltr">{p.profit >= 0 ? '+' : ''}{money(p.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Percent size={16} /> حجم و ریسک</h2>
          <NumField label="ریسکِ هر معامله" hint="٪ موجودی" value={cfg.risk_percent} onChange={(v) => set('risk_percent', v)} step={0.1} min={0.01} max={20} suffix="٪" />
          <NumField label="حجمِ ثابت" hint="۰=ریسک‌محور" value={cfg.fixed_lots} onChange={(v) => set('fixed_lots', v)} step={0.01} min={0} suffix="lot" />
          <NumField label="سقفِ حجم" value={cfg.max_lot} onChange={(v) => set('max_lot', v)} step={0.1} min={0.01} suffix="lot" />
          <NumField label="حداکثر معاملاتِ باز هم‌زمان" value={cfg.max_open_trades} onChange={(v) => set('max_open_trades', v)} step={1} min={1} max={100} />
        </div>

        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Shield size={16} /> گاردِ ریسکِ روزانه</h2>
          <NumField label="حداکثر معاملاتِ روزانه" hint="۰=بدون محدودیت" value={cfg.max_daily_trades} onChange={(v) => set('max_daily_trades', v)} step={1} min={0} />
          <NumField label="حداکثر ضررِ روزانه" hint="٪ موجودی · توقفِ معاملهٔ جدید" value={cfg.max_daily_loss_pct} onChange={(v) => set('max_daily_loss_pct', v)} step={0.5} min={0} max={100} suffix="٪" />
          <NumField label="حداکثر اسپردِ مجاز" hint="point · ۰=بدون محدودیت" value={cfg.max_spread_points} onChange={(v) => set('max_spread_points', v)} step={1} min={0} />
        </div>

        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Layers size={16} /> نماد</h2>
          <div>
            <label className="block text-xs text-text-muted mb-1">پسوندِ نمادِ بروکر <span className="text-text-muted/70">· مثلِ <code dir="ltr">.m</code> یا خالی</span></label>
            <input value={cfg.symbol_suffix} onChange={(e) => set('symbol_suffix', e.target.value)} placeholder="(خالی)" className="w-full" dir="ltr" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">نمادهای مجاز <span className="text-text-muted/70">· با کاما؛ خالی=همه</span></label>
            <input value={cfg.allowed_symbols} onChange={(e) => set('allowed_symbols', e.target.value)} placeholder="EURUSD,XAUUSD" className="w-full" dir="ltr" />
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><TrendingUp size={16} /> مدیریتِ سود</h2>
          <Toggle label="سربه‌سر در TP1" hint="رسیدن به TP1 → استاپ روی ورود" checked={cfg.breakeven_at_tp1} onChange={(v) => set('breakeven_at_tp1', v)} />
          <Toggle label="تریلینگ‌استاپ" hint="قفلِ پلکانیِ سود" checked={cfg.use_trailing} onChange={(v) => set('use_trailing', v)} />
          <Toggle label="حدِ سودِ نهایی روی TP3" checked={cfg.set_tp_tp3} onChange={(v) => set('set_tp_tp3', v)} />
          <Toggle label="بستن وقتی سیگنال از کانال رفت" checked={cfg.close_on_signal_gone} onChange={(v) => set('close_on_signal_gone', v)} />
          {cfg.use_trailing && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <NumField label="شروعِ تریل" hint="× TP1" value={cfg.trail_start_frac} onChange={(v) => set('trail_start_frac', v)} step={0.1} min={0} max={5} />
              <NumField label="فاصلهٔ تریل" hint="× TP1" value={cfg.trail_distance_frac} onChange={(v) => set('trail_distance_frac', v)} step={0.05} min={0.05} max={5} />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button onClick={() => save()} disabled={saving} className="btn-primary flex items-center gap-2 px-6">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} ذخیرهٔ تنظیمات
        </button>
      </div>

      {/* setup guide */}
      <div className="card">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-2"><Info size={16} /> راه‌اندازیِ یک‌بارهٔ EA</h2>
        <ol className="text-sm text-text-secondary space-y-1 list-decimal pr-5 leading-7">
          <li>لایو ترید → «دسکتاپ متاتریدرِ سرور» را باز کن.</li>
          <li>دکمهٔ <b>AutoTrading</b> را روشن کن.</li>
          <li>Navigator → Expert Advisors → <b>CoineProAutoTrader</b> را روی یک چارت بکش → <i>Allow Algo Trading</i> → OK.</li>
          <li>اینجا کلید را <b>روشن</b> کن. وقتی بالا نوشت «متصل ✓» یعنی آماده است.</li>
        </ol>
      </div>
    </div>
  );
}
