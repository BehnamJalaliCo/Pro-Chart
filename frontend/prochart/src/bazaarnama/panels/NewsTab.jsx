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
    const all = items || [];
    if (!onlyRelevant) return all;
    return all.filter((a) => {
      const hay = `${a.title || ''} ${a.summary || ''}`.toLowerCase();
      return kw.some((w) => hay.includes(w));
    });
  }, [items, onlyRelevant, kw]);

  const impactColor = (n) => (n >= 8 ? TH.down : n >= 5 ? '#f59e0b' : TH.text);

  return (
    <div className="flex flex-col text-xs" style={{ color: TH.text }}>
      <div className="flex items-center justify-between px-3 h-8 border-b shrink-0" style={{ borderColor: TH.border }}>
        <span className="opacity-50 text-[10px]">مهم‌ترین اخبارِ بازار</span>
        <button onClick={() => setOnlyRelevant((v) => !v)}
          className="px-2 h-[26px] rounded-md text-[10px] transition-colors"
          style={{ background: onlyRelevant ? TH.accent : TH.chipBg, color: onlyRelevant ? '#fff' : TH.text }} dir="rtl"
          onMouseEnter={(e) => { if (!onlyRelevant) e.currentTarget.style.background = TH.chipBgHover; }}
          onMouseLeave={(e) => { if (!onlyRelevant) e.currentTarget.style.background = TH.chipBg; }}>
          مرتبط با <span dir="ltr">{symbol}</span>
        </button>
      </div>

      <div className="overflow-auto">
        {items === null && <div className="px-3 py-8 text-center opacity-40 text-[11px]">در حالِ دریافتِ اخبار…</div>}
        {items !== null && shown.length === 0 && (
          <div className="px-3 py-8 text-center opacity-40 text-[11px]">
            {onlyRelevant ? `خبرِ مرتبط با ${symbol} یافت نشد.` : 'فعلاً خبری نیست.'}
          </div>
        )}
        {shown.map((a, i) => (
          <button key={i} onClick={() => a.url && window.open(a.url, '_blank', 'noopener,noreferrer')}
            className="block w-full text-right px-3 py-2 border-b transition-colors"
            style={{ borderColor: TH.border }}
            onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <div className="flex items-start gap-1.5">
              <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: impactColor(a.impact || 0) }} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] leading-5" style={{ color: TH.textStrong }}>{a.title}</div>
                {a.summary && <div className="text-[10px] leading-5 mt-0.5 opacity-70">{a.summary}</div>}
                <div className="flex items-center gap-1.5 mt-1 text-[9px] opacity-50" dir="ltr">
                  <span>{a.source}</span><span>·</span><span dir="rtl">{relTime(a.ts)}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
