import React from 'react';
import {
  Menu, X, LogIn, UserPlus, Crown, LogOut, User, Loader2, Eye, EyeOff,
  Sparkles, Code2, LineChart, List, Bell, Search, CalendarDays,
  HelpCircle, LifeBuoy, FileText, ChevronLeft, ArrowUpRight, Sun, Moon,
  Check, ShieldCheck, Zap, Star, Users, BadgeCheck,
} from 'lucide-react';
import { api, tokenStore } from './api/client';

// آدرسِ پنلِ کاربری (ثبت‌نام/پرداخت/بروکر). از env قابلِ تنظیم؛ پیش‌فرضِ امن.
const PANEL_URL = (import.meta.env && import.meta.env.VITE_USER_PANEL_URL) || 'https://user.pro-chart.com';
// رویدادِ سفارشی برای ارتباط با والد (BazaarNama.jsx) بدونِ prop-drilling
const fire = (name, detail) => {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { /* noop */ }
};

// ورودیِ رمز با آیکونِ چشم (نمایش/مخفی‌کردنِ رمز)
function PasswordField({ P, value, onChange, placeholder }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <input className={inpCls + ' pl-9'} style={fieldStyle(P)} type={show ? 'text' : 'password'}
             placeholder={placeholder} value={value} onChange={onChange} dir="ltr" />
      <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1}
              className="absolute left-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
              style={{ color: P.text }} title={show ? 'مخفی' : 'نمایش'}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// منوی همبرگری ورود/ثبت‌نام/اشتراک — theme-aware (روشن/تاریک) + انیمیشنِ نرم.
const authStore = {
  get: () => { try { return JSON.parse(localStorage.getItem('bn_auth') || 'null'); } catch (e) { return null; } },
  set: (v) => localStorage.setItem('bn_auth', JSON.stringify(v)),
  clear: () => localStorage.removeItem('bn_auth'),
};
const tierLabel = { free: 'رایگان', vip: 'VIP', premium: 'پرمیوم' };

// پالتِ رنگ بر اساسِ تم
function palette(dark) {
  return dark
    ? { panel: '#0f1117', card: '#161923', border: 'rgba(255,255,255,.10)', text: '#e4e6ed', sub: 'rgba(255,255,255,.6)', field: '#0f1117', fieldBorder: '#2a2e3d', soft: 'rgba(255,255,255,.05)', softHover: 'rgba(255,255,255,.1)' }
    : { panel: '#ffffff', card: '#ffffff', border: 'rgba(15,23,42,.10)', text: '#0f172a', sub: 'rgba(15,23,42,.55)', field: '#f8fafc', fieldBorder: '#e2e8f0', soft: 'rgba(15,23,42,.04)', softHover: 'rgba(15,23,42,.08)' };
}

// ── کلیدها/قراردادها (خارج از کامپوننت تا ثابت بمانند) ──
const SUPPORT_URL = 'https://t.me/CoinProFXBot';   // پشتیبانِ CoinePro FX (#13)

