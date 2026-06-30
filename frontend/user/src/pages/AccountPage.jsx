import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Trash2, ShieldCheck, AlertTriangle, Lock } from 'lucide-react';
import { userAPI } from '../api/client';
import { useAuth } from '../store';
import { Spinner, StatusLight } from '../components/ui';
import Guide from '../components/Guide';

export default function AccountPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: status, isLoading } = useQuery({ queryKey: ['copyStatus'], queryFn: () => userAPI.copyStatus(), refetchInterval: 8000 });
  const [form, setForm] = useState({ broker: '', server: '', login: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  if (isLoading) return <Spinner />;
  const acc = status?.account;
  const paid = profile?.is_paid;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const link = async () => {
    setErr(''); setOk(''); setBusy(true);
    try {
      const r = await userAPI.linkAccount(form);
      setOk(r.message || 'حساب ثبت شد.'); setForm({ broker: '', server: '', login: '', password: '' });
      qc.invalidateQueries({ queryKey: ['copyStatus'] });
    } catch (e) { setErr(e?.message || 'ثبت ناموفق بود.'); }
    finally { setBusy(false); }
  };
  const unlink = async () => {
    if (!confirm('اتصالِ حساب حذف شود؟ کپی‌ترید متوقف می‌شود.')) return;
    setBusy(true);
    try { await userAPI.unlinkAccount(); qc.invalidateQueries({ queryKey: ['copyStatus'] }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-text-primary">اتصالِ حساب</h1>
        <p className="text-text-secondary text-sm">حساب MT5 خود را وصل کنید تا معاملات روی آن کپی شود</p>
      </div>

      {/* قانونِ بروکر */}
      <div className={`card p-4 flex items-center gap-3 ${paid ? 'border-brand-green/30' : 'border-brand-amber/30'}`}>
        {paid ? <ShieldCheck className="text-brand-green shrink-0" /> : <Lock className="text-brand-amber shrink-0" />}
        <div className="text-sm text-text-secondary">
          {paid
            ? 'شما اشتراکِ پولی دارید: می‌توانید حساب از هر بروکری وصل کنید.'
            : 'در پلنِ فعلی فقط حسابِ بروکرِ OneRoyal مجاز است. برای استفاده از سایر بروکرها، اشتراکِ پولی تهیه کنید.'}
        </div>
      </div>

      {acc ? (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <StatusLight tone={acc.status === 'connected' ? 'green' : acc.status === 'pending' ? 'amber' : 'red'} />
            <div className="flex-1">
              <div className="font-bold text-text-primary">{acc.broker}</div>
              <div className="text-xs text-text-muted">{acc.server} · حساب {acc.login_masked}</div>
            </div>
            <span className="text-sm text-text-secondary">
              {acc.status === 'connected' ? 'متصل' : acc.status === 'pending' ? 'در صفِ اتصال…' : 'خطا'}
            </span>
          </div>
          {acc.last_error && <p className="text-brand-red text-sm mb-3">{acc.last_error}</p>}
          <button onClick={unlink} disabled={busy} className="btn-danger text-sm flex items-center gap-2">
            <Trash2 size={15} /> حذفِ اتصال
          </button>
        </div>
      ) : (
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-text-primary flex items-center gap-2"><Link2 size={18} className="text-brand-blue" /> اتصالِ حساب جدید</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">نامِ بروکر</label>
              <input className="input" placeholder="مثلاً OneRoyal" value={form.broker} onChange={(e) => set('broker', e.target.value)} /></div>
            <div><label className="label">سرورِ MT5</label>
              <input className="input" dir="ltr" placeholder="OneRoyal-Server" value={form.server} onChange={(e) => set('server', e.target.value)} /></div>
            <div><label className="label">شمارهٔ حساب (Login)</label>
              <input className="input" dir="ltr" placeholder="9991073" value={form.login} onChange={(e) => set('login', e.target.value)} /></div>
            <div><label className="label">رمزِ معاملاتی (Master Password)</label>
              <input className="input" dir="ltr" type="password" placeholder="••••••••" value={form.password} onChange={(e) => set('password', e.target.value)} /></div>
          </div>
          <button onClick={link} disabled={busy || !form.broker || !form.server || !form.login || !form.password} className="btn-success w-full">
            {busy ? 'در حال ثبت…' : 'اتصالِ حساب'}
          </button>
          {ok && <p className="text-brand-green text-sm">{ok}</p>}
          {err && <p className="text-brand-red text-sm flex items-center gap-1.5"><AlertTriangle size={14} /> {err}</p>}
        </div>
      )}

      <Guide title="چطور حسابم را وصل کنم؟" defaultOpen={!acc}>
        برای کپی‌ترید، سیستمِ ما باید بتواند روی حسابِ شما معامله باز کند. برای این کار به مشخصاتِ
        حسابِ MT5 شما نیاز داریم:
        <br />• <b>سرور و شمارهٔ حساب:</b> در اپلیکیشنِ متاتریدرِ خودتان، بخشِ Account یا ایمیلِ افتتاحِ
        حساب از بروکر، این دو را می‌بینید.
        <br />• <b>رمزِ معاملاتی (Master/Trade Password):</b> همان رمزی که با آن به متاتریدر لاگین می‌کنید
        (نه رمزِ investor که فقط مشاهده است — آن اجازهٔ معامله نمی‌دهد).
        <br />🔒 رمزِ شما به‌صورتِ <b>رمزنگاری‌شده</b> ذخیره می‌شود و فقط برای اتصالِ امن به حسابتان استفاده می‌شود.
        <br />نکته: اگر اشتراکِ رایگان دارید، حساب باید نزدِ بروکرِ OneRoyal باشد.
      </Guide>
    </div>
  );
}
