import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Power, Save, ShieldAlert, OctagonX, XCircle } from 'lucide-react';
import { userAPI } from '../api/client';
import { Spinner, StatusLight } from '../components/ui';
import Guide from '../components/Guide';
import RiskSimulator from '../components/RiskSimulator';

function Slider({ label, value, min, max, step, suffix, onChange, accent = 'accent-brand-blue' }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm text-text-secondary">{label}</label>
        <span className="text-sm font-bold text-text-primary">{Number(value).toLocaleString('fa-IR')}{suffix || ''}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className={`w-full ${accent}`} />
    </div>
  );
}

const RISK_MODES = [
  { v: 'proportional', label: 'متناسب با موجودی', hint: 'حجم به نسبتِ موجودیِ شما نسبت به مَستر' },
  { v: 'risk_percent', label: 'درصدِ ریسک', hint: 'در هر معامله درصدِ ثابتی از موجودی ریسک می‌شود' },
  { v: 'fixed_lot', label: 'لاتِ ثابت', hint: 'هر معامله با حجمِ ثابت باز می‌شود' },
];

export default function CopyTradePage() {
  const { data: status } = useQuery({ queryKey: ['copyStatus'], queryFn: () => userAPI.copyStatus(), refetchInterval: 8000 });
  const { data: cfg, isLoading } = useQuery({ queryKey: ['copyConfig'], queryFn: () => userAPI.getCopyConfig() });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => { if (cfg && !form) setForm(cfg); }, [cfg, form]);
  if (isLoading || !form) return <Spinner />;

  const hasAccount = !!status?.account;
  const connected = status?.account?.status === 'connected';
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (override) => {
    setSaving(true); setMsg('');
    try { const next = { ...form, ...(override || {}) }; const r = await userAPI.setCopyConfig(next); setForm(r); setMsg('ذخیره شد ✓'); setTimeout(() => setMsg(''), 2500); }
    catch (e) { setMsg(e?.message || 'ذخیره ناشد'); }
    finally { setSaving(false); }
  };
  const toggle = () => save({ enabled: !form.enabled });

  const emergencyStop = async () => {
    if (!window.confirm('کپی‌ترید فوراً متوقف شود؟ پوزیشنِ جدیدی باز نخواهد شد.')) return;
    setBusy('stop');
    try { const r = await userAPI.copyStop(); setForm((f) => ({ ...f, enabled: r.enabled })); setMsg('کپی متوقف شد ✓'); }
    catch (e) { setMsg(e?.message || 'خطا'); }
    finally { setBusy(''); setTimeout(() => setMsg(''), 3000); }
  };
  const closeAll = async () => {
    if (!window.confirm('همهٔ پوزیشن‌های بازِ شما بسته شوند؟ این عمل قابلِ بازگشت نیست.')) return;
    setBusy('close');
    try { await userAPI.copyCloseAll(); setMsg('درخواستِ بستنِ همه ثبت شد ✓'); }
    catch (e) { setMsg(e?.message || 'خطا'); }
    finally { setBusy(''); setTimeout(() => setMsg(''), 3000); }
  };

  const tone = !hasAccount ? 'red' : form.enabled ? (connected ? 'green' : 'amber') : 'red';
  const title = !hasAccount ? 'حسابی متصل نیست' : !form.enabled ? 'کپی‌ترید خاموش است'
    : connected ? 'کپی‌ترید روشن — در حال اجرا' : 'کپی‌ترید روشن — منتظرِ اتصالِ حساب';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-text-primary">کپی‌ترید</h1>
        <p className="text-text-secondary text-sm">معاملاتِ سیستم به‌صورت خودکار روی حسابِ شما اجرا می‌شود</p>
      </div>

      {!hasAccount && (
        <div className="card p-5 border-brand-red/40 flex items-center gap-3">
          <ShieldAlert className="text-brand-red shrink-0" />
          <div className="flex-1 text-sm text-text-secondary">ابتدا باید حساب MT5 خود را متصل کنید.</div>
          <Link to="/account" className="btn-primary text-sm shrink-0">اتصالِ حساب</Link>
        </div>
      )}

      {/* وضعیت + کلیدِ روشن/خاموش */}
      <div className={`card p-5 flex items-center gap-4 ${tone === 'green' ? 'border-brand-green/40' : tone === 'amber' ? 'border-brand-amber/40' : 'border-brand-red/40'}`}>
        <StatusLight tone={tone} />
        <div className="flex-1">
          <div className="font-bold text-text-primary">{title}</div>
          <div className="text-xs text-text-muted">{form.enabled ? 'برای توقف، خاموش کنید.' : 'برای شروعِ آینه‌شدنِ معاملات، روشن کنید.'}</div>
        </div>
        <button onClick={toggle} disabled={saving || !hasAccount}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shrink-0 ${form.enabled ? 'bg-brand-red' : 'bg-brand-green'} disabled:opacity-50`}>
          <Power size={18} /> {form.enabled ? 'خاموش کن' : 'روشن کن'}
        </button>
      </div>

      {/* کنترلِ اضطراری (Kill-switch) */}
      <div className="card p-5 border-brand-red/30">
        <div className="flex items-center gap-2 mb-1">
          <OctagonX size={18} className="text-brand-red" />
          <h3 className="font-bold text-text-primary">کنترلِ اضطراری</h3>
        </div>
        <p className="text-xs text-text-muted mb-4">دکمه‌های ایمنی برای مواقعِ اضطراری — بدونِ نیاز به جست‌وجوی تنظیمات.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <button onClick={emergencyStop} disabled={busy !== '' || !hasAccount}
            className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-black text-white bg-brand-red hover:opacity-90 disabled:opacity-40 transition">
            <OctagonX size={20} /> {busy === 'stop' ? 'در حالِ توقف…' : 'توقفِ فوریِ کپی'}
          </button>
          <button onClick={closeAll} disabled={busy !== '' || !hasAccount}
            className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-black text-brand-red border-2 border-brand-red/50 hover:bg-brand-red/10 disabled:opacity-40 transition">
            <XCircle size={20} /> {busy === 'close' ? 'در حالِ ارسال…' : 'بستنِ همهٔ پوزیشن‌ها'}
          </button>
        </div>
        <p className="text-[11px] text-text-muted mt-3">
          «توقفِ فوری» کپی را خاموش می‌کند (پوزیشن‌های باز دست‌نخورده می‌مانند). «بستنِ همه» فرمانِ بستنِ همهٔ پوزیشن‌های بازِ شما را می‌فرستد.
        </p>
      </div>

      {/* تنظیماتِ ریسک */}
      <div className="card p-5 space-y-5">
        <h3 className="font-bold text-text-primary">تنظیماتِ ریسک</h3>

        <div>
          <label className="label">مدلِ تعیینِ حجم</label>
          <div className="grid sm:grid-cols-3 gap-2">
            {RISK_MODES.map((m) => (
              <button key={m.v} onClick={() => set('risk_mode', m.v)}
                className={`text-right p-3 rounded-xl border transition ${form.risk_mode === m.v ? 'border-brand-blue bg-brand-blue/10' : 'border-surface-border bg-surface-elevated'}`}>
                <div className="text-sm font-bold text-text-primary">{m.label}</div>
                <div className="text-[11px] text-text-muted mt-0.5">{m.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
          {form.risk_mode === 'fixed_lot' ? (
            <Slider label="حجمِ ثابت (لات)" value={form.risk_value} min={0.01} max={10} step={0.01}
              suffix=" لات" onChange={(v) => set('risk_value', v)} />
          ) : form.risk_mode === 'risk_percent' ? (
            <Slider label="درصدِ ریسک در هر معامله" value={form.risk_value} min={0.5} max={10} step={0.5}
              suffix="٪" onChange={(v) => set('risk_value', v)} />
          ) : (
            <Slider label="ضریبِ تناسب" value={form.risk_value} min={0.1} max={5} step={0.1}
              onChange={(v) => set('risk_value', v)} />
          )}
          <Slider label="حداکثر حجمِ هر معامله" value={form.max_lot} min={0.01} max={20} step={0.01}
            suffix=" لات" onChange={(v) => set('max_lot', v)} />
          <Slider label="حداکثر معاملاتِ بازِ هم‌زمان" value={form.max_open_trades} min={1} max={50} step={1}
            onChange={(v) => set('max_open_trades', v)} />
          <Slider label="سقفِ زیانِ روزانه (٪ موجودی — ۰ یعنی غیرفعال)" value={form.max_daily_loss_pct}
            min={0} max={90} step={1} suffix="٪" accent="accent-brand-amber" onChange={(v) => set('max_daily_loss_pct', v)} />
        </div>

        <label className="flex items-center justify-between bg-surface-elevated rounded-xl px-4 py-3 cursor-pointer">
          <span className="text-sm text-text-primary">کپیِ حد ضرر و حد سود از مَستر</span>
          <input type="checkbox" checked={form.copy_sl_tp} onChange={(e) => set('copy_sl_tp', e.target.checked)} className="w-5 h-5 accent-brand-green" />
        </label>

        <div className="flex items-center gap-3">
          <button onClick={() => save()} disabled={saving} className="btn-primary flex items-center gap-2">
            <Save size={16} /> {saving ? 'ذخیره…' : 'ذخیرهٔ تنظیمات'}
          </button>
          {msg && <span className="text-sm text-brand-green">{msg}</span>}
        </div>
      </div>

      {/* شبیه‌سازِ ریسک */}
      <RiskSimulator defaultRisk={form.risk_mode === 'risk_percent' ? form.risk_value : 1} />

      <Guide title="کپی‌ترید چطور کار می‌کند؟" defaultOpen>
        وقتی روشن کنید، هر معامله‌ای که سیستمِ ما (مَستر) باز می‌کند، به‌صورت خودکار و زنده روی
        حسابِ شما هم باز می‌شود — بدونِ نیاز به کارِ دستی.
        <br />• <b>متناسب با موجودی:</b> حجم بر اساسِ نسبتِ موجودیِ شما تنظیم می‌شود (پیشنهادی).
        <br />• <b>درصدِ ریسک:</b> در هر معامله همان درصد از موجودیِ شما ریسک می‌شود.
        <br />• <b>لاتِ ثابت:</b> هر معامله با حجمِ مشخص باز می‌شود.
        <br />«سقفِ زیانِ روزانه» یک محافظ است: اگر زیانِ امروز به آن درصد برسد، کپی تا فردا متوقف می‌شود.
        توصیه: با حجمِ کم شروع کنید تا با رفتارِ سیستم آشنا شوید.
      </Guide>
    </div>
  );
}
