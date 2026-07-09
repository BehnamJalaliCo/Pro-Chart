import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Lock, CheckCircle2, PlayCircle, Video, Crown, Sparkles, BookOpen, Trophy, ChevronDown, Flame, Medal, Award, Map, List, Star, GitBranch, Circle, MapPin } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../store';
import { GuideButton } from '../components/Guide';

const LEVEL_META = {
  beginner: { icon: BookOpen, color: 'text-sky-400', bg: 'bg-sky-400/10' },
  intermediate: { icon: PlayCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  advanced: { icon: Crown, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ai: { icon: Sparkles, color: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10' },
};
const TIER_FA = { free: 'رایگان', vip: 'VIP', premium: 'پرمیوم' };

export default function Catalog() {
  const { me } = useAuth();
  const [open, setOpen] = useState({}); // کدام سطح‌ها باز هستند
  const [viewMode, setViewMode] = useState({}); // 'list' | 'roadmap' برای هر سطح
  const [catalogView, setCatalogView] = useState('levels'); // 'levels' | 'skilltree' — نمای کلیِ کاتالوگ
  const { data, isLoading } = useQuery({ queryKey: ['catalog'], queryFn: () => api.catalog() });
  const { data: streak } = useQuery({ queryKey: ['streak'], queryFn: () => api.streak(), enabled: !!me });

  if (isLoading) return <p className="text-text-secondary text-center py-10">در حال بارگذاری دوره‌ها…</p>;
  const levels = data?.levels || [];
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  // اولین درسِ بازِ تکمیل‌نشده برای «ادامه»
  let next = null;
  for (const lv of levels) for (const l of lv.lessons) if (!l.locked && !l.completed && !next) next = l;

  const streakCur = streak?.current ?? me?.streak?.current ?? 0;
  const streakLong = streak?.longest ?? me?.streak?.longest ?? 0;
  const todayDone = streak?.today_done;

  return (
    <div>
      {/* سربرگِ بخش + راهنمای استفاده */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h1 className="text-lg sm:text-xl font-black">دوره‌ها و مسیرِ یادگیری</h1>
        <GuideButton guideKey="catalog" auto />
      </div>

      {/* بنرِ روزهای پیاپی + دکمه‌های لیدربورد و دستاوردها */}
      {me && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="card flex-1 min-w-[200px] p-3 rounded-2xl flex items-center gap-3 bg-gradient-to-l from-amber-400/10 to-transparent">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${todayDone ? 'bg-amber-400/20 text-amber-400' : 'bg-surface-border text-text-muted'}`}>
              <Flame size={22} fill={streakCur > 0 ? 'currentColor' : 'none'} />
            </div>
            <div className="min-w-0">
              <div className="font-black text-sm leading-tight">🔥 {streakCur} روز پیاپی</div>
              <div className="text-xs text-text-muted">
                رکوردِ تو: <b className="text-amber-400">{streakLong} روز</b>
                {todayDone === false && <span className="text-brand-green"> · امروز یک درس بخوان تا ادامه پیدا کند!</span>}
                {todayDone === true && <span className="text-brand-green"> · امروز فعال بودی ✓</span>}
              </div>
            </div>
          </div>
          <Link to="/leaderboard" className="card px-4 py-3 rounded-2xl flex items-center gap-2 hover:ring-1 hover:ring-amber-400/40 transition shrink-0">
            <Medal size={18} className="text-amber-400" />
            <span className="text-sm font-bold">لیدربورد</span>
          </Link>
          <Link to="/achievements" className="card px-4 py-3 rounded-2xl flex items-center gap-2 hover:ring-1 hover:ring-fuchsia-400/40 transition shrink-0">
            <Award size={18} className="text-fuchsia-400" />
            <span className="text-sm font-bold">دستاوردها</span>
            {me.achievements_count != null && (
              <span className="text-[10px] bg-fuchsia-400/15 text-fuchsia-400 rounded-full px-1.5 py-0.5">{me.achievements_count}</span>
            )}
          </Link>
        </div>
      )}

      {/* هدرِ پیشرفت */}
      {me && (
        <div className="card p-5 mb-6 rounded-2xl bg-gradient-to-l from-brand-green/10 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-brand-green/15 text-brand-green flex items-center justify-center"><Trophy size={20} /></div>
              <div>
                <div className="font-black">مسیرِ یادگیریِ تو</div>
                <div className="text-xs text-text-muted">
                  پلنِ فعلی: <b className={data.tier === 'free' ? 'text-text-secondary' : 'text-brand-green'}>{TIER_FA[data.tier] || data.tier}</b>
                </div>
              </div>
            </div>
            <div className="text-left">
              <div className="text-2xl font-black text-brand-green">{me.progress_pct || 0}%</div>
              <div className="text-xs text-text-muted">{me.completed} از {me.total_lessons} درس</div>
            </div>
          </div>
          <div className="w-full h-2.5 bg-surface-border rounded-full overflow-hidden">
            <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: `${me.progress_pct || 0}%` }} />
          </div>
          {/* گیمیفیکیشن: امتیاز + نشان‌ها */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs font-bold bg-amber-400/15 text-amber-400 rounded-full px-2.5 py-1 flex items-center gap-1">⚡ {me.xp || 0} امتیاز</span>
            {me.avg_quiz != null && <span className="text-xs bg-brand-blue/10 text-brand-blue rounded-full px-2.5 py-1">میانگینِ آزمون‌ها: {me.avg_quiz}٪</span>}
            {(me.badges || []).map((b) => (
              <span key={b} className="text-xs bg-surface-card border border-surface-border rounded-full px-2.5 py-1">{b}</span>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {next && (
              <Link to={`/lesson/${next.slug}`} className="inline-flex items-center gap-1.5 text-xs font-bold bg-brand-green text-black rounded-lg px-3 py-1.5 hover:opacity-90">
                <PlayCircle size={14} /> ادامه: {next.title}
              </Link>
            )}
            {data.tier === 'free' && (
              <Link to="/subscribe" className="inline-flex items-center gap-1 text-xs text-brand-green font-bold hover:opacity-80">
                <Crown size={13} /> ارتقا به VIP
              </Link>
            )}
          </div>
        </div>
      )}

      {/* سوییچِ نمایِ کلیِ کاتالوگ: سطح‌ها ↔ درختِ مهارت */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex rounded-xl border border-surface-border overflow-hidden text-xs">
          <button onClick={() => setCatalogView('levels')}
            className={`px-3.5 py-2 flex items-center gap-1.5 transition ${catalogView === 'levels' ? 'bg-brand-green text-black font-bold' : 'text-text-secondary hover:text-text-primary'}`}>
            <List size={14} /> سطح‌ها
          </button>
          <button onClick={() => setCatalogView('skilltree')}
            className={`px-3.5 py-2 flex items-center gap-1.5 transition ${catalogView === 'skilltree' ? 'bg-brand-green text-black font-bold' : 'text-text-secondary hover:text-text-primary'}`}>
            <GitBranch size={14} /> درختِ مهارت
          </button>
        </div>
      </div>

      {catalogView === 'skilltree' ? <SkillTreeView /> : levels.map((lv) => {
        const meta = LEVEL_META[lv.key] || LEVEL_META.beginner;
        const Icon = meta.icon;
        const doneCount = lv.lessons.filter((l) => l.completed).length;
        const freeCount = lv.lessons.filter((l) => l.tier === 'free').length;
        const isOpen = !!open[lv.key];
        return (
          <section key={lv.key} className="mb-3">
            <button onClick={() => toggle(lv.key)}
              className="w-full card p-3 flex items-center gap-3 hover:ring-1 hover:ring-brand-green/40 transition text-right">
              <div className={`w-10 h-10 rounded-xl ${meta.bg} ${meta.color} flex items-center justify-center shrink-0`}><Icon size={20} /></div>
              <div className="flex-1 min-w-0">
                <h2 className="font-black text-base leading-tight">{lv.name}</h2>
                <div className="text-xs text-text-muted">
                  {lv.lessons.length} درس · {doneCount} تکمیل‌شده
                  {freeCount > 0 && <span className="text-brand-green"> · {freeCount} رایگان</span>}
                </div>
              </div>
              {/* نوارِ پیشرفتِ کوچکِ سطح */}
              <div className="hidden sm:block w-24 h-1.5 bg-surface-border rounded-full overflow-hidden shrink-0">
                <div className="h-full bg-brand-green" style={{ width: `${Math.round(100 * doneCount / Math.max(1, lv.lessons.length))}%` }} />
              </div>
              <ChevronDown size={18} className={`text-text-muted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
            <>
            <div className="flex flex-wrap items-center gap-2 mt-2 mb-1">
              {/* سوییچِ نمایش: فهرست ↔ نقشهٔ راه */}
              <div className="flex rounded-lg border border-surface-border overflow-hidden text-xs">
                <button onClick={() => setViewMode((v) => ({ ...v, [lv.key]: 'list' }))}
                  className={`px-3 py-1.5 flex items-center gap-1 transition ${(viewMode[lv.key] || 'list') === 'list' ? 'bg-brand-green text-black font-bold' : 'text-text-secondary hover:text-text-primary'}`}>
                  <List size={13} /> فهرست
                </button>
                <button onClick={() => setViewMode((v) => ({ ...v, [lv.key]: 'roadmap' }))}
                  className={`px-3 py-1.5 flex items-center gap-1 transition ${viewMode[lv.key] === 'roadmap' ? 'bg-brand-green text-black font-bold' : 'text-text-secondary hover:text-text-primary'}`}>
                  <Map size={13} /> نقشهٔ راه
                </button>
              </div>
              <Link to={`/cheatsheet/${lv.key}`} className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-text-secondary hover:text-brand-green hover:border-brand-green/50 flex items-center gap-1">
                <BookOpen size={13} /> چیت‌شیتِ این سطح
              </Link>
              {me?.by_level?.[lv.key]?.mastered && (
                <Link to={`/certificate/${lv.key}`} className="text-xs px-3 py-1.5 rounded-lg bg-amber-400/15 text-amber-400 border border-amber-400/30 flex items-center gap-1">
                  <Crown size={13} /> دریافتِ گواهی
                </Link>
              )}
            </div>

            {viewMode[lv.key] === 'roadmap' ? (
              <RoadmapView levelKey={lv.key} />
            ) : (
            <div className="grid sm:grid-cols-2 gap-2 pr-1">
              {lv.lessons.map((l, idx) => {
                const milestone = (idx + 1) % 5 === 0; // هر ۵ درس یک نقطهٔ عطف
                return (
                l.locked ? (
                  <Link to="/pricing" key={l.slug}
                    className="card p-3 flex items-center gap-3 opacity-70 hover:opacity-100 transition group">
                    <Lock size={17} className="text-text-muted shrink-0 group-hover:text-amber-400" />
                    <span className="text-sm flex-1 line-clamp-1">{l.title}</span>
                    {milestone && <Star size={14} className="text-amber-400 shrink-0" fill="currentColor" />}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 shrink-0">{TIER_FA[l.tier]}</span>
                  </Link>
                ) : (
                  <Link to={`/lesson/${l.slug}`} key={l.slug}
                    className="card p-3 flex items-center gap-3 hover:ring-1 hover:ring-brand-green/50 transition">
                    {l.completed
                      ? <CheckCircle2 size={17} className="text-brand-green shrink-0" />
                      : <PlayCircle size={17} className="text-brand-blue shrink-0" />}
                    <span className="text-sm flex-1 line-clamp-1">{l.title}</span>
                    {milestone && <Star size={14} className="text-amber-400 shrink-0" fill="currentColor" title="نقطهٔ عطف" />}
                    {l.has_video && <Video size={14} className="text-fuchsia-400 shrink-0" />}
                    {l.tier === 'free' && <span className="text-[10px] text-brand-green shrink-0">رایگان</span>}
                  </Link>
                ));
              })}
            </div>
            )}
            </>
            )}
          </section>
        );
      })}
    </div>
  );
}

