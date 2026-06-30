import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Target, CheckCircle2, XCircle, Trophy, Wallet, ExternalLink, Printer, Award, Medal } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton, InfoTip } from '../components/Guide';

const TIERS = [
  { id: 'bronze', label: 'برنز', Icon: Medal, ring: 'border-amber-700/60', text: 'text-amber-600', bg: 'bg-amber-700/15', bar: 'bg-amber-700' },
  { id: 'silver', label: 'نقره', Icon: Award, ring: 'border-slate-300/60', text: 'text-slate-300', bg: 'bg-slate-400/15', bar: 'bg-slate-300' },
  { id: 'gold', label: 'طلا', Icon: Trophy, ring: 'border-amber-400/60', text: 'text-amber-400', bg: 'bg-amber-400/15', bar: 'bg-amber-400' },
];
const tierMeta = (id) => TIERS.find((t) => t.id === id) || TIERS[0];

function Rule({ r, barClass }) {
  const pct = r.invert
    ? Math.max(0, Math.min(100, 100 * (1 - r.current / (r.target || 1))))
    : Math.max(0, Math.min(100, 100 * r.current / (r.target || 1)));
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-bold flex items-center gap-1.5">{r.passed ? <CheckCircle2 size={15} className="text-brand-green" /> : <XCircle size={15} className="text-text-muted" />} {r.name}</span>
        <span className={r.passed ? 'text-brand-green' : 'text-text-secondary'}>{r.current}{r.unit} / {r.invert ? '≤' : '≥'} {r.target}{r.unit}</span>
      </div>
      <div className="w-full h-2 bg-surface-border rounded-full overflow-hidden"><div className={`h-full rounded-full ${r.passed ? 'bg-brand-green' : barClass}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function Funded() {
  const [tier, setTier] = useState('bronze');
  const [cert, setCert] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const meta = tierMeta(tier);
  const { data, isLoading } = useQuery({ queryKey: ['funded', tier], queryFn: () => api.fundedStatus(tier), refetchInterval: 15000 });

  const claim = async () => {
    setClaiming(true);
    try {
      const res = await api.claimFunded(tier);
      setCert(res);
    } catch (e) {
      if (e?.status === 400) alert(e?.message || 'هنوز این سطح را پاس نکرده‌ای.');
      else alert(e?.message || 'خطا');
    } finally { setClaiming(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="flex items-center gap-2"><Target className="text-brand-green" /><h1 className="text-lg sm:text-xl font-black">چالشِ فاندد</h1></div>
        <GuideButton guideKey="funded" auto />
      </div>
      <p className="text-xs text-text-muted mb-4 leading-6">
        مثلِ ارزیابیِ پراپ‌فرم‌های واقعی: روی **حسابِ مجازی** این اهداف را بزن تا «آمادهٔ سرمایه» شوی.
      </p>

      {/* سطحِ چالش */}
      <div className="mb-4">
        <div className="text-xs text-text-muted mb-2">سطحِ چالش</div>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((t) => {
            const active = t.id === tier;
            return (
              <button key={t.id} onClick={() => { setTier(t.id); setCert(null); }}
                className={`card p-3 flex flex-col items-center gap-1 transition ${active ? `${t.ring} ${t.bg}` : 'opacity-70 hover:opacity-100'}`}>
                <t.Icon size={22} className={t.text} />
                <span className={`text-sm font-bold ${active ? t.text : 'text-text-secondary'}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading || !data ? (
        <p className="text-text-secondary text-center py-10">در حال بارگذاری…</p>
      ) : (
        <>
          {/* وضعیتِ کلی */}
          <div className={`card p-5 mb-4 text-center ${data.passed ? meta.ring : ''}`}>
            {data.passed ? (
              <>
                <meta.Icon size={44} className={`${meta.text} mx-auto mb-2`} />
                <h2 className="font-black text-lg text-brand-green">آفرین! سطحِ {meta.label} را پاس کردی 🎉</h2>
                <p className="text-text-secondary text-sm mt-1">تو الان «آمادهٔ سرمایه» (Funded-Ready) هستی.</p>

                {cert ? (
                  <div className={`mt-4 card p-3 ${meta.bg} ${meta.ring}`}>
                    <div className="text-sm font-bold mb-1">کدِ گواهی: <span dir="ltr" className={`font-mono ${meta.text}`}>{cert.code}</span></div>
                    {cert.code && (
                      <a href={cert.verify_url || `/api/academy/public/verify/${cert.code}`} target="_blank" rel="noreferrer" className="text-xs text-brand-green inline-flex items-center gap-1 hover:underline">
                        تأییدِ اصالتِ گواهی <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                ) : (
                  <button onClick={claim} disabled={claiming} className="btn-success mt-3 inline-flex items-center gap-2 disabled:opacity-50">
                    <Award size={16} /> {claiming ? 'در حال صدور…' : 'دریافتِ گواهی'}
                  </button>
                )}
                <div className="mt-3"><button onClick={() => window.print()} className="text-xs text-text-muted hover:text-brand-green inline-flex items-center gap-1.5"><Printer size={14} /> چاپِ گواهیِ آمادگی</button></div>
              </>
            ) : (
              <>
                <Wallet size={40} className="text-brand-green mx-auto mb-2" />
                <div className="text-2xl font-black">${data.balance}</div>
                <p className="text-text-secondary text-sm">سود: {data.profit_pct}٪ · افت: {data.max_dd}٪ · {data.trades} معامله</p>
                <Link to="/paper" className="btn-success mt-3 inline-flex items-center gap-2"><Wallet size={16} /> ادامه روی حسابِ مجازی</Link>
              </>
            )}
          </div>

          {/* قوانینِ این سطح */}
          <div className="text-xs text-text-muted mb-2 flex items-center gap-1">قوانینِ این سطح <InfoTip text="برای «آمادهٔ سرمایه» شدن باید همهٔ این قوانین سبز شوند: هدفِ سود را بزن و افتِ سرمایه را زیرِ سقفِ مجاز نگه دار (≥ یعنی حداقل، ≤ یعنی حداکثر)." /></div>
          <div className="space-y-2 mb-5">{(data.rules || []).map((r) => <Rule key={r.name} r={r} barClass={meta.bar} />)}</div>
        </>
      )}

      {/* پلِ سرمایهٔ واقعی */}
      <div className="card p-4">
        <div className="font-bold text-sm mb-2">مرحلهٔ بعد: سرمایهٔ واقعی</div>
        <p className="text-xs text-text-secondary leading-7 mb-3">
          وقتی این چالش را پاس کردی، آمادهٔ شرکت در **چالشِ فاندِ واقعی** هستی. این شرکت‌ها به معامله‌گرانِ موفق **سرمایهٔ واقعی** می‌دهند:
        </p>
        <div className="flex flex-wrap gap-2">
          {[['FTMO', 'https://ftmo.com'], ['The5ers', 'https://www.the5ers.com'], ['MyForexFunds', 'https://myforexfunds.com']].map(([n, u]) => (
            <a key={n} href={u} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-brand-green flex items-center gap-1">{n} <ExternalLink size={11} /></a>
          ))}
        </div>
        <p className="text-[11px] text-text-muted mt-3 leading-6">⚠️ این‌ها شرکت‌های مستقل‌اند؛ آکادمی صرفاً معرفی می‌کند. در آینده آکادمی می‌تواند چالشِ فاندِ اختصاصیِ خود را ارائه دهد.</p>
      </div>

      <style>{`@media print{.no-print{display:none}}`}</style>
    </div>
  );
}
