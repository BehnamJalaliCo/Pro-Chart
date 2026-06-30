import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, ArrowDownRight, HeartPulse } from 'lucide-react';
import { userAPI } from '../api/client';
import { useAuth } from '../store';
import { Stat, StatusLight, Spinner, money } from '../components/ui';
import Guide from '../components/Guide';
import SubscriptionStrip from '../components/SubscriptionStrip';
import PerformanceSection from '../components/PerformanceSection';
import EconomicCalendar from '../components/EconomicCalendar';
import OnboardingChecklist from '../components/OnboardingChecklist';

function MarginHealth({ level }) {
  // سلامتِ حساب بر اساسِ سطحِ مارجین: <100 مارجین‌کال، <200 خطر، <500 احتیاط، بالاتر سالم
  const lv = Number(level);
  const band = lv < 100 ? { c: 'red', t: 'بحرانی — خطرِ مارجین‌کال', pct: 12 }
    : lv < 200 ? { c: 'red', t: 'خطر — مارجین پایین', pct: 30 }
    : lv < 500 ? { c: 'amber', t: 'احتیاط', pct: 60 }
    : { c: 'green', t: 'سالم', pct: 100 };
  const color = { red: 'bg-brand-red', amber: 'bg-brand-amber', green: 'bg-brand-green' }[band.c];
  const text = { red: 'text-brand-red', amber: 'text-brand-amber', green: 'text-brand-green' }[band.c];
  return (
    <div className={`card p-5 ${band.c === 'red' ? 'border-brand-red/40' : band.c === 'amber' ? 'border-brand-amber/40' : 'border-brand-green/30'}`}>
      <div className="flex items-center gap-2 mb-3">
        <HeartPulse size={18} className={text} />
        <h3 className="font-bold text-text-primary">سلامتِ حساب</h3>
        <span className={`ms-auto text-sm font-bold ${text}`}>{band.t}</span>
      </div>
      <div className="h-3 rounded-full bg-surface-elevated overflow-hidden">
        <div className={`h-full ${color} transition-all duration-700 rounded-full`} style={{ width: `${band.pct}%` }} />
      </div>
      <div className="flex justify-between mt-2 text-xs text-text-muted">
        <span>سطحِ مارجین: <b className={text}>{lv.toLocaleString('fa-IR')}٪</b></span>
        {band.c === 'red' && <span className="text-brand-red">ریسک را کاهش دهید یا پوزیشن ببندید</span>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['copyStatus'], queryFn: () => userAPI.copyStatus(), refetchInterval: 7000,
  });

  if (isLoading) return <Spinner />;
  const acc = data?.account;
  const copy = data?.copy;
  const master = data?.master || { open: 0, positions: [] };

  const connected = acc?.status === 'connected';
  const tone = !acc ? 'red' : connected ? 'green' : 'amber';
  const accLabel = !acc ? 'حسابی متصل نیست' : connected ? 'متصل' : (acc.status === 'pending' ? 'در صفِ اتصال' : 'خطا در اتصال');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-text-primary">سلام {profile?.name} 👋</h1>
        <p className="text-text-secondary text-sm">نمای زندهٔ حساب و وضعیتِ کپی‌ترید شما</p>
      </div>

      <OnboardingChecklist />
      <SubscriptionStrip />

      {data?.mode === 'paper' && (
        <div className="card p-4 border-brand-amber/40 bg-brand-amber/8 text-sm text-brand-amber">
          ⚙️ <b>حالتِ آزمایشی:</b> اتصالِ اجرای زندهٔ معاملات روی حساب در حالِ راه‌اندازیِ نهایی است.
          در این حالت معاملات فقط شبیه‌سازی و نمایش داده می‌شوند و سفارشِ واقعی روی حساب ثبت نمی‌شود.
        </div>
      )}

      {/* وضعیتِ اتصال */}
      <div className={`card p-5 flex items-center gap-4 ${tone === 'green' ? 'border-brand-green/40' : tone === 'amber' ? 'border-brand-amber/40' : 'border-brand-red/40'}`}>
        <StatusLight tone={tone} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-text-primary">{accLabel}</div>
          <div className="text-xs text-text-muted">
            {acc ? `${acc.broker} · ${acc.login_masked}` : 'برای شروعِ کپی‌ترید، حساب MT5 خود را متصل کنید.'}
          </div>
          {acc?.last_error && <div className="text-xs text-brand-red mt-1">{acc.last_error}</div>}
        </div>
        {!acc && <Link to="/account" className="btn-primary text-sm shrink-0">اتصالِ حساب</Link>}
      </div>

      {/* سلامتِ حساب — فقط وقتی مارجینِ زنده هست */}
      {acc?.margin_level != null && Number(acc.margin_level) > 0 && (
        <MarginHealth level={acc.margin_level} />
      )}

      {/* کارت‌های حساب — متریک‌های واقعیِ لحظه‌ای */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="موجودی" value={money(acc?.balance, acc?.currency)} tone="text-text-primary" />
        <Stat label="ارزشِ خالص (Equity)" value={money(acc?.equity, acc?.currency)} tone="text-brand-blue" />
        <Stat label="مارجینِ آزاد" value={money(acc?.free_margin, acc?.currency)} tone="text-text-primary" />
        <Stat
          label="سود/زیانِ لحظه‌ای"
          value={acc?.floating_pnl == null ? '—' : `${acc.floating_pnl >= 0 ? '+' : ''}${money(acc.floating_pnl)}`}
          tone={acc?.floating_pnl == null ? 'text-text-muted' : acc.floating_pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}
        />
        <Stat label="مارجینِ استفاده‌شده" value={money(acc?.margin, acc?.currency)} tone="text-text-secondary" />
        <Stat label="سطحِ مارجین" value={acc?.margin_level == null ? '—' : `${Number(acc.margin_level).toLocaleString('fa-IR')}٪`} tone="text-text-secondary" />
        <Stat label="کپی‌ترید" value={copy?.enabled ? 'روشن' : 'خاموش'} tone={copy?.enabled ? 'text-brand-green' : 'text-text-muted'} />
        <Stat label="معاملاتِ بازِ من" value={Number(acc?.open_count || 0).toLocaleString('fa-IR')} tone="text-brand-amber" />
      </div>

      {/* عملکردِ راهبرد — منحنیِ اکوییتی + متریک‌ها */}
      <PerformanceSection />

      {/* معاملاتِ زندهٔ مَستر */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-brand-green" />
          <h3 className="font-bold text-text-primary">معاملاتِ زندهٔ سیستم (مَستر)</h3>
          {master.positions.length > 0 && (() => {
            const tot = master.positions.reduce((s, p) => s + Number(p.profit || 0), 0);
            return <span className={`text-sm font-bold font-mono ${tot >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{tot >= 0 ? '+' : ''}{money(tot)}</span>;
          })()}
          <span className="ms-auto"><StatusLight tone={master.open > 0 ? 'green' : 'amber'} /></span>
        </div>
        {master.positions.length === 0 ? (
          <p className="text-text-muted text-sm py-6 text-center">در حال حاضر معاملهٔ بازی وجود ندارد. به‌محضِ بازشدنِ سیگنال، اینجا و روی حساب شما اجرا می‌شود.</p>
        ) : (
          <div className="space-y-2">
            {master.positions.map((p, i) => {
              const up = p.profit >= 0;
              const buy = (p.direction || '').toUpperCase().includes('BUY') || (p.direction || '').toLowerCase().includes('long');
              return (
                <div key={i} className="flex items-center justify-between bg-surface-elevated rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${buy ? 'bg-brand-green/15 text-brand-green' : 'bg-brand-red/15 text-brand-red'}`}>
                      {buy ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    </span>
                    <div>
                      <div className="font-bold text-text-primary text-sm">{p.symbol}</div>
                      <div className="text-xs text-text-muted">{buy ? 'خرید' : 'فروش'} · {p.lots} لات</div>
                    </div>
                  </div>
                  <span className={`font-mono font-bold text-sm ${up ? 'text-brand-green' : 'text-brand-red'}`}>
                    {up ? '+' : ''}{money(p.profit)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* تقویمِ اقتصادی */}
      <EconomicCalendar />

      <Guide title="این صفحه چه می‌گوید؟" defaultOpen={!acc}>
        اینجا وضعیتِ زندهٔ حساب شما را می‌بینید: آیا حساب MT5 شما به سیستم متصل است (چراغِ سبزِ
        چشمک‌زن یعنی متصل)، موجودی و ارزشِ خالص، و معاملاتی که سیستمِ ما همین حالا باز کرده است.
        وقتی کپی‌ترید را روشن کنید، همین معاملات به‌صورت خودکار روی حسابِ شما هم اجرا می‌شوند.
        برای شروع: ۱) از تبِ «اتصالِ حساب» حسابِ خود را وصل کنید، ۲) از تبِ «کپی‌ترید» آن را روشن کنید.
      </Guide>
    </div>
  );
}
