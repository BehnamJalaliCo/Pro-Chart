import { motion } from 'framer-motion';
import { toPersianDigits, getSignalStrengthLabel, getDirectionLabel } from '../../utils/formatters';

/**
 * وضعیت سیگنال به صورت بج رنگی
 */
function StatusBadge({ status }) {
  const statusMap = {
    active: { text: 'فعال', cls: 'bg-accent/10 text-accent border-accent/20' },
    tp_hit: { text: 'سود محقق شد', cls: 'bg-bullish/10 text-bullish border-bullish/20' },
    tp1_hit: { text: 'TP1 فعال', cls: 'bg-bullish/10 text-bullish border-bullish/20' },
    tp2_hit: { text: 'TP2 فعال', cls: 'bg-bullish/10 text-bullish border-bullish/20' },
    tp3_hit: { text: 'TP3 فعال', cls: 'bg-bullish/10 text-bullish border-bullish/20' },
    sl_hit: { text: 'حد ضرر فعال شد', cls: 'bg-bearish/10 text-bearish border-bearish/20' },
    cancelled: { text: 'لغو شده', cls: 'bg-dark-600/30 text-dark-400 border-dark-600/30' },
    closed: { text: 'بسته شده', cls: 'bg-dark-600/30 text-dark-300 border-dark-600/30' },
    pending: { text: 'در انتظار', cls: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  };
  const s = statusMap[status] || statusMap.active;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${s.cls}`}>
      {s.text}
    </span>
  );
}

/**
 * نوار امتیاز قدرت سیگنال
 */
function ScoreBar({ score }) {
  const clampedScore = Math.max(0, Math.min(100, score || 0));
  const barColor =
    clampedScore >= 75
      ? 'bg-bullish'
      : clampedScore >= 50
        ? 'bg-yellow-500'
        : clampedScore >= 25
          ? 'bg-orange-500'
          : 'bg-bearish';
  const trackColor =
    clampedScore >= 75
      ? 'bg-bullish/10'
      : clampedScore >= 50
        ? 'bg-yellow-500/10'
        : clampedScore >= 25
          ? 'bg-orange-500/10'
          : 'bg-bearish/10';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 h-1.5 rounded-full ${trackColor} overflow-hidden`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clampedScore}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
      <span className="text-dark-400 text-xs font-mono min-w-[2rem] text-left">
        {toPersianDigits(String(clampedScore))}%
      </span>
    </div>
  );
}

/**
 * SignalCard - کارت سیگنال معاملاتی قابل استفاده مجدد
 *
 * @param {Object} props
 * @param {Object} props.signal - داده سیگنال
 * @param {string} props.signal.symbol - نماد (مثلا EUR/USD)
 * @param {'BUY'|'SELL'} props.signal.direction - جهت معامله
 * @param {string|number} props.signal.entry - قیمت ورود
 * @param {string|number} [props.signal.tp1] - حد سود ۱
 * @param {string|number} [props.signal.tp2] - حد سود ۲
 * @param {string|number} [props.signal.tp3] - حد سود ۳
 * @param {string|number} props.signal.sl - حد ضرر
 * @param {number} [props.signal.score] - امتیاز قدرت (۰ تا ۱۰۰)
 * @param {string} [props.signal.strength] - برچسب قدرت فارسی
 * @param {string} [props.signal.status='active'] - وضعیت سیگنال
 * @param {string} [props.signal.timeframe] - تایم‌فریم
 * @param {string} [props.signal.time] - زمان ارسال
 * @param {string|number} [props.signal.pnl] - سود/زیان به پیپ
 * @param {boolean} [props.compact=false] - حالت فشرده
 * @param {Function} [props.onClick] - رویداد کلیک
 * @param {string} [props.className=''] - کلاس اضافی
 */
