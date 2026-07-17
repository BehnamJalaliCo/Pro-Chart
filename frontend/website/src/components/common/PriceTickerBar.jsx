import { useEffect, useRef, useState } from 'react';
import { toPersianDigits } from '../../utils/formatters';

/**
 * آیتم تکی تیکر قیمت
 */
function TickerItem({ symbol, price, change, positive }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2 whitespace-nowrap select-none">
      <span className="text-white font-bold text-sm">{symbol}</span>
      <span className="text-dark-200 font-mono text-sm">{price}</span>
      <span
        className={`text-xs font-medium font-mono ${
          positive ? 'text-bullish' : 'text-bearish'
        }`}
      >
        {positive ? (
          <svg
            className="w-3 h-3 inline-block ml-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 15.75l7.5-7.5 7.5 7.5"
            />
          </svg>
        ) : (
          <svg
            className="w-3 h-3 inline-block ml-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        )}
        {change}
      </span>
      {/* جداکننده */}
      <span className="text-dark-700 mr-2">|</span>
    </div>
  );
}

/**
 * PriceTickerBar - نوار اسکرول افقی قیمت‌های لحظه‌ای (افکت مارکی)
 *
 * @param {Object} props
 * @param {Array} [props.items] - آرایه آیتم‌ها [{symbol, price, change, positive}]
 * @param {number} [props.speed=40] - سرعت اسکرول (پیکسل در ثانیه)
 * @param {boolean} [props.pauseOnHover=true] - توقف هنگام هاور
 * @param {string} [props.className=''] - کلاس اضافی
 */
export default function PriceTickerBar({
  items: propItems,
  speed = 40,
  pauseOnHover = true,
  className = '',
}) {
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const [animationDuration, setAnimationDuration] = useState(20);
  const [isPaused, setIsPaused] = useState(false);

  // داده‌های پیش‌فرض
  const defaultItems = [
    { symbol: 'EUR/USD', price: '1.0872', change: '+0.15%', positive: true },
    { symbol: 'GBP/USD', price: '1.2634', change: '-0.08%', positive: false },
    { symbol: 'USD/JPY', price: '150.23', change: '+0.32%', positive: true },
    { symbol: 'XAU/USD', price: '2041.50', change: '+0.45%', positive: true },
    { symbol: 'USD/CHF', price: '0.8752', change: '-0.12%', positive: false },
    { symbol: 'AUD/USD', price: '0.6543', change: '+0.21%', positive: true },
    { symbol: 'NZD/USD', price: '0.6128', change: '-0.05%', positive: false },
    { symbol: 'EUR/GBP', price: '0.8604', change: '+0.09%', positive: true },
    { symbol: 'GBP/JPY', price: '189.45', change: '+0.28%', positive: true },
    { symbol: 'US30', price: '38,945', change: '+0.18%', positive: true },
    { symbol: 'NAS100', price: '17,520', change: '-0.22%', positive: false },
    { symbol: 'XAG/USD', price: '22.85', change: '+0.35%', positive: true },
  ];

  const items = propItems || defaultItems;

  // محاسبه مدت انیمیشن بر اساس عرض محتوا و سرعت
  useEffect(() => {
    if (contentRef.current) {
      const contentWidth = contentRef.current.scrollWidth / 2; // نصف عرض چون تکرار شده
      const duration = contentWidth / speed;
      setAnimationDuration(duration);
    }
  }, [items, speed]);

  return (
    <div
      className={`relative overflow-hidden bg-dark-900/80 backdrop-blur-sm border-y border-dark-800/50 ${className}`}
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
      ref={scrollRef}
      dir="ltr"
    >
      {/* گرادیان‌های محو در لبه‌ها */}
      <div className="absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-dark-900/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-dark-900/80 to-transparent z-10 pointer-events-none" />

      {/* محتوای اسکرول شونده */}
      <div
        ref={contentRef}
        className="flex"
        style={{
          animation: `ticker-scroll ${animationDuration}s linear infinite`,
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      >
        {/* محتوای اصلی */}
        {items.map((item, index) => (
          <TickerItem key={`a-${index}`} {...item} />
        ))}
        {/* تکرار برای ایجاد حلقه بدون وقفه */}
        {items.map((item, index) => (
          <TickerItem key={`b-${index}`} {...item} />
        ))}
      </div>

      {/* CSS انیمیشن */}
      <style>{`
        @keyframes ticker-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
