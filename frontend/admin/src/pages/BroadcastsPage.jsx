import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone, Send, Users, CheckCircle2, XCircle, Clock, Plus, X, Loader2,
  Image as ImageIcon, Calendar, Target, FileText, Activity, Inbox, Sparkles,
} from 'lucide-react';
import { broadcastsAPI } from '../api/client';
import { useNotificationStore } from '../store';

const card = 'rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur';

const PLANS = [
  { code: 'all', label: 'همه کاربران' },
  { code: 'free', label: 'رایگان' },
  { code: 'gift_trial', label: 'هدیه (تریال)' },
];
const planLabel = (code) => PLANS.find((p) => p.code === code)?.label || code || 'همه کاربران';

const STATUS = {
  draft: { text: 'پیش‌نویس', color: '#94a3b8', bg: 'bg-white/10', fg: 'text-white/60', icon: FileText },
  scheduled: { text: 'زمان‌بندی', color: '#f59e0b', bg: 'bg-amber-500/15', fg: 'text-amber-300', icon: Calendar },
  sending: { text: 'در حال ارسال', color: '#3b82f6', bg: 'bg-blue-500/15', fg: 'text-blue-300', icon: Activity, pulse: true },
  sent: { text: 'ارسال‌شده', color: '#10b981', bg: 'bg-emerald-500/15', fg: 'text-emerald-300', icon: CheckCircle2 },
};
const statusMeta = (s) => STATUS[s] || STATUS.draft;

const FILTERS = [
  { key: 'all', label: 'همه' },
  { key: 'draft', label: 'پیش‌نویس' },
  { key: 'scheduled', label: 'زمان‌بندی' },
  { key: 'sending', label: 'در حال ارسال' },
  { key: 'sent', label: 'ارسال‌شده' },
];