export default function SignalCard({
  signal,
  compact = false,
  onClick,
  className = '',
}) {
  const {
    symbol,
    direction,
    entry,
    tp1,
    tp2,
    tp3,
    sl,
    score,
    strength,
    status = 'active',
    timeframe,
    time,
    pnl,
  } = signal;

  const isBuy = direction === 'BUY';
  const directionLabel = getDirectionLabel(direction);
  const strengthLabel = strength || (score != null ? getSignalStrengthLabel(score) : null);

  const glowClass = isBuy ? 'glow-bullish' : 'glow-bearish';
  const hoverShadow = isBuy
    ? 'hover:shadow-bullish/5 hover:shadow-lg'
    : 'hover:shadow-bearish/5 hover:shadow-lg';

  /**
   * فرمت زمان نسبی ساده
   */
  function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'لحظاتی پیش';
    if (minutes < 60) return `${toPersianDigits(String(minutes))} دقیقه پیش`;
    if (hours < 24) return `${toPersianDigits(String(hours))} ساعت پیش`;
    return `${toPersianDigits(String(days))} روز پیش`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={`glass-card p-5 transition-all ${glowClass} ${hoverShadow} ${
        onClick ? 'cursor-pointer' : ''
      } hover:border-dark-600/80 ${className}`}
    >
      {/* هدر: نماد + جهت + وضعیت */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg">{symbol}</span>
          <span className={isBuy ? 'badge-bullish' : 'badge-bearish'}>
            {directionLabel}
          </span>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* قیمت‌ها */}
      {compact ? (
        /* حالت فشرده: ورود + حد سود + حد ضرر */
        <div className="grid grid-cols-3 gap-2 text-sm mb-3">
          <div>
            <span className="text-dark-500 text-xs block">ورود</span>
            <span className="text-white font-mono">{entry}</span>
          </div>
          <div>
            <span className="text-dark-500 text-xs block">حد سود</span>
            <span className="text-bullish font-mono">{tp1 || '-'}</span>
          </div>
          <div>
            <span className="text-dark-500 text-xs block">حد ضرر</span>
            <span className="text-bearish font-mono">{sl}</span>
          </div>
        </div>
      ) : (
        /* حالت کامل: ورود + TP1/TP2/TP3 + SL */
        <div className="space-y-2 text-sm mb-3">
          <div className="flex justify-between">
            <span className="text-dark-400">نقطه ورود:</span>
            <span className="text-white font-mono font-medium">{entry}</span>
          </div>
          {tp1 && (
            <div className="flex justify-between">
              <span className="text-dark-400">حد سود ۱:</span>
              <span className="text-bullish font-mono">{tp1}</span>
            </div>
          )}
          {tp2 && (
            <div className="flex justify-between">
              <span className="text-dark-400">حد سود ۲:</span>
              <span className="text-bullish font-mono">{tp2}</span>
            </div>
          )}
          {tp3 && (
            <div className="flex justify-between">
              <span className="text-dark-400">حد سود ۳:</span>
              <span className="text-bullish font-mono">{tp3}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-dark-400">حد ضرر:</span>
            <span className="text-bearish font-mono">{sl}</span>
          </div>
        </div>
      )}

      {/* نوار امتیاز قدرت */}
      {score != null && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-dark-500 text-xs">قدرت سیگنال</span>
            {strengthLabel && (
              <span
                className={`text-xs font-medium ${
                  score >= 75
                    ? 'text-bullish'
                    : score >= 50
                      ? 'text-yellow-500'
                      : 'text-dark-400'
                }`}
              >
                {strengthLabel}
              </span>
            )}
          </div>
          <ScoreBar score={score} />
        </div>
      )}

      {/* پاورقی: تایم‌فریم + زمان + سود/زیان */}
      <div className="flex items-center justify-between pt-3 border-t border-dark-800/50">
        <div className="flex items-center gap-3">
          {timeframe && (
            <span className="text-dark-500 text-xs bg-dark-800/50 px-2 py-0.5 rounded">
              {timeframe}
            </span>
          )}
          {time && (
            <span className="text-dark-500 text-xs">
              {formatRelativeTime(time)}
            </span>
          )}
          {!timeframe && !time && strengthLabel && !score && (
            <span
              className={`text-xs font-medium ${
                strengthLabel === 'قوی'
                  ? 'text-bullish'
                  : strengthLabel === 'متوسط'
                    ? 'text-yellow-500'
                    : 'text-dark-400'
              }`}
            >
              قدرت: {strengthLabel}
            </span>
          )}
        </div>
        {pnl != null && (
          <span
            className={`text-sm font-bold font-mono ${
              String(pnl).startsWith('+') || Number(pnl) > 0
                ? 'text-bullish'
                : String(pnl).startsWith('-') || Number(pnl) < 0
                  ? 'text-bearish'
                  : 'text-dark-400'
            }`}
          >
            {String(pnl).startsWith('+') || String(pnl).startsWith('-')
              ? pnl
              : Number(pnl) > 0
                ? `+${pnl}`
                : pnl}{' '}
            پیپ
          </span>
        )}
      </div>
    </motion.div>
  );
}
