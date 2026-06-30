import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { userAPI } from '../api/client';
import { useAuth } from '../store';
import TelegramLogin from '../components/TelegramLogin';

export default function LoginPage() {
  const { login, setProfile } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
  const inWebApp = !!(tg && tg.initData);

  const { data: cfg } = useQuery({
    queryKey: ['authCfg'], queryFn: () => userAPI.authConfig(), staleTime: 3600e3, enabled: !inWebApp,
  });

  const finish = (res) => { login(res.token, res.profile); setProfile(res.profile); nav('/', { replace: true }); };

  // داخلِ Telegram WebApp: ورودِ خودکار با initData
  useEffect(() => {
    if (!inWebApp) return;
    try { tg.ready(); tg.expand(); } catch { /* noop */ }
    setBusy(true);
    userAPI.loginWebApp(tg.initData)
      .then(finish)
      .catch((e) => setErr(e?.message || 'ورود خودکار ناموفق بود.'))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inWebApp]);

  const onAuth = async (user) => {
    setErr(''); setBusy(true);
    try {
      const res = await userAPI.loginTelegram(user);
      finish(res);
    } catch (e) {
      setErr(e?.message || 'ورود ناموفق بود.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="card p-8 w-full max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-brand-green/15 text-brand-green flex items-center justify-center text-3xl font-black">C</div>
        <h1 className="text-2xl font-black text-text-primary mb-1">پنل کاربری CoinePro FX</h1>
        <p className="text-text-secondary text-sm leading-7 mb-7">
          برای ورود، با همان حساب تلگرامی که اشتراک VIP دارید وارد شوید. ورود امن و رمزنگاری‌شده است.
        </p>

        <div className="flex flex-col items-center gap-3">
          {inWebApp ? (
            <span className="text-text-muted text-sm">{busy ? 'در حال ورود…' : 'آماده‌سازی…'}</span>
          ) : (
            <>
              {/* راهِ اصلی و بی‌دردسر: بازکردن از داخلِ تلگرام (ورودِ خودکار) */}
              <a href="https://t.me/CoineProFxBot"
                className="btn-success w-full text-center">
                بازکردن در تلگرام (ورودِ خودکار)
              </a>
              <p className="text-text-muted text-xs leading-6">
                داخلِ ربات، دکمهٔ <b>«پنل کاربری»</b> یا <b>«🔁 کپی‌ترید»</b> را بزنید — بدونِ
                نیاز به رمز، خودکار وارد می‌شوید.
              </p>
              {/* راهِ جایگزین: ورودِ مرورگری با ویجتِ تلگرام (نیازمندِ تنظیمِ دامنه) */}
              <div className="w-full border-t border-surface-border my-1" />
              <span className="text-text-muted text-xs">یا ورود در همین مرورگر:</span>
              {cfg?.bot_username && <TelegramLogin botUsername={cfg.bot_username} onAuth={onAuth} />}
              {busy && <span className="text-text-muted text-sm">در حال ورود…</span>}
            </>
          )}
          {err && <span className="text-brand-red text-sm">{err}</span>}
        </div>

        <p className="text-text-muted text-xs mt-7 leading-6">
          هنوز اشتراک ندارید؟ از ربات تلگرام
          <a href="https://t.me/CoineProFxBot" className="text-brand-blue mx-1">@CoineProFxBot</a>
          اشتراک VIP تهیه کنید.
        </p>
      </div>
    </div>
  );
}
