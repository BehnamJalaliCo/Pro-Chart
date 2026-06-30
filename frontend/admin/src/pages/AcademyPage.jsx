import { useEffect, useState, useCallback } from 'react';
import {
  GraduationCap, Users, Crown, BookOpen, MessageSquare, Plus, Search, Trash2,
  KeyRound, Power, X, Pencil, CalendarPlus, Copy, Check, AlertTriangle, Clock, CreditCard,
} from 'lucide-react';
import { academyAPI } from '../api/client';

const TIERS = [
  { k: 'free', label: 'رایگان', cls: 'bg-slate-700 text-slate-300' },
  { k: 'vip', label: 'VIP', cls: 'bg-amber-500/15 text-amber-400' },
  { k: 'premium', label: 'پرمیوم', cls: 'bg-fuchsia-500/15 text-fuchsia-400' },
];
const tierOf = (t) => TIERS.find((x) => x.k === t) || TIERS[0];

// تعریفِ شفافِ پلن‌ها — همان چیزی که در صفحهٔ قیمتِ آکادمی هم نمایش داده می‌شود
const TIER_MATRIX = [
  { f: 'محتوا', free: '۵ درسِ مقدماتیِ نمونه', vip: 'مقدماتی + متوسط (۷۵+ درس)', premium: 'همهٔ VIP + سطحِ پیشرفته/حرفه‌ای (۴۰ درسِ انحصاری)' },
  { f: 'ویدیوهای آموزشی', free: '—', vip: '✓ همه', premium: '✓ همه + وبینار' },
  { f: 'مربیِ AI (سوال/روز)', free: '۱۰', vip: '۸۰', premium: '۳۰۰' },
  { f: 'نقدِ تصویریِ معاملهٔ شما', free: '—', vip: '—', premium: '✓' },
  { f: 'آزمون و گواهیِ پیشرفت', free: '—', vip: '✓', premium: '✓' },
  { f: 'پشتیبانی', free: '—', vip: 'استاندارد', premium: 'اولویت‌دار' },
  { f: 'قیمت (USDT/ماه)', free: '۰', vip: '۲۵', premium: '۶۰' },
];

const EXPIRY_PRESETS = [
  { label: 'نامحدود', days: 0 },
  { label: '۱ ماه', days: 30 },
  { label: '۳ ماه', days: 90 },
  { label: '۶ ماه', days: 180 },
  { label: '۱ سال', days: 365 },
];

// تاریخِ امروز + n روز → YYYY-MM-DD (برای پیش‌فرضِ فیلدِ تاریخ)
const dateInDays = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmtDate = (s) => (s ? s.slice(0, 10) : null);

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}><Icon size={20} /></div>
      <div>
        <div className="text-xl font-black text-white">{value ?? '—'}</div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
    </div>
  );
}

function CopyField({ label, value }) {
  const [ok, setOk] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500); };
  return (
    <div className="flex items-center justify-between bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2">
      <div><span className="text-xs text-slate-500">{label}: </span><span className="font-mono text-white" dir="ltr">{value}</span></div>
      <button onClick={copy} className="text-slate-400 hover:text-emerald-400">{ok ? <Check size={15} /> : <Copy size={15} />}</button>
    </div>
  );
}

