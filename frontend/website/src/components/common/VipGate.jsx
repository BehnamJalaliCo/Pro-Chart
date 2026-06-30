import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { vipAuthAPI, vipSession, signalsAPI } from '../../api/client';
import TelegramLogin from './TelegramLogin';

const BOT_URL = 'https://t.me/CoineProFxBot';

/**
 * گِیتِ بخشِ سیگنال: آمارِ عمومی نمایش داده می‌شود (تا کاربر سوددهی را ببیند)
 * ولی جزئیاتِ سیگنال فقط پس از ورودِ تلگرام و تأییدِ اشتراکِ VIP باز می‌شود.
 */
export default function VipGate({ onAuthed }) {
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [notVip, setNotVip] = useState(false);

  const { data: cfg } = useQuery({
    queryKey: ['vipAuthConfig'],
    queryFn: () => vipAuthAPI.getConfig(),
    staleTime: 60 * 60 * 1000,
  });
  const { data: stats } = useQuery({
    queryKey: ['signalStats'],
    queryFn: () => signalsAPI.getStats(),
    refetchInterval: 60000,
  });

  const handleAuth = async (user) => {
    setErr(''); setNotVip(false); setLoading(true);
    try {
      const res = await vipAuthAPI.loginTelegram(user);
      vipSession.save(res);
      if (res?.is_vip) {
        onAuthed?.(res);
      } else {
        setNotVip(true);
      }
    } catch (e) {
      setErr(e?.message || 'ورود ناموفق بود. دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    { label: 'نرخ برد', value: stats ? `${Number(stats.win_rate).toLocaleString('fa-IR')}٪` : '—', cls: 'text-bullish' },
    { label: 'مجموع پیپ', value: stats ? Number(stats.total_pips).toLocaleString('fa-IR') : '—', cls: 'text-accent' },
    { label: 'کل سیگنال‌ها', value: stats ? Number(stats.total_signals).toLocaleString('fa-IR') : '—', cls: 'text-white' },
    { label: 'سیگنال فعال', value: stats ? Number(stats.active).toLocaleString('fa-IR') : '—', cls: 'text-yellow-500' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto">
      {/* آمارِ عمومی — اثباتِ سوددهی */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="glass-card p-4 text-center">
            <div className={`text-2xl font-black ${c.cls}`}>{c.value}</div>
            <div className="text-dark-400 text-xs mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* قفلِ VIP */}
      <div className="glass-card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-white mb-2">بخش سیگنال‌ها ویژهٔ اعضای VIP است</h2>
        <p className="text-dark-400 leading-8 mb-6 max-w-xl mx-auto">
          برای مشاهدهٔ سیگنال‌های زنده با نقطهٔ ورود، حد ضرر و سه حد سود، با همان حساب
          تلگرامی که اشتراک VIP دارید وارد شوید. آمار و عملکردِ کلی برای همه قابل‌مشاهده است.
        </p>

        {!notVip && (
          <div className="flex flex-col items-center gap-3">
            {cfg?.bot_username
              ? <TelegramLogin botUsername={cfg.bot_username} onAuth={handleAuth} />
              : <span className="text-dark-500 text-sm">در حال بارگذاری دکمهٔ ورود…</span>}
            {loading && <span className="text-dark-400 text-sm">در حال بررسی اشتراک…</span>}
            {err && <span className="text-bearish text-sm">{err}</span>}
          </div>
        )}

        {notVip && (
          <div className="mt-2">
            <div className="bg-bearish/10 border border-bearish/20 rounded-xl p-4 mb-4">
              <p className="text-bearish font-bold mb-1">اشتراک فعالی پیدا نشد</p>
              <p className="text-dark-300 text-sm leading-7">
                این حساب تلگرام اشتراک VIP فعال ندارد. برای تهیه یا تمدیدِ اشتراک از ربات اقدام کنید،
                سپس دوباره وارد شوید.
              </p>
            </div>
            <a href={BOT_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-colors">
              تهیهٔ اشتراک VIP از ربات
            </a>
            <button onClick={() => { setNotVip(false); vipSession.clear(); }}
              className="block mx-auto mt-4 text-dark-400 text-sm hover:text-white transition-colors">
              ورود با حساب دیگر
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
