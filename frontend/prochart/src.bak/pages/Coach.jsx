import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Brain, Activity, Gauge, AlertTriangle, TrendingUp, Tag, Target, Sparkles, RefreshCw } from 'lucide-react';
import { api } from '../api/client';

// نگاشتِ احساسات (انگلیسی ← فارسی + رنگ)
const EMOTION_MAP = {
  calm: { fa: 'آرامش', color: '#34d399' },
  confident: { fa: 'اعتمادبه‌نفس', color: '#38bdf8' },
  fear: { fa: 'ترس', color: '#fbbf24' },
  greed: { fa: 'طمع', color: '#f97316' },
  revenge: { fa: 'انتقام', color: '#f87171' },
  impatience: { fa: 'بی‌صبری', color: '#a78bfa' },
};
const emoFa = (e) => EMOTION_MAP[e]?.fa || e || '—';
const emoColor = (e) => EMOTION_MAP[e]?.color || '#94a3b8';

const SEV = {
  high: { ring: 'border-brand-red/40', bg: 'bg-brand-red/5', text: 'text-brand-red', label: 'بحرانی' },
  med: { ring: 'border-amber-500/40', bg: 'bg-amber-500/5', text: 'text-amber-400', label: 'هشدار' },
  low: { ring: 'border-surface-border', bg: 'bg-surface-elevated/40', text: 'text-text-secondary', label: 'توجه' },
};
const sev = (s) => SEV[s] || SEV.low;

const fmt = (v, suffix = '', dash = '—') =>
  (v === null || v === undefined || Number.isNaN(v)) ? dash : `${v}${suffix}`;
const pct = (v) => (v === null || v === undefined || Number.isNaN(v)) ? '—' : `${Math.round(v)}٪`;

function ScoreRing({ score }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const color = s < 40 ? '#f87171' : s < 70 ? '#fbbf24' : '#34d399';
  const r = 70, c = 2 * Math.PI * r, off = c * (1 - s / 100);
  const label = s < 40 ? 'نیازمندِ کار' : s < 70 ? 'رو به رشد' : 'منضبط';
  return (
    <div className="relative w-[180px] h-[180px] shrink-0">
      <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
        <circle cx="90" cy="90" r={r} fill="none" stroke="currentColor" className="text-surface-border" strokeWidth="14" />
        <circle cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-4xl font-black" style={{ color }}>{Math.round(s)}</div>
        <div className="text-[11px] text-text-muted">از ۱۰۰</div>
        <div className="text-xs font-bold mt-1" style={{ color }}>{label}</div>
      </div>
    </div>
  );
}

function FactorBar({ name, value, weight }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const color = v < 40 ? '#f87171' : v < 70 ? '#fbbf24' : '#34d399';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-text-secondary">{name}{weight ? <span className="text-text-muted"> ·وزن {Math.round(weight * 100)}٪</span> : null}</span>
        <span className="font-bold" style={{ color }}>{Math.round(v)}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color, transition: 'width .6s ease' }} />
      </div>
    </div>
  );
}

function EmotionRow({ e }) {
  const wr = e?.win_rate;
  const w = (wr === null || wr === undefined) ? 0 : Math.max(0, Math.min(100, wr));
  const good = (wr ?? 0) >= 50;
  const pnl = e?.avg_pnl;
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 flex items-center gap-1.5 text-sm">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: emoColor(e?.emotion) }} />
        <span className="truncate">{emoFa(e?.emotion)}</span>
      </div>
      <div className="flex-1 h-3.5 rounded-full bg-surface-elevated overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: good ? '#34d399' : '#f87171', transition: 'width .6s ease' }} />
      </div>
      <div className="w-12 shrink-0 text-left text-xs font-bold" style={{ color: good ? '#34d399' : '#f87171' }}>{pct(wr)}</div>
      <div className="w-14 shrink-0 text-left text-[11px] text-text-muted">{fmt(e?.trades, ' معامله', '—')}</div>
      <div className="w-16 shrink-0 text-left text-xs font-bold" dir="ltr"
        style={{ color: pnl == null ? '#94a3b8' : pnl >= 0 ? '#34d399' : '#f87171' }}>
        {pnl == null ? '—' : `${pnl >= 0 ? '+' : ''}${(+pnl).toFixed(1)}$`}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = 'neutral' }) {
  const c = tone === 'good' ? 'text-brand-green' : tone === 'bad' ? 'text-brand-red' : 'text-text-primary';
  return (
    <div className="card p-3 text-center">
      <div className={`font-black text-base ${c}`} dir="ltr">{value}</div>
      <div className="text-[10px] text-text-muted mt-0.5">{label}</div>
    </div>
  );
}