function StudentModal({ student, onClose, onSaved }) {
  const isNew = !student;
  const [f, setF] = useState({
    username: student?.username || '', password: '', tier: student?.tier || 'vip',
    full_name: student?.full_name || '', email: student?.email || '',
    expires_at: student?.expires_at ? fmtDate(student.expires_at) : '', notes: student?.notes || '',
  });
  const [preset, setPreset] = useState(student?.expires_at ? null : 0); // 0 = نامحدود برای جدید
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null); // {username, password}
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const applyPreset = (days) => {
    setPreset(days);
    up('expires_at', days === 0 ? '' : dateInDays(days));
  };

  const save = async () => {
    setErr(''); setBusy(true);
    try {
      if (isNew) {
        await academyAPI.createStudent({
          username: f.username, password: f.password, tier: f.tier,
          full_name: f.full_name, email: f.email, expires_at: f.expires_at, notes: f.notes,
        });
        setCreated({ username: f.username.trim().toLowerCase(), password: f.password });
      } else {
        await academyAPI.updateStudent(student.id, {
          tier: f.tier, full_name: f.full_name, email: f.email, expires_at: f.expires_at, notes: f.notes,
        });
        onSaved();
      }
    } catch (e) { setErr(e?.response?.data?.detail || 'خطا در ذخیره'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-white">{created ? 'دانش‌آموز ساخته شد ✅' : isNew ? 'دانش‌آموزِ جدید' : `ویرایش: ${student.username}`}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        {created ? (
          <div className="space-y-3 text-sm">
            <p className="text-slate-400">این مشخصات را به دانش‌آموز بده (در آدرسِ <span className="text-brand-blue font-mono" dir="ltr">academy.fx.trade-future.ir</span> وارد می‌شود):</p>
            <CopyField label="نام‌کاربری" value={created.username} />
            <CopyField label="رمز عبور" value={created.password} />
            <button onClick={onSaved} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold">تمام</button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {isNew && (
              <>
                <input className="inp" placeholder="نام‌کاربری (انگلیسی، حداقل ۳)" dir="ltr" value={f.username} onChange={(e) => up('username', e.target.value)} />
                <input className="inp" placeholder="رمز عبور (حداقل ۶)" dir="ltr" value={f.password} onChange={(e) => up('password', e.target.value)} />
              </>
            )}
            <input className="inp" placeholder="نام و نام خانوادگی" value={f.full_name} onChange={(e) => up('full_name', e.target.value)} />
            <input className="inp" placeholder="ایمیل (اختیاری)" dir="ltr" value={f.email} onChange={(e) => up('email', e.target.value)} />
            <div>
              <label className="text-xs text-slate-400">پلنِ اشتراک</label>
              <select className="inp mt-1" value={f.tier} onChange={(e) => up('tier', e.target.value)}>
                {TIERS.map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">مدتِ اعتبار</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {EXPIRY_PRESETS.map((p) => (
                  <button key={p.label} onClick={() => applyPreset(p.days)}
                    className={`px-2.5 py-1 rounded-lg text-xs border ${preset === p.days ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <input className="inp mt-2" type="date" value={f.expires_at} onChange={(e) => { up('expires_at', e.target.value); setPreset(null); }} />
              <p className="text-[11px] text-slate-500 mt-1">خالی = نامحدود · تاریخ = تا پایانِ همان روز معتبر است.</p>
            </div>
            <textarea className="inp" rows={2} placeholder="یادداشتِ ادمین" value={f.notes} onChange={(e) => up('notes', e.target.value)} />
            {err && <p className="text-red-400">{err}</p>}
            <button onClick={save} disabled={busy} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50">
              {busy ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StudentsTab() {
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [q, setQ] = useState(''); const [tier, setTier] = useState(''); const [status, setStatus] = useState('');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([academyAPI.stats(), academyAPI.listStudents({ q, tier, status, per_page: 100 })]);
      setStats(s); setStudents(list.items || []);
    } catch { /* noop */ } finally { setLoading(false); }
  }, [q, tier, status]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, ...args) => { try { await fn(...args); load(); } catch (e) { alert(e?.response?.data?.detail || 'خطا'); } };
  const resetPw = (s) => { const p = prompt(`رمزِ جدید برای ${s.username} (حداقل ۶):`); if (p && p.length >= 6) act(academyAPI.resetPassword, s.id, p); };
  const del = (s) => { if (confirm(`حذفِ «${s.username}»؟ همهٔ پیشرفت و چت‌هایش پاک می‌شود.`)) act(academyAPI.deleteStudent, s.id); };
  const toggle = (s) => act(academyAPI.updateStudent, s.id, { status: s.status === 'active' ? 'disabled' : 'active' });
  const extend = (s) => { const d = prompt(`چند روز به اعتبارِ ${s.username} اضافه شود؟`, '30'); const n = parseInt(d, 10); if (n > 0) act(academyAPI.extendStudent, s.id, n); };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <Stat icon={Users} label="کل" value={stats?.students_total} color="bg-blue-500/15 text-blue-400" />
        <Stat icon={Power} label="فعال" value={stats?.students_active} color="bg-emerald-500/15 text-emerald-400" />
        <Stat icon={Clock} label="منقضی" value={stats?.students_expired} color="bg-red-500/15 text-red-400" />
        <Stat icon={Crown} label="VIP+پرمیوم" value={stats ? (stats.by_tier?.vip || 0) + (stats.by_tier?.premium || 0) : null} color="bg-amber-500/15 text-amber-400" />
        <Stat icon={BookOpen} label="دروس" value={stats?.lessons} color="bg-purple-500/15 text-purple-400" />
        <Stat icon={MessageSquare} label="سوال از مربی" value={stats?.mentor_questions} color="bg-cyan-500/15 text-cyan-400" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 flex-1 min-w-[180px]">
          <Search size={16} className="text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام‌کاربری/نام/ایمیل" className="bg-transparent py-2 text-sm text-white flex-1 focus:outline-none" />
        </div>
        <select value={tier} onChange={(e) => setTier(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">همهٔ پلن‌ها</option>{TIERS.map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">همه</option><option value="active">فعال</option><option value="disabled">غیرفعال</option>
        </select>
        <button onClick={() => setModal('new')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">
          <Plus size={16} /> دانش‌آموزِ جدید
        </button>
      </div>

      <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-400 text-xs">
            <tr>
              <th className="text-right p-3">نام‌کاربری</th><th className="text-right p-3">نام</th>
              <th className="p-3">پلن</th><th className="p-3">وضعیت</th><th className="p-3">انقضا</th><th className="p-3">ورودِ آخر</th><th className="p-3">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-center text-slate-500">در حال بارگذاری…</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-slate-500">دانش‌آموزی نیست. «دانش‌آموزِ جدید» بساز.</td></tr>
            ) : students.map((s) => {
              const t = tierOf(s.tier);
              return (
                <tr key={s.id} className="border-t border-slate-700/50 hover:bg-slate-800/40">
                  <td className="p-3 font-mono text-white" dir="ltr">{s.username}</td>
                  <td className="p-3 text-slate-300">{s.full_name || '—'}</td>
                  <td className="p-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${t.cls}`}>{t.label}</span></td>
                  <td className="p-3 text-center">
                    {s.status !== 'active'
                      ? <span className="text-xs text-red-400">غیرفعال</span>
                      : s.expired
                        ? <span className="text-xs text-red-400 flex items-center justify-center gap-1"><AlertTriangle size={12} />منقضی</span>
                        : <span className="text-xs text-emerald-400">فعال</span>}
                  </td>
                  <td className="p-3 text-center text-xs text-slate-400">{s.expires_at ? fmtDate(s.expires_at) : 'نامحدود'}</td>
                  <td className="p-3 text-center text-xs text-slate-500">{s.last_login_at ? fmtDate(s.last_login_at) : '—'}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => setModal({ student: s })} title="ویرایش" className="p-1.5 text-slate-400 hover:text-blue-400"><Pencil size={15} /></button>
                      <button onClick={() => extend(s)} title="تمدید" className="p-1.5 text-slate-400 hover:text-emerald-400"><CalendarPlus size={15} /></button>
                      <button onClick={() => resetPw(s)} title="ریست رمز" className="p-1.5 text-slate-400 hover:text-amber-400"><KeyRound size={15} /></button>
                      <button onClick={() => toggle(s)} title="فعال/غیرفعال" className="p-1.5 text-slate-400 hover:text-fuchsia-400"><Power size={15} /></button>
                      <button onClick={() => del(s)} title="حذف" className="p-1.5 text-slate-400 hover:text-red-400"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <StudentModal student={modal === 'new' ? null : modal.student} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </>
  );
}

