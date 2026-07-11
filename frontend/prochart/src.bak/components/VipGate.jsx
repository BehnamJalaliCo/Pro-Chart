import { Link } from 'react-router-dom';
import { Crown, Lock, Check } from 'lucide-react';
import { useAuth } from '../store';

const PERKS = [
  '۱۶۰ درسِ کامل در ۴ سطح (مقدماتی تا حرفه‌ای)',
  'مربیِ هوشِ مصنوعیِ اختصاصی و تحلیلِ زندهٔ چارت',
  'حسابِ مجازی، آزمایشگاهِ استراتژی و اتوماسیون',
  'بوت‌کمپِ زمان‌دار، چالشِ فاندد و گواهیِ معتبر',
  'ژورنالِ حرفه‌ای، انجمنِ خصوصی و ابزارهای بازار',
];

/** محافظِ بخش‌های ویژهٔ VIP — اگر کاربر رایگان/منقضی باشد، صفحهٔ ارتقا نمایش داده می‌شود. */
export default function VipGate({ children, title = 'این بخش ویژهٔ اعضای VIP است' }) {
  const { me } = useAuth();
  const tier = me?.tier || 'free';
  if (tier !== 'free') return children;

  return (
    <div className="max-w-lg mx-auto py-6">
      <div className="card p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
          <Lock size={30} className="text-amber-400" />
        </div>
        <h1 className="text-lg font-black mb-1">{title}</h1>
        <p className="text-sm text-text-secondary mb-5">با اشتراکِ VIP به همهٔ امکاناتِ آکادمی دسترسی کامل پیدا می‌کنی.</p>

        <ul className="text-right space-y-2 mb-6">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-text-secondary">
              <Check size={16} className="text-brand-green shrink-0 mt-0.5" /> <span>{p}</span>
            </li>
          ))}
        </ul>

        <Link to="/subscribe" className="btn-success w-full flex items-center justify-center gap-2 text-sm py-3">
          <Crown size={18} /> ارتقا به VIP
        </Link>
        <p className="text-[11px] text-text-muted mt-3">
          کاربرانِ رایگان به ۵ درسِ نخستِ هر سطح، سطح‌سنجی و واژه‌نامه دسترسی دارند.
        </p>
      </div>
    </div>
  );
}