export default function Coach() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['coach'],
    queryFn: () => api.coachDashboard(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const d = data || {};
  const emotions = Array.isArray(d.emotions) ? d.emotions : [];
  const tags = Array.isArray(d.tags) ? d.tags : [];
  const flags = Array.isArray(d.behavioral_flags) ? d.behavioral_flags : [];
  const weak = Array.isArray(d.weak_levels) ? d.weak_levels : [];
  const lessons = Array.isArray(d.recommended_lessons) ? d.recommended_lessons : [];
  const practice = d.practice || {};
  const paper = d.paper || {};
  const ds = d.discipline_score || {};
  const factors = Array.isArray(ds.factors) ? ds.factors : [];
  const report = (d.ai_report || '').trim();

  const sortedFlags = useMemo(
    () => [...flags].sort((a, b) => ({ high: 0, med: 1, low: 2 }[a?.severity] ?? 3) - ({ high: 0, med: 1, low: 2 }[b?.severity] ?? 3)),
    [flags]
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <div className="relative">
          <Brain size={48} className="text-brand-green animate-pulse" />
        </div>
        <div className="w-8 h-8 border-2 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
        <div className="text-text-secondary text-sm">در حال تحلیلِ رفتارِ تو…</div>
        <div className="text-text-muted text-xs">کوچِ هوشمند، الگوهای معاملاتی‌ات را بررسی می‌کند (ممکن است تا ۳۰ ثانیه طول بکشد).</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-10">
      {/* سربرگ */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-5">
        <div>
          <h1 className="text-lg sm:text-2xl font-black flex items-center gap-2">
            <Brain className="text-brand-green" /> کوچِ رفتاری
          </h1>
          <p className="text-text-muted text-xs sm:text-sm mt-1">مربیِ شخصیِ هوشمند که الگوهای ذهنی و انضباطِ معاملاتی‌ات را آینه می‌کند.</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="btn-ghost flex items-center gap-1.5 text-sm disabled:opacity-50">
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /> {isFetching ? 'در حال به‌روزرسانی…' : 'به‌روزرسانی'}
        </button>
      </div>

      {/* امتیازِ انضباط + فاکتورها */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-4 text-sm font-bold text-text-secondary">
          <Gauge size={18} className="text-brand-green" /> امتیازِ انضباط
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing score={ds.score} />
          <div className="flex-1 w-full space-y-3">
            {factors.length === 0 ? (
              <div className="text-text-muted text-sm text-center py-4">هنوز دادهٔ کافی برای محاسبهٔ فاکتورها نیست. معامله ثبت کن تا کوچ یادبگیرد.</div>
            ) : factors.map((f, i) => (
              <FactorBar key={i} name={f?.name || `فاکتور ${i + 1}`} value={f?.value} weight={f?.weight} />
            ))}
          </div>
        </div>
      </div>

      {/* احساسات × نتیجه */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-text-secondary">
            <Activity size={18} className="text-brand-green" /> احساسات × نتیجه
          </div>
          <span className="text-[11px] text-text-muted">کدام احساس برایت هزینه دارد؟</span>
        </div>
        {emotions.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-6">هنوز معامله‌ای با ثبتِ احساس نداری. در ژورنال، احساست را هم بنویس.</div>
        ) : (
          <div className="space-y-3">
            {emotions.map((e, i) => <EmotionRow key={i} e={e} />)}
          </div>
        )}
      </div>

      {/* الگوهای رفتاری */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-4 text-sm font-bold text-text-secondary">
          <AlertTriangle size={18} className="text-amber-400" /> الگوهای رفتاری
        </div>
        {sortedFlags.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-2xl mb-1">👏</div>
            <div className="text-brand-green font-bold text-sm">الگوی مخربی پیدا نشد</div>
            <div className="text-text-muted text-xs mt-1">انضباطت خوب است؛ همین مسیر را ادامه بده.</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedFlags.map((f, i) => {
              const st = sev(f?.severity);
              return (
                <div key={f?.key || i} className={`rounded-xl border ${st.ring} ${st.bg} p-3.5`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className={`font-bold text-sm flex items-center gap-1.5 ${st.text}`}>
                      <AlertTriangle size={14} /> {f?.title_fa || f?.key || 'الگو'}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${st.ring} ${st.text}`}>{st.label}</span>
                  </div>
                  {f?.evidence_fa && <div className="text-xs text-text-secondary leading-6">{f.evidence_fa}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* آمارِ تمرین و حساب مجازی */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-bold text-text-secondary">
            <Target size={16} className="text-brand-green" /> آمارِ تمرین
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="معامله" value={fmt(practice.trades)} />
            <Stat label="نرخِ برد" value={pct(practice.win_rate)} tone={(practice.win_rate ?? 0) >= 50 ? 'good' : (practice.win_rate == null ? 'neutral' : 'bad')} />
            <Stat label="فاکتورِ سود" value={fmt(practice.profit_factor)} tone={(practice.profit_factor ?? 0) >= 1 ? 'good' : (practice.profit_factor == null ? 'neutral' : 'bad')} />
            <Stat label="میانگین R" value={practice.avg_r == null ? '—' : `${practice.avg_r >= 0 ? '+' : ''}${practice.avg_r}`} tone={(practice.avg_r ?? 0) >= 0 ? 'good' : 'bad'} />
            <Stat label="بهترین رکوردِ بُرد" value={fmt(practice.best_streak)} tone="good" />
            <Stat label="بدترین رکوردِ باخت" value={fmt(practice.worst_streak)} tone="bad" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-bold text-text-secondary">
            <TrendingUp size={16} className="text-brand-green" /> حسابِ مجازی
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="معامله" value={fmt(paper.trades)} />
            <Stat label="نرخِ برد" value={pct(paper.win_rate)} tone={(paper.win_rate ?? 0) >= 50 ? 'good' : (paper.win_rate == null ? 'neutral' : 'bad')} />
            <Stat label="فاکتورِ سود" value={fmt(paper.profit_factor)} tone={(paper.profit_factor ?? 0) >= 1 ? 'good' : (paper.profit_factor == null ? 'neutral' : 'bad')} />
            <Stat label="سود/زیانِ کل" value={paper.total_pnl == null ? '—' : `${paper.total_pnl >= 0 ? '+' : ''}${(+paper.total_pnl).toFixed(1)}$`} tone={(paper.total_pnl ?? 0) >= 0 ? 'good' : 'bad'} />
          </div>
        </div>
      </div>

      {/* تگ‌ها */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-4 text-sm font-bold text-text-secondary">
          <Tag size={18} className="text-brand-green" /> ستاپ‌های تو (برچسب‌ها)
        </div>
        {tags.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-4">هنوز برچسبی روی معاملاتت نداری. در ژورنال، ستاپ‌ها را برچسب بزن.</div>
        ) : (
          <div className="space-y-2.5">
            {tags.map((t, i) => {
              const wr = t?.win_rate;
              const w = (wr === null || wr === undefined) ? 0 : Math.max(0, Math.min(100, wr));
              const good = (wr ?? 0) >= 50;
              return (
                <div key={t?.tag || i} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-sm truncate">#{t?.tag || '—'}</div>
                  <div className="flex-1 h-3 rounded-full bg-surface-elevated overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${w}%`, background: good ? '#34d399' : '#f87171' }} />
                  </div>
                  <div className="w-12 shrink-0 text-left text-xs font-bold" style={{ color: good ? '#34d399' : '#f87171' }}>{pct(wr)}</div>
                  <div className="w-14 shrink-0 text-left text-[11px] text-text-muted">{fmt(t?.trades, ' معامله')}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* نقاطِ ضعف + درس‌های پیشنهادی */}
      {(weak.length > 0 || lessons.length > 0) && (
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-2 mb-4 text-sm font-bold text-text-secondary">
            <Target size={18} className="text-amber-400" /> نقاطِ ضعف و مسیرِ رشد
          </div>
          {weak.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-text-muted mb-2">سرفصل‌هایی که باید تقویت کنی:</div>
              <div className="flex flex-wrap gap-1.5">
                {weak.map((w, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400">{w}</span>
                ))}
              </div>
            </div>
          )}
          {lessons.length > 0 && (
            <div>
              <div className="text-xs text-text-muted mb-2">درس‌های پیشنهادیِ کوچ:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {lessons.map((l, i) => (
                  <Link key={l?.slug || i} to={`/lesson/${l?.slug || ''}`}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-surface-border hover:border-brand-green hover:bg-brand-green/5 text-sm text-text-secondary hover:text-brand-green transition-colors">
                    <GraduationDot /> <span className="truncate">{l?.title || l?.slug || 'درس'}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* گزارشِ مربیِ AI */}
      <div className="card p-5 border border-brand-green/30 bg-brand-green/5">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-bold text-brand-green">
            <Sparkles size={18} /> گزارشِ مربیِ هوشمند
          </div>
          <button onClick={() => refetch()} disabled={isFetching}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-brand-green/40 text-brand-green hover:bg-brand-green/10 disabled:opacity-50">
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} /> {isFetching ? 'در حال تحلیل…' : 'تولیدِ دوبارهٔ تحلیل'}
          </button>
        </div>
        {isFetching ? (
          <div className="flex items-center gap-2 text-text-secondary text-sm py-3">
            <div className="w-5 h-5 border-2 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
            در حال تحلیلِ رفتارِ تو…
          </div>
        ) : report ? (
          <div className="text-sm text-text-primary leading-8 whitespace-pre-line">{report}</div>
        ) : (
          <div className="text-text-muted text-sm py-2">هنوز گزارشی تولید نشده. با ثبتِ معاملاتِ بیشتر، کوچ تحلیلِ شخصی‌ات را می‌نویسد.</div>
        )}
      </div>
    </div>
  );
}

function GraduationDot() {
  return <span className="w-1.5 h-1.5 rounded-full bg-brand-green shrink-0" />;
}
