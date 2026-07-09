import React, { useRef, useState, useCallback } from 'react';

// لیستِ مجازی با ردیفِ ثابت‌ارتفاع (برای ۲۰۰۰+ نماد بدونِ jank).
// items: آرایه، rowH: px، height: ارتفاعِ viewport، renderRow: (item, index) => JSX،
// overscan: تعدادِ ردیفِ اضافه بالا/پایین، scrollToIndex: اسکرولِ برنامه‌ای (ناوبریِ کیبورد).
export default function VirtualList({ items, rowH = 44, height = 420, overscan = 6, renderRow, scrollToIndex }) {
  const ref = useRef(null);
  const [top, setTop] = useState(0);
  const onScroll = useCallback((e) => setTop(e.currentTarget.scrollTop), []);

  React.useEffect(() => {
    if (scrollToIndex == null || !ref.current) return;
    const y = scrollToIndex * rowH, vh = height, st = ref.current.scrollTop;
    if (y < st) ref.current.scrollTop = y;
    else if (y + rowH > st + vh) ref.current.scrollTop = y - vh + rowH;
  }, [scrollToIndex, rowH, height]);

  const total = items.length * rowH;
  const start = Math.max(0, Math.floor(top / rowH) - overscan);
  const end = Math.min(items.length, Math.ceil((top + height) / rowH) + overscan);
  const slice = items.slice(start, end);

  return (
    <div ref={ref} onScroll={onScroll} className="bn-thin-scroll" style={{ height, overflowY: 'auto', position: 'relative', touchAction: 'pan-y' }} role="listbox">
      <div style={{ height: total, position: 'relative' }}>
        {slice.map((it, i) => {
          const index = start + i;
          return (
            <div key={(it && it.symbol) || index} style={{ position: 'absolute', top: index * rowH, left: 0, right: 0, height: rowH }}>
              {renderRow(it, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
