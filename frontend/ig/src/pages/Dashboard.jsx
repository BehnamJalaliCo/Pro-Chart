import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, Send, MessageCircle, MessageSquareReply, CheckCircle2, Clock,
  FileEdit, Users, Wifi, Plane, Sparkles, Image as ImageIcon, Bot, ArrowLeft,
  Activity, AtSign,
} from 'lucide-react';
import { api } from '../api/client';
import { PageHeader, StatCard, Skeleton, Tag } from '../components/ui';

// ─────────── کمکی: نامِ کوتاه و حروفِ اول برای آواتارِ یدکی ───────────
const initials = (s = '') => (s.replace('@', '').slice(0, 2) || '?').toUpperCase();
const faDate = (iso) => { try { return iso ? new Date(iso).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) : ''; } catch { return ''; } };

// ─────────── آواتارِ اکانت (با fallback) ───────────
function Avatar({ src, name, size = 44, online }) {
  const [err, setErr] = React.useState(false);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src && !err ? (
        <img src={src} alt={name} onError={() => setErr(true)}
          className="w-full h-full rounded-2xl object-cover border border-slate-100" style={{ width: size, height: size }} />
      ) : (
        <div className="w-full h-full rounded-2xl bg-brand-grad text-white grid place-items-center font-black"
          style={{ width: size, height: size, fontSize: size * 0.34 }}>{initials(name)}</div>
      )}
      {online != null && (
        <span className={`absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      )}
    </div>
  );
}

// ─────────── نمودارِ میله‌ایِ ساده (بدونِ کتابخانه) ───────────
function MiniBars({ series, color = '#6d28d9' }) {
  const max = Math.max(1, ...series.map((d) => d.value || 0));
  return (
    <div className="flex items-end gap-1.5 h-24" dir="ltr">
      {series.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
          <div className="w-full rounded-t-md transition-all" title={`${d.label}: ${d.value}`}
            style={{ height: `${Math.max(6, ((d.value || 0) / max) * 100)}%`, background: color, opacity: 0.35 + 0.65 * ((d.value || 0) / max) }} />
          <span className="text-[10px] text-ink-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

const QUICK = [
  { to: '/content', label: 'تولیدِ محتوا', icon: Sparkles, color: '#6d28d9' },
  { to: '/cover', label: 'طراحیِ کاور', icon: ImageIcon, color: '#e1306c' },
  { to: '/autopilot', label: 'خلبانِ خودکار', icon: Plane, color: '#2563eb' },
  { to: '/smart', label: 'پاسخِ هوشمند', icon: Bot, color: '#10b981' },
];

const KIND_LABEL = (k) => (k === 'direct' ? 'دایرکت' : 'کامنت');

export default function Dashboard() {
  const dashQ = useQuery({ queryKey: ['ig-dash'], queryFn: api.dashboard });
  const accQ = useQuery({ queryKey: ['ig-accounts'], queryFn: api.accounts });
  const apQ = useQuery({ queryKey: ['ig-autopilots'], queryFn: api.autopilots });

  const d = dashQ.data || {};
  const sr = d.smart_reply || {};
  const ct = d.content || {};
  const accounts = Array.isArray(accQ.data) ? accQ.data : [];
  const autopilots = Array.isArray(apQ.data) ? apQ.data : [];

  const onlineCount = accounts.filter((a) => a?.status === 'online' || a?.is_active).length;
  const autopilotsOn = autopilots.filter((a) => a?.enabled).length;
  const recent = Array.isArray(d.recent_messages) ? d.recent_messages : [];

  // سریِ زمانیِ ۷ روزه اگر بک‌اند بدهد (هر یک از این کلیدها)، وگرنه حذفِ آرام
  const ts = d.timeseries || d.series || d.trend || d.daily || null;
  const dmSeries = Array.isArray(ts)
    ? ts.map((p) => ({ label: p.label || p.day || p.date || '', value: p.dm ?? p.dm_sent ?? p.value ?? 0 }))
    : null;
  const cmSeries = Array.isArray(ts)
    ? ts.map((p) => ({ label: p.label || p.day || p.date || '', value: p.comment ?? p.comment_sent ?? 0 }))
    : null;

  const loading = dashQ.isLoading;

  return (
    <div>
      <PageHeader title="پیشخوان" sub="نمای کلیِ فعالیتِ ۷ روزِ اخیر" icon={LayoutDashboard} />

      {/* ── کارت‌های آماری ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[76px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="اکانت‌های شما" value={d.accounts ?? accounts.length ?? 0} color="#6d28d9" />
          <StatCard icon={Wifi} label="آنلاین" value={onlineCount} color="#10b981" />
          <StatCard icon={CheckCircle2} label="پستِ منتشرشده" value={ct.published ?? 0} color="#059669" />
          <StatCard icon={Clock} label="زمان‌بندی‌شده" value={ct.scheduled ?? 0} color="#2563eb" />
          <StatCard icon={Send} label="دایرکتِ ارسالی" value={sr.dm_sent ?? 0} color="#7c3aed" />
          <StatCard icon={MessageCircle} label="پاسخِ کامنت" value={sr.comment_sent ?? 0} color="#e1306c" />
          <StatCard icon={MessageSquareReply} label="دستورِ فعال" value={sr.active_rules ?? 0} color="#f56040" />
          <StatCard icon={Plane} label="خلبانِ روشن" value={autopilotsOn} color="#0891b2" />
        </div>
      )}

      {/* ── دسترسیِ سریع ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {QUICK.map((q) => (
          <Link key={q.to} to={q.to}
            className="card p-4 flex items-center gap-3 hover:shadow-card transition group">
            <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: q.color + '18', color: q.color }}>
              <q.icon size={19} />
            </div>
            <span className="font-bold text-ink text-sm flex-1">{q.label}</span>
            <ArrowLeft size={16} className="text-ink-muted group-hover:-translate-x-0.5 transition" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        {/* ── اکانت‌ها ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-black text-ink flex items-center gap-2"><Users size={17} className="text-brand" /> اکانت‌ها</div>
              <Link to="/accounts" className="text-xs font-bold text-brand hover:underline">مدیریت</Link>
            </div>
            {accQ.isLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : accounts.length === 0 ? (
              <div className="text-sm text-ink-muted py-6 text-center">
                هنوز اکانتی اضافه نکرده‌اید.{' '}
                <Link to="/accounts" className="text-brand font-bold hover:underline">افزودنِ اکانت</Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {accounts.map((a) => {
                  const online = a?.status === 'online' || a?.is_active;
                  return (
                    <div key={a.id} className="rounded-2xl border border-slate-100 bg-white/60 p-3.5 flex items-center gap-3">
                      <Avatar src={a.avatar_url} name={a.username} online={online} />
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-ink text-sm truncate">@{a.username || '—'}</div>
                        <div className="text-[11px] text-ink-muted truncate">{a.full_name || (online ? 'آنلاین' : 'آفلاین')}</div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {a.smart_enabled && <Tag color="green">هوشمند</Tag>}
                          {!a.has_creds && <Tag color="red">بدونِ رمز</Tag>}
                          {a.last_error ? <Tag color="amber">خطا</Tag> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── نمودارِ ۷ روزه (تنها اگر داده باشد) ── */}
          {dmSeries && dmSeries.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="card p-5">
                <div className="font-black text-ink text-sm mb-3 flex items-center gap-2"><Send size={15} className="text-brand" /> دایرکتِ ۷ روز</div>
                <MiniBars series={dmSeries} color="#6d28d9" />
              </div>
              <div className="card p-5">
                <div className="font-black text-ink text-sm mb-3 flex items-center gap-2"><MessageCircle size={15} className="text-accent-pink" /> کامنتِ ۷ روز</div>
                <MiniBars series={cmSeries} color="#e1306c" />
              </div>
            </div>
          )}
        </div>

        {/* ── فعالیتِ اخیر ── */}
        <div className="card p-5">
          <div className="font-black text-ink mb-4 flex items-center gap-2"><Activity size={17} className="text-brand" /> فعالیتِ اخیر</div>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : recent.length === 0 ? (
            <div className="text-sm text-ink-muted py-8 text-center">هنوز پیامی نیست.</div>
          ) : (
            <div className="space-y-3">
              {recent.map((m, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 grid place-items-center text-ink-muted shrink-0">
                    {m.kind === 'direct' ? <Send size={15} /> : <MessageCircle size={15} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink text-sm truncate flex items-center gap-0.5"><AtSign size={12} className="text-ink-muted" />{(m.from || '—').replace('@', '')}</span>
                      <span className={`chip ${m.kind === 'direct' ? 'bg-brand-50 text-brand' : 'bg-pink-50 text-accent-pink'}`}>{KIND_LABEL(m.kind)}</span>
                    </div>
                    <div className="text-xs text-ink-muted truncate mt-0.5">{m.text || '—'}</div>
                    <div className="text-[10px] text-ink-muted/70 mt-0.5">{faDate(m.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
