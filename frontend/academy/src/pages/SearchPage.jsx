import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Lock, PlayCircle, BookOpen, FileText, MessageSquare } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton } from '../components/Guide';

const TABS = [
  { key: 'lessons', label: 'درس‌ها', icon: BookOpen },
  { key: 'glossary', label: 'واژه‌نامه', icon: FileText },
  { key: 'posts', label: 'انجمن', icon: MessageSquare },
];

function postSnippet(content) {
  const t = (content || '').replace(/\s+/g, ' ').trim();
  return t.length > 140 ? t.slice(0, 140) + '…' : t;
}

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);   // {lessons, glossary, posts, counts}
  const [legacy, setLegacy] = useState(null);     // fallback: array of lessons
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('lessons');

  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const boxRef = useRef(null);
  const suggTimer = useRef(null);
  const lastQueried = useRef('');

  // اجرای جستجوی سراسری (با fallback به جستجوی دروس)
  const doSearch = useCallback(async (term) => {
    const query = (term ?? q).trim();
    if (query.length < 2) return;
    lastQueried.current = query;
    setShowSug(false);
    setBusy(true);
    setLegacy(null);
    try {
      const r = await api.searchGlobal(query);
      setResults({
        lessons: r.lessons || [],
        glossary: r.glossary || [],
        posts: r.posts || [],
        counts: r.counts || {
          lessons: (r.lessons || []).length,
          glossary: (r.glossary || []).length,
          posts: (r.posts || []).length,
        },
      });
      // انتخاب اولین تبِ دارای نتیجه
      const c = r.counts || {};
      const firstWith = TABS.find((t) => (c[t.key] ?? 0) > 0);
      if (firstWith) setTab(firstWith.key);
    } catch {
      // fallback: جستجوی قدیمیِ دروس
      try {
        const lr = await api.search(query);
        setResults(null);
        setLegacy(lr.results || []);
      } catch {
        setResults(null);
        setLegacy([]);
      }
    } finally {
      setBusy(false);
    }
  }, [q]);

  const onSubmit = (e) => {
    e?.preventDefault();
    doSearch();
  };

  // پیشنهادها (debounced)
  useEffect(() => {
    const prefix = q.trim();
    if (suggTimer.current) clearTimeout(suggTimer.current);
    if (prefix.length < 2 || prefix === lastQueried.current) {
      setSuggestions([]);
      return;
    }
    suggTimer.current = setTimeout(async () => {
      try {
        const r = await api.searchSuggest(prefix);
        setSuggestions((r.items || []).slice(0, 8));
        setShowSug(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => suggTimer.current && clearTimeout(suggTimer.current);
  }, [q]);

  // بستنِ دراپ‌داون با کلیک بیرون
  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShowSug(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pickSuggestion = (s) => {
    setQ(s);
    setSuggestions([]);
    doSearch(s);
  };

  const counts = results?.counts || {};
  const activeTab = TABS.find((t) => t.key === tab) || TABS[0];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Search className="text-brand-green" />
        <h1 className="text-xl font-black">جستجوی سراسری</h1>
        <GuideButton guideKey="search" auto className="ms-auto" />
      </div>

      <form onSubmit={onSubmit} className="mb-5">
        <div ref={boxRef} className="relative">
          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 flex-1">
              <Search size={18} className="text-text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => suggestions.length && setShowSug(true)}
                autoFocus
                placeholder="درس، واژه‌نامه یا گفت‌وگوهای انجمن… مثلاً: حد ضرر، کندل، ریسک"
                className="flex-1 bg-transparent py-3 text-sm focus:outline-none"
              />
            </div>
            <button type="submit" disabled={busy} className="btn-success px-5 disabled:opacity-50">جستجو</button>
          </div>

          {showSug && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-surface-card border border-surface-border rounded-xl shadow-lg overflow-hidden">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickSuggestion(s)}
                  className="w-full text-right flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-brand-green/10 transition-colors"
                >
                  <Search size={14} className="text-text-muted shrink-0" />
                  <span className="flex-1 truncate">{s}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </form>

      {busy && <p className="text-text-muted text-center text-sm py-4">در حال جستجو…</p>}

      {/* نتایجِ جستجوی سراسری */}
      {!busy && results && (
        <>
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const n = counts[t.key] ?? 0;
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm whitespace-nowrap border transition-colors ${
                    active
                      ? 'bg-brand-green/15 border-brand-green/50 text-brand-green font-bold'
                      : 'bg-surface-card border-surface-border text-text-muted hover:text-text-base'
                  }`}
                >
                  <Icon size={15} />
                  <span>{t.label}</span>
                  <span className={`text-xs px-1.5 rounded-full ${active ? 'bg-brand-green/20' : 'bg-surface-border/60'}`}>{n}</span>
                </button>
              );
            })}
          </div>

          {/* درس‌ها */}
          {tab === 'lessons' && (
            (results.lessons.length === 0)
              ? <p className="text-text-muted text-center text-sm py-6">درسی یافت نشد.</p>
              : <div className="space-y-2">
                  {results.lessons.map((r) => (
                    r.locked ? (
                      <Link key={r.slug} to="/subscribe" className="card p-3 flex items-center gap-3 opacity-70">
                        <Lock size={16} className="text-text-muted shrink-0" />
                        <span className="text-sm flex-1">{r.title}</span>
                        <span className="text-xs text-text-muted">{r.level}</span>
                      </Link>
                    ) : (
                      <Link key={r.slug} to={`/lesson/${r.slug}`} className="card p-3 flex items-center gap-3 hover:ring-1 hover:ring-brand-green/50">
                        <PlayCircle size={16} className="text-brand-blue shrink-0" />
                        <span className="text-sm flex-1">{r.title}</span>
                        <span className="text-xs text-text-muted">{r.level}</span>
                      </Link>
                    )
                  ))}
                </div>
          )}

          {/* واژه‌نامه */}
          {tab === 'glossary' && (
            (results.glossary.length === 0)
              ? <p className="text-text-muted text-center text-sm py-6">واژه‌ای یافت نشد.</p>
              : <div className="space-y-2">
                  {results.glossary.map((g, i) => (
                    <div key={i} className="card p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText size={16} className="text-brand-green shrink-0" />
                        <span className="text-sm font-bold flex-1">{g.term}</span>
                        {g.cat && <span className="text-xs text-text-muted bg-surface-border/50 px-2 py-0.5 rounded-full">{g.cat}</span>}
                      </div>
                      {g.def && <p className="text-sm text-text-muted leading-6">{g.def}</p>}
                    </div>
                  ))}
                </div>
          )}

          {/* انجمن */}
          {tab === 'posts' && (
            (results.posts.length === 0)
              ? <p className="text-text-muted text-center text-sm py-6">گفت‌وگویی یافت نشد.</p>
              : <div className="space-y-2">
                  {results.posts.map((p) => (
                    <Link key={p.id} to={`/community?post=${p.id}`} className="card p-3 flex items-start gap-3 hover:ring-1 hover:ring-brand-green/50">
                      <MessageSquare size={16} className="text-brand-blue shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-6">{postSnippet(p.content)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {p.category && <span className="text-xs text-text-muted bg-surface-border/50 px-2 py-0.5 rounded-full">{p.category}</span>}
                          {p.created_at && <span className="text-xs text-text-muted">{new Date(p.created_at).toLocaleDateString('fa-IR')}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
          )}
        </>
      )}

      {/* fallback: جستجوی قدیمیِ دروس */}
      {!busy && legacy && (
        legacy.length === 0
          ? <p className="text-text-muted text-center text-sm py-6">نتیجه‌ای یافت نشد.</p>
          : <div className="space-y-2">
              {legacy.map((r) => (
                r.locked ? (
                  <Link key={r.slug} to="/subscribe" className="card p-3 flex items-center gap-3 opacity-70">
                    <Lock size={16} className="text-text-muted shrink-0" />
                    <span className="text-sm flex-1">{r.title}</span>
                    <span className="text-xs text-text-muted">{r.level}</span>
                  </Link>
                ) : (
                  <Link key={r.slug} to={`/lesson/${r.slug}`} className="card p-3 flex items-center gap-3 hover:ring-1 hover:ring-brand-green/50">
                    <PlayCircle size={16} className="text-brand-blue shrink-0" />
                    <span className="text-sm flex-1">{r.title}</span>
                    <span className="text-xs text-text-muted">{r.level}</span>
                  </Link>
                )
              ))}
            </div>
      )}

      {/* وضعیتِ خالی */}
      {!busy && !results && !legacy && (
        <div className="text-center py-12 text-text-muted">
          <Search size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">در میان درس‌ها، واژه‌نامه و انجمن جستجو کنید.</p>
          <p className="text-xs mt-1 opacity-70">حداقل ۲ نویسه وارد کنید.</p>
        </div>
      )}
    </div>
  );
}
