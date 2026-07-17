import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AtSign, Plus, Trash2, Instagram, Loader2, ShieldCheck, Power, Eye, EyeOff } from 'lucide-react';
import { api } from '../api/client';
import { PageHeader, Empty, Spinner, Modal, useToast } from '../components/ui';
import { useAuth } from '../store';

export default function Accounts() {
  const qc = useQueryClient();
  const { me, setMe, setAccount } = useAuth();
  const [show, msgNode] = useToast();
  const [open, setOpen] = useState(false);
  const { data: accts, isLoading } = useQuery({ queryKey: ['ig-accounts'], queryFn: api.accounts });

  const [form, setForm] = useState({ username: '', password: '', totp_secret: '', verification_code: '' });
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const reset = () => { setForm({ username: '', password: '', totp_secret: '', verification_code: '' }); setChallenge(false); };

  const add = async () => {
    setBusy(true);
    try {
      const res = await api.addAccount(form);
      if (res.ok) {
        show('اکانت با موفقیت اضافه شد ✓');
        setOpen(false); reset();
        qc.invalidateQueries({ queryKey: ['ig-accounts'] });
        api.me().then(setMe).catch(() => {});
      } else if (res.challenge) {
        setChallenge(true);
        show('کدِ تأییدِ دو‌مرحله‌ای را وارد کنید', 'err');
      } else {
        show(res.message || 'اتصال ناموفق', 'err');
      }
    } catch (e) { show(e.message || 'خطا', 'err'); } finally { setBusy(false); }
  };

  const remove = async (a) => {
    if (!confirm(`حذفِ @${a.username}؟`)) return;
    try { await api.removeAccount(a.id); show('حذف شد'); qc.invalidateQueries({ queryKey: ['ig-accounts'] }); api.me().then(setMe).catch(() => {}); }
    catch (e) { show(e.message, 'err'); }
  };

  const toggle = async (a) => {
    try { await api.smartToggle(a.id); qc.invalidateQueries({ queryKey: ['ig-accounts'] }); } catch (e) { show(e.message, 'err'); }
  };

  const full = (accts?.length || 0) >= (me?.max_accounts || 3);

  return (
    <div>
      {msgNode}
      <PageHeader title="اکانت‌های اینستاگرام" sub={`${accts?.length || 0} از ${me?.max_accounts || 3} اکانت`} icon={AtSign}
        action={<button className="btn-primary" disabled={full} onClick={() => { reset(); setOpen(true); }}><Plus size={17} /> افزودن اکانت</button>} />
      {isLoading ? <Spinner /> : (accts?.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accts.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-brand-grad grid place-items-center text-white overflow-hidden shrink-0">
                  {a.avatar_url ? <img src={a.avatar_url} className="w-full h-full object-cover" /> : <Instagram size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-ink truncate">@{a.username}</div>
                  <div className="text-xs text-ink-muted truncate">{a.full_name || '—'}</div>
                </div>
                <span className={`chip ${a.status === 'online' ? 'bg-green-50 text-accent-green' : a.status === 'challenge' ? 'bg-amber-50 text-accent-amber' : 'bg-slate-100 text-ink-muted'}`}>
                  {a.status === 'online' ? 'آنلاین' : a.status === 'challenge' ? 'نیازِ تأیید' : 'آفلاین'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button onClick={() => toggle(a)} className={`btn flex-1 text-xs ${a.smart_enabled ? 'btn-soft' : 'btn-ghost'}`}>
                  <Power size={14} /> پاسخ هوشمند {a.smart_enabled ? 'روشن' : 'خاموش'}
                </button>
                <button onClick={() => remove(a)} className="btn-ghost px-2.5 text-accent-red"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={Instagram} title="هنوز اکانتی اضافه نکرده‌اید" sub="اولین اکانتِ اینستاگرامِ خود را وصل کنید تا مدیریت شروع شود."
          action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={17} /> افزودن اکانت</button>} />
      ))}

      <Modal open={open} onClose={() => setOpen(false)} title="افزودن اکانت اینستاگرام">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-ink-muted bg-brand-50 rounded-xl p-3">
            <ShieldCheck size={16} className="text-brand shrink-0" /> رمز شما رمزنگاری‌شده ذخیره می‌شود و هرگز نمایش داده نمی‌شود.
          </div>
          <div>
            <label className="label">نام کاربری اینستاگرام</label>
            <input className="input" dir="ltr" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" />
          </div>
          <div>
            <label className="label">رمز عبور</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} className="input pl-10" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              <button type="button" onClick={() => setShowPw((s) => !s)} tabIndex={-1}
                title={showPw ? 'پنهان‌کردنِ رمز' : 'نمایشِ رمز'}
                className="absolute left-3 top-3 text-ink-muted hover:text-ink">
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
          {challenge ? (
            <div>
              <label className="label">کدِ تأییدِ دو‌مرحله‌ای (۲FA)</label>
              <input className="input" dir="ltr" value={form.verification_code} onChange={(e) => setForm({ ...form, verification_code: e.target.value })} placeholder="123456" />
            </div>
          ) : (
            <details className="text-sm">
              <summary className="text-ink-muted cursor-pointer">احراز دو‌مرحله‌ای دارید؟ (اختیاری)</summary>
              <input className="input mt-2" dir="ltr" value={form.totp_secret} onChange={(e) => setForm({ ...form, totp_secret: e.target.value })} placeholder="TOTP secret (اختیاری)" />
            </details>
          )}
          <button className="btn-primary w-full py-3" disabled={busy || !form.username || !form.password} onClick={add}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : 'اتصال اکانت'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
