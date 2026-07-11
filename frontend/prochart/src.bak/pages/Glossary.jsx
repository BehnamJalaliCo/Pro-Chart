import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { BookA, Search, Layers, List, Shuffle, RotateCw, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton } from '../components/Guide';

const MASTERY_KEY = 'cp_academy_glossary_mastery';
const loadMastery = () => {
  try { return JSON.parse(localStorage.getItem(MASTERY_KEY) || '{}'); } catch { return {}; }
};

export default function Glossary() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [mode, setMode] = useState('list'); // 'list' | 'cards'
  const { data, isLoading } = useQuery({ queryKey: ['glossary'], queryFn: () => api.glossary(), staleTime: 3600e3 });

  const all = data?.terms || [];
  const cats = useMemo(() => [...new Set(all.map((t) => t.cat).filter(Boolean))], [all]);
  const terms = all.filter((t) =>
    (!cat || t.cat === cat) &&
    (!q || t.term.toLowerCase().includes(q.toLowerCase()) || t.def.includes(q)));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <BookA className="text-brand-green" />
        <h1 className="text-xl font-black">واژه‌نامهٔ معامله‌گری</h1>
        <span className="text-xs text-text-muted">({all.length} اصطلاح)</span>
        <GuideButton guideKey="glossary" auto className="ms-auto" />
        <div className="flex items-center gap-1 bg-surface-card border border-surface-border rounded-xl p-1">
          <button onClick={() => setMode('list')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs ${mode === 'list' ? 'bg-brand-green/15 text-brand-green' : 'text-text-secondary'}`}>
            <List size={14} /> فهرست
          </button>
          <button onClick={() => setMode('cards')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs ${mode === 'cards' ? 'bg-brand-green/15 text-brand-green' : 'text-text-secondary'}`}>
            <Layers size={14} /> حالتِ فلش‌کارت
          </button>
        </div>
      </div>

      {cats.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setCat('')} className={`px-3 py-1.5 rounded-lg text-xs ${!cat ? 'bg-brand-green/15 text-brand-green' : 'bg-surface-card text-text-secondary border border-surface-border'}`}>همه</button>
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-lg text-xs ${cat === c ? 'bg-brand-green/15 text-brand-green' : 'bg-surface-card text-text-secondary border border-surface-border'}`}>{c}</button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-text-muted text-center py-6 text-sm">در حال بارگذاری…</p>
      ) : mode === 'cards' ? (
        <Flashcards terms={terms} cat={cat} />
      ) : (
        <>
          <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 mb-3">
            <Search size={18} className="text-text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی اصطلاح…"
              className="flex-1 bg-transparent py-3 text-sm focus:outline-none" />
          </div>
          {terms.length === 0 ? (
            <p className="text-text-muted text-center py-6 text-sm">{all.length ? 'موردی یافت نشد.' : 'واژه‌نامه به‌زودی آماده می‌شود.'}</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {terms.map((t, i) => (
                <div key={i} className="card p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-brand-green">{t.term}</span>
                    {t.cat && <span className="text-[10px] text-text-muted bg-surface-elevated rounded px-1.5 py-0.5">{t.cat}</span>}
                  </div>
                  <div className="text-xs text-text-secondary leading-6">{t.def}</div>
                </div>
              ))}
            </div>
          )}
          {terms.length > 0 && <p className="text-xs text-text-muted text-center mt-4">{terms.length} اصطلاح</p>}
        </>
      )}
    </div>
  );
}

const termKey = (t) => (t.term || '') + '|' + (t.cat || '');

function Flashcards({ terms, cat }) {
  const [mastery, setMastery] = useState(loadMastery);
  const [filter, setFilter] = useState('all'); // 'all' | 'review' | 'known'
  const [order, setOrder] = useState([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // فهرستِ نهایی پس از فیلترِ تسلط
  const deck = useMemo(() => {
    return terms.filter((t) => {
      const m = mastery[termKey(t)];
      if (filter === 'known') return m === 'known';
      if (filter === 'review') return m === 'review' || !m;
      return true;
    });
  }, [terms, mastery, filter]);

  // ساختِ ترتیب وقتی محتوای دسته عوض می‌شود
  useEffect(() => {
    setOrder(deck.map((_, i) => i));
    setPos(0);
    setFlipped(false);
  }, [deck.length, cat, filter]);

  const persist = (next) => { setMastery(next); try { localStorage.setItem(MASTERY_KEY, JSON.stringify(next)); } catch {} };

  const total = order.length;
  const card = total ? deck[order[Math.min(pos, total - 1)]] : null;

  const go = (d) => { setFlipped(false); setPos((p) => (total ? (p + d + total) % total : 0)); };
  const shuffle = () => {
    const a = deck.map((_, i) => i);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    setOrder(a); setPos(0); setFlipped(false);
  };
  const mark = (state) => {
    if (!card) return;
    const next = { ...mastery, [termKey(card)]: state };
    persist(next);
    go(1);
  };

  const knownCount = terms.filter((t) => mastery[termKey(t)] === 'known').length;
  const reviewCount = terms.filter((t) => mastery[termKey(t)] === 'review').length;

  if (!terms.length) {
    return <p className="text-text-muted text-center py-6 text-sm">اصطلاحی برای مرور نیست.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-3 bg-surface-card border border-surface-border rounded-xl p-1 w-fit mx-auto text-xs">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg ${filter === 'all' ? 'bg-brand-green/15 text-brand-green' : 'text-text-secondary'}`}>همه ({terms.length})</button>
        <button onClick={() => setFilter('review')} className={`px-3 py-1.5 rounded-lg ${filter === 'review' ? 'bg-brand-green/15 text-brand-green' : 'text-text-secondary'}`}>نیاز به مرور ({reviewCount})</button>
        <button onClick={() => setFilter('known')} className={`px-3 py-1.5 rounded-lg ${filter === 'known' ? 'bg-brand-green/15 text-brand-green' : 'text-text-secondary'}`}>بلدم ({knownCount})</button>
      </div>

      {total === 0 || !card ? (
        <p className="text-text-muted text-center py-10 text-sm">کارتی در این فیلتر نیست. 👌</p>
      ) : (
        <>
          <div className="flex items-center justify-center gap-2 mb-2 text-xs text-text-muted">
            <span>{pos + 1}/{total}</span>
            <span className="w-px h-3 bg-surface-border" />
            <button onClick={shuffle} className="flex items-center gap-1 text-text-secondary hover:text-brand-green"><Shuffle size={13} /> برزدن</button>
          </div>

          <button
            onClick={() => setFlipped((f) => !f)}
            className="card w-full min-h-[210px] p-6 flex flex-col items-center justify-center text-center select-none cursor-pointer transition active:scale-[0.99]"
          >
            {!flipped ? (
              <>
                <span className="text-[10px] text-text-muted mb-2 flex items-center gap-1"><RotateCw size={11} /> برای دیدنِ معنی بزن</span>
                <span className="font-black text-xl text-brand-green">{card.term}</span>
              </>
            ) : (
              <>
                {card.cat && <span className="text-[10px] text-text-muted bg-surface-elevated rounded px-1.5 py-0.5 mb-3">{card.cat}</span>}
                <span className="text-sm text-text-secondary leading-7">{card.def}</span>
                {mastery[termKey(card)] && (
                  <span className={`mt-3 text-[10px] ${mastery[termKey(card)] === 'known' ? 'text-brand-green' : 'text-brand-red'}`}>
                    {mastery[termKey(card)] === 'known' ? 'وضعیت: بلدم' : 'وضعیت: نیاز به مرور'}
                  </span>
                )}
              </>
            )}
          </button>

          <div className="flex items-center justify-between gap-2 mt-3">
            <button onClick={() => go(-1)} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-surface-border text-text-secondary text-xs">
              <ChevronRight size={15} /> قبلی
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => mark('review')} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-brand-red/40 text-brand-red text-xs">
                <RotateCw size={14} /> نیاز به مرور
              </button>
              <button onClick={() => mark('known')} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-brand-green/40 text-brand-green text-xs">
                <CheckCircle2 size={14} /> بلدم
              </button>
            </div>
            <button onClick={() => go(1)} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-surface-border text-text-secondary text-xs">
              بعدی <ChevronLeft size={15} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
