import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Search, MousePointerClick, TrendingDown, Gauge, AlertTriangle, CheckCircle2,
  XCircle, RefreshCw, Zap, Eye, ExternalLink, Plus, Trash2, Smartphone, Monitor,
  Activity, LayoutGrid, FileText, ListChecks, Loader2, ArrowUpDown,
} from 'lucide-react';
import { seoAPI } from '../api/client';

const fa = (n) => (n ?? 0).toLocaleString('fa-IR');
const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}٪`);
const ms = (v) => (v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`);
const short = (u) => (u || '').replace('https://fx.trade-future.ir', '') || '/';

const SEV = {
  high: { label: 'بحرانی', color: '#F44336', bg: '#F4433618' },
  medium: { label: 'متوسط', color: '#FF9800', bg: '#FF980018' },
  low: { label: 'کم', color: '#2979FF', bg: '#2979FF18' },
  info: { label: 'اطلاع', color: '#607D8B', bg: '#607D8B18' },
};
const CAT = {
  ctr_opportunity: { label: 'فرصتِ CTR', Icon: MousePointerClick, color: '#00C853' },
  zero_click: { label: 'بدونِ کلیک', Icon: Eye, color: '#FF9800' },
  rank_drop: { label: 'افتِ رتبه', Icon: TrendingDown, color: '#F44336' },
  pagespeed: { label: 'سرعتِ صفحه', Icon: Gauge, color: '#9C27B0' },
  index_issue: { label: 'مشکلِ ایندکس', Icon: AlertTriangle, color: '#E91E63' },
  schema: { label: 'داده ساختاریافته', Icon: FileText, color: '#00BCD4' },
};

const scoreColor = (s) => (s == null ? '#607D8B' : s >= 90 ? '#00C853' : s >= 50 ? '#FF9800' : '#F44336');

function Ring({ score, size = 64, label }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - (score ?? 0) / 100);
  const col = scoreColor(score);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff12" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="6"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div className="-mt-[calc(50%+2px)] mb-[calc(50%-12px)] text-base font-black" style={{ color: col }}>
        {score ?? '—'}
      </div>
      {label && <span className="text-[10px] text-text-secondary">{label}</span>}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = '#2979FF' }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-secondary text-xs mb-1">{label}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          {sub && <p className="text-text-secondary text-[11px] mt-1">{sub}</p>}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}1a`, color }}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'overview', label: 'نمای کلی', Icon: LayoutGrid },
  { id: 'speed', label: 'سرعت صفحات', Icon: Gauge },
  { id: 'queries', label: 'کوئری‌ها', Icon: Search },
  { id: 'pages', label: 'صفحات', Icon: FileText },
  { id: 'actions', label: 'اقدامات', Icon: ListChecks },
];