// نمای «نقشهٔ راه» — درس‌ها در قالبِ ماژول‌ها با نوارِ پیشرفتِ هر ماژول
function RoadmapView({ levelKey }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['roadmap', levelKey],
    queryFn: () => api.roadmap(levelKey),
  });

  if (isLoading) return <p className="text-text-muted text-center py-6 text-sm">در حال ساختِ نقشهٔ راه…</p>;
  if (isError || !data?.modules?.length) return <p className="text-text-muted text-center py-6 text-sm">نقشهٔ راهی برای این سطح موجود نیست.</p>;

  return (
    <div className="space-y-3 pr-1">
      {data.modules.map((mod) => {
        const pct = Math.round(100 * (mod.done || 0) / Math.max(1, mod.total || mod.lessons?.length || 1));
        const complete = pct >= 100;
        return (
          <div key={mod.index} className="card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-black ${complete ? 'bg-brand-green/15 text-brand-green' : 'bg-surface-border text-text-secondary'}`}>
                {complete ? <CheckCircle2 size={18} /> : mod.index}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-sm leading-tight">ماژول {mod.index} · {mod.title}</div>
                <div className="text-xs text-text-muted">{mod.done || 0} از {mod.total || mod.lessons?.length || 0} درس</div>
              </div>
              <span className={`text-xs font-bold shrink-0 ${complete ? 'text-brand-green' : 'text-text-muted'}`}>{pct}%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-border rounded-full overflow-hidden mb-3">
              <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="space-y-1.5">
              {(mod.lessons || []).map((l) => {
                const milestone = (l.order || 0) % 5 === 0 && (l.order || 0) > 0;
                return l.locked ? (
                  <Link to="/pricing" key={l.slug}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-surface-elevated transition group">
                    <Lock size={15} className="text-text-muted shrink-0 group-hover:text-amber-400" />
                    <span className="text-sm flex-1 line-clamp-1">{l.title}</span>
                    {milestone && <Star size={13} className="text-amber-400 shrink-0" fill="currentColor" />}
                  </Link>
                ) : (
                  <Link to={`/lesson/${l.slug}`} key={l.slug}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-surface-elevated transition">
                    {l.completed
                      ? <CheckCircle2 size={15} className="text-brand-green shrink-0" />
                      : <PlayCircle size={15} className="text-brand-blue shrink-0" />}
                    <span className="text-sm flex-1 line-clamp-1">{l.title}</span>
                    {milestone && <Star size={13} className="text-amber-400 shrink-0" fill="currentColor" title="نقطهٔ عطف" />}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// نمای «درختِ مهارت» — هر ماژول یک گرهٔ پیش‌نیازدار؛ سطح‌ها در ستون‌ها، گره‌ها با خطِ اتصال زنجیر می‌شوند
function SkillTreeView() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['skilltree'], queryFn: () => api.skillTree() });
  const [openNode, setOpenNode] = useState(null); // کلیدِ گرهٔ بازشده: `${level}:${index}`

  if (isLoading) return <p className="text-text-muted text-center py-10 text-sm">در حال ساختِ درختِ مهارت…</p>;
  if (isError || !data?.levels?.length) return <p className="text-text-muted text-center py-10 text-sm">درختِ مهارتی موجود نیست.</p>;

  const levels = data.levels;
  // پیشرفتِ کلی
  let allDone = 0, allTotal = 0;
  for (const lv of levels) for (const m of lv.modules) { allDone += (m.done || 0); allTotal += (m.total || m.lessons?.length || 0); }
  const overallPct = Math.round(100 * allDone / Math.max(1, allTotal));

  const toggleNode = (key) => setOpenNode((k) => (k === key ? null : key));

  return (
    <div>
      {/* پیشرفتِ کلیِ درخت */}
      <div className="card p-4 mb-5 rounded-2xl flex items-center gap-3 bg-gradient-to-l from-brand-green/10 to-transparent">
        <div className="w-10 h-10 rounded-xl bg-brand-green/15 text-brand-green flex items-center justify-center shrink-0"><GitBranch size={20} /></div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-sm">درختِ مهارتِ تو</div>
          <div className="w-full h-2 bg-surface-border rounded-full overflow-hidden mt-1.5">
            <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: `${overallPct}%` }} />
          </div>
        </div>
        <div className="text-left shrink-0">
          <div className="text-xl font-black text-brand-green">{overallPct}%</div>
          <div className="text-[11px] text-text-muted">{allDone} از {allTotal} درس</div>
        </div>
      </div>

      {/* ستون‌هایِ سطح؛ هر ستون زنجیرهٔ عمودیِ گره‌هایِ ماژول */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {levels.map((lv) => {
          const meta = LEVEL_META[lv.level] || LEVEL_META.beginner;
          const LIcon = meta.icon;
          const lvDone = lv.modules.reduce((a, m) => a + (m.done || 0), 0);
          const lvTotal = lv.modules.reduce((a, m) => a + (m.total || m.lessons?.length || 0), 0);
          return (
            <section key={lv.level} className="card p-3 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-9 h-9 rounded-xl ${meta.bg} ${meta.color} flex items-center justify-center shrink-0`}><LIcon size={18} /></div>
                <div className="min-w-0">
                  <div className="font-black text-sm leading-tight line-clamp-1">{lv.name}</div>
                  <div className="text-[11px] text-text-muted">{lvDone} از {lvTotal} درس</div>
                </div>
              </div>

              <div className="relative">
                {lv.modules.map((mod, i) => {
                  const total = mod.total || mod.lessons?.length || 0;
                  const done = mod.done || 0;
                  const completed = total > 0 && done === total;
                  const inProgress = done > 0 && done < total;
                  const locked = mod.unlocked === false;
                  const key = `${lv.level}:${mod.index}`;
                  const isOpen = openNode === key && !locked;
                  const pct = Math.round(100 * done / Math.max(1, total));
                  const last = i === lv.modules.length - 1;

                  // وضعیتِ ظاهریِ گره
                  let ring = 'border-surface-border';
                  let badge = <span className="text-[11px] font-bold text-text-muted">{mod.index}</span>;
                  let badgeBg = 'bg-surface-border text-text-secondary';
                  if (completed) { ring = 'border-brand-green/50'; badgeBg = 'bg-brand-green/15 text-brand-green'; badge = <CheckCircle2 size={16} />; }
                  else if (inProgress) { ring = 'border-brand-green/40 ring-1 ring-brand-green/30'; badgeBg = 'bg-brand-green/10 text-brand-green'; }
                  else if (locked) { ring = 'border-surface-border'; badgeBg = 'bg-surface-border text-text-muted'; badge = <Lock size={14} />; }
                  else { badge = <Circle size={14} className="text-text-muted" />; }

                  return (
                    <div key={mod.index} className="relative">
                      {/* خطِ اتصالِ پیش‌نیاز به ماژولِ بعد */}
                      {!last && (
                        <div className={`absolute right-[18px] top-9 bottom-0 w-0.5 ${completed ? 'bg-brand-green/50' : 'bg-surface-border'}`} aria-hidden />
                      )}
                      <div className="relative pb-3">
                        <button
                          type="button"
                          onClick={() => toggleNode(key)}
                          disabled={locked}
                          className={`w-full flex items-start gap-2.5 text-right rounded-xl border p-2.5 transition ${ring} ${locked ? 'opacity-60 cursor-not-allowed bg-surface-card' : 'bg-surface-card hover:border-brand-green/50'}`}>
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 ${badgeBg}`}>{badge}</div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className={`text-sm font-bold leading-tight line-clamp-2 ${locked ? 'text-text-muted' : ''}`}>{mod.title}</div>
                            {locked ? (
                              <div className="text-[11px] text-amber-400 mt-0.5 flex items-center gap-1">
                                <Lock size={11} /> نیاز: {mod.prereq || 'ماژولِ قبلی'}
                              </div>
                            ) : (
                              <div className="text-[11px] text-text-muted mt-0.5">
                                {completed ? <span className="text-brand-green">تکمیل‌شده ✓</span> : `${done} از ${total} درس`}
                              </div>
                            )}
                            {!locked && total > 0 && (
                              <div className="w-full h-1 bg-surface-border rounded-full overflow-hidden mt-1.5">
                                <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            )}
                          </div>
                          {!locked && (
                            <ChevronDown size={15} className={`text-text-muted shrink-0 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          )}
                        </button>

                        {/* درس‌هایِ گرهٔ بازشده */}
                        {isOpen && (
                          <div className="mt-1.5 mr-11 space-y-1">
                            {(mod.lessons || []).map((l) => (
                              l.locked ? (
                                <Link to="/subscribe" key={l.slug}
                                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-surface-elevated transition group">
                                  <Lock size={13} className="text-text-muted shrink-0 group-hover:text-amber-400" />
                                  <span className="text-[13px] flex-1 line-clamp-1">{l.title}</span>
                                </Link>
                              ) : (
                                <Link to={`/lesson/${l.slug}`} key={l.slug}
                                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-elevated transition">
                                  {l.completed
                                    ? <CheckCircle2 size={13} className="text-brand-green shrink-0" />
                                    : <MapPin size={13} className="text-brand-blue shrink-0" />}
                                  <span className="text-[13px] flex-1 line-clamp-1">{l.title}</span>
                                </Link>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
