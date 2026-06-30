import { Lock, LogOut, Clock } from 'lucide-react';
import { useAuth } from '../store';

// state: 'buy' (نیاز به اشتراکِ پولی) | 'pending' (پولی ولی منتظرِ تأییدِ مدیریت)
export default function VipGate({ state = 'buy' }) {
  const { logout, profile } = useAuth();
  const pending = state === 'pending';

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="card p-8 w-full max-w-md text-center">
        <div className={`w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center ${
          pending ? 'bg-brand-blue/15 text-brand-blue' : 'bg-brand-amber/15 text-brand-amber'}`}>
          {pending ? <Clock size={30} /> : <Lock size={30} />}
        </div>

        {pending ? (
          <>
            <h1 className="text-xl font-black text-text-primary mb-2">در انتظارِ تأییدِ مدیریت</h1>
            <p className="text-text-secondary text-sm leading-7 mb-6">
              {profile?.name && <b>{profile.name} عزیز، </b>}
              اشتراکِ شما فعال است و درخواستتان برای دسترسی به پنل ثبت شد. به‌محضِ
              تأییدِ مدیریت، دسترسیِ کامل (اتصالِ حساب و کپی‌ترید) فعال می‌شود.
              معمولاً کوتاه طول می‌کشد.
            </p>
            <a href="https://t.me/CoinePro_Admin" target="_blank" rel="noopener noreferrer"
              className="btn-primary inline-block w-full mb-3">پیگیری از پشتیبانی</a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-black text-text-primary mb-2">دسترسی ویژهٔ اعضای VIPِ پولی</h1>
            <p className="text-text-secondary text-sm leading-7 mb-6">
              {profile?.name && <b>{profile.name} عزیز، </b>}
              پنلِ کپی‌ترید فقط برای کاربرانِ دارایِ <b>اشتراکِ پولی</b> (ماهانه/سه‌ماهه/شش‌ماهه)
              و با تأییدِ مدیریت فعال است. تریالِ رایگانِ ۴۸ساعته شاملِ این پنل نمی‌شود.
              برای استفاده، اشتراکِ پولی تهیه کنید.
            </p>
            <a href="https://t.me/CoineProFxBot" target="_blank" rel="noopener noreferrer"
              className="btn-success inline-block w-full mb-3">تهیهٔ اشتراکِ VIP از ربات</a>
          </>
        )}

        <button onClick={logout} className="text-text-muted text-sm hover:text-text-primary flex items-center gap-1.5 mx-auto">
          <LogOut size={15} /> خروج
        </button>
      </div>
    </div>
  );
}