function LessonsTab() {
  const [level, setLevel] = useState('beginner');
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true);
  const LEVELS = [
    { k: 'beginner', label: 'مقدماتی' }, { k: 'intermediate', label: 'متوسط' },
    { k: 'advanced', label: 'پیشرفته' }, { k: 'ai', label: 'حرفه‌ای' },
    { k: 'mt4', label: 'متاتریدر ۴' }, { k: 'mt5', label: 'متاتریدر ۵' },
  ];
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await academyAPI.listLessons(level)).items || []); } catch { /* */ } finally { setLoading(false); }
  }, [level]);
  useEffect(() => { load(); }, [load]);
  const patch = async (l, data) => { try { await academyAPI.updateLesson(l.id, data); load(); } catch (e) { alert(e?.response?.data?.detail || 'خطا'); } };

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        {LEVELS.map((l) => (
          <button key={l.k} onClick={() => setLevel(l.k)}
            className={`px-3 py-1.5 rounded-lg text-sm shrink-0 ${level === l.k ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>{l.label}</button>
        ))}
      </div>
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-400 text-xs">
            <tr><th className="p-3 w-12">#</th><th className="text-right p-3">عنوان</th><th className="p-3">پلنِ موردنیاز</th><th className="p-3">محتوا</th><th className="p-3">انتشار</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center text-slate-500">در حال بارگذاری…</td></tr>
            ) : items.map((l) => (
              <tr key={l.id} className="border-t border-slate-700/50 hover:bg-slate-800/40">
                <td className="p-3 text-center text-slate-500">{l.order}</td>
                <td className="p-3 text-slate-200">{l.title}</td>
                <td className="p-3 text-center">
                  <select value={l.min_tier} onChange={(e) => patch(l, { min_tier: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white">
                    {TIERS.map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}
                  </select>
                </td>
                <td className="p-3 text-center text-xs">{l.has_content ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">—</span>}</td>
                <td className="p-3 text-center">
                  <button onClick={() => patch(l, { is_published: !l.is_published })}
                    className={`text-xs px-2 py-1 rounded-lg ${l.is_published ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                    {l.is_published ? 'منتشرشده' : 'پیش‌نویس'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TiersTab() {
  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-800 text-slate-300">
          <tr>
            <th className="text-right p-3">امکانات</th>
            <th className="p-3">رایگان</th>
            <th className="p-3 text-amber-400">VIP</th>
            <th className="p-3 text-fuchsia-400">پرمیوم</th>
          </tr>
        </thead>
        <tbody>
          {TIER_MATRIX.map((r) => (
            <tr key={r.f} className="border-t border-slate-700/50">
              <td className="p-3 text-slate-300 font-medium">{r.f}</td>
              <td className="p-3 text-center text-slate-400 text-xs">{r.free}</td>
              <td className="p-3 text-center text-slate-200 text-xs">{r.vip}</td>
              <td className="p-3 text-center text-slate-200 text-xs">{r.premium}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 p-3 leading-6">
        پلنِ هر درس را می‌توانی در تبِ «دروس» تغییر دهی. پرداختِ کاربران فقط USDT شبکهٔ BEP-20 است؛
        دانش‌آموز را همین‌جا (تبِ دانش‌آموزان) با نام‌کاربری/رمز می‌سازی و پلن/مدتش را تعیین می‌کنی.
      </p>
    </div>
  );
}

function PaymentsTab() {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await academyAPI.listPayments('pending')).items || []); } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const approve = async (p) => { const m = prompt(`چند ماه فعال شود؟ (${p.username})`, '1'); const n = parseInt(m, 10); if (n > 0) { try { await academyAPI.approvePayment(p.id, n); load(); } catch (e) { alert(e?.response?.data?.detail || 'خطا'); } } };
  const reject = async (p) => { if (confirm('رد شود؟')) { await academyAPI.rejectPayment(p.id); load(); } };
  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-800 text-slate-400 text-xs"><tr>
          <th className="text-right p-3">دانش‌آموز</th><th className="p-3">پلن</th><th className="p-3">مبلغ</th><th className="text-right p-3">هشِ تراکنش</th><th className="p-3">عملیات</th>
        </tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">…</td></tr>
            : items.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">پرداختِ در انتظاری نیست.</td></tr>
            : items.map((p) => (
              <tr key={p.id} className="border-t border-slate-700/50">
                <td className="p-3 text-white">{p.full_name || p.username}</td>
                <td className="p-3 text-center"><span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{p.tier}</span></td>
                <td className="p-3 text-center text-slate-300">{p.amount_usdt} USDT</td>
                <td className="p-3 text-xs text-slate-400 font-mono max-w-[260px] truncate" dir="ltr" title={p.tx_note}>{p.tx_note || '—'}</td>
                <td className="p-3"><div className="flex items-center justify-center gap-2">
                  <button onClick={() => approve(p)} className="text-xs px-3 py-1 rounded-lg bg-emerald-600 text-white">تأیید</button>
                  <button onClick={() => reject(p)} className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-slate-300">رد</button>
                </div></td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function CommunityTab() {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await academyAPI.communityPosts('pending')).items || []); } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const approve = async (p) => { await academyAPI.approvePost(p.id); load(); };
  const del = async (p) => { if (confirm('حذف شود؟')) { await academyAPI.deletePost(p.id); load(); } };
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 mb-2">پست‌های در انتظارِ بازبینی (مشکوک به تبلیغ/گزارش‌شده).</p>
      {loading ? <p className="text-slate-500 text-center py-6 text-sm">…</p>
        : items.length === 0 ? <p className="text-slate-500 text-center py-6 text-sm">پستِ در انتظاری نیست.</p>
        : items.map((p) => (
          <div key={p.id} className="bg-slate-800/40 border border-slate-700 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">{p.author} {p.reports > 0 && <span className="text-amber-400">· {p.reports} گزارش</span>} {p.flag_reason && <span className="text-red-400">· {p.flag_reason}</span>}</span>
              <div className="flex gap-2">
                <button onClick={() => approve(p)} className="text-xs px-3 py-1 rounded-lg bg-emerald-600 text-white">انتشار</button>
                <button onClick={() => del(p)} className="text-xs px-3 py-1 rounded-lg bg-red-600/80 text-white">حذف</button>
              </div>
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-6">{p.content}</p>
          </div>
        ))}
    </div>
  );
}

export default function AcademyPage() {
  const [tab, setTab] = useState('students');
  const TABS = [
    { k: 'students', label: 'دانش‌آموزان', icon: Users },
    { k: 'lessons', label: 'دروس', icon: BookOpen },
    { k: 'payments', label: 'پرداخت‌ها', icon: CreditCard },
    { k: 'community', label: 'انجمن', icon: MessageSquare },
    { k: 'tiers', label: 'پلن‌ها و امکانات', icon: Crown },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0"><GraduationCap size={22} /></div>
        <div className="min-w-0">
          <h1 className="text-lg font-black text-white leading-5">آکادمی VIP</h1>
          <p className="text-xs text-slate-400 mt-0.5">مدیریتِ دانش‌آموزان، دروس، پرداخت‌ها و پلن‌ها</p>
        </div>
      </div>
      <div className="flex gap-1 border-b border-slate-700 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        {TABS.map((t) => { const I = t.icon; const on = tab === t.k; return (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold whitespace-nowrap shrink-0 -mb-px border-b-2 transition-colors ${on ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <I size={15} /> {t.label}
          </button>
        ); })}
      </div>
      {tab === 'students' && <StudentsTab />}
      {tab === 'lessons' && <LessonsTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'community' && <CommunityTab />}
      {tab === 'tiers' && <TiersTab />}
      <style>{`.inp{width:100%;background:#0f172a;border:1px solid #334155;border-radius:0.75rem;padding:0.6rem 0.75rem;color:#fff;font-size:0.875rem}.inp:focus{outline:none;border-color:#10b981}`}</style>
    </div>
  );
}
