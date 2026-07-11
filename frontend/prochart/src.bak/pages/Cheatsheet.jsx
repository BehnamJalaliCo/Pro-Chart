import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Printer, ListChecks } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton } from '../components/Guide';

export default function Cheatsheet() {
  const { level } = useParams();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['cheatsheet', level], queryFn: () => api.cheatsheet(level) });

  if (isLoading) return <p className="text-text-secondary text-center py-10">در حال بارگذاری…</p>;
  const points = data?.points || [];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 no-print">
        <button onClick={() => nav('/')} className="text-text-muted text-sm flex items-center gap-1 hover:text-text-primary">
          <ArrowRight size={16} /> بازگشت
        </button>
        <div className="flex items-center gap-2">
          <GuideButton guideKey="cheatsheet" auto />
          {points.length > 0 && (
            <button onClick={() => window.print()} className="btn-success flex items-center gap-2">
              <Printer size={18} /> چاپ / دریافتِ PDF
            </button>
          )}
        </div>
      </div>

      <div id="sheet" className="card p-7">
        <div className="flex items-center gap-2 mb-1">
          <ListChecks className="text-brand-green" />
          <h1 className="text-xl font-black">چیت‌شیتِ سطحِ {data?.title || level}</h1>
        </div>
        <p className="text-xs text-text-muted mb-5">جانِ کلامِ این سطح برای مرورِ سریع — آکادمیِ کوین‌پرو FX</p>

        {points.length === 0 ? (
          <p className="text-text-muted text-sm py-4">چیت‌شیت به‌زودی آماده می‌شود.</p>
        ) : (
          <ul className="space-y-2.5">
            {points.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary leading-7">
                <span className="text-brand-green font-black shrink-0">{i + 1}.</span> {p}
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`@media print {
        .no-print{display:none!important}
        body *{visibility:hidden}
        #sheet,#sheet *{visibility:visible}
        #sheet{position:absolute;inset:0;color:#000;background:#fff}
      }`}</style>
    </div>
  );
}