const faNum = (n) => (n ?? 0).toLocaleString('fa-IR');
const fa = (d) => (d ? new Date(d).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function StatCard({ icon: Icon, label, value, color, sub, big }) {
  return (
    <div className={`${card} p-4 ${big ? 'ring-1 ring-purple-500/30' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: color + '22', color }}>
          <Icon size={19} />
        </div>
        <div className="min-w-0">
          <div className={`font-black text-white leading-tight ${big ? 'text-3xl' : 'text-2xl'}`}>{value}</div>
          <div className="text-xs text-white/50 truncate">{label}</div>
          {sub && <div className="text-[11px] mt-0.5" style={{ color }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ delivered, failed, total, color = '#10b981' }) {
  const denom = total > 0 ? total : 1;
  const dPct = Math.min(100, (delivered / denom) * 100);
  const fPct = Math.min(100 - dPct, (failed / denom) * 100);
  return (
    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden flex">
      <div className="h-full transition-all duration-500" style={{ width: `${dPct}%`, background: color }} />
      <div className="h-full transition-all duration-500" style={{ width: `${fPct}%`, background: '#f43f5e' }} />
    </div>
  );
}

function ComposeModal({ audience, onClose, onCreated }) {
  const notify = useNotificationStore();
  const [f, setF] = useState({ title: '', message: '', target_plan: 'all', media_url: '', scheduled_at: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const charCount = f.message.length;

  const submit = async () => {
    if (!f.message.trim()) return;
    setBusy(true);
    try {
      await broadcastsAPI.create({
        title: f.title || null,
        message: f.message,
        target_plan: f.target_plan,
        message_type: f.media_url ? 'photo' : 'text',
        media_url: f.media_url || null,
        scheduled_at: f.scheduled_at || null,
      });
      notify.success('پیام ساخته شد');
      onCreated();
    } catch (e) {
      notify.error(e.response?.data?.detail || 'خطا در ساخت پیام');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative ${card} w-full max-w-lg max-h-[92vh] overflow-y-auto`} style={{ background: '#13161f' }} dir="rtl">
        <div className="p-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#13161f] z-10">
          <h3 className="font-black text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl grid place-items-center text-white bg-gradient-to-l from-purple-600 to-pink-500"><Megaphone size={16} /></span>
            پیام جدید
          </h3>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-gradient-to-l from-purple-600/15 to-pink-500/15 border border-purple-500/20 px-4 py-3 flex items-center gap-3">
            <Target size={18} className="text-pink-300 shrink-0" />
            <div className="text-sm text-white/80">
              مخاطبینِ واجدِ شرایط: <span className="font-black text-white">{faNum(audience)}</span> کاربر
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-white/60 mb-1 block">عنوان (اختیاری)</label>
            <input className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm"
              value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="عنوانِ داخلیِ پیام" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-white/60">متنِ پیام</label>
              <span className={`text-[11px] ${charCount > 4096 ? 'text-red-400' : 'text-white/40'}`}>{faNum(charCount)} / {faNum(4096)}</span>
            </div>
            <textarea rows={6} maxLength={4096}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm resize-none leading-7"
              value={f.message} onChange={(e) => set('message', e.target.value)} placeholder="متنِ پیامِ همگانی را بنویسید…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-white/60 mb-1 block">مخاطب</label>
              <select className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm"
                value={f.target_plan} onChange={(e) => set('target_plan', e.target.value)}>
                {PLANS.map((p) => <option key={p.code} value={p.code} className="bg-[#13161f]">{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-white/60 mb-1 block">زمان‌بندی (اختیاری)</label>
              <input type="datetime-local"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm"
                value={f.scheduled_at} onChange={(e) => set('scheduled_at', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-white/60 mb-1 block flex items-center gap-1.5"><ImageIcon size={13} /> رسانه (آدرسِ تصویر، اختیاری)</label>
            <input className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm" dir="ltr"
              value={f.media_url} onChange={(e) => set('media_url', e.target.value)} placeholder="https://…" />
          </div>
        </div>

        <div className="p-5 border-t border-white/10 sticky bottom-0 bg-[#13161f]">
          <button onClick={submit} disabled={busy || !f.message.trim() || charCount > 4096}
            className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-l from-purple-600 to-pink-500 disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
            {f.scheduled_at ? 'ساخت و زمان‌بندی' : 'ساختِ پیش‌نویس'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BroadcastCard({ bc, onSend, sending }) {
  const meta = statusMeta(bc.status);
  const Icon = meta.icon;
  const showProgress = bc.status === 'sending' || bc.status === 'sent';
  const total = bc.total_recipients || 0;
  const pct = total > 0 ? Math.round(((bc.delivered + bc.failed) / total) * 100) : 0;

  return (
    <div className={`${card} p-4 transition hover:border-white/20`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold ${meta.bg} ${meta.fg} ${meta.pulse ? 'animate-pulse' : ''}`}>
              <Icon size={11} /> {meta.text}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 font-bold">
              <Users size={11} /> {planLabel(bc.target_plan)}
            </span>
            {bc.message_type === 'photo' && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 font-bold">
                <ImageIcon size={11} /> تصویر
              </span>
            )}
          </div>
          {bc.title && <div className="font-black text-white truncate">{bc.title}</div>}
          <p className="text-sm text-white/60 leading-6 line-clamp-2 mt-0.5">{bc.message}</p>
        </div>

        {(bc.status === 'draft' || bc.status === 'scheduled') && (
          <button onClick={() => onSend(bc)} disabled={sending}
            className="shrink-0 px-3.5 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-l from-purple-600 to-pink-500 disabled:opacity-50 flex items-center gap-1.5">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} ارسال
          </button>
        )}
      </div>

      {showProgress && (
        <div className="mt-3 space-y-1.5">
          <ProgressBar delivered={bc.delivered} failed={bc.failed} total={total} color={meta.color} />
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/50">
              <span className="text-emerald-300 font-bold">{faNum(bc.delivered)}</span> تحویل /
              <span className="text-rose-300 font-bold"> {faNum(bc.failed)}</span> ناموفق /
              <span className="text-white/70 font-bold"> {faNum(total)}</span> کل
            </span>
            <span className="text-white/40 font-bold">{faNum(pct)}٪</span>
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
        <span className="flex items-center gap-1"><Clock size={11} /> ساخت: {fa(bc.created_at)}</span>
        {bc.sent_at
          ? <span className="flex items-center gap-1 text-emerald-300/70"><CheckCircle2 size={11} /> ارسال: {fa(bc.sent_at)}</span>
          : bc.scheduled_at
            ? <span className="flex items-center gap-1 text-amber-300/70"><Calendar size={11} /> زمان: {fa(bc.scheduled_at)}</span>
            : null}
      </div>
    </div>
  );
}

export default function BroadcastsPage() {
  const notify = useNotificationStore();
  const [overview, setOverview] = useState(null);
  const [items, setItems] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [compose, setCompose] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const pollRef = useRef({});

  const loadOverview = async () => {
    try { setOverview((await broadcastsAPI.overview()).data); } catch { /* */ }
  };
  const loadList = async () => {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (filter !== 'all') params.status = filter;
      const d = (await broadcastsAPI.getAll(params)).data;
      setItems(d.items || []);
      setTotalPages(d.total_pages || 1);
    } catch { setItems([]); } finally { setLoading(false); }
  };

  useEffect(() => { loadOverview(); }, []);
  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, [page, filter]);

  // resume polling for any broadcast already "sending"
  useEffect(() => {
    items.forEach((b) => { if (b.status === 'sending' && !pollRef.current[b.id]) startPoll(b.id); });
    return () => { Object.values(pollRef.current).forEach((t) => clearInterval(t)); pollRef.current = {}; };
    // eslint-disable-next-line
  }, [items]);

  const startPoll = (id) => {
    if (pollRef.current[id]) return;
    pollRef.current[id] = setInterval(async () => {
      try {
        const s = (await broadcastsAPI.status(id)).data;
        setItems((prev) => prev.map((b) => b.id === id ? {
          ...b, status: s.status, delivered: s.delivered, failed: s.failed,
          total_recipients: s.total_recipients, sent_at: s.sent_at || b.sent_at,
        } : b));
        if (s.status !== 'sending') {
          clearInterval(pollRef.current[id]); delete pollRef.current[id];
          loadOverview();
        }
      } catch { /* keep polling */ }
    }, 3000);
  };

  const handleSend = async (bc) => {
    if (!window.confirm(`ارسالِ این پیام به مخاطبینِ «${planLabel(bc.target_plan)}»؟`)) return;
    setSendingId(bc.id);
    try {
      await broadcastsAPI.send(bc.id);
      notify.success('ارسالِ پیام آغاز شد');
      setItems((prev) => prev.map((b) => b.id === bc.id ? { ...b, status: 'sending' } : b));
      startPoll(bc.id);
      loadOverview();
    } catch (e) {
      notify.error(e.response?.data?.detail || 'خطا در ارسال');
    } finally {
      setSendingId(null);
    }
  };

  const ov = overview || {};

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto" dir="rtl">
      {/* header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl grid place-items-center text-white bg-gradient-to-l from-purple-600 to-pink-500"><Megaphone size={22} /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">پیام‌ها</h1>
            <p className="text-sm text-white/50">ارسالِ همگانی، آمارِ زندهٔ تحویل و کنترلِ کاملِ پیام‌ها</p>
          </div>
        </div>
        <button onClick={() => setCompose(true)}
          className="px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-l from-purple-600 to-pink-500 flex items-center gap-2">
          <Plus size={17} /> پیام جدید
        </button>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        <StatCard icon={Target} label="مخاطبینِ واجدِ شرایط" value={faNum(ov.audience)} sub="هدفِ ارسالِ بعدی" color="#ec4899" big />
        <StatCard icon={Megaphone} label="کل پیام‌ها" value={faNum(ov.total_broadcasts)}
          sub={`${faNum(ov.drafts)} پیش‌نویس · ${faNum(ov.scheduled)} زمان‌بندی`} color="#a855f7" />
        <StatCard icon={Send} label="ارسال‌شده" value={faNum(ov.sent)}
          sub={ov.sending ? `${faNum(ov.sending)} در حال ارسال` : null} color="#3b82f6" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <StatCard icon={Activity} label="نرخِ تحویل" value={`${faNum(ov.delivered_pct ?? 0)}٪`} color="#10b981" />
        <StatCard icon={CheckCircle2} label="کلِ تحویل‌شده" value={faNum(ov.total_delivered)}
          sub={`از ${faNum(ov.total_reach)} گیرنده`} color="#22c55e" />
        <StatCard icon={XCircle} label="ناموفق" value={faNum(ov.total_failed)}
          sub={`${faNum(ov.failed_pct ?? 0)}٪`} color="#f43f5e" />
      </div>

      {/* filter tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {FILTERS.map((t) => (
          <button key={t.key} onClick={() => { setFilter(t.key); setPage(1); }}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${filter === t.key ? 'bg-gradient-to-l from-purple-600 to-pink-500 text-white' : 'text-white/50 hover:bg-white/5 bg-white/[0.03]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* list */}
      {loading ? (
        <div className="text-center text-white/40 py-12"><Loader2 className="animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className={`${card} p-12 text-center`}>
          <Inbox size={36} className="mx-auto text-white/20 mb-3" />
          <div className="text-white/50 font-bold">پیامی یافت نشد</div>
          <div className="text-white/30 text-sm mt-1">با دکمهٔ «پیام جدید» اولین پیامِ همگانی را بسازید.</div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {items.map((bc) => (
            <BroadcastCard key={bc.id} bc={bc} onSend={handleSend} sending={sendingId === bc.id} />
          ))}
        </div>
      )}

      {/* pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white/70 bg-white/5 hover:bg-white/10 disabled:opacity-30">قبلی</button>
          <span className="text-sm text-white/50">صفحه {faNum(page)} از {faNum(totalPages)}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white/70 bg-white/5 hover:bg-white/10 disabled:opacity-30">بعدی</button>
        </div>
      )}

      {compose && (
        <ComposeModal audience={ov.audience} onClose={() => setCompose(false)}
          onCreated={() => { setCompose(false); loadList(); loadOverview(); }} />
      )}
    </div>
  );
}