export default function AuthMenu({ theme = 'dark', panelUrl, onToggleTheme }) {
  // ── همهٔ stateها/refها قبل از هر افکت/کال‌بکی که استفاده‌شان می‌کند (جلوگیری از TDZ) ──
  const [open, setOpen] = React.useState(false);
  const [shown, setShown] = React.useState(false);      // برای انیمیشنِ نرم (mount→slide)
  const [view, setView] = React.useState(null);
  const [auth, setAuth] = React.useState(authStore.get());
  // تمِ محلیِ خوش‌بینانه: با propِ والد سینک می‌شود ولی اجازه می‌دهد سوییچ فوری بازتاب یابد
  const [localTheme, setLocalTheme] = React.useState(theme);
  React.useEffect(() => { setLocalTheme(theme); }, [theme]);

  const dark = localTheme !== 'light';
  const P = palette(dark);

  // اجازهٔ override به والد برای آدرسِ پنل (backward-compatible؛ propِ اختیاری)
  const goPanel = React.useCallback((path = '') => {
    const base = panelUrl || PANEL_URL;
    try { window.open(base + path, '_blank', 'noopener'); } catch (e) { /* noop */ }
  }, [panelUrl]);

  // #۳ سوییچِ تمِ روز/شب — اعمالِ فوری: بازتابِ محلی + callbackِ والد (در صورت وجود) + رویدادِ سراسری
  const toggleTheme = React.useCallback(() => {
    setLocalTheme((t) => (t === 'light' ? 'dark' : 'light'));
    try { if (typeof onToggleTheme === 'function') onToggleTheme(); } catch (e) { /* noop */ }
    fire('bn:toggleTheme');
  }, [onToggleTheme]);

  React.useEffect(() => {
    if (open) { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }
    setShown(false);
  }, [open]);
  React.useEffect(() => {
    if (open && auth) api.me().then((m) => { if (m?.tier) { const a = { ...auth, tier: m.tier }; authStore.set(a); setAuth(a); } }).catch(() => {});
  }, [open]); // eslint-disable-line

  const close = () => { setShown(false); setView(null); setTimeout(() => setOpen(false), 220); };

  const onAuthed = (username, tier) => { const a = { username, tier: tier || 'free' }; authStore.set(a); setAuth(a); setView(null); close(); setTimeout(() => location.reload(), 250); };
  const logout = () => { authStore.clear(); tokenStore.clear(); location.reload(); };

  // شورت‌کاتِ فیچرها: رویداد به والد + بستنِ منو
  const feature = (name, detail) => { fire(name, detail); close(); };

  const tier = auth?.tier || 'free';
  const isPremium = tier === 'premium' || tier === 'vip';

  return (
    <>
      <button onClick={() => setOpen(true)} title="حساب / ورود / ثبت‌نام"
              className="p-1.5 rounded-md transition-colors duration-[120ms]"
              style={{ background: P.soft, color: P.text }}
              onMouseEnter={(e) => (e.currentTarget.style.background = P.softHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = P.soft)}>
        <Menu size={16} />
      </button>

      {open && (
        <div dir="rtl" className="fixed inset-0 z-[150]" onClick={close}>
          {/* backdrop با fade نرم */}
          <div className="absolute inset-0 transition-opacity duration-200"
               style={{ background: 'rgba(2,6,23,.55)', backdropFilter: shown ? 'blur(2px)' : 'blur(0)', opacity: shown ? 1 : 0 }} />
          {/* پنل با slide نرم */}
          <div className="absolute right-0 top-0 bottom-0 w-[22rem] max-w-[92vw] flex flex-col shadow-2xl transition-transform duration-200 ease-out"
               style={{ background: P.panel, color: P.text, borderLeft: `1px solid ${P.border}`,
                        transform: shown ? 'translateX(0)' : 'translateX(100%)' }}
               onClick={(e) => e.stopPropagation()}>

            {/* ── هدر ── */}
            <div className="flex items-center justify-between px-4 h-14 shrink-0"
                 style={{ borderBottom: `1px solid ${P.border}` }}>
              <div className="flex items-center gap-2 font-extrabold tracking-tight">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                  <LineChart size={16} />
                </span>
                Pro<span className="text-indigo-400">·</span>Chart
              </div>
              <div className="flex items-center gap-1">
                {/* #۳ سوییچِ تمِ روز/شب داخلِ منو */}
                <button onClick={toggleTheme} title={dark ? 'تمِ روشن' : 'تمِ تاریک'}
                        className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: P.soft, color: P.text }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = P.softHover)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = P.soft)}>
                  {dark ? <Sun size={17} /> : <Moon size={17} />}
                </button>
                <button onClick={close} title="بستن"
                        className="w-9 h-9 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                        style={{ color: P.text }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1">
              {/* کارتِ کاربر */}
              <div className="rounded-2xl p-3.5 mb-4 flex items-center gap-3 relative overflow-hidden"
                   style={{ background: P.soft, border: `1px solid ${P.border}` }}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                     style={{ background: isPremium ? 'linear-gradient(135deg,#f59e0b,#6366f1)' : 'rgba(99,102,241,.18)' }}>
                  {auth ? <Crown size={19} className="text-white" /> : <User size={19} style={{ color: P.sub }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate flex items-center gap-1.5">
                    {auth ? auth.username : 'کاربرِ مهمان'}
                    {isPremium && <BadgeCheck size={15} className="text-amber-400 shrink-0" />}
                  </div>
                  <div className="text-[12px] flex items-center gap-1.5" style={{ color: P.sub }}>
                    {auth ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold"
                            style={{ background: isPremium ? 'rgba(245,158,11,.16)' : P.softHover, color: isPremium ? '#f59e0b' : P.sub }}>
                        {tierLabel[tier] || tier}
                      </span>
                    ) : 'هنوز وارد نشده‌اید'}
                  </div>
                </div>
              </div>

              {!view ? (
                <>
                  {/* جایگاهِ تبلیغِ بالا (مدیریت‌پذیر از ادمین) */}
                  <AdSlot P={P} slot="menu_top" tier={tier} />

                  {/* بخشِ حساب */}
                  <Section P={P} title="حساب">
                    {!auth ? (<>
                      <MenuBtn P={P} icon={<LogIn size={16} />} label="ورود به حساب" onClick={() => setView('login')} accent />
                      <MenuBtn P={P} icon={<UserPlus size={16} />} label="ثبت‌نام در پنلِ کاربری" external onClick={() => goPanel('/register?from=chart')} />
                    </>) : (
                      <MenuBtn P={P} icon={<LogOut size={16} />} label="خروج از حساب" onClick={logout} danger />
                    )}
                    <MenuBtn P={P} icon={<User size={16} />} label="پنلِ کاربری (حساب · اشتراک · بروکر)" external onClick={() => goPanel('/?from=chart')} />
                  </Section>

                  {/* #۶ اشتراکِ پریمیوم — کارتِ بازاریابیِ حرفه‌ای (بدونِ آدرسِ کانترکتِ خام) */}
                  <Section P={P} title="اشتراکِ پریمیوم">
                    <PremiumPitch P={P} isPremium={isPremium} onBuy={() => goPanel('/subscribe?from=chart')} />
                  </Section>

                  {/* امکاناتِ بازارنما (شورت‌کاتِ فیچرها) */}
                  <Section P={P} title="امکاناتِ بازارنما">
                    <div className="grid grid-cols-3 gap-2">
                      <FeatureChip P={P} icon={<List size={18} />}        label="واچ‌لیست"  onClick={() => feature('bn:rightTab', 'watch')} />
                      <FeatureChip P={P} icon={<Bell size={18} />}        label="آلارم‌ها"  onClick={() => feature('bn:rightTab', 'alerts')} />
                      <FeatureChip P={P} icon={<Search size={18} />}      label="اسکرینر"   onClick={() => feature('bn:rightTab', 'screener')} />
                      <FeatureChip P={P} icon={<CalendarDays size={18} />} label="تقویم"     onClick={() => feature('bn:rightTab', 'calendar')} />
                      <FeatureChip P={P} icon={<Code2 size={18} />}       label="نمااسکریپت" onClick={() => feature('bn:openScript')} />
                      <FeatureChip P={P} icon={<HelpCircle size={18} />}  label="راهنما"    onClick={() => feature('bn:help')} />
                    </div>
                  </Section>

                  {/* جایگاهِ تبلیغِ پایین (مدیریت‌پذیر از ادمین) */}
                  <AdSlot P={P} slot="menu_inline" tier={tier} compact />

                  {/* پشتیبانی و اطلاعات — #۱۳ پشتیبانِ CoinePro FX · #۱۴ بدونِ کانالِ تلگرام */}
                  <Section P={P} title="پشتیبانی و اطلاعات">
                    <MenuBtn P={P} icon={<LifeBuoy size={16} />}  label="پشتیبانِ CoinePro FX" external onClick={() => feature('bn:support', SUPPORT_URL)} />
                    <MenuBtn P={P} icon={<FileText size={16} />}  label="قوانین و حریمِ خصوصی" external onClick={() => feature('bn:terms')} />
                  </Section>

                  <div className="text-center text-[11px] pt-1" style={{ color: P.sub }}>نسخه ۱.۰ · بازارنما · CoinePro FX</div>
                </>
              ) : (
                <button onClick={() => setView(null)} className="mb-3 flex items-center gap-1 text-[12px] opacity-70 hover:opacity-100">
                  <ChevronLeft size={14} /> بازگشت به منو
                </button>
              )}

              {view === 'login' && <LoginForm P={P} onBack={() => setView(null)} onAuthed={onAuthed} onPanel={() => goPanel('/?from=chart')} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// سرگروهِ بخش‌ها — عنوانِ کوچک + فاصله‌گذاریِ یکنواخت
function Section({ P, title, children }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold mb-2 px-1 uppercase tracking-wide" style={{ color: P.sub }}>{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MenuBtn({ P, icon, label, onClick, accent, danger, external }) {
  const style = accent ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff' }
    : danger ? { background: 'rgba(239,68,68,.18)', color: '#f87171' }
    : { background: P.soft, color: P.text };
  return (
    <button onClick={onClick} style={style}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-transform duration-100 hover:scale-[1.01] active:scale-[.99]">
      {icon}<span className="flex-1 text-right">{label}</span>
      {external && <ArrowUpRight size={14} className="opacity-70 shrink-0" />}
    </button>
  );
}

// چیپِ فیچر — شبکهٔ سه‌تایی (سبکِ right-rail)
function FeatureChip({ P, icon, label, onClick }) {
  return (
    <button onClick={onClick}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-[11px] font-medium transition-transform duration-100 hover:scale-[1.03] active:scale-[.97]"
            style={{ background: P.soft, color: P.text }}
            onMouseEnter={(e) => (e.currentTarget.style.background = P.softHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = P.soft)}>
      <span className="text-indigo-400">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function fieldStyle(P) { return { background: P.field, border: `1px solid ${P.fieldBorder}`, color: P.text }; }
const inpCls = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition';

// ── #۶ کارتِ بازاریابیِ اشتراکِ پریمیوم — مزایا + قیمت‌گذاری + CTA + اجتماعی‌اثبات ──
// قیمت: ماهانه ۲۵ تتر / سالانه ۲۰۰ تتر (#۸). آدرسِ کانترکتِ خام نمایش داده نمی‌شود؛ پرداخت داخلِ پنل.
function PremiumPitch({ P, isPremium, onBuy }) {
  const [pr, setPr] = React.useState(null);
  React.useEffect(() => { api.pricing().then(setPr).catch(() => {}); }, []);
  const [plan, setPlan] = React.useState('yearly'); // پیش‌فرض روی صرفه‌جوترین پلن

  // قیمت‌ها از API (در صورتِ وجود) وگرنه پیش‌فرضِ مصوب: ۲۵ ماهانه / ۲۰۰ سالانه
  const monthly = pr?.monthly_usdt ?? pr?.premium_monthly ?? 25;
  const yearly = pr?.yearly_usdt ?? pr?.premium_yearly ?? 200;
  const yearlyPerMonth = Math.round((yearly / 12) * 10) / 10;            // ~۱۶٫۷ تتر در ماه
  const savePct = monthly > 0 ? Math.round((1 - (yearly / (monthly * 12))) * 100) : 0; // ~۳۳٪

  const PERKS = [
    { icon: <Sparkles size={15} />,  t: 'هوشِ مصنوعیِ بازار',  d: 'سیگنالِ زندهٔ هوشمند روی هر نماد و تایم‌فریم' },
    { icon: <Code2 size={15} />,     t: 'نمااسکریپت',          d: 'نوشتنِ اندیکاتور و استراتژیِ اختصاصی' },
    { icon: <LineChart size={15} />, t: 'تریدِ روی چارت',      d: 'اجرای سفارش مستقیم از روی نمودار' },
    { icon: <Zap size={15} />,       t: 'دادهٔ بلادرنگ',        d: 'قیمت و آلارمِ آنی بدونِ تأخیر' },
  ];

  if (isPremium) {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-3"
           style={{ background: 'linear-gradient(135deg,rgba(245,158,11,.14),rgba(99,102,241,.14))', border: `1px solid ${P.border}` }}>
        <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#6366f1)' }}><Crown size={18} /></span>
        <div className="min-w-0">
          <div className="font-bold text-sm">اشتراکِ پریمیوم فعال است</div>
          <div className="text-[12px]" style={{ color: P.sub }}>به تمامِ امکاناتِ ویژه دسترسی دارید. سپاس از همراهی‌تان.</div>
        </div>
      </div>
    );
  }

  const sel = (k) => setPlan(k);
  const active = (k) => plan === k;

  return (
    <div className="rounded-2xl p-4 space-y-3.5"
         style={{ background: 'linear-gradient(160deg,rgba(99,102,241,.10),rgba(139,92,246,.06))', border: `1px solid ${P.border}` }}>

      {/* سرتیتر بازاریابی */}
      <div className="flex items-start gap-2.5">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#6366f1)' }}><Crown size={17} /></span>
        <div className="min-w-0">
          <div className="font-extrabold text-[15px] leading-5">به سطحِ حرفه‌ای ارتقا دهید</div>
          <div className="text-[12px] leading-5" style={{ color: P.sub }}>هرچه برای تحلیل و معاملهٔ هوشمند لازم دارید، یک‌جا.</div>
        </div>
      </div>

      {/* مزایا با تیکِ سبز */}
      <div className="space-y-2">
        {PERKS.map((k) => (
          <div key={k.t} className="flex items-start gap-2.5">
            <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(34,197,94,.16)', color: '#22c55e' }}><Check size={13} strokeWidth={3} /></span>
            <div className="min-w-0">
              <div className="font-bold text-[13px] leading-4">{k.t}</div>
              <div className="text-[11px] leading-4 mt-0.5" style={{ color: P.sub }}>{k.d}</div>
            </div>
          </div>
        ))}
      </div>

      {/* انتخابِ پلن: ماهانه / سالانه (با نشانِ صرفه‌جویی) */}
      <div className="grid grid-cols-2 gap-2">
        <PlanCard P={P} active={active('monthly')} onClick={() => sel('monthly')}
                  label="ماهانه" price={monthly} per="در ماه" />
        <PlanCard P={P} active={active('yearly')} onClick={() => sel('yearly')}
                  label="سالانه" price={yearly} per="در سال"
                  badge={savePct > 0 ? `${savePct}٪ صرفه‌جویی` : null}
                  hint={`معادلِ ~${yearlyPerMonth} تتر در ماه`} />
      </div>

      {/* CTA اصلی — #۶ دکمهٔ «خریدِ پریمیوم» */}
      <button onClick={onBuy}
              className="w-full py-3 rounded-xl text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-[1.015] active:scale-[.985]"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#6366f1)', boxShadow: '0 8px 24px -8px rgba(99,102,241,.6)' }}>
        <Crown size={16} /> خریدِ پریمیوم
      </button>

      {/* اعتمادسازی + اجتماعی‌اثبات */}
      <div className="flex items-center justify-center gap-3 text-[11px]" style={{ color: P.sub }}>
        <span className="inline-flex items-center gap-1"><ShieldCheck size={13} /> پرداختِ امن</span>
        <span className="opacity-40">·</span>
        <span className="inline-flex items-center gap-1">
          <span className="flex text-amber-400">{[0,1,2,3,4].map((i) => <Star key={i} size={11} fill="currentColor" />)}</span>
        </span>
        <span className="opacity-40">·</span>
        <span className="inline-flex items-center gap-1"><Users size={13} /> هزاران معامله‌گر</span>
      </div>

      <p className="text-[10.5px] text-center leading-4" style={{ color: P.sub }}>
        پرداخت با تتر داخلِ پنلِ کاربری انجام می‌شود؛ پس از تأیید، قفلِ امکانات بلافاصله باز می‌شود.
      </p>
    </div>
  );
}

// کارتِ انتخابِ پلن (ماهانه/سالانه)
function PlanCard({ P, active, onClick, label, price, per, badge, hint }) {
  return (
    <button onClick={onClick}
            className="relative text-right rounded-xl p-2.5 transition-transform hover:scale-[1.02] active:scale-[.98]"
            style={{
              background: active ? 'rgba(99,102,241,.16)' : P.soft,
              border: `1.5px solid ${active ? '#6366f1' : P.border}`,
              color: P.text,
            }}>
      {badge && (
        <span className="absolute -top-2 left-2 text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-full text-white"
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>{badge}</span>
      )}
      <div className="text-[11px] font-bold" style={{ color: P.sub }}>{label}</div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="text-[18px] font-extrabold leading-none">{price}</span>
        <span className="text-[11px] font-bold opacity-80">تتر</span>
      </div>
      <div className="text-[10px] mt-0.5" style={{ color: P.sub }}>{hint || per}</div>
      <span className="absolute top-2 left-2">
        {active
          ? <span className="w-4 h-4 rounded-full flex items-center justify-center text-white" style={{ background: '#6366f1' }}><Check size={11} strokeWidth={3} /></span>
          : <span className="w-4 h-4 rounded-full block" style={{ border: `1.5px solid ${P.border}` }} />}
      </span>
    </button>
  );
}

// ── جایگاهِ تبلیغاتیِ مدیریت‌پذیر از ادمین ──
// داده از API می‌آید (api.bnAds یا fallbackِ مستقیم به /academy/bn/ads). نبودِ تبلیغ ⇒ هیچ فضای خالی.
async function fetchAds(slot) {
  // ۱) اگر متدِ اختصاصیِ client اضافه شده باشد، از آن استفاده کن (forward-compatible)
  if (typeof api.bnAds === 'function') {
    try { const r = await api.bnAds(slot); return (r && r.ads) || []; } catch (e) { return null; }
  }
  // ۲) fallback مستقیم به اندپوینتِ عمومی با همان baseURL و توکنِ آکادمی (اگر بود)
  try {
    const base = (import.meta.env && import.meta.env.VITE_API_URL) || '/api';
    const headers = {};
    try { const t = tokenStore.get(); if (t) headers.Authorization = `Bearer ${t}`; } catch (e) { /* noop */ }
    const res = await fetch(`${base}/academy/bn/ads?slot=${encodeURIComponent(slot)}`, { headers });
    if (!res.ok) return null;
    const j = await res.json();
    return (j && j.ads) || [];
  } catch (e) { return null; }
}
function adClick(ad) {
  try {
    if (typeof api.bnAdClick === 'function') { api.bnAdClick(ad.id); }
    else {
      const base = (import.meta.env && import.meta.env.VITE_API_URL) || '/api';
      fetch(`${base}/academy/bn/ads/${ad.id}/click`, { method: 'POST' }).catch(() => {});
    }
  } catch (e) { /* noop */ }
  try { window.open(ad.cta_url, '_blank', 'noopener'); } catch (e) { /* noop */ }
}

function AdSlot({ P, slot, tier, compact }) {
  const [ad, setAd] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    fetchAds(slot).then((ads) => {
      if (!alive) return;
      const pick = pickAd(ads, tier);
      setAd(pick);
    });
    return () => { alive = false; };
  }, [slot, tier]);

  if (!ad) return null;  // نبودِ تبلیغ ⇒ فضای خالی اشغال نمی‌شود
  const logo = ad.logo_url || ad.logo_path;
  const onLight = !!ad.bg_color; // اگر رنگِ سفارشی داشت، متن/CTA روی پس‌زمینهٔ پررنگ
  return (
    <div className="mb-4">
      <button onClick={() => adClick(ad)}
              className={`w-full text-right rounded-xl flex items-center gap-3 transition-transform hover:scale-[1.01] active:scale-[.99] ${compact ? 'p-2.5' : 'p-3'}`}
              style={{ background: ad.bg_color || P.soft, border: `1px solid ${P.border}`, color: onLight ? '#fff' : P.text }}>
        {logo && <img src={logo} alt="" loading="lazy" className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg object-contain shrink-0 bg-white/90 p-0.5`} />}
        <div className="min-w-0 flex-1">
          <div className={`font-bold ${compact ? 'text-[13px]' : 'text-sm'} truncate`}>{ad.title}</div>
          {ad.body && !compact && <div className="text-[11px] leading-5 opacity-80 line-clamp-2">{ad.body}</div>}
        </div>
        {ad.cta_label && (
          <span className="shrink-0 text-[11px] px-2 py-1 rounded-lg flex items-center gap-1"
                style={{ background: onLight ? 'rgba(255,255,255,.18)' : P.softHover }}>
            {ad.cta_label}<ArrowUpRight size={12} />
          </span>
        )}
      </button>
    </div>
  );
}

// انتخابِ تبلیغ از فهرست: تیرِ هدف + اولویت (سرور هم همین را اعمال می‌کند؛ این لایهٔ دفاعیِ کلاینت است)
function pickAd(ads, tier) {
  if (!Array.isArray(ads) || ads.length === 0) return null;
  const t = tier || 'free';
  const eligible = ads.filter((a) => {
    if (a.active === false) return false;
    const tt = a.target_tier || 'all';
    return tt === 'all' || tt === t;
  });
  const pool = eligible.length ? eligible : ads;
  pool.sort((a, b) => (b.priority || 0) - (a.priority || 0) || (b.id || 0) - (a.id || 0));
  return pool[0] || null;
}

function LoginForm({ P, onBack, onAuthed, onPanel }) {
  const [u, setU] = React.useState(''); const [p, setP] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState('');
  const submit = async () => {
    setErr(''); setBusy(true);
    try { const r = await api.login(u.trim(), p); if (r?.token) { tokenStore.set(r.token); onAuthed(r.username || u.trim(), r.tier); } }
    catch (e) { setErr(e?.message || 'ایمیل/نام‌کاربری یا رمز اشتباه است.'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <h4 className="font-bold">ورود به حساب</h4>
      <input className={inpCls} style={fieldStyle(P)} placeholder="ایمیل یا نام‌کاربری" value={u} onChange={(e) => setU(e.target.value)} dir="ltr" />
      <PasswordField P={P} value={p} onChange={(e) => setP(e.target.value)} placeholder="رمزِ عبور" />
      {err && <div className="text-[12px] text-red-400">{err}</div>}
      <button onClick={submit} disabled={busy || !u || !p} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} ورود</button>
      {onPanel && (
        <button onClick={onPanel} className="w-full text-[12px] flex items-center justify-center gap-1 opacity-70 hover:opacity-100" style={{ color: P.sub }}>
          ورود/مدیریت در پنلِ کاربری <ArrowUpRight size={12} />
        </button>
      )}
      <button onClick={onBack} className="w-full text-[12px] opacity-60 hover:opacity-100">بازگشت</button>
    </div>
  );
}