/* ─────────────── Overview tab ─────────────── */
function OverviewTab() {
  const { data: ov, isLoading } = useQuery({
    queryKey: ['seo-overview'], queryFn: () => seoAPI.overview().then((r) => r.data), refetchInterval: 60000,
  });
  const d7 = ov?.last_7d || {}, d28 = ov?.last_28d || {};
  const openCount = ov?.open_actions?.total || 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={MousePointerClick} label="کلیک (۷ روز)" value={fa(d7.clicks)} sub={`۲۸ روز: ${fa(d28.clicks)}`} color="#00C853" />
        <StatCard icon={Eye} label="نمایش (۷ روز)" value={fa(d7.impressions)} sub={`۲۸ روز: ${fa(d28.impressions)}`} color="#2979FF" />
        <StatCard icon={Search} label="CTR (۲۸ روز)" value={pct(d28.ctr)} sub={`میانگین رتبه: ${d28.avg_position ?? '—'}`} color="#FF9800" />
        <StatCard icon={Activity} label="سلامتِ سرعت" value={ov?.avg_performance ?? '—'} sub={`${fa(ov?.monitored_count)} صفحه تحتِ‌نظر`} color={scoreColor(ov?.avg_performance)} />
      </div>
      <div className="card">
        <h3 className="text-text-primary font-semibold mb-3">روندِ ۲۸ روزه</h3>
        {ov?.trend?.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={ov.trend} margin={{ left: -20, right: 8 }}>
              <defs>
                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00C853" stopOpacity={0.5} /><stop offset="95%" stopColor="#00C853" stopOpacity={0} /></linearGradient>
                <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2979FF" stopOpacity={0.35} /><stop offset="95%" stopColor="#2979FF" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9aa0b5' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9aa0b5' }} />
              <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="impressions" name="نمایش" stroke="#2979FF" fill="url(#gI)" strokeWidth={2} />
              <Area type="monotone" dataKey="clicks" name="کلیک" stroke="#00C853" fill="url(#gC)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-text-secondary text-sm py-8 text-center">
            {isLoading ? 'در حال بارگذاری…' : 'هنوز داده‌ای از Search Console نیامده — اولین داده‌کاوی ۰۶:۰۰ UTC اجرا می‌شود.'}
          </p>
        )}
      </div>
      {openCount > 0 && (
        <div className="card">
          <h3 className="text-text-primary font-semibold mb-3">اقداماتِ باز بر اساسِ نوع</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ov.open_actions.by_category || {}).map(([k, v]) => {
              const c = CAT[k] || { label: k, color: '#607D8B', Icon: AlertTriangle };
              const I = c.Icon;
              return (
                <div key={k} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: `${c.color}14` }}>
                  <I size={16} style={{ color: c.color }} />
                  <span className="text-sm text-text-primary">{c.label}</span>
                  <span className="text-sm font-bold" style={{ color: c.color }}>{fa(v)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Speed tab ─────────────── */
function CWV({ k, v, good, mid }) {
  const col = v == null ? '#607D8B' : v <= good ? '#00C853' : v <= mid ? '#FF9800' : '#F44336';
  return (
    <div className="text-center">
      <div className="text-[10px] text-text-secondary">{k}</div>
      <div className="text-sm font-bold" style={{ color: col }}>{typeof v === 'number' && v < 5 ? v?.toFixed(3) : ms(v)}</div>
    </div>
  );
}

function UrlCard({ u, onTest, onDelete, onToggle, testing }) {
  const m = u.scores?.mobile, d = u.scores?.desktop;
  return (
    <div className="card !p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary truncate">{u.label || short(u.url)}</div>
          <a href={u.url} target="_blank" rel="noreferrer" className="text-[11px] text-accent-blue inline-flex items-center gap-1" dir="ltr">{short(u.url)} <ExternalLink size={10} /></a>
        </div>
        <div className="flex gap-1 shrink-0">
          <button title="تستِ فوری" disabled={testing} onClick={() => onTest(u.url)}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 disabled:opacity-50">
            {testing ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
          </button>
          <button title={u.enabled ? 'غیرفعال' : 'فعال'} onClick={() => onToggle(u)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${u.enabled ? 'bg-accent-green/10 text-accent-green' : 'bg-white/5 text-text-secondary'} hover:opacity-80`}>
            <CheckCircle2 size={15} />
          </button>
          <button title="حذف" onClick={() => onDelete(u)}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/20">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {(m || d) ? (
        <div className="grid grid-cols-2 gap-3">
          {[['موبایل', Smartphone, m], ['دسکتاپ', Monitor, d]].map(([lbl, Ic, s]) => (
            <div key={lbl} className="rounded-xl border border-white/10 p-2">
              <div className="flex items-center gap-1 text-[11px] text-text-secondary mb-1"><Ic size={12} /> {lbl}</div>
              {s ? (
                <>
                  <div className="flex items-center justify-around mb-2">
                    <Ring score={s.performance} size={56} label="سرعت" />
                    <div className="flex flex-col gap-0.5 text-[10px]">
                      <span style={{ color: scoreColor(s.seo) }}>SEO {s.seo ?? '—'}</span>
                      <span style={{ color: scoreColor(s.accessibility) }}>A11y {s.accessibility ?? '—'}</span>
                      <span style={{ color: scoreColor(s.best_practices) }}>BP {s.best_practices ?? '—'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-1 border-t border-white/5">
                    <CWV k="LCP" v={s.lcp_ms} good={2500} mid={4000} />
                    <CWV k="CLS" v={s.cls} good={0.1} mid={0.25} />
                    <CWV k="TBT" v={s.tbt_ms} good={200} mid={600} />
                  </div>
                </>
              ) : <div className="text-[11px] text-text-secondary py-4 text-center">بدونِ داده</div>}
            </div>
          ))}
        </div>
      ) : <div className="text-xs text-text-secondary py-3 text-center">هنوز تست نشده — «تستِ فوری» را بزن</div>}
      {m?.issues?.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <div className="text-[10px] text-text-secondary mb-1">مشکلاتِ کلیدی (موبایل):</div>
          <ul className="text-[11px] text-text-secondary space-y-0.5 list-disc pr-4">
            {m.issues.slice(0, 4).map((i, idx) => <li key={idx}>{i}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function SpeedTab() {
  const qc = useQueryClient();
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [testingUrl, setTestingUrl] = useState(null);
  const { data: urls, isLoading } = useQuery({ queryKey: ['seo-urls'], queryFn: () => seoAPI.listUrls().then((r) => r.data) });
  const inv = () => qc.invalidateQueries({ queryKey: ['seo-urls'] });
  const mAdd = useMutation({ mutationFn: () => seoAPI.addUrl({ url: newUrl.trim(), label: newLabel.trim() }), onSuccess: () => { setNewUrl(''); setNewLabel(''); inv(); } });
  const mDel = useMutation({ mutationFn: (id) => seoAPI.deleteUrl(id), onSuccess: inv });
  const mTog = useMutation({ mutationFn: ({ id, enabled }) => seoAPI.toggleUrl(id, { enabled }), onSuccess: inv });
  const mTest = useMutation({ mutationFn: (url) => seoAPI.testUrl(url), onSuccess: inv, onSettled: () => setTestingUrl(null) });

  return (
    <div className="space-y-4">
      <div className="card !p-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[11px] text-text-secondary">آدرسِ صفحه (URL)</label>
            <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} dir="ltr" placeholder="https://fx.trade-future.ir/..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary mt-1" />
          </div>
          <div className="w-40">
            <label className="text-[11px] text-text-secondary">برچسب (اختیاری)</label>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="مثلاً صفحهٔ قیمت‌گذاری"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary mt-1" />
          </div>
          <button disabled={!newUrl.trim() || mAdd.isPending} onClick={() => mAdd.mutate()}
            className="btn-primary flex items-center gap-2 h-[38px]"><Plus size={16} /> افزودنِ صفحه</button>
        </div>
        {mAdd.isError && <p className="text-xs text-red-400 mt-2">{mAdd.error?.response?.data?.detail || 'خطا در افزودن'}</p>}
      </div>

      {isLoading ? (
        <p className="text-text-secondary text-sm text-center py-8">در حال بارگذاری…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {urls?.map((u) => (
            <UrlCard key={u.id} u={u} testing={testingUrl === u.url}
              onTest={(url) => { setTestingUrl(url); mTest.mutate(url); }}
              onDelete={(x) => { if (confirm(`حذفِ «${x.label || short(x.url)}» از تحتِ‌نظر؟`)) mDel.mutate(x.id); }}
              onToggle={(x) => mTog.mutate({ id: x.id, enabled: !x.enabled })} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── GSC tables ─────────────── */
function GscTable({ rows, isLoading, error, firstCol }) {
  const [sort, setSort] = useState('clicks');
  const [dir, setDir] = useState(-1);
  if (isLoading) return <p className="text-text-secondary text-sm text-center py-8">در حال دریافت از Search Console…</p>;
  if (error) return <p className="text-amber-400 text-sm text-center py-8">{error?.response?.data?.detail || 'خطا در دریافت'}</p>;
  if (!rows?.length) return <p className="text-text-secondary text-sm text-center py-8">هنوز داده‌ای ثبت نشده (سایت تازه است یا ترافیک کم).</p>;
  const sorted = [...rows].sort((a, b) => (a[sort] - b[sort]) * dir);
  const Th = ({ k, children }) => (
    <th className="px-3 py-2 text-right cursor-pointer select-none" onClick={() => { sort === k ? setDir(-dir) : (setSort(k), setDir(-1)); }}>
      <span className="inline-flex items-center gap-1">{children}<ArrowUpDown size={11} className={sort === k ? 'text-accent-blue' : 'text-text-secondary/40'} /></span>
    </th>
  );
  return (
    <div className="card !p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[11px] text-text-secondary border-b border-white/10">
          <tr>
            <th className="px-3 py-2 text-right">{firstCol}</th>
            <Th k="clicks">کلیک</Th><Th k="impressions">نمایش</Th><Th k="ctr">CTR</Th><Th k="position">رتبه</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 100).map((r, i) => {
            const lowCtr = r.impressions > 100 && r.ctr < 0.02;
            return (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-3 py-2 text-text-primary max-w-[280px] truncate" dir={firstCol === 'صفحه' ? 'ltr' : 'rtl'}>
                  {firstCol === 'صفحه' ? short(r.key) : r.key}
                </td>
                <td className="px-3 py-2 font-semibold text-text-primary">{fa(r.clicks)}</td>
                <td className="px-3 py-2 text-text-secondary">{fa(r.impressions)}</td>
                <td className={`px-3 py-2 ${lowCtr ? 'text-amber-400 font-bold' : 'text-text-secondary'}`}>{pct(r.ctr)}</td>
                <td className="px-3 py-2 text-text-secondary">{r.position}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QueriesTab() {
  const { data, isLoading, error } = useQuery({ queryKey: ['seo-queries'], queryFn: () => seoAPI.queries().then((r) => r.data), retry: false });
  return (<>
    <p className="text-xs text-text-secondary mb-3">کوئری‌های ۲۸ روزِ اخیر. <span className="text-amber-400">زرد</span> = CTR پایین با نمایشِ بالا (فرصتِ بهبودِ عنوان/توضیحات).</p>
    <GscTable rows={data} isLoading={isLoading} error={error} firstCol="کوئری" />
  </>);
}
function PagesTab() {
  const { data, isLoading, error } = useQuery({ queryKey: ['seo-pages'], queryFn: () => seoAPI.pages().then((r) => r.data), retry: false });
  return (<>
    <p className="text-xs text-text-secondary mb-3">صفحاتِ ۲۸ روزِ اخیر بر اساسِ عملکردِ جستجو.</p>
    <GscTable rows={data} isLoading={isLoading} error={error} firstCol="صفحه" />
  </>);
}

/* ─────────────── Actions tab ─────────────── */
function ActionsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('open');
  const { data: actions } = useQuery({ queryKey: ['seo-actions', status], queryFn: () => seoAPI.actions({ status, limit: 200 }).then((r) => r.data) });
  const inv = () => { qc.invalidateQueries({ queryKey: ['seo-actions'] }); qc.invalidateQueries({ queryKey: ['seo-overview'] }); };
  const mR = useMutation({ mutationFn: (id) => seoAPI.resolve(id), onSuccess: inv });
  const mD = useMutation({ mutationFn: (id) => seoAPI.dismiss(id), onSuccess: inv });
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-text-primary font-semibold">آیتم‌های اقدام</h3>
        <div className="flex gap-1 text-xs">
          {['open', 'resolved', 'all'].map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1 rounded-lg ${status === s ? 'bg-accent-blue text-white' : 'bg-white/5 text-text-secondary'}`}>
              {s === 'open' ? 'باز' : s === 'resolved' ? 'حل‌شده' : 'همه'}
            </button>
          ))}
        </div>
      </div>
      {actions?.length ? (
        <div className="space-y-2">
          {actions.map((a) => {
            const sev = SEV[a.severity] || SEV.info, cat = CAT[a.category] || { label: a.category, Icon: AlertTriangle, color: '#607D8B' };
            const CatIcon = cat.Icon;
            return (
              <div key={a.id} className="rounded-xl border border-white/10 p-3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cat.color}1a`, color: cat.color }}><CatIcon size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-text-primary">{a.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
                    <span className="text-[10px] text-text-secondary">{cat.label}</span>
                  </div>
                  {a.detail && <p className="text-xs text-text-secondary mt-1">{a.detail}</p>}
                  {a.target && (
                    <a href={a.target.startsWith('http') ? a.target : undefined} target="_blank" rel="noreferrer"
                      className="text-[11px] text-accent-blue mt-1 inline-flex items-center gap-1" dir="ltr">
                      {a.target.length > 60 ? a.target.slice(0, 60) + '…' : a.target}{a.target.startsWith('http') && <ExternalLink size={11} />}
                    </a>
                  )}
                </div>
                {a.status === 'open' && (
                  <div className="flex gap-1 shrink-0">
                    <button title="انجام شد" onClick={() => mR.mutate(a.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-green/10 text-accent-green hover:bg-accent-green/20"><CheckCircle2 size={16} /></button>
                    <button title="نادیده بگیر" onClick={() => mD.mutate(a.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-text-secondary hover:bg-white/10"><XCircle size={16} /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10">
          <CheckCircle2 size={40} className="mx-auto text-accent-green mb-2" />
          <p className="text-text-secondary text-sm">{status === 'open' ? 'هیچ اقدامِ بازی نیست — همه‌چیز سالم است! 🎉' : 'موردی یافت نشد.'}</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Root ─────────────── */
export default function SeoPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const mRun = useMutation({ mutationFn: () => seoAPI.runNow() });
  const mRunPS = useMutation({ mutationFn: () => seoAPI.runPagespeed() });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2"><Search size={24} className="text-accent-blue" /> مرکزِ سئو و عملکرد</h1>
          <p className="text-text-secondary text-sm mt-1">داده‌کاویِ خودکارِ Search Console + سنجشِ PageSpeed + purge هوشمندِ Cloudflare</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2" disabled={mRun.isPending} onClick={() => mRun.mutate()}>
            <RefreshCw size={16} className={mRun.isPending ? 'animate-spin' : ''} /> داده‌کاویِ فوری
          </button>
          <button className="btn-secondary flex items-center gap-2" disabled={mRunPS.isPending} onClick={() => mRunPS.mutate()}>
            <Zap size={16} className={mRunPS.isPending ? 'animate-spin' : ''} /> تستِ سرعتِ همه
          </button>
        </div>
      </div>

      {(mRun.isSuccess || mRunPS.isSuccess) && (
        <div className="text-xs text-accent-green bg-accent-green/10 rounded-lg px-3 py-2">درخواست ثبت شد؛ نتیجه طیِ چند دقیقه به‌روزرسانی می‌شود.</div>
      )}

      {/* tabs */}
      <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
        {TABS.map((t) => {
          const I = t.Icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm flex items-center gap-2 border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? 'border-accent-blue text-accent-blue' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
              <I size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'speed' && <SpeedTab />}
      {tab === 'queries' && <QueriesTab />}
      {tab === 'pages' && <PagesTab />}
      {tab === 'actions' && <ActionsTab />}
    </div>
  );
}
