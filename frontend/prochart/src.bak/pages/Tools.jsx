import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gauge, TrendingUp, TrendingDown, Grid3x3, Calculator, Percent, Scale, Clock } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton, InfoTip } from '../components/Guide';

function fmtPrice(p) {
  if (p == null) return '—';
  const abs = Math.abs(p);
  const d = abs >= 100 ? 2 : abs >= 1 ? 4 : 5;
  return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function corrColor(v) {
  if (v >= 0.6) return 'rgba(52,211,153,.55)';
  if (v >= 0.2) return 'rgba(52,211,153,.22)';
  if (v <= -0.6) return 'rgba(248,113,113,.55)';
  if (v <= -0.2) return 'rgba(248,113,113,.22)';
  return 'rgba(148,163,184,.12)';
}

// ورودیِ عددیِ مشترک (RTL، نمایشِ عدد LTR)
function NumField({ label, value, onChange, placeholder, step }) {
  return (
    <label className="block">
      <span className="text-[11px] text-text-muted mb-1 block">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step || 'any'}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        dir="ltr"
        className="w-full text-sm rounded-lg px-2.5 py-1.5 bg-bg-secondary/60 border border-border focus:border-brand-green outline-none text-text-primary"
      />
    </label>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-[11px] text-text-muted mb-1 block">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        dir="ltr"
        className="w-full text-sm rounded-lg px-2.5 py-1.5 bg-bg-secondary/60 border border-border focus:border-brand-green outline-none text-text-primary uppercase"
      />
    </label>
  );
}

const isNum = (v) => v !== '' && v != null && !Number.isNaN(Number(v));
const fmtN = (v, d = 2) => (v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d }));

// ─── ۱) ماشین‌حسابِ حجمِ معامله ───────────────────────────────
function PositionSizeCard() {
  const [account, setAccount] = useState('1000');
  const [risk, setRisk] = useState('1');
  const [symbol, setSymbol] = useState('EURUSD');
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = isNum(account) && isNum(risk) && isNum(entry) && isNum(sl) && symbol.trim() && Number(entry) !== Number(sl);

  const calc = useCallback(async () => {
    if (!valid) { setRes(null); setErr(''); return; }
    setBusy(true); setErr('');
    try {
      const r = await api.toolPositionSize({ account: Number(account), risk_pct: Number(risk), entry: Number(entry), sl: Number(sl), symbol: symbol.trim() });
      setRes(r);
    } catch (e) { setErr(e?.message || 'خطا در محاسبه'); setRes(null); }
    finally { setBusy(false); }
  }, [account, risk, entry, sl, symbol, valid]);

  const t = useRef();
  useEffect(() => { clearTimeout(t.current); t.current = setTimeout(calc, 450); return () => clearTimeout(t.current); }, [calc]);

  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 font-bold text-sm mb-3"><Calculator size={16} className="text-brand-green" /> ماشین‌حسابِ حجمِ معامله <InfoTip text="موجودی، درصدِ ریسک، ورود و حدِ ضرر را بده تا حجمِ امنِ معامله (لات) را خودکار حساب کند." /></div>
      <div className="grid grid-cols-2 gap-2.5">
        <NumField label="موجودیِ حساب ($)" value={account} onChange={setAccount} placeholder="1000" />
        <NumField label="ریسک (٪)" value={risk} onChange={setRisk} placeholder="1" />
        <TextField label="نماد" value={symbol} onChange={setSymbol} placeholder="EURUSD" />
        <div />
        <NumField label="قیمتِ ورود" value={entry} onChange={setEntry} placeholder="1.0850" />
        <NumField label="حدِ ضرر (SL)" value={sl} onChange={setSl} placeholder="1.0800" />
      </div>
      {err && <p className="text-[11px] text-brand-red mt-2">{err}</p>}
      {res && !err && (
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="rounded-lg bg-brand-green/10 py-2">
            <div className="text-[10px] text-text-muted">حجم (لات)</div>
            <div className="text-base font-black text-brand-green">{fmtN(res.size, 2)}</div>
          </div>
          <div className="rounded-lg bg-bg-secondary/60 py-2">
            <div className="text-[10px] text-text-muted">پیپِ ریسک</div>
            <div className="text-base font-black">{fmtN(res.sl_pips, 1)}</div>
          </div>
          <div className="rounded-lg bg-bg-secondary/60 py-2">
            <div className="text-[10px] text-text-muted">ریسکِ دلاری</div>
            <div className="text-base font-black text-brand-red" dir="ltr">${fmtN(res.risk_usd, 2)}</div>
          </div>
          {res.units != null && <div className="col-span-3 text-[11px] text-text-muted">معادلِ {fmtN(res.units, 0)} واحد</div>}
        </div>
      )}
      {busy && !res && <p className="text-[11px] text-text-muted mt-2">در حالِ محاسبه…</p>}
    </div>
  );
}

