import React, { useEffect, useState } from 'react';
import {
  Instagram, Users, Plus, Trash2, Power, X, Loader2, AtSign, Send, MessageCircle,
  Zap, Search, Eye, EyeOff, KeyRound, ShieldCheck, Activity as ActivityIcon, Lock, Unlock,
  Rocket, ClipboardList, Inbox, Save, UserCog, CheckCircle2, Clock, FileText, Wifi,
} from 'lucide-react';
import { igUsersAPI } from '../api/client';

const card = 'rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur';
const PERM_ICON = { accounts: AtSign, smart_reply: MessageCircle, content: Send, autopilot: Rocket, forms: ClipboardList, inbox: Inbox, ai: Zap };
const ACT_ICON = { send: Send, zap: Zap, message: MessageCircle, rocket: Rocket };

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: color + '22', color }}><Icon size={18} /></div>
        <div>
          <div className="text-2xl font-black text-white">{value ?? 0}</div>
          <div className="text-xs text-white/50">{label}</div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onChange, disabled }) {
  return (
    <button disabled={disabled} onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-white/15'} ${disabled ? 'opacity-40' : ''}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'right-0.5' : 'right-5'}`} />
    </button>
  );
}

function Mini({ label, value, color = '#fff' }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-2.5 text-center">
      <div className="text-lg font-black" style={{ color }}>{value ?? 0}</div>
      <div className="text-[11px] text-white/40">{label}</div>
    </div>
  );
}

