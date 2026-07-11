import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, Minus, Activity } from 'lucide-react';
import { bnAPI } from '../../api/client';
import { toPersianDigits } from '../../utils/formatters';
import { SkeletonBox } from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import LiveDot from '../common/LiveDot';

/**
 * LiveMarketTape — نوار روان و زنده‌ی قیمت تمام نمادها (marquee).
 *
 * داده‌ی واقعی از bnAPI.getMarket (هر ۵ ثانیه refetch). هر آیتم:
 *   نماد · آخرین قیمت (monospace) · درصد تغییر با رنگ سبز/قرمز + فلش.
 * هنگام تغییر قیمت، پس‌زمینه‌ی آیتم به‌صورت کوتاه سبز/قرمز فلش می‌شود.
 * حلقه‌ی بی‌درز (دو نسخه‌ی پشت‌سرهم) و توقف روی hover.
 *
 * props:
 *   height : number = 40   (ارتفاع نوار، px)
 *   className : string
 */

function fmtPrice(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  const decimals = abs >= 1000 ? 2 : abs >= 1 ? 2 : 4;
  const s = n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return toPersianDigits(s);
}

function fmtPct(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return toPersianDigits(`${sign}${n.toFixed(2)}٪`);
}

function TapeItem({ item, flash }) {
  const chg = Number(item.changePct);
  const up = !Number.isNaN(chg) && chg > 0;
  const down = !Number.isNaN(chg) && chg < 0;

  const chgColor = up
    ? 'text-brand-green'
    : down
    ? 'text-brand-red'
    : 'text-text-muted';

  const ChgIcon = up ? ArrowUp : down ? ArrowDown : Minus;

  return (
    <div
      className="relative flex items-center gap-2.5 px-4 h-full whitespace-nowrap select-none border-l border-surface-border/60"
    >
      {/* لایه‌ی فلش (با key بیرونی remount می‌شود) */}
      {flash && (
        <span
          key={flash.seq}
          className={`absolute inset-0 pointer-events-none ${
            flash.dir === 'green' ? 'flash-green' : 'flash-red'
          }`}
          aria-hidden="true"
        />
      )}

      <span
        dir="ltr"
        className="font-semibold text-[13px] text-text-primary tracking-wide"
      >
        {item.symbol}
      </span>

      <span
        dir="ltr"
        className="font-mono tabular-nums text-[13px] text-text-secondary"
      >
        {fmtPrice(item.last)}
      </span>

      <span
        className={`inline-flex items-center gap-0.5 font-mono tabular-nums text-[12px] font-medium ${chgColor}`}
      >
        <ChgIcon size={12} strokeWidth={2.5} />
        {fmtPct(item.changePct)}
      </span>
    </div>
  );
}

export default function LiveMarketTape({ height = 40, className = '' }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bn', 'market', 'tape'],
    queryFn: () => bnAPI.getMarket(),
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
    staleTime: 4000,
  });

  const items = useMemo(
    () => (Array.isArray(data?.items) ? data.items.filter((it) => it && it.symbol) : []),
    [data]
  );

  // ردیابی قیمت قبلی برای فلش سبز/قرمز روی تغییر
  const prevRef = useRef({}); // symbol -> { price, seq }
  const [flashMap, setFlashMap] = useState({});

  useEffect(() => {
    if (!items.length) return;
    const prev = prevRef.current;
    const nextFlash = {};
    let changed = false;
    items.forEach((it) => {
      const price = Number(it.last);
      if (Number.isNaN(price)) return;
      const rec = prev[it.symbol];
      if (rec && rec.price !== price) {
        const seq = (rec.seq || 0) + 1;
        prev[it.symbol] = { price, seq };
        nextFlash[it.symbol] = { dir: price > rec.price ? 'green' : 'red', seq };
        changed = true;
      } else if (!rec) {
        prev[it.symbol] = { price, seq: 0 };
      }
    });
    if (changed) setFlashMap((m) => ({ ...m, ...nextFlash }));
  }, [items]);

  const wrapClass = `relative w-full overflow-hidden bg-surface-card/60 border-y border-surface-border ${className}`;

  // حالت loading — شیمر ملایم
  if (isLoading) {
    return (
      <div className={wrapClass} style={{ height }} aria-busy="true">
        <div className="flex items-center h-full gap-6 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <SkeletonBox className="h-3 w-14" />
              <SkeletonBox className="h-3 w-12" />
              <SkeletonBox className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // حالت خطا
  if (isError) {
    return (
      <div className={wrapClass} style={{ minHeight: Math.max(height, 64) }}>
        <ErrorState
          compact
          description="دریافت داده‌ی بازار ممکن نشد."
          onRetry={refetch}
        />
      </div>
    );
  }

  // حالت خالی
  if (!items.length) {
    return (
      <div className={wrapClass} style={{ minHeight: Math.max(height, 64) }}>
        <EmptyState
          compact
          icon={Activity}
          title="داده‌ی بازار در دسترس نیست"
          description="در حال حاضر نمادی برای نمایش وجود ندارد."
        />
      </div>
    );
  }

  // دو نسخه‌ی پشت‌سرهم برای حلقه‌ی بی‌درز
  const loop = [...items, ...items];

  return (
    <div className={wrapClass} style={{ height }} role="marquee" aria-label="نوار زنده‌ی بازار">
      {/* نشان زنده‌بودن سمت راست (RTL) */}
      <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5 h-full px-3 bg-gradient-to-l from-surface-card via-surface-card/90 to-transparent">
        <LiveDot color="green" size={7} />
        <span className="text-[11px] font-medium text-text-muted">زنده</span>
      </div>

      {/* لبه‌ی محوکننده‌ی سمت چپ */}
      <div className="absolute left-0 top-0 z-10 h-full w-12 bg-gradient-to-r from-surface-card to-transparent pointer-events-none" />

      <div className="marquee-paused h-full flex items-center">
        <div className="animate-marquee flex items-center h-full w-max">
          {loop.map((item, i) => (
            <TapeItem
              key={`${item.symbol}-${i}`}
              item={item}
              flash={flashMap[item.symbol]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