// ─── ۲) ماشین‌حسابِ پیپ ───────────────────────────────────────
function PipCard() {
  const [symbol, setSymbol] = useState('EURUSD');
  const [pips, setPips] = useState('');
  const [size, setSize] = useState('1');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');

  const valid = symbol.trim() && isNum(pips) && isNum(size);

  const calc = useCallback(async () => {
    if (!valid) { setRes(null); setErr(''); return; }
    setErr('');
    try {
      const r = await api.toolPip({ symbol: symbol.trim(), pips: Number(pips), size: Number(size) });
      setRes(r);
    } catch (e) { setErr(e?.message || 'خطا در محاسبه'); setRes(null); }
  }, [symbol, pips, size, valid]);

  const t = useRef();
  useEffect(() => { clearTimeout(t.current); t.current = setTimeout(calc, 450); return () => clearTimeout(t.current); }, [calc]);

  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 font-bold text-sm mb-3"><Percent size={16} className="text-brand-green" /> ماشین‌حسابِ پیپ <InfoTip text="ارزشِ دلاریِ هر تعداد پیپ را برای حجمِ دلخواه حساب می‌کند؛ نماد، تعدادِ پیپ و حجم (لات) را وارد کن." /></div>
      <div className="grid grid-cols-3 gap-2.5">
        <TextField label="نماد" value={symbol} onChange={setSymbol} placeholder="EURUSD" />
        <NumField label="تعدادِ پیپ" value={pips} onChange={setPips} placeholder="50" />
        <NumField label="حجم (لات)" value={size} onChange={setSize} placeholder="1" />
      </div>
      {err && <p className="text-[11px] text-brand-red mt-2">{err}</p>}
      {res && !err && (
        <div className="mt-3 text-center rounded-lg bg-brand-green/10 py-3">
          <div className="text-[10px] text-text-muted">سود / زیانِ دلاری</div>
          <div className={`text-xl font-black ${Number(res.usd) >= 0 ? 'text-brand-green' : 'text-brand-red'}`} dir="ltr">
            {Number(res.usd) >= 0 ? '+' : ''}${fmtN(res.usd, 2)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ۳) نسبتِ ریسک به ریوارد ─────────────────────────────────
function RRCard() {
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');

  const valid = isNum(entry) && isNum(sl) && isNum(tp) && Number(entry) !== Number(sl);

  const calc = useCallback(async () => {
    if (!valid) { setRes(null); setErr(''); return; }
    setErr('');
    try {
      const r = await api.toolRR({ entry: Number(entry), sl: Number(sl), tp: Number(tp) });
      setRes(r);
    } catch (e) { setErr(e?.message || 'خطا در محاسبه'); setRes(null); }
  }, [entry, sl, tp, valid]);

  const t = useRef();
  useEffect(() => { clearTimeout(t.current); t.current = setTimeout(calc, 450); return () => clearTimeout(t.current); }, [calc]);

  const good = res && Number(res.rr) >= 2;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 font-bold text-sm mb-3"><Scale size={16} className="text-brand-green" /> نسبتِ ریسک به ریوارد <InfoTip text="ورود، حدِ ضرر و حدِ سود را بده تا نسبتِ پاداش به ریسک را بسنجی؛ نسبتِ ۲ یا بیشتر مطلوب است." /></div>
      <div className="grid grid-cols-3 gap-2.5">
        <NumField label="ورود" value={entry} onChange={setEntry} placeholder="1.0850" />
        <NumField label="حدِ ضرر" value={sl} onChange={setSl} placeholder="1.0800" />
        <NumField label="حدِ سود" value={tp} onChange={setTp} placeholder="1.0950" />
      </div>
      {err && <p className="text-[11px] text-brand-red mt-2">{err}</p>}
      {res && !err && (
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className={`rounded-lg py-2 ${good ? 'bg-brand-green/15' : 'bg-bg-secondary/60'}`}>
            <div className="text-[10px] text-text-muted">نسبت R:R</div>
            <div className={`text-lg font-black ${good ? 'text-brand-green' : 'text-text-primary'}`}>1 : {fmtN(res.rr, 2)}</div>
          </div>
          <div className="rounded-lg bg-bg-secondary/60 py-2">
            <div className="text-[10px] text-text-muted">ریسک</div>
            <div className="text-base font-black text-brand-red" dir="ltr">{fmtN(res.risk, 5)}</div>
          </div>
          <div className="rounded-lg bg-bg-secondary/60 py-2">
            <div className="text-[10px] text-text-muted">ریوارد</div>
            <div className="text-base font-black text-brand-green" dir="ltr">{fmtN(res.reward, 5)}</div>
          </div>
          {!good && <div className="col-span-3 text-[11px] text-text-muted">برای معاملاتِ باکیفیت، نسبتِ ۲ یا بیشتر توصیه می‌شود.</div>}
        </div>
      )}
    </div>
  );
}

// ─── ۴) جلساتِ بازار ─────────────────────────────────────────
function SessionsCard() {
  const { data } = useQuery({ queryKey: ['toolSessions'], queryFn: () => api.toolSessions(), refetchInterval: 60000 });
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 font-bold text-sm"><Clock size={16} className="text-brand-green" /> جلساتِ بازار</div>
        {data?.now_utc && <span className="text-[10px] text-text-muted" dir="ltr">UTC {data.now_utc}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(data?.sessions || []).map((s) => (
          <div key={s.name} className={`rounded-lg p-2.5 border ${s.active ? 'border-brand-green bg-brand-green/10' : 'border-border bg-bg-secondary/40'}`}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">{s.name}</span>
              {s.active && <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-green" /></span>}
            </div>
            <div className="text-[11px] text-text-muted mt-1" dir="ltr">{s.open} – {s.close}</div>
            <div className={`text-[10px] mt-0.5 ${s.active ? 'text-brand-green font-bold' : 'text-text-muted'}`}>{s.active ? 'فعال الان' : 'بسته'}</div>
          </div>
        ))}
      </div>
      {Array.isArray(data?.active) && data.active.length > 0 && (
        <p className="text-[11px] text-text-muted mt-2.5">جلساتِ فعال: <span className="text-brand-green font-bold">{data.active.join('، ')}</span></p>
      )}
    </div>
  );
}

export default function Tools() {
  const { data: ov } = useQuery({ queryKey: ['toolsOv'], queryFn: () => api.toolsOverview(), refetchInterval: 30000 });
  const { data: cr } = useQuery({ queryKey: ['toolsCorr'], queryFn: () => api.toolsCorrelations() });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <h1 className="text-lg sm:text-xl font-black flex items-center gap-2"><Gauge className="text-brand-green" /> داشبوردِ ابزارها</h1>
        <GuideButton guideKey="tools" auto />
      </div>

      {/* سنتیمنتِ بازار */}
      {ov && (
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm">سنتیمنتِ بازار</span>
            <span className={`text-sm font-black ${ov.sentiment >= 50 ? 'text-brand-green' : 'text-brand-red'}`}>{ov.sentiment}٪ صعودی</span>
          </div>
          <div className="w-full h-3 bg-brand-red/30 rounded-full overflow-hidden"><div className="h-full bg-brand-green" style={{ width: `${ov.sentiment}%` }} /></div>
          <p className="text-[11px] text-text-muted mt-1">{ov.bullish} از {ov.total} نماد امروز صعودی‌اند.</p>
        </div>
      )}

      {/* نمای بازار */}
      <div className="font-bold text-sm mb-2">نمای بازار (تغییرِ روزانه)</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
        {(ov?.symbols || []).map((s) => (
          <div key={s.symbol} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">{s.symbol}</span>
              {s.change >= 0 ? <TrendingUp size={14} className="text-brand-green" /> : <TrendingDown size={14} className="text-brand-red" />}
            </div>
            <div className="text-xs text-text-muted" dir="ltr">{fmtPrice(s.price)}</div>
            <div className={`text-sm font-black ${s.change >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{s.change >= 0 ? '+' : ''}{s.change}%</div>
          </div>
        ))}
      </div>

      {/* ماشین‌حساب‌های حرفه‌ای */}
      <div className="font-bold text-sm mb-2 flex items-center gap-1.5"><Calculator size={15} className="text-brand-green" /> ماشین‌حساب‌های معامله‌گرِ حرفه‌ای</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <PositionSizeCard />
        <PipCard />
        <RRCard />
        <SessionsCard />
      </div>

      {/* همبستگی */}
      {cr?.symbols?.length > 0 && (
        <>
          <div className="font-bold text-sm mb-2 flex items-center gap-1.5"><Grid3x3 size={15} className="text-brand-green" /> ماتریسِ همبستگی</div>
          <div className="card p-2 overflow-x-auto">
            <table className="text-[10px] sm:text-xs">
              <thead><tr><th className="p-1"></th>{cr.symbols.map((s) => <th key={s} className="p-1 text-text-muted" style={{ writingMode: 'vertical-rl' }}>{s}</th>)}</tr></thead>
              <tbody>
                {cr.matrix.map((row, i) => (
                  <tr key={i}>
                    <td className="p-1 font-bold text-text-secondary whitespace-nowrap">{cr.symbols[i]}</td>
                    {row.map((v, j) => <td key={j} className="p-1 text-center" style={{ background: corrColor(v) }}>{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-text-muted mt-2 leading-6">🟩 همبستگیِ مثبت · 🟥 منفی. محاسبه‌شده از تغییراتِ قیمتِ H4. (تقویمِ اقتصادیِ زنده در نسخه‌های بعد.)</p>
        </>
      )}
    </div>
  );
}
