import { useEffect, useState, useCallback } from 'react';
import {
  Instagram, LayoutDashboard, Users, MessageSquareText, FileText, Mail,
  MessagesSquare, RefreshCw, CheckCircle2, AlertTriangle, Eye, Send, Bot, FormInput, Plus, Wand2,
} from 'lucide-react';
import { instagramAPI } from '../api/client';
import SmartReply from './instagram/SmartReply';
import FormBuilder from './instagram/FormBuilder';
import StaticMenu from './instagram/StaticMenu';
import Inbox from './instagram/Inbox';
import ContentPublish from './instagram/ContentPublish';
import CoverMaker from './instagram/CoverMaker';

const TABS = [
  { k: 'dashboard', label: 'پیشخوان', icon: LayoutDashboard },
  { k: 'accounts', label: 'اکانت‌ها', icon: Users },
  { k: 'smart', label: 'پاسخ هوشمند', icon: MessageSquareText },
  { k: 'content', label: 'محتواها', icon: FileText },
  { k: 'cover', label: 'ساخت کاور', icon: Wand2 },
  { k: 'messages', label: 'پیام‌ها', icon: Mail },
  { k: 'comments', label: 'نظرات', icon: MessagesSquare },
];

function Stat({ label, value, accent = 'text-sky-400' }) {
  return (
    <div className="bg-slate-800/40 rounded-xl p-4 text-center">
      <div className={`text-2xl font-black ${accent}`}>{value ?? 0}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
}

function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { instagramAPI.dashboard().then(setD).catch((e) => setErr(e?.response?.data?.detail || 'خطا')); }, []);
  if (err) return <div className="text-rose-400 text-sm">{err}</div>;
  if (!d) return <div className="text-slate-400 text-sm">در حال بارگذاری…</div>;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Bot size={16} className="text-sky-400" /> آمارِ پاسخِ هوشمند <span className="text-xs text-slate-500">(۷ روزِ گذشته)</span></h3>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="دایرکتِ خودکار" value={d.smart_reply.dm_sent} />
          <Stat label="کامنتِ خودکار" value={d.smart_reply.comment_sent} accent="text-emerald-400" />
          <Stat label="قواعدِ فعال" value={d.smart_reply.active_rules} accent="text-amber-400" />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><FileText size={16} className="text-sky-400" /> آمارِ انتشارِ محتوا</h3>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="منتشرشده" value={d.content.published} accent="text-emerald-400" />
          <Stat label="زمان‌بندی‌شده" value={d.content.scheduled} accent="text-sky-400" />
          <Stat label="پیش‌نویس" value={d.content.drafts} accent="text-slate-300" />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Mail size={16} className="text-sky-400" /> آخرین پیام‌ها</h3>
        {d.recent_messages.length === 0
          ? <div className="text-slate-500 text-sm bg-slate-800/40 rounded-xl p-4">پیامی نیست.</div>
          : <div className="space-y-2">{d.recent_messages.map((m, i) => (
              <div key={i} className="bg-slate-800/40 rounded-lg p-3 flex items-center justify-between">
                <div className="text-sm"><span className="text-slate-300">@{m.from || '—'}</span> <span className="text-slate-500">· {m.kind === 'direct' ? 'دایرکت' : 'کامنت'}</span><div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{m.text}</div></div>
              </div>))}</div>}
      </div>
    </div>
  );
}

