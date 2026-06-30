import { useQuery } from '@tanstack/react-query';
import { Download, Printer, TrendingUp, Target, BarChart3, Award } from 'lucide-react';
import { userAPI } from '../api/client';
import { Stat, Spinner, money } from '../components/ui';
import Guide from '../components/Guide';
import PnlHistory from '../components/PnlHistory';

function toCSV(rows) {
  const head = ['نماد', 'جهت', 'حجم', 'سود/زیان', 'نتیجه', 'زمان'];
  const lines = [head.join(',')];
  rows.forEach((r) => {
    lines.push([
      r.symbol || '', r.direction || '', r.lots ?? '', r.profit ?? '',
      r.result || r.close_reason || '', r.closed_at || r.ts || '',
    ].join(','));
  });
  return '﻿' + lines.join('\n'); // BOM برای اکسلِ فارسی
}

function download(name, content, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function HistoryPage() {
  const { data: perf } = useQuery({ queryKey: ['perfSummary'], queryFn: () => userAPI.perfSummary() });
  const { data: hist, isLoading } = useQuery({ queryKey: ['history'], queryFn: () => userAPI.history() });

  if (isLoading) return <Spinner />;
  const o = perf?.overall || {};
  const copied = hist?.copied || [];

  const winRate = o.win_rate != null ? `${Number(o.win_rate).toLocaleString('fa-IR')}٪` : '—';
  const total = o.total_signals != null ? Number(o.total_signals).toLocaleString('fa-IR') : '—';
  const pips = o.total_pips != null ? `${Number(o.total_pips).toLocaleString('fa-IR')}` : '—';
  const pf = o.profit_factor != null ? Number(o.profit_factor).toLocaleString('fa-IR') : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-text-primary">تاریخچه و کارنامه</h1>
          <p className="text-text-secondary text-sm">عملکردِ واقعیِ راهبرد و معاملاتِ کپی‌شدهٔ شما</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => download(`coinepro-history-${Date.now()}.csv`, toCSV(copied))}
            disabled={copied.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border border-surface-border text-text-secondary hover:text-brand-blue hover:border-brand-blue disabled:opacity-40 transition">
            <Download size={16} /> CSV
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border border-surface-border text-text-secondary hover:text-brand-blue hover:border-brand-blue transition">
            <Printer size={16} /> چاپ / PDF
          </button>
        </div>
      </div>

      {/* سود/زیانِ واقعیِ حسابِ کاربر (دیلِ MT5) */}
      <PnlHistory />

      {/* کارنامهٔ راهبرد — دادهٔ واقعی */}
      <div>
        <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2"><Award size={18} className="text-brand-green" /> کارنامهٔ راهبردِ ما</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="نرخِ موفقیت" value={winRate} tone="text-brand-green" />
          <Stat label="کلِ معاملات" value={total} tone="text-text-primary" />
          <Stat label="مجموعِ پیپ" value={pips} tone="text-brand-blue" />
          <Stat label="فاکتورِ سود" value={pf} tone="text-brand-amber" />
        </div>
        {perf?.this_month && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <Stat label="معاملاتِ این ماه" value={Number(perf.this_month.total_signals || 0).toLocaleString('fa-IR')} />
            <Stat label="موفقیتِ این ماه" value={perf.this_month.win_rate != null ? `${Number(perf.this_month.win_rate).toLocaleString('fa-IR')}٪` : '—'} tone="text-brand-green" />
            <Stat label="معاملاتِ فعالِ اکنون" value={Number(perf.active_signals || 0).toLocaleString('fa-IR')} tone="text-brand-amber" />
            <Stat label="موفقیتِ این هفته" value={perf.this_week?.win_rate != null ? `${Number(perf.this_week.win_rate).toLocaleString('fa-IR')}٪` : '—'} tone="text-brand-green" />
          </div>
        )}
      </div>

      {/* معاملاتِ کپی‌شدهٔ کاربر */}
      <div className="card p-5">
        <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-brand-blue" /> معاملاتِ کپی‌شدهٔ من</h3>
        {copied.length === 0 ? (
          <div className="text-center py-10">
            <Target size={32} className="mx-auto text-text-muted mb-3" />
            <p className="text-text-secondary text-sm">هنوز معاملهٔ بسته‌شده‌ای ندارید.</p>
            <p className="text-text-muted text-xs mt-1">پس از فعال‌سازیِ کپی‌ترید و بسته‌شدنِ معاملات، تاریخچهٔ کاملِ شما اینجا با امکانِ خروجی نمایش داده می‌شود.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs border-b border-surface-border">
                  <th className="text-right py-2 font-medium">نماد</th>
                  <th className="text-right py-2 font-medium">جهت</th>
                  <th className="text-right py-2 font-medium">حجم</th>
                  <th className="text-right py-2 font-medium">سود/زیان</th>
                  <th className="text-right py-2 font-medium">نتیجه</th>
                </tr>
              </thead>
              <tbody>
                {copied.map((r, i) => {
                  const up = Number(r.profit) >= 0;
                  return (
                    <tr key={i} className="border-b border-surface-border/40">
                      <td className="py-2.5 font-bold text-text-primary">{r.symbol}</td>
                      <td className="py-2.5 text-text-secondary">{(r.direction || '').toUpperCase().includes('BUY') ? 'خرید' : 'فروش'}</td>
                      <td className="py-2.5 text-text-secondary">{r.lots}</td>
                      <td className={`py-2.5 font-mono font-bold ${up ? 'text-brand-green' : 'text-brand-red'}`}>{up ? '+' : ''}{money(r.profit)}</td>
                      <td className="py-2.5 text-text-muted text-xs">{r.result || r.close_reason || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Guide title="این اعداد از کجا می‌آیند؟">
        «کارنامهٔ راهبرد» عملکردِ واقعیِ سیستمِ سیگنال‌دهیِ ماست که از معاملاتِ بسته‌شدهٔ واقعی محاسبه می‌شود
        و شفاف در دسترسِ شماست. «معاملاتِ کپی‌شدهٔ من» تاریخچهٔ شخصیِ شماست که پس از فعال‌سازیِ کپی‌ترید پر می‌شود.
        با دکمه‌های بالا می‌توانید خروجیِ CSV (برای اکسل) یا PDF (چاپ) بگیرید.
      </Guide>
    </div>
  );
}
