import { useState } from 'react';
import { Calculator, TrendingDown } from 'lucide-react';

export default function RiskSimulator({ defaultRisk = 1 }) {
  const [deposit, setDeposit] = useState(500);
  const [risk, setRisk] = useState(defaultRisk);
  const [losses, setLosses] = useState(5);

  const perTrade = deposit * (risk / 100);
  // افتِ سرمایه پس از n باختِ متوالی (ریسکِ ثابتِ درصدی روی موجودیِ کاهنده)
  let bal = deposit;
  for (let i = 0; i < losses; i++) bal -= bal * (risk / 100);
  const ddPct = deposit > 0 ? ((deposit - bal) / deposit) * 100 : 0;
  const ddAmt = deposit - bal;

  const tone = ddPct < 10 ? 'text-brand-green' : ddPct < 25 ? 'text-brand-amber' : 'text-brand-red';

  const num = (v) => Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Calculator size={18} className="text-brand-blue" />
        <h3 className="font-bold text-text-primary">شبیه‌سازِ ریسک</h3>
      </div>
      <p className="text-xs text-text-muted mb-4">ببین با سرمایه و ریسکِ انتخابی، در بدترین سناریو چقدر در خطری.</p>

      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <div>
          <label className="label">سرمایه ($)</label>
          <input type="number" min="50" step="50" className="input" value={deposit}
            onChange={(e) => setDeposit(Math.max(0, Number(e.target.value)))} />
        </div>
        <div>
          <label className="label">ریسک در هر معامله: <b className="text-brand-blue">{risk}٪</b></label>
          <input type="range" min="0.5" max="5" step="0.5" value={risk}
            onChange={(e) => setRisk(Number(e.target.value))} className="w-full accent-brand-blue mt-3" />
        </div>
        <div>
          <label className="label">باختِ متوالی: <b className="text-brand-amber">{losses}</b></label>
          <input type="range" min="1" max="15" step="1" value={losses}
            onChange={(e) => setLosses(Number(e.target.value))} className="w-full accent-brand-amber mt-3" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-elevated rounded-xl p-3 text-center">
          <div className="text-xs text-text-muted mb-1">ریسکِ هر معامله</div>
          <div className="text-lg font-black text-text-primary">{num(perTrade)} $</div>
        </div>
        <div className="bg-surface-elevated rounded-xl p-3 text-center">
          <div className="text-xs text-text-muted mb-1">افت پس از {losses} باخت</div>
          <div className={`text-lg font-black ${tone}`}>{num(ddAmt)} $</div>
        </div>
        <div className="bg-surface-elevated rounded-xl p-3 text-center">
          <div className="text-xs text-text-muted mb-1 flex items-center justify-center gap-1"><TrendingDown size={12} /> درصدِ افت</div>
          <div className={`text-lg font-black ${tone}`}>{num(ddPct)}٪</div>
        </div>
      </div>
      <p className="text-[11px] text-text-muted mt-3">
        این برآورد آموزشی است. توصیه: ریسکِ هر معامله را زیرِ ۲٪ نگه دار تا یک رشتهٔ باخت، حساب را از پا درنیاورد.
      </p>
    </div>
  );
}