function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    instagramAPI.accounts().then(setAccounts).catch(() => setAccounts([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setSyncing(true); setMsg('');
    try { await instagramAPI.syncAccounts(); setMsg('وضعیت به‌روزرسانی شد ✓'); load(); }
    catch (e) { setMsg(e?.response?.data?.detail || 'اتصال ناموفق'); }
    finally { setSyncing(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-400">{accounts.length} اکانتِ متصل</span>
        <button onClick={sync} disabled={syncing} className="flex items-center gap-1.5 text-sm bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg px-3 py-2">
          <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} /> همگام‌سازی وضعیت
        </button>
      </div>
      {msg && <div className="text-xs text-slate-300 mb-3">{msg}</div>}
      {loading ? <div className="text-slate-400 text-sm">در حال بارگذاری…</div> : (
        <div className="grid sm:grid-cols-2 gap-3">
          {accounts.map((a) => (
            <div key={a.id} className="bg-slate-800/40 rounded-xl p-4 flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-700 shrink-0 ring-2 ring-pink-500/40">
                {a.avatar_url ? <img src={a.avatar_url} alt="" className="w-full h-full object-cover" /> : <Instagram className="w-full h-full p-3 text-pink-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">{a.username}
                  {a.status === 'online'
                    ? <span className="flex items-center gap-1 text-[11px] text-emerald-400"><CheckCircle2 size={12} /> آنلاین</span>
                    : <span className="flex items-center gap-1 text-[11px] text-rose-400"><AlertTriangle size={12} /> {a.status}</span>}
                </div>
                <div className="text-xs text-slate-500 line-clamp-1">{a.full_name}</div>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1.5 cursor-pointer">
                  <input type="checkbox" checked={a.smart_enabled !== false}
                    onChange={() => instagramAPI.smartToggle(a.id).then(load)} />
                  پاسخِ هوشمندِ این اکانت
                </label>
                {a.last_error && <div className="text-[11px] text-rose-400 mt-1 line-clamp-1">{a.last_error}</div>}
              </div>
            </div>
          ))}
          {accounts.length === 0 && <div className="text-slate-500 text-sm">اکانتی نیست — «همگام‌سازی وضعیت» را بزن.</div>}
        </div>
      )}
    </div>
  );
}

function Soon({ title, items }) {
  return (
    <div className="bg-slate-800/40 rounded-xl p-6">
      <div className="text-slate-300 font-bold mb-2">{title}</div>
      <div className="text-sm text-slate-500 mb-3">این بخش در فازِ بعدی فعال می‌شود. ساختار:</div>
      <ul className="text-sm text-slate-400 space-y-1 list-disc pr-5">{items.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}

export default function InstagramPage() {
  const [tab, setTab] = useState('dashboard');
  const [accs, setAccs] = useState([]);
  const [accId, setAccId] = useState(null);
  const [smartSub, setSmartSub] = useState('auto');
  const [quickOpen, setQuickOpen] = useState(false);
  useEffect(() => {
    instagramAPI.accounts().then((a) => { setAccs(a); if (a[0]) setAccId(a[0].id); }).catch(() => {});
  }, []);
  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <div className="flex items-center gap-2 mb-5 relative">
        <Instagram className="text-pink-500" />
        <h1 className="text-lg font-black text-slate-100">اینستاگرام</h1>
        <span className="text-xs text-slate-500 hidden sm:inline">— ماژولِ مدیریتِ پیج (مستقل)</span>
        <div className="mr-auto relative">
          <button onClick={() => setQuickOpen((o) => !o)} className="w-9 h-9 rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center"><Plus size={18} /></button>
          {quickOpen && (
            <div className="absolute left-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-20 w-44 py-1">
              <button onClick={() => { setTab('content'); setQuickOpen(false); }} className="w-full text-right px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2"><FileText size={15} /> پستِ جدید</button>
              <button onClick={() => { setTab('smart'); setSmartSub('auto'); setQuickOpen(false); }} className="w-full text-right px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2"><MessageSquareText size={15} /> دستورِ جدید</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const I = t.icon; const on = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 whitespace-nowrap ${on ? 'bg-sky-600 text-white' : 'bg-slate-800/40 text-slate-400 hover:text-slate-200'}`}>
              <I size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {(tab === 'smart') && accs.length > 1 && (
        <div className="mb-4">
          <select value={accId || ''} onChange={(e) => setAccId(Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
            {accs.map((a) => <option key={a.id} value={a.id}>{a.username}</option>)}
          </select>
        </div>
      )}
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'accounts' && <Accounts />}
      {tab === 'smart' && (accId ? (
        <div>
          <div className="flex gap-1.5 mb-5 border-b border-slate-700 pb-2">
            {[['auto', 'پاسخ خودکار'], ['forms', 'فرم‌ساز'], ['menu', 'منوی ثابت']].map(([k, l]) => (
              <button key={k} onClick={() => setSmartSub(k)} className={`text-sm rounded-lg px-3 py-1.5 ${smartSub === k ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>
            ))}
          </div>
          {smartSub === 'auto' && <SmartReply accountId={accId} />}
          {smartSub === 'forms' && <FormBuilder accountId={accId} />}
          {smartSub === 'menu' && <StaticMenu accountId={accId} />}
        </div>
      ) : <div className="text-slate-500 text-sm">اول در تبِ «اکانت‌ها» همگام‌سازی کن.</div>)}
      {tab === 'content' && (accId ? <ContentPublish accountId={accId} accounts={accs} /> : <div className="text-slate-500 text-sm">اول همگام‌سازی کن.</div>)}
      {tab === 'cover' && <CoverMaker />}
      {tab === 'messages' && (accId ? <Inbox accountId={accId} kind="direct" /> : <div className="text-slate-500 text-sm">اول همگام‌سازی کن.</div>)}
      {tab === 'comments' && (accId ? <Inbox accountId={accId} kind="comment" /> : <div className="text-slate-500 text-sm">اول همگام‌سازی کن.</div>)}
    </div>
  );
}
