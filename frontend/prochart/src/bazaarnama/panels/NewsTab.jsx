// اخبارِ بازار — فارسی، بدونِ عکس. منبع: /academy/bn/news (RSSِ بین‌المللی،
// خلاصه/ترجمهٔ فارسی توسطِ Claudeِ داخلِ سرور). بدنهٔ تبِ پنلِ راست. props: { symbol, TH }
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';

// زمانِ نسبیِ فارسی از unix-seconds
function relTime(ts) {
  if (!ts) return '';
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return 'هم‌اکنون';
  const m = Math.floor(s / 60); if (m < 60) return `${m} دقیقه پیش`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} ساعت پیش`;
  const d = Math.floor(h / 24); return `${d} روز پیش`;
}

function symbolKeywords(symbol = '') {
  const s = symbol.toUpperCase();
  const map = {
    EUR: ['eur', 'یورو'], USD: ['usd', 'دلار', 'فدرال', 'fed'], GBP: ['gbp', 'پوند'],
    JPY: ['jpy', 'ین'], XAU: ['xau', 'gold', 'طلا'], CAD: ['cad', 'کانادا'],
    AUD: ['aud', 'استرالیا'], CHF: ['chf', 'فرانک'], NZD: ['nzd', 'نیوزیلند'],
    OIL: ['oil', 'نفت'], XTI: ['oil', 'نفت'], US30: ['داو', 'dow'], US500: ['اس‌اند‌پی', 's&p'],
    NAS: ['نزدک', 'nasdaq'], DE40: ['دکس', 'dax'],
  };
  const out = new Set([s.toLowerCase()]);
  Object.keys(map).forEach((k) => { if (s.includes(k)) map[k].forEach((w) => out.add(w)); });
  return [...out];
}

export default function NewsTab({ symbol, TH }) {
  const [items, setItems] = useState(null); // null=loading
  const [onlyRelevant, setOnlyRelevant] = useState(false);
  const [onlyHigh, setOnlyHigh] = useState(false);

  useEffect(() => {
    let on = true;
    const load = () => api.bnNews().then((r) => { if (on) setItems(r?.items || []); }).catch(() => { if (on && items === null) setItems([]); });
    load();
    const id = setInterval(load, 60000);
    return () => { on = false; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kw = useMemo(() => symbolKeywords(symbol), [symbol]);
  const shown = useMemo(() => {
    let all = items || [];
    if (onlyHigh) all = all.filter((a) => (a.impact || 0) >= 8);
    if (!onlyRelevant) return all;
    return all.filter((a) => {
      const hay = `${a.title || ''} ${a.summary || ''}`.toLowerCase();
      return kw.some((w) => hay.includes(w));
    });
  }, [items, onlyRelevant, onlyHigh, kw]);

  const impactColor = (n) => (n >= 8 ? TH.down : n >= 5 ? '#f59e0b' : TH.subtle || TH.text);
  const impactLabel = (n) => (n >= 8 ? 'پراثر' : n >= 5 ? 'متوسط' : 'کم‌اثر');

  return (
    <div className="flex flex-col text-xs" style={{ color: TH.text }}>
      <div className="flex items-center justify-between px-3 h-9 border-b shrink-0" style={{ borderColor: TH.border, background: TH.panel }}>
        <span className="text-[10px] font-medium tracking-wide" style={{ color: TH.textStrong }}>مهم‌ترین اخبارِ بازار</span>
        <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: TH.bg, border: `1px solid ${TH.border}` }}>
        <button onClick={() => setOnlyHigh((v) => !v)} title="فقط اخبارِ پراثر"
          className="px-2.5 h-[24px] rounded-md text-[10px] font-medium transition-colors"
          style={{ background: onlyHigh ? TH.down : 'transparent', color: onlyHigh ? '#fff' : TH.text }}
          onMouseEnter={(e) => { if (!onlyHigh) e.currentTarget.style.background = TH.chipBgHover; }}
          onMouseLeave={(e) => { if (!onlyHigh) e.currentTarget.style.background = 'transparent'; }}>پراثر</button>
        <button onClick={() => setOnlyRelevant((v) => !v)}
          className="px-2.5 h-[24px] rounded-md text-[10px] font-medium transition-colors"
          style={{ background: onlyRelevant ? TH.accent : 'transparent', color: onlyRelevant ? '#fff' : TH.text }} dir="rtl"
          onMouseEnter={(e) => { if (!onlyRelevant) e.currentTarget.style.background = TH.chipBgHover; }}
          onMouseLeave={(e) => { if (!onlyRelevant) e.currentTarget.style.background = 'transparent'; }}>
          مرتبط با <span dir="ltr">{symbol}</span>
        </button>
        </div>
      </div>

      <div className="overflow-auto">
        {items === null && <div className="px-3 py-10 text-center opacity-40 text-[11px]">در حالِ دریافتِ اخبار…</div>}
        {items !== null && shown.length === 0 && (
          <div className="px-3 py-10 text-center opacity-40 text-[11px]">
            {onlyRelevant ? `خبرِ مرتبط با ${symbol} یافت نشد.` : 'فعلاً خبری نیست.'}
          </div>
        )}
        <div className="flex flex-col gap-1.5 p-2">
        {shown.map((a, i) => {
          const imp = a.impact || 0;
          const c = impactColor(imp);
          return (
          <button key={i} onClick={() => a.url && window.open(a.url, '_blank', 'noopener,noreferrer')}
            className="group block w-full text-right px-2.5 py-2.5 rounded-lg border transition-colors"
            style={{ borderColor: TH.border, background: TH.panel }}
            onMouseEnter={(e) => { e.currentTarget.style.background = TH.chipBgHover; e.currentTarget.style.borderColor = c; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = TH.panel; e.currentTarget.style.borderColor = TH.border; }}>
            <div className="flex items-start gap-2">
              <span className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] leading-5 font-medium" style={{ color: TH.textStrong }}>{a.title}</div>
                {a.summary && <div className="text-[10px] leading-5 mt-1 opacity-70">{a.summary}</div>}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="px-1.5 h-[15px] inline-flex items-center rounded text-[8px] font-semibold shrink-0"
                    style={{ color: c, background: `${c}1f`, border: `1px solid ${c}33` }}>{impactLabel(imp)}</span>
                  <span className="flex items-center gap-1.5 text-[9px] opacity-50 min-w-0" dir="ltr">
                    <span className="truncate">{a.source}</span><span>·</span><span dir="rtl" className="shrink-0">{relTime(a.ts)}</span>
                  </span>
                </div>
              </div>
            </div>
          </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
