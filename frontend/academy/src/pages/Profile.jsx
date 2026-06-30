import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { User, Crown, Zap, BookOpen, CheckCircle2, Bookmark, Trophy, NotebookPen, Award, Calendar, TrendingUp,
  Phone, MonitorSmartphone, Trash2, ShieldAlert, Loader2, Check } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton } from '../components/Guide';

const TIER_FA = { free: 'رایگان', vip: 'VIP', premium: 'پرمیوم' };

function AccountSecurity({ me }) {
  const qc = useQueryClient();
  const [phone, setPhone] = useState(me.phone_number || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const { data: devData } = useQuery({ queryKey: ['devices'], queryFn: () => api.devices() });

  const savePhone = async () => {
    setBusy(true); setMsg('');
    try { await api.updateProfile({ phone }); setMsg('ok'); qc.invalidateQueries({ queryKey: ['me'] }); }
    catch (e) { setMsg(e?.message || 'خطا'); } finally { setBusy(false); }
  };
  const removeDev = async (id) => {
    if (!confirm('این دستگاه از حساب خارج شود؟')) return;
    try { await api.removeDevice(id); qc.invalidateQueries({ queryKey: ['devices'] }); } catch (e) { alert(e?.message); }
  };

  return (
    <div className="card p-5 mb-5">
      <div className="font-bold text-sm mb-3 flex items-center gap-1.5"><Phone size={16} className="text-brand-green" /> شمارهٔ موبایل</div>
      {me.phone_required && (
        <div className="flex items-start gap-2 bg-brand-amber/10 text-brand-amber rounded-xl px-3 py-2.5 text-sm mb-3">
          <ShieldAlert size={16} className="shrink-0 mt-0.5" /> برای بازکردنِ سطح‌های حرفه‌ای، شمارهٔ موبایلت را وارد و ذخیره کن.
        </div>
      )}
      <div className="flex gap-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09123456789" dir="ltr"
          className="flex-1 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-green" />
        <button onClick={savePhone} disabled={busy} className="btn-success px-5 disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : 'ذخیره'}
        </button>
      </div>
      {msg === 'ok' && <p className="text-brand-green text-xs mt-2 flex items-center gap-1"><Check size={13} /> ذخیره شد.</p>}
      {msg && msg !== 'ok' && <p className="text-brand-red text-xs mt-2">{msg}</p>}

      <div className="font-bold text-sm mt-5 mb-2 flex items-center gap-1.5"><MonitorSmartphone size={16} className="text-brand-blue" /> دستگاه‌های فعال <span className="text-text-muted font-normal">({(devData?.devices || []).length}/{devData?.max || 2})</span></div>
      <div className="space-y-2">
        {(devData?.devices || []).map((d) => (
          <div key={d.id} className="flex items-center gap-3 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5">
            <MonitorSmartphone size={18} className="text-text-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{d.name || 'دستگاه'} {d.current && <span className="text-[10px] text-brand-green">(همین دستگاه)</span>}</div>
              <div className="text-[11px] text-text-muted">آخرین فعالیت: {d.last_seen ? new Date(d.last_seen).toLocaleString('fa-IR') : '—'}</div>
            </div>
            {!d.current && <button onClick={() => removeDev(d.id)} className="text-brand-red hover:bg-brand-red/10 rounded-lg p-2"><Trash2 size={16} /></button>}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-text-muted mt-2">هر حساب فقط روی {devData?.max || 2} دستگاه هم‌زمان فعال می‌ماند.</p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-3 text-center">
      <Icon size={18} className={`mx-auto mb-1 ${color}`} />
      <div className="font-black text-lg">{value}</div>
      <div className="text-[11px] text-text-muted">{label}</div>
    </div>
  );
}

export default function Profile() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.me() });
  const { data: cat } = useQuery({ queryKey: ['catalog'], queryFn: () => api.catalog() });
  const { data: js } = useQuery({ queryKey: ['journalStats'], queryFn: () => api.journalStats() });
  const [tab, setTab] = useState('done');

  let bookmarks = [];
  try { bookmarks = JSON.parse(localStorage.getItem('cp_bookmarks') || '[]'); } catch { /* */ }
  const completed = (cat?.levels || []).flatMap((lv) => lv.lessons.filter((l) => l.completed).map((l) => ({ ...l, levelName: lv.name })));

  if (!me) return <p className="text-text-secondary text-center py-10">در حال بارگذاری…</p>;

  return (
    <div className="max-w-3xl mx-auto">
      {/* کارتِ پروفایل */}
      <div className="card p-6 mb-5 bg-gradient-to-l from-brand-green/10 to-transparent">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-brand-green/15 text-brand-green flex items-center justify-center shrink-0">
            <User size={40} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <h1 className="text-xl font-black truncate flex-1">{me.full_name || me.username}</h1>
              <GuideButton guideKey="profile" auto className="shrink-0" />
            </div>
            <div className="text-sm text-text-muted font-mono" dir="ltr">@{me.username}</div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1 ${me.tier === 'free' ? 'bg-surface-elevated text-text-secondary' : 'bg-amber-400/15 text-amber-400'}`}>
                <Crown size={12} /> {TIER_FA[me.tier] || me.tier}
              </span>
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Calendar size={12} /> {me.expires_at ? `تا ${me.expires_at.slice(0, 10)}` : 'نامحدود'}
              </span>
            </div>
          </div>
        </div>
        {/* نوارِ پیشرفت */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1"><span className="text-text-muted">پیشرفتِ کلی</span><span className="text-brand-green font-black">{me.progress_pct || 0}%</span></div>
          <div className="w-full h-2.5 bg-surface-border rounded-full overflow-hidden"><div className="h-full bg-brand-green rounded-full" style={{ width: `${me.progress_pct || 0}%` }} /></div>
        </div>
      </div>

      {/* امنیتِ حساب: شماره موبایل + دستگاه‌ها */}
      <AccountSecurity me={me} />

      {/* آمار */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        <Stat icon={Zap} label="امتیاز" value={me.xp || 0} color="text-amber-400" />
        <Stat icon={CheckCircle2} label="درسِ تمام" value={`${me.completed}/${me.total_lessons}`} color="text-brand-green" />
        <Stat icon={Award} label="میانگینِ آزمون" value={me.avg_quiz != null ? me.avg_quiz + '٪' : '—'} color="text-brand-blue" />
        <Stat icon={Trophy} label="نشان‌ها" value={(me.badges || []).length} color="text-fuchsia-400" />
        <Stat icon={NotebookPen} label="معاملاتِ ژورنال" value={js?.total ?? 0} color="text-sky-400" />
        <Stat icon={TrendingUp} label="نرخِ برد" value={js?.win_rate != null ? js.win_rate + '٪' : '—'} color="text-emerald-400" />
      </div>

      {/* نشان‌ها */}
      {(me.badges || []).length > 0 && (
        <div className="card p-4 mb-5">
          <div className="font-bold text-sm mb-2 flex items-center gap-1.5"><Trophy size={16} className="text-amber-400" /> نشان‌های کسب‌شده</div>
          <div className="flex flex-wrap gap-2">
            {me.badges.map((b) => <span key={b} className="text-xs bg-amber-400/10 text-amber-400 border border-amber-400/30 rounded-full px-3 py-1.5">{b}</span>)}
          </div>
        </div>
      )}

      {/* پیشرفتِ هر سطح */}
      {me.by_level && (
        <div className="card p-4 mb-5">
          <div className="font-bold text-sm mb-3">پیشرفتِ سطوح</div>
          <div className="space-y-3">
            {Object.entries(me.by_level).map(([k, lv]) => (
              <div key={k}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1">{lv.name} {lv.mastered && <span className="text-amber-400">🏅</span>}</span>
                  <span className="text-text-muted">{lv.done}/{lv.total}</span>
                </div>
                <div className="w-full h-2 bg-surface-border rounded-full overflow-hidden"><div className="h-full bg-brand-green rounded-full" style={{ width: `${Math.round(100 * lv.done / Math.max(1, lv.total))}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* تب‌ها: تکمیل‌شده / نشان‌شده */}
      <div className="flex gap-2 mb-3 border-b border-surface-border">
        <button onClick={() => setTab('done')} className={`px-4 py-2 text-sm font-bold -mb-px border-b-2 ${tab === 'done' ? 'border-brand-green text-text-primary' : 'border-transparent text-text-muted'}`}>تکمیل‌شده ({completed.length})</button>
        <button onClick={() => setTab('saved')} className={`px-4 py-2 text-sm font-bold -mb-px border-b-2 ${tab === 'saved' ? 'border-brand-green text-text-primary' : 'border-transparent text-text-muted'}`}>نشان‌شده ({bookmarks.length})</button>
      </div>

      {tab === 'done' ? (
        completed.length === 0 ? <p className="text-text-muted text-center py-6 text-sm">هنوز درسی را کامل نکرده‌ای.</p>
          : <div className="grid sm:grid-cols-2 gap-2">{completed.map((l) => (
              <Link key={l.slug} to={`/lesson/${l.slug}`} className="card p-3 flex items-center gap-2 hover:ring-1 hover:ring-brand-green/40">
                <CheckCircle2 size={16} className="text-brand-green shrink-0" />
                <span className="text-sm flex-1 line-clamp-1">{l.title}</span>
                <span className="text-[10px] text-text-muted">{l.levelName}</span>
              </Link>))}</div>
      ) : (
        bookmarks.length === 0 ? <p className="text-text-muted text-center py-6 text-sm">درسی نشان‌گذاری نکرده‌ای. در صفحهٔ هر درس دکمهٔ «نشان‌گذاری» را بزن.</p>
          : <div className="grid sm:grid-cols-2 gap-2">{bookmarks.map((b) => (
              <Link key={b.slug} to={`/lesson/${b.slug}`} className="card p-3 flex items-center gap-2 hover:ring-1 hover:ring-amber-400/40">
                <Bookmark size={16} className="text-amber-400 shrink-0" fill="currentColor" />
                <span className="text-sm flex-1 line-clamp-1">{b.title}</span>
              </Link>))}</div>
      )}
    </div>
  );
}
