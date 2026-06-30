import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Circle, Flame, Target, Trophy } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton } from '../components/Guide';

export default function Bootcamp() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['bootcampMy'], queryFn: () => api.bootcampMy() });
  const enrolled = !!data?.enrolled;
  const { data: today } = useQuery({ queryKey: ['bootcampToday'], queryFn: () => api.bootcampToday(), enabled: enrolled });
  const { data: board } = useQuery({ queryKey: ['bootcampLeaderboard'], queryFn: () => api.bootcampLeaderboard(), enabled: enrolled });
  const enroll = async (id) => { try { await api.bootcampEnroll(id); qc.invalidateQueries({ queryKey: ['bootcampMy'] }); } catch (e) { alert(e?.message); } };

  if (isLoading) return <p className="text-text-secondary text-center py-10">در حال بارگذاری…</p>;

  if (!data?.enrolled) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-2"><CalendarClock className="text-brand-green" /><h1 className="text-lg sm:text-xl font-black">بوت‌کمپِ زمان‌دار</h1></div>
          <GuideButton guideKey="bootcamp" auto />
        </div>
        <p className="text-xs text-text-muted mb-4 leading-6">یک برنامهٔ ساختاریافته با **ددلاینِ هفتگی** انتخاب کن تا منظم و پاسخگو پیش بروی.</p>
        <div className="space-y-3">
          {(data?.bootcamps || []).map((b) => (
            <div key={b.id} className="card p-4">
              <div className="font-black">{b.name}</div>
              <p className="text-sm text-text-secondary mt-1">{b.desc}</p>
              <button onClick={() => enroll(b.id)} className="btn-success mt-3 text-sm">ثبت‌نام در این بوت‌کمپ</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h1 className="text-lg sm:text-xl font-black flex items-center gap-2"><CalendarClock className="text-brand-green" /> {data.name}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs bg-brand-green/15 text-brand-green rounded-full px-3 py-1 flex items-center gap-1"><Flame size={13} /> هفتهٔ {data.current_week} از {data.total_weeks}</span>
          <GuideButton guideKey="bootcamp" auto />
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between text-sm mb-1"><span className="text-text-muted">روی برنامه‌ای؟</span><span className={`font-black ${data.on_track_pct >= 80 ? 'text-brand-green' : data.on_track_pct >= 50 ? 'text-amber-400' : 'text-brand-red'}`}>{data.on_track_pct}٪</span></div>
        <div className="w-full h-2.5 bg-surface-border rounded-full overflow-hidden"><div className="h-full bg-brand-green rounded-full" style={{ width: `${data.on_track_pct}%` }} /></div>
      </div>

      {/* مأموریت‌های امروز */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="font-black text-sm flex items-center gap-1.5"><Target size={16} className="text-brand-green" /> مأموریت‌های امروز</span>
          {today?.week != null && <span className="text-xs bg-brand-green/15 text-brand-green rounded-full px-3 py-1">هفتهٔ {today.week}</span>}
        </div>
        {today?.items?.length ? (
          <div className="space-y-1.5">
            {today.items.map((l) => (
              <Link key={l.slug} to={`/lesson/${l.slug}`} className="flex items-center gap-2 text-sm text-text-secondary hover:text-brand-green group">
                <Circle size={15} className="text-amber-400 shrink-0 group-hover:text-brand-green" />
                <span className="line-clamp-1 flex-1">{l.title}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted text-center py-2">همهٔ درس‌های این هفته را تمام کردی! 🎉</p>
        )}
      </div>

      {/* جدولِ امتیازات */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="font-black text-sm flex items-center gap-1.5"><Trophy size={16} className="text-amber-400" /> جدولِ امتیازات</span>
          {board?.my_rank != null && <span className="text-xs bg-brand-green/15 text-brand-green rounded-full px-3 py-1">رتبهٔ شما: {board.my_rank}</span>}
        </div>
        {board?.items?.length ? (
          <div className="space-y-1.5">
            {board.items.map((u) => (
              <div key={u.rank} className={`flex items-center gap-3 text-sm rounded-xl px-3 py-2 ${u.is_me ? 'bg-brand-green/10 ring-1 ring-brand-green/40' : ''}`}>
                <span className={`font-black w-6 text-center shrink-0 ${u.rank <= 3 ? 'text-amber-400' : 'text-text-muted'}`}>{u.rank}</span>
                <span className={`flex-1 line-clamp-1 ${u.is_me ? 'text-brand-green font-bold' : 'text-text-secondary'}`}>{u.username}{u.is_me && ' (تو)'}</span>
                <span className="text-xs text-text-muted shrink-0">{u.done} درس</span>
                <span className="text-xs font-black text-brand-green shrink-0">{u.xp} XP</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted text-center py-2">هنوز امتیازی ثبت نشده — اولین نفر باش!</p>
        )}
      </div>

      <div className="space-y-3">
        {data.weeks.map((w) => (
          <div key={w.week} className={`card p-4 ${w.current ? 'ring-1 ring-brand-green/50' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">هفتهٔ {w.week} {w.current && <span className="text-brand-green text-xs">· این هفته</span>}{!w.due && <span className="text-text-muted text-xs">· آینده</span>}</span>
              <span className="text-xs text-text-muted">{w.done}/{w.total}</span>
            </div>
            <div className="space-y-1.5">
              {w.lessons.map((l) => (
                <Link key={l.slug} to={`/lesson/${l.slug}`} className="flex items-center gap-2 text-sm text-text-secondary hover:text-brand-green">
                  {l.done ? <CheckCircle2 size={15} className="text-brand-green shrink-0" /> : <Circle size={15} className="text-text-muted shrink-0" />}
                  <span className="line-clamp-1">{l.title}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