function CreateModal({ perms, onClose, onSaved }) {
  const [f, setF] = useState({ username: '', password: '', display_name: '', max_accounts: 3, notes: '' });
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try { await igUsersAPI.create(f); onSaved(); }
    catch (e) { setErr(e.response?.data?.detail || 'خطا'); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative ${card} p-5 w-full max-w-md`} style={{ background: '#161a26' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-white flex items-center gap-2"><Plus size={18} /> کاربر جدید IG</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-white/60 mb-1 block">نام کاربری</label>
            <input className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm" dir="ltr"
              value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="username" />
          </div>
          <div>
            <label className="text-xs font-bold text-white/60 mb-1 block">رمز عبور</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 pl-10 text-white text-sm" dir="ltr"
                value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="••••••" />
              <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute left-3 top-2.5 text-white/40 hover:text-white">{showPw ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-white/60 mb-1 block">نام نمایشی</label>
              <input className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm"
                value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-bold text-white/60 mb-1 block">سقفِ اکانت</label>
              <input type="number" min={1} max={20} className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm"
                value={f.max_accounts} onChange={(e) => setF({ ...f, max_accounts: +e.target.value })} />
            </div>
          </div>
          {err && <div className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{err}</div>}
          <button onClick={save} disabled={busy || !f.username || !f.password}
            className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-l from-purple-600 to-pink-500 disabled:opacity-50">
            {busy ? <Loader2 size={17} className="animate-spin mx-auto" /> : 'ساختِ کاربر'}
          </button>
        </div>
      </div>
    </div>
  );
}

function fa(d) { return d ? new Date(d).toLocaleString('fa-IR') : '—'; }

function Drawer({ uid, perms, onClose, onChanged }) {
  const [u, setU] = useState(null);
  const [tab, setTab] = useState('overview');
  const [activity, setActivity] = useState(null);
  // credentials
  const [pw, setPw] = useState(''); const [revealed, setRevealed] = useState(''); const [revealing, setRevealing] = useState(false);
  const [uname, setUname] = useState(''); const [newPw, setNewPw] = useState(''); const [showNew, setShowNew] = useState(false);
  const [perm, setPerm] = useState({}); const [notes, setNotes] = useState('');
  const [maxAcc, setMaxAcc] = useState(3);
  const [busy, setBusy] = useState(''); const [toast, setToast] = useState('');

  const load = async () => {
    const d = await igUsersAPI.get(uid);
    setU(d); setUname(d.username); setPerm(d.permissions || {}); setNotes(d.notes || ''); setMaxAcc(d.max_accounts);
  };
  useEffect(() => { load(); }, [uid]);
  useEffect(() => { if (tab === 'activity' && !activity) igUsersAPI.activity(uid).then(setActivity).catch(() => setActivity({ items: [] })); }, [tab]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  const reveal = async () => {
    setRevealing(true);
    try { const r = await igUsersAPI.revealPassword(uid); setRevealed(r.password || r.message || '—'); }
    catch (e) { setRevealed('خطا'); } finally { setRevealing(false); }
  };
  const saveCreds = async () => {
    setBusy('creds');
    try {
      const d = {}; if (uname && uname !== u.username) d.username = uname; if (newPw) d.password = newPw;
      if (!Object.keys(d).length) { flash('تغییری نبود'); setBusy(''); return; }
      await igUsersAPI.update(uid, d); setNewPw(''); setRevealed(''); await load(); onChanged(); flash('کرِدِنشیال ذخیره شد');
    } catch (e) { flash(e.response?.data?.detail || 'خطا'); } finally { setBusy(''); }
  };
  const togglePerm = (k, v) => setPerm((p) => ({ ...p, [k]: v }));
  const savePerms = async () => {
    setBusy('perms');
    try { await igUsersAPI.setPermissions(uid, perm); onChanged(); flash('دسترسی‌ها ذخیره شد'); }
    catch (e) { flash('خطا'); } finally { setBusy(''); }
  };
  const saveMeta = async () => {
    setBusy('meta');
    try { await igUsersAPI.update(uid, { notes, max_accounts: maxAcc }); await load(); onChanged(); flash('ذخیره شد'); }
    catch (e) { flash('خطا'); } finally { setBusy(''); }
  };
  const toggleActive = async () => { await igUsersAPI.update(uid, { is_active: !u.is_active }); await load(); onChanged(); };

  const TABS = [['overview', 'نمای کلی', UserCog], ['creds', 'کرِدِنشیال', KeyRound], ['locks', 'قفلِ فیچرها', ShieldCheck], ['activity', 'فعالیت', ActivityIcon], ['notes', 'یادداشت', FileText]];
  const s = u?.stats || {};

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative h-full w-full max-w-xl bg-[#11141d] border-l border-white/10 overflow-y-auto shadow-2xl animate-[slidein_.2s_ease]">
        {!u ? <div className="h-full grid place-items-center text-white/40"><Loader2 className="animate-spin" /></div> : (
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full grid place-items-center text-white font-black bg-gradient-to-l from-purple-600 to-pink-500">{(u.display_name || u.username)[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-white text-lg">{u.display_name || u.username}</span>
                  {u.is_admin_seed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">ادمین</span>}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${u.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>{u.is_active ? 'فعال' : 'غیرفعال'}</span>
                </div>
                <div className="text-xs text-white/40 mt-0.5" dir="ltr">@{u.username}</div>
              </div>
              <button onClick={onClose} className="text-white/50 hover:text-white p-2"><X size={20} /></button>
            </div>

            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {TABS.map(([k, lbl, Ic]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${tab === k ? 'bg-gradient-to-l from-purple-600 to-pink-500 text-white' : 'text-white/50 hover:bg-white/5'}`}>
                  <Ic size={15} /> {lbl}
                </button>
              ))}
            </div>

            {toast && <div className="mb-3 text-sm text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2 font-bold">{toast}</div>}

            {tab === 'overview' && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Mini label="پستِ منتشرشده" value={s.posts_published} color="#10b981" />
                  <Mini label="زمان‌بندی‌شده" value={s.posts_scheduled} color="#f59e0b" />
                  <Mini label="پیش‌نویس" value={s.posts_draft} color="#94a3b8" />
                  <Mini label="پاسخِ دایرکت" value={s.dm_sent} color="#3b82f6" />
                  <Mini label="پاسخِ کامنت" value={s.comment_sent} color="#8b5cf6" />
                  <Mini label="کلِ صندوق" value={s.inbox_total} color="#06b6d4" />
                  <Mini label="دستورِ فعال" value={s.active_rules} color="#ec4899" />
                  <Mini label="کلِ دستورها" value={s.rules_total} color="#fff" />
                  <Mini label="پیام‌های آماده" value={s.messages} color="#fff" />
                  <Mini label="فرم‌ساز" value={s.forms} color="#fff" />
                  <Mini label="خلبانِ فعال" value={`${s.autopilots_on}/${s.autopilots}`} color="#f43f5e" />
                  <Mini label="اکانتِ آنلاین" value={`${s.online_accounts}/${u.accounts_used}`} color="#10b981" />
                </div>
                <div className={`${card} p-3 grid grid-cols-3 gap-2 text-center`}>
                  <div><div className="text-xs text-white/40">تعدادِ ورود</div><div className="font-black text-white">{u.login_count}</div></div>
                  <div><div className="text-xs text-white/40">آخرین IP</div><div className="font-mono text-white text-xs mt-1" dir="ltr">{u.last_login_ip || '—'}</div></div>
                  <div><div className="text-xs text-white/40">آخرین فعالیت</div><div className="text-white text-[11px] mt-1">{fa(u.last_active_at)}</div></div>
                </div>
                <div>
                  <div className="text-xs font-bold text-white/50 mb-2">اکانت‌های اینستاگرام ({u.accounts_used}/{u.max_accounts})</div>
                  <div className="space-y-2">
                    {u.accounts.map((a) => (
                      <div key={a.id} className={`${card} p-3 flex items-center gap-3`}>
                        <div className="w-9 h-9 rounded-full bg-white/10 grid place-items-center overflow-hidden shrink-0">{a.avatar_url ? <img src={a.avatar_url} className="w-full h-full object-cover" /> : <Instagram size={16} className="text-white/60" />}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate" dir="ltr">@{a.username}</div>
                          <div className="text-[11px] text-white/40">آخرین ورود: {fa(a.last_login_at)}{a.last_error ? ` · خطا: ${a.last_error.slice(0, 40)}` : ''}</div>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold ${a.status === 'online' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/50'}`}>
                          <Wifi size={11} /> {a.status === 'online' ? 'آنلاین' : a.status}
                        </span>
                      </div>
                    ))}
                    {u.accounts.length === 0 && <div className="text-white/30 text-sm text-center py-3">اکانتی متصل نکرده.</div>}
                  </div>
                </div>
              </div>
            )}

            {tab === 'creds' && (
              <div className="space-y-4">
                <div className={`${card} p-4`}>
                  <div className="text-xs font-bold text-white/50 mb-2">رمزِ فعلیِ پنل (فقط ادمین)</div>
                  {revealed ? (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-black/40 rounded-lg px-3 py-2 text-emerald-300 font-mono text-sm break-all" dir="ltr">{revealed}</code>
                      <button onClick={() => setRevealed('')} className="text-white/40 hover:text-white p-2"><EyeOff size={17} /></button>
                    </div>
                  ) : (
                    <button onClick={reveal} disabled={revealing} className="flex items-center gap-2 text-sm font-bold text-white bg-white/10 hover:bg-white/15 rounded-xl px-4 py-2.5">
                      {revealing ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} نمایشِ رمز
                    </button>
                  )}
                </div>
                <div className={`${card} p-4 space-y-3`}>
                  <div className="text-xs font-bold text-white/50">تغییرِ کرِدِنشیال</div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">نام کاربری</label>
                    <input className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm disabled:opacity-50" dir="ltr"
                      disabled={u.is_admin_seed} value={uname} onChange={(e) => setUname(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">رمزِ جدید (خالی = بدون تغییر)</label>
                    <div className="relative">
                      <input type={showNew ? 'text' : 'password'} className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 pl-10 text-white text-sm" dir="ltr"
                        value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••" />
                      <button type="button" onClick={() => setShowNew((x) => !x)} className="absolute left-3 top-2.5 text-white/40 hover:text-white">{showNew ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                    </div>
                  </div>
                  <button onClick={saveCreds} disabled={busy === 'creds'} className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-l from-purple-600 to-pink-500 disabled:opacity-50 flex items-center justify-center gap-2">
                    {busy === 'creds' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} ذخیره
                  </button>
                </div>
              </div>
            )}

            {tab === 'locks' && (
              <div className="space-y-3">
                <p className="text-xs text-white/40">هر فیچری که خاموش کنی، برای این کاربر در پنلِ IG قفل می‌شود (نه می‌بیند، نه می‌تواند استفاده کند).</p>
                {(perms || []).map((p) => {
                  const Ic = PERM_ICON[p.key] || ShieldCheck; const on = perm[p.key] !== false;
                  return (
                    <div key={p.key} className={`${card} p-3.5 flex items-center gap-3`}>
                      <div className={`w-9 h-9 rounded-xl grid place-items-center ${on ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}><Ic size={17} /></div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-white">{p.label}</div>
                        <div className="text-[11px] flex items-center gap-1" style={{ color: on ? '#6ee7b7' : '#fca5a5' }}>{on ? <><Unlock size={11} /> باز</> : <><Lock size={11} /> قفل</>}</div>
                      </div>
                      <Toggle on={on} onChange={(v) => togglePerm(p.key, v)} />
                    </div>
                  );
                })}
                <button onClick={savePerms} disabled={busy === 'perms'} className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-l from-purple-600 to-pink-500 disabled:opacity-50 flex items-center justify-center gap-2">
                  {busy === 'perms' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} ذخیرهٔ دسترسی‌ها
                </button>
              </div>
            )}

            {tab === 'activity' && (
              <div className="space-y-2">
                {!activity ? <div className="text-center text-white/30 py-6"><Loader2 className="animate-spin mx-auto" /></div> :
                  activity.items.length === 0 ? <div className="text-center text-white/30 py-6">فعالیتی ثبت نشده.</div> :
                    activity.items.map((it, i) => {
                      const Ic = ACT_ICON[it.icon] || ActivityIcon;
                      return (
                        <div key={i} className={`${card} p-3 flex items-start gap-3`}>
                          <div className="w-8 h-8 rounded-lg bg-white/10 grid place-items-center text-white/70 shrink-0"><Ic size={15} /></div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white">{it.title}</div>
                            {it.detail && <div className="text-[11px] text-white/40 truncate">{it.detail}</div>}
                          </div>
                          <div className="text-[10px] text-white/30 flex items-center gap-1 shrink-0"><Clock size={10} /> {fa(it.at)}</div>
                        </div>
                      );
                    })}
              </div>
            )}

            {tab === 'notes' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-white/50 mb-1 block">سقفِ اکانتِ اینستاگرام</label>
                  <input type="number" min={1} max={20} className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm"
                    value={maxAcc} onChange={(e) => setMaxAcc(+e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-white/50 mb-1 block">یادداشتِ ادمین</label>
                  <textarea rows={5} className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm resize-none"
                    value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="یادداشتِ داخلی دربارهٔ این کاربر…" />
                </div>
                <button onClick={saveMeta} disabled={busy === 'meta'} className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-l from-purple-600 to-pink-500 disabled:opacity-50 flex items-center justify-center gap-2">
                  {busy === 'meta' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} ذخیره
                </button>
              </div>
            )}

            {/* اقداماتِ پایین */}
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-2">
              <button onClick={toggleActive} className="flex items-center gap-1.5 text-sm font-bold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl px-4 py-2.5">
                <Power size={15} /> {u.is_active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
              </button>
              {!u.is_admin_seed && (
                <button onClick={async () => { if (confirm(`حذفِ @${u.username} و همهٔ اکانت‌هایش؟`)) { await igUsersAPI.remove(uid); onChanged(); onClose(); } }}
                  className="flex items-center gap-1.5 text-sm font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 rounded-xl px-4 py-2.5">
                  <Trash2 size={15} /> حذفِ کاربر
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes slidein{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
    </div>
  );
}

export default function IgUsersPage() {
  const [users, setUsers] = useState([]);
  const [ov, setOv] = useState(null);
  const [perms, setPerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [create, setCreate] = useState(false);
  const [drawer, setDrawer] = useState(null); // uid

  const load = async () => {
    setLoading(true);
    try {
      const [u, o, p] = await Promise.all([igUsersAPI.list(), igUsersAPI.overview(), igUsersAPI.permsSchema()]);
      setUsers(u); setOv(o); setPerms(p);
    } catch (e) { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const lockedCount = (u) => perms.filter((p) => u.permissions?.[p.key] === false).length;
  const filtered = users.filter((u) => !q || (u.username + ' ' + (u.display_name || '')).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl grid place-items-center text-white bg-gradient-to-l from-purple-600 to-pink-500"><Instagram size={22} /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">کاربران IG</h1>
            <p className="text-sm text-white/50">اشرافِ کامل، آمارِ زنده، کنترلِ کرِدِنشیال و قفلِ فیچرها — ig.trade-future.ir</p>
          </div>
        </div>
        <button onClick={() => setCreate(true)} className="px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-l from-purple-600 to-pink-500 flex items-center gap-2"><Plus size={17} /> کاربر جدید</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Stat icon={Users} label="کاربران (فعال)" value={`${ov?.active_users ?? 0}/${ov?.total_users ?? 0}`} color="#a855f7" />
        <Stat icon={AtSign} label="اکانت (آنلاین)" value={`${ov?.online_accounts ?? 0}/${ov?.total_accounts ?? 0}`} color="#ec4899" />
        <Stat icon={Send} label="پستِ منتشرشده" value={ov?.total_posts} color="#10b981" />
        <Stat icon={MessageCircle} label="پاسخ (۳۰ روز)" value={(ov?.total_dm || 0) + (ov?.total_comment || 0)} color="#3b82f6" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat icon={Zap} label="دستورِ فعال" value={ov?.total_rules} color="#f59e0b" />
        <Stat icon={Rocket} label="خلبانِ فعال" value={ov?.total_autopilots_on} color="#f43f5e" />
        <div className="lg:col-span-2 relative">
          <Search size={17} className="absolute right-3 top-3.5 text-white/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی کاربر…"
            className="w-full h-full rounded-2xl bg-white/[0.03] border border-white/10 pr-10 pl-3 text-white text-sm" />
        </div>
      </div>

      {loading ? <div className="text-center text-white/40 py-10"><Loader2 className="animate-spin mx-auto" /></div> : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((u) => {
            const lc = lockedCount(u);
            return (
              <button key={u.id} onClick={() => setDrawer(u.id)} className={`${card} p-4 text-right hover:border-white/25 transition`}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full grid place-items-center text-white font-black bg-gradient-to-l from-purple-600 to-pink-500 shrink-0">{(u.display_name || u.username)[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-white truncate">{u.display_name || u.username}</span>
                      {u.is_admin_seed && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">ادمین</span>}
                      {!u.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold">غیرفعال</span>}
                      {lc > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 font-bold flex items-center gap-0.5"><Lock size={9} /> {lc}</span>}
                    </div>
                    <div className="text-[11px] text-white/40 mt-0.5" dir="ltr">@{u.username}</div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-[11px] text-white/40">{u.accounts_used}/{u.max_accounts} اکانت</div>
                    <div className="text-[11px] text-emerald-300">{u.stats.online_accounts} آنلاین</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <Mini label="پست" value={u.stats.posts_published} color="#10b981" />
                  <Mini label="دایرکت" value={u.stats.dm_sent} color="#3b82f6" />
                  <Mini label="کامنت" value={u.stats.comment_sent} color="#8b5cf6" />
                  <Mini label="دستور" value={u.stats.active_rules} color="#f59e0b" />
                </div>
                <div className="text-[11px] text-white/30 mt-3 flex items-center justify-between">
                  <span>آخرین فعالیت: {fa(u.last_active_at)}</span>
                  <span className="flex items-center gap-1"><Power size={11} /> {u.login_count} ورود</span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <div className={`${card} p-10 text-center text-white/40 md:col-span-2`}>کاربری یافت نشد.</div>}
        </div>
      )}

      {create && <CreateModal perms={perms} onClose={() => setCreate(false)} onSaved={() => { setCreate(false); load(); }} />}
      {drawer && <Drawer uid={drawer} perms={perms} onClose={() => setDrawer(null)} onChanged={load} />}
    </div>
  );
}
