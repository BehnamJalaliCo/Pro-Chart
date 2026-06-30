import { useState, useMemo, useEffect } from 'react';
import { Phone, Search, Check, Info, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../store';

// فهرستِ کشورها (ISO + پیش‌شماره + نام فارسی) — ایران اول. پرچم از روی ISO ساخته می‌شود.
const COUNTRIES = [
  ['IR', '98', 'ایران', 10], ['AE', '971', 'امارات', 9], ['TR', '90', 'ترکیه', 10],
  ['IQ', '964', 'عراق', 10], ['AF', '93', 'افغانستان', 9], ['OM', '968', 'عمان', 8],
  ['QA', '974', 'قطر', 8], ['KW', '965', 'کویت', 8], ['SA', '966', 'عربستان', 9],
  ['BH', '973', 'بحرین', 8], ['AZ', '994', 'آذربایجان', 9], ['AM', '374', 'ارمنستان', 8],
  ['GE', '995', 'گرجستان', 9], ['RU', '7', 'روسیه', 10], ['DE', '49', 'آلمان', 11],
  ['GB', '44', 'بریتانیا', 10], ['FR', '33', 'فرانسه', 9], ['IT', '39', 'ایتالیا', 10],
  ['ES', '34', 'اسپانیا', 9], ['NL', '31', 'هلند', 9], ['SE', '46', 'سوئد', 9],
  ['NO', '47', 'نروژ', 8], ['CA', '1', 'کانادا', 10], ['US', '1', 'آمریکا', 10],
  ['AU', '61', 'استرالیا', 9], ['MY', '60', 'مالزی', 9], ['ID', '62', 'اندونزی', 10],
  ['IN', '91', 'هند', 10], ['PK', '92', 'پاکستان', 10], ['CN', '86', 'چین', 11],
  ['JP', '81', 'ژاپن', 10], ['KR', '82', 'کرهٔ جنوبی', 10],
];

const flag = (iso) => String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
const onlyDigits = (s) => (s || '').replace(/[^\d]/g, '');

export default function PhoneGate() {
  const { me, setMe } = useAuth();
  const [iso, setIso] = useState('IR');
  const [num, setNum] = useState('');
  const [openList, setOpenList] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const country = useMemo(() => COUNTRIES.find((c) => c[0] === iso) || COUNTRIES[0], [iso]);
  const filtered = useMemo(() => COUNTRIES.filter((c) => c[2].includes(q) || c[1].includes(q) || c[0].toLowerCase().includes(q.toLowerCase())), [q]);

  // ورودی: حذفِ صفرِ ابتدایی + فقط رقم (آموزشِ «بدون صفر»)
  const onNum = (v) => { let d = onlyDigits(v); d = d.replace(/^0+/, ''); setNum(d); setErr(''); };

  const valid = useMemo(() => {
    if (country[0] === 'IR') return /^9\d{9}$/.test(num);          // ایران: با ۹ شروع، ۱۰ رقم، بدونِ صفر
    return num.length >= 6 && num.length <= 14;                     // بین‌المللی
  }, [num, country]);

  const submit = async () => {
    if (!valid) { setErr(country[0] === 'IR' ? 'شمارهٔ ایران باید با ۹ شروع شود و ۱۰ رقم باشد (بدونِ صفر).' : 'شمارهٔ معتبر وارد کن (بدونِ صفر و کدِ کشور).'); return; }
    setBusy(true); setErr('');
    try {
      const full = `+${country[1]}${num}`;
      const r = await api.updateProfile({ phone: full, country: country[0] });
      setMe({ ...(me || {}), phone_number: r.phone_number || full, phone_required: false });
    } catch (e) { setErr(e?.message || 'ثبتِ شماره ناموفق بود. دوباره تلاش کن.'); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-surface-bg">
      <div className="card p-7 w-full max-w-md relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-brand-green/10 blur-2xl" />
        <div className="relative text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-brand-green/15 flex items-center justify-center mx-auto mb-3">
            <Phone size={26} className="text-brand-green" />
          </div>
          <h1 className="text-xl font-black mb-1">شمارهٔ موبایلت را وارد کن</h1>
          <p className="text-text-secondary text-sm leading-6">برای فعال‌سازیِ کاملِ حساب و دسترسی به آکادمی، یک‌بار شمارهٔ موبایلت را ثبت کن.</p>
        </div>

        {/* آموزشِ کوتاه */}
        <div className="flex items-start gap-2 bg-brand-blue/8 text-brand-blue/90 rounded-xl px-3 py-2.5 text-[12px] mb-4 leading-6">
          <Info size={15} className="shrink-0 mt-0.5" />
          <span>کشورت را انتخاب کن و شماره را <b>بدونِ صفرِ ابتدایی</b> و <b>بدونِ کدِ کشور</b> وارد کن. مثلاً ایران: <span dir="ltr" className="font-mono">9123456789</span></span>
        </div>

        <div className="flex items-stretch gap-2 mb-2">
          {/* انتخابگرِ کشور */}
          <div className="relative">
            <button onClick={() => setOpenList((v) => !v)} className="flex items-center gap-1.5 h-full px-3 rounded-xl border border-surface-border bg-surface-card hover:border-brand-green/50 transition-colors" dir="ltr">
              <span className="text-lg leading-none">{flag(country[0])}</span>
              <span className="text-sm font-mono">+{country[1]}</span>
            </button>
            {openList && (
              <div className="absolute z-30 mt-1 w-60 bg-surface-card border border-surface-border rounded-xl shadow-2xl max-h-72 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border">
                  <Search size={14} className="text-text-muted" />
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجوی کشور…" className="flex-1 bg-transparent text-sm outline-none" />
                </div>
                <div className="overflow-auto">
                  {filtered.map((c) => (
                    <button key={c[0] + c[1]} onClick={() => { setIso(c[0]); setOpenList(false); setQ(''); }} className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-brand-green/5">
                      <span className="flex items-center gap-2"><span className="text-base">{flag(c[0])}</span> {c[2]}</span>
                      <span className="text-text-muted font-mono" dir="ltr">+{c[1]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* شماره */}
          <div className={`flex-1 flex items-center gap-2 bg-surface-card border rounded-xl px-3 transition-colors ${num && !valid ? 'border-brand-red' : num && valid ? 'border-brand-green' : 'border-surface-border focus-within:border-brand-green'}`}>
            <input value={num} onChange={(e) => onNum(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
              inputMode="numeric" placeholder="9123456789" autoFocus className="flex-1 bg-transparent py-3 text-sm outline-none font-mono tracking-wide" dir="ltr" />
            {num && valid && <Check size={18} className="text-brand-green shrink-0" />}
          </div>
        </div>

        {num && (
          <p className="text-[11px] text-text-muted mb-2 text-center" dir="ltr">شمارهٔ کامل: <b className="text-text-secondary">+{country[1]} {num}</b></p>
        )}
        {err && <p className="text-brand-red text-sm bg-brand-red/10 rounded-lg px-3 py-2 mb-3">{err}</p>}

        <button onClick={submit} disabled={busy || !valid} className="btn-success w-full disabled:opacity-50 flex items-center justify-center gap-2">
          <ShieldCheck size={18} /> {busy ? 'در حال ثبت…' : 'ثبت و ورود به آکادمی'}
        </button>
        <p className="text-[11px] text-text-muted mt-3 text-center">شمارهٔ تو محرمانه می‌ماند و فقط برای فعال‌سازیِ حساب استفاده می‌شود.</p>
      </div>
    </div>
  );
}
